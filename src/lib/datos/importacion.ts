import 'server-only';
import ExcelJS from 'exceljs';
import { sql } from '@/lib/db';
import type { Planilla } from './planilla';

/** Destinos posibles de una columna del Excel de Albor: planilla + código de concepto. */
export const DESTINOS: { valor: string; texto: string }[] = [
  { valor: '', texto: '— no importar —' },
  { valor: 'B1|511', texto: 'B1 · Anticipos' },
  { valor: 'B1|508', texto: 'B1 · Préstamo interno' },
  { valor: 'B1|506', texto: 'B1 · Amort. préstamo cooperativa' },
  { valor: 'B1|507', texto: 'B1 · Interés préstamo cooperativa' },
  { valor: 'B2|511', texto: 'B2 · Cuenta corriente (anticipos)' },
  { valor: 'B2|508', texto: 'B2 · Préstamo interno' },
  { valor: 'B2|506', texto: 'B2 · Amort. préstamo cooperativa' },
  { valor: 'B2|507', texto: 'B2 · Interés préstamo cooperativa' },
  { valor: 'B2|12', texto: 'B2 · Bono apoyo alimentación (ingreso)' },
  { valor: 'B2|13', texto: 'B2 · Bono carne (ingreso)' },
  { valor: 'B2|14', texto: 'B2 · Bono carne SCZ (ingreso)' },
  { valor: 'B2|11', texto: 'B2 · Gratificación puestero (ingreso)' },
  { valor: 'B2|25', texto: 'B2 · Bono rendimiento (ingreso)' },
];

/** Reconocimiento automático por nombre de columna (formato actual del Excel de Albor). */
function sugerir(col: string): string {
  const c = col.toLowerCase();
  if (c.includes('antic b2')) return 'B2|511';
  if (c.includes('amortización préstamo interno') || c.includes('amortizacion prestamo interno')) return 'B2|508';
  if (c.includes('amortización préstamo coop') || c.includes('amortizacion prestamo coop')) return 'B2|506';
  if (c.includes('interés préstamo coop') || c.includes('interes prestamo coop')) return 'B2|507';
  if (c.includes('antic b1') || c === 'anticipos') return 'B1|511';
  return '';
}

export interface Hoja { nombre: string; filaCabecera: number; columnas: string[]; colCodigo: number; filas: (string | number | null)[][] }

/** Valor plano de una celda de exceljs (fórmulas → resultado, textos enriquecidos → texto). */
function plano(v: ExcelJS.CellValue): string | number | null {
  if (v == null) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v) return plano((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('');
    if ('text' in v) return String((v as ExcelJS.CellHyperlinkValue).text);
  }
  return null;
}

/** Lee el Excel (.xlsx) y detecta, en cada hoja, la fila de cabecera (la que contiene "Codigo"). */
export async function leerExcel(buf: ArrayBuffer): Promise<Hoja[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb.worksheets.map((ws) => {
    const filas: (string | number | null)[][] = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      const vals = row.values as ExcelJS.CellValue[];
      filas.push(Array.from(vals.slice(1), (v) => plano(v)));
    });
    let fc = filas.findIndex((f) => f.some((c) => typeof c === 'string' && /c[oó]digo/i.test(c)));
    if (fc < 0) fc = 0;
    const ancho = Math.max(...filas.map((f) => f.length));
    const columnas = Array.from({ length: ancho }, (_, i) => filas[fc]?.[i] ?? null).map((c, i) => (c == null || c === '' ? `Columna ${i + 1}` : String(c).trim()));
    const colCodigo = Math.max(0, columnas.findIndex((c) => /c[oó]digo/i.test(c)));
    return { nombre: ws.name, filaCabecera: fc, columnas, colCodigo,
      filas: filas.slice(fc + 1).filter((f) => f[colCodigo] != null && String(f[colCodigo]).trim() !== '') };
  });
}

export async function registrarImportacion(periodoId: number, archivo: string, hojas: Hoja[]) {
  const [r] = await sql<{ id: number }[]>`
    insert into importacion (periodo_id, tipo, archivo_nombre, log)
    values (${periodoId}, 'ALBOR_CTA_CTE', ${archivo}, ${sql.json(JSON.parse(JSON.stringify({ hojas })))})
    returning id`;
  return r.id;
}

export async function obtenerImportacion(id: number) {
  const [r] = await sql<{ id: number; periodo_id: number; archivo_nombre: string; filas_ok: number | null; log: { hojas: Hoja[]; aplicado?: unknown } }[]>`
    select id, periodo_id, archivo_nombre, filas_ok, log from importacion where id = ${id}`;
  return r ?? null;
}

export function sugerencias(h: Hoja) {
  return h.columnas.map((c) => sugerir(String(c ?? '')));
}

/**
 * Aplica la importación: por cada columna mapeada crea novedades ALBOR (monto positivo = descuento).
 * Reemplaza las novedades ALBOR anteriores de los mismos conceptos en el periodo.
 */
export async function aplicarImportacion(id: number, hojaNombre: string, mapeo: Record<number, string>) {
  const imp = await obtenerImportacion(id);
  if (!imp) throw new Error('Importación no encontrada');
  const h = imp.log.hojas.find((x) => x.nombre === hojaNombre)!;
  const destinos = Object.entries(mapeo).filter(([, d]) => d).map(([col, d]) => {
    const [pl, cod] = d.split('|');
    return { col: Number(col), planilla: pl as Planilla, codigo: Number(cod) };
  });
  const vinculos = await sql<{ codigo: string; vinculo_id: number; nombre: string }[]>`
    select t.codigo, v.id vinculo_id, concat_ws(' ', t.ap_paterno, t.ap_materno, t.nombres) nombre from vinculo v join trabajador t on t.id = v.trabajador_id
    join periodo p on p.id = ${imp.periodo_id}
    where v.fecha_ingreso <= p.fecha_fin and (v.fecha_retiro is null or v.fecha_retiro >= p.fecha_inicio)`;
  const porCodigo = new Map(vinculos.map((v) => [v.codigo.toUpperCase(), v.vinculo_id]));
  // Respaldo por nombre, para códigos mal escritos en Albor (p.ej. TD1001 en lugar de TD0110)
  const norm = (x: unknown) => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/gi, '').toUpperCase();
  const porNombre = new Map(vinculos.map((v) => [norm(v.nombre), v.vinculo_id]));
  const colNombre = h.columnas.findIndex((c) => /^(personal|nombre)/i.test(c.trim()));
  const corregidos: string[] = [];
  const conceptos = await sql<{ id: number; planilla: string; codigo: number }[]>`select id, planilla::text, codigo from concepto`;
  const cid = (pl: string, cod: number) => conceptos.find((c) => c.planilla === pl && c.codigo === cod)?.id;

  const noEncontrados: string[] = [];
  const filas: { periodo_id: number; vinculo_id: number; concepto_id: number; monto: number; origen: string; importacion_id: number }[] = [];
  for (const f of h.filas) {
    const cod = String(f[h.colCodigo]).trim().toUpperCase();
    let v = porCodigo.get(cod);
    if (!v && colNombre >= 0) {
      v = porNombre.get(norm(f[colNombre]));
      if (v) corregidos.push(`${cod} → ${vinculos.find((x) => x.vinculo_id === v)!.codigo}`);
    }
    if (!v) { noEncontrados.push(cod); continue; }
    for (const d of destinos) {
      const monto = Math.round(Math.abs(Number(f[d.col] ?? 0)) * 100) / 100;
      if (!monto) continue;
      filas.push({ periodo_id: imp.periodo_id, vinculo_id: v, concepto_id: cid(d.planilla, d.codigo)!, monto, origen: 'ALBOR', importacion_id: id });
    }
  }
  await sql.begin(async (tx) => {
    const ids = [...new Set(destinos.map((d) => cid(d.planilla, d.codigo)!))];
    if (ids.length) await tx`delete from novedad where periodo_id = ${imp.periodo_id} and origen = 'ALBOR' and concepto_id in ${tx(ids)}`;
    if (filas.length) await tx`insert into novedad ${tx(filas, 'periodo_id', 'vinculo_id', 'concepto_id', 'monto', 'origen', 'importacion_id')}`;
    await tx`update importacion set filas_ok = ${filas.length}, filas_error = ${noEncontrados.length},
             log = log || ${tx.json({ aplicado: { hoja: hojaNombre, mapeo, noEncontrados, corregidos } })} where id = ${id}`;
  });
  return { novedades: filas.length, noEncontrados, corregidos };
}
