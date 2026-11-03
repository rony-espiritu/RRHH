import 'server-only';
import ExcelJS from 'exceljs';
import { sql } from '@/lib/db';

/**
 * Excel "Jornadas extras" aprobado por el Gerente Técnico: una pestaña por mes.
 * De cada fila solo se toma el código y la cantidad de HORAS (columna "Horas"; si no está, jornadas × 8).
 * Se cargan como novedad de horas extra en B1 (concepto 4) y B2 (concepto 7); el sistema calcula el valor.
 */
export type FilaHE = { codigo: string; nombre: string; trabajo: string; horas: number; fechas: string };
export type HojaHE = { nombre: string; mes: string | null; titulo: string; oculta?: boolean; filas: FilaHE[] };

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const texto = (v: ExcelJS.CellValue): string => {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v) return texto((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('');
    if ('text' in v) return String((v as ExcelJS.CellHyperlinkValue).text);
  }
  return String(v);
};
const numero = (v: ExcelJS.CellValue): number => {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'result' in v) return numero((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Mes de la hoja (YYYY-MM): de la fecha en A1 o del título "Correspondiente al mes de SEPTIEMBRE-2026". */
function mesDeHoja(a1: ExcelJS.CellValue, titulo: string): string | null {
  if (a1 instanceof Date) return a1.toISOString().slice(0, 7);
  const m = titulo.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/MES DE\s+([A-Z]+)\W*(\d{2,4})/);
  if (!m) return null;
  const i = MESES.findIndex((x) => m[1].startsWith(x));
  if (i < 0) return null;
  const y = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  return `${y}-${String(i + 1).padStart(2, '0')}`;
}

export async function leerHorasExtras(buf: ArrayBuffer): Promise<HojaHE[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const out: HojaHE[] = [];
  for (const ws of wb.worksheets) {
    let cab = 0, titulo = '';
    ws.eachRow((row, n) => {
      const t = (row.values as ExcelJS.CellValue[]).map(texto);
      if (!titulo && t.some((x) => /correspondiente al mes/i.test(x))) titulo = t.find((x) => /correspondiente al mes/i.test(x))!.trim();
      if (!cab && t.some((x) => /^c[oó]digo$/i.test(x.trim()))) cab = n;
    });
    if (!cab) continue;
    const h = (ws.getRow(cab).values as ExcelJS.CellValue[]).map((x) => texto(x).trim().toLowerCase());
    const col = (re: RegExp) => h.findIndex((x) => re.test(x));
    const cCod = col(/^c[oó]digo$/), cNom = col(/nombre/), cTra = col(/trabajo realizado/), cFec = col(/fechas/);
    const cHoras = col(/^horas$/), cTotJ = col(/^total jorn/), cJor = col(/^jornadas extras trabajadas$/);
    const filas: FilaHE[] = [];
    for (let r = cab + 1; r <= ws.rowCount; r++) {
      const v = ws.getRow(r).values as ExcelJS.CellValue[];
      const codigo = texto(v[cCod]).trim().toUpperCase();
      if (/^TOTAL/.test(codigo)) break;
      if (!/^[A-Z]{2}\d{4}$/.test(codigo)) continue;
      const horas = cHoras > 0 ? numero(v[cHoras]) : (cTotJ > 0 ? numero(v[cTotJ]) : numero(v[cJor])) * 8;
      if (!horas) continue;
      filas.push({ codigo, nombre: texto(v[cNom]).replace(/\s+/g, ' ').trim(), trabajo: cTra > 0 ? texto(v[cTra]).trim() : '',
        horas: Math.round(horas * 100) / 100, fechas: cFec > 0 ? texto(v[cFec]).trim() : '' });
    }
    out.push({ nombre: ws.name, mes: mesDeHoja(ws.getCell('A1').value, titulo), titulo, oculta: ws.state !== 'visible', filas });
  }
  return out;
}

export async function registrarHE(periodoId: number, archivo: string, hojas: HojaHE[]) {
  const [r] = await sql<{ id: number }[]>`insert into importacion (periodo_id, tipo, archivo_nombre, log)
    values (${periodoId}, 'HORAS_EXTRAS', ${archivo}, ${sql.json(JSON.parse(JSON.stringify({ hojasHE: hojas })))}) returning id`;
  return r.id;
}
export async function obtenerHE(id: number) {
  const [r] = await sql<{ id: number; periodo_id: number; archivo_nombre: string; log: { hojasHE: HojaHE[] } }[]>`
    select id, periodo_id, archivo_nombre, log from importacion where id = ${id} and tipo = 'HORAS_EXTRAS'`;
  return r ?? null;
}

export type VistaHE = FilaHE & { vinculo_id: number | null; empresa: string | null; b1: boolean; b2: boolean; aviso: string | null; actualB1: number; actualB2: number };

/** Cruza las filas con los trabajadores del periodo y lo que ya hay cargado de horas extra. */
export async function previsualizarHE(periodoId: number, filas: FilaHE[]): Promise<VistaHE[]> {
  const vs = await sql<{ codigo: string; vinculo_id: number; empresa: string; en_b1: boolean; en_b2: boolean; hb1: string; hb2: string }[]>`
    select t.codigo, v.id vinculo_id, e.codigo empresa, v.en_b1, v.en_b2,
           coalesce((select sum(n.cantidad) from novedad n join concepto c on c.id = n.concepto_id where n.periodo_id = p.id and n.vinculo_id = v.id and c.planilla = 'B1' and c.codigo = 4), 0) hb1,
           coalesce((select sum(n.cantidad) from novedad n join concepto c on c.id = n.concepto_id where n.periodo_id = p.id and n.vinculo_id = v.id and c.planilla = 'B2' and c.codigo = 7), 0) hb2
    from periodo p join vinculo v on v.fecha_ingreso <= p.fecha_fin and (v.fecha_retiro is null or v.fecha_retiro >= p.fecha_inicio)
    join trabajador t on t.id = v.trabajador_id join empresa e on e.id = v.empresa_id
    where p.id = ${periodoId} order by v.fecha_ingreso`;
  const m = new Map(vs.map((v) => [v.codigo, v]));   // si hay dos vínculos en el mes, queda el más reciente
  return filas.map((f) => {
    const v = m.get(f.codigo);
    if (!v) return { ...f, vinculo_id: null, empresa: null, b1: false, b2: false, aviso: 'No está en la planilla de este mes', actualB1: 0, actualB2: 0 };
    const aviso = !v.en_b1 && v.en_b2 ? 'Solo B2 (no está en B1)' : v.en_b1 && !v.en_b2 ? 'Solo B1' : null;
    return { ...f, vinculo_id: v.vinculo_id, empresa: v.empresa, b1: v.en_b1, b2: v.en_b2, aviso, actualB1: Number(v.hb1), actualB2: Number(v.hb2) };
  });
}

/** Reemplaza todas las horas extra del mes (B1 concepto 4 y B2 concepto 7) por las del Excel aprobado. */
export async function aplicarHE(periodoId: number, importacionId: number, hoja: string, usuarioId: string) {
  const imp = await obtenerHE(importacionId);
  const h = imp?.log.hojasHE.find((x) => x.nombre === hoja);
  if (!imp || !h) throw new Error('No se encontró la hoja del Excel');
  const vista = await previsualizarHE(periodoId, h.filas);
  const [c1] = await sql<{ id: number }[]>`select id from concepto where planilla = 'B1' and codigo = 4`;
  const [c2] = await sql<{ id: number }[]>`select id from concepto where planilla = 'B2' and codigo = 7`;
  const filas: { periodo_id: number; vinculo_id: number; concepto_id: number; cantidad: number; origen: string; importacion_id: number; nota: string; creado_por: string }[] = [];
  for (const f of vista) {
    if (!f.vinculo_id) continue;
    const nota = [f.trabajo, f.fechas].filter(Boolean).join(' · ').slice(0, 150);
    if (f.b1) filas.push({ periodo_id: periodoId, vinculo_id: f.vinculo_id, concepto_id: c1.id, cantidad: f.horas, origen: 'SISTEMA', importacion_id: importacionId, nota, creado_por: usuarioId });
    if (f.b2) filas.push({ periodo_id: periodoId, vinculo_id: f.vinculo_id, concepto_id: c2.id, cantidad: f.horas, origen: 'SISTEMA', importacion_id: importacionId, nota, creado_por: usuarioId });
  }
  await sql.begin(async (tx) => {
    await tx`delete from novedad where periodo_id = ${periodoId} and concepto_id in ${tx([c1.id, c2.id])}`;
    if (filas.length) await tx`insert into novedad ${tx(filas, 'periodo_id', 'vinculo_id', 'concepto_id', 'cantidad', 'origen', 'importacion_id', 'nota', 'creado_por')}`;
    await tx`update importacion set filas_ok = ${filas.length}, filas_error = ${vista.filter((f) => !f.vinculo_id).length},
             log = log || ${tx.json({ aplicado: { tipo: 'HORAS_EXTRAS', hoja } })} where id = ${importacionId}`;
  });
  return { trabajadores: vista.filter((f) => f.vinculo_id).length, horas: vista.filter((f) => f.vinculo_id).reduce((s, f) => s + f.horas, 0),
    noEncontrados: vista.filter((f) => !f.vinculo_id).map((f) => `${f.codigo} ${f.nombre}`) };
}
