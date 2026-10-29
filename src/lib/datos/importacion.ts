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
  // Las cuotas de préstamos ya no se importan: las genera el módulo de Cooperativa al abrir el periodo.
  if (c.includes('antic b1') || c === 'anticipos') return 'B1|511';
  return '';
}

export type SaldoAlbor = { codigo: string; nombre: string; saldo: number };
export interface Hoja { nombre: string; filaCabecera: number; columnas: string[]; colCodigo: number; filas: (string | number | null)[][]; cubo?: SaldoAlbor[] }

/**
 * Reconoce el "cubo" de Albor con los saldos de Cuenta Corriente Personal al cierre del mes:
 * una fila de títulos con "Codigo Personal" y "Saldo …", seguida de una fila por trabajador.
 */
function leerCubo(filas: (string | number | null)[][]): SaldoAlbor[] | undefined {
  const esCod = (c: string) => /^c[oó]digo personal$/i.test(c);
  const esNom = (c: string) => /^personal\b/i.test(c);
  const fc = filas.findIndex((f) => f.some((c) => typeof c === 'string' && (esCod(c.trim()) || esNom(c.trim()))) && f.some((c) => typeof c === 'string' && /saldo/i.test(c)));
  if (fc < 0) return undefined;
  const t = filas[fc].map((c) => String(c ?? '').trim());
  const cCod = t.findIndex(esCod), cNom = t.findIndex(esNom), cSal = t.findIndex((c) => /saldo/i.test(c));
  const out: SaldoAlbor[] = [];
  for (const f of filas.slice(fc + 1)) {
    if (f.some((c) => typeof c === 'string' && /^total\b|total$/i.test(c.trim()))) break;
    const cod = cCod >= 0 ? String(f[cCod] ?? '').trim() : '';
    const nom = cNom >= 0 ? String(f[cNom] ?? '').trim() : '';
    if ((!cod && !nom) || typeof f[cSal] !== 'number') continue;
    out.push({ codigo: cod.toUpperCase(), nombre: nom, saldo: Math.round(Number(f[cSal]) * 100) / 100 });
  }
  return out.length ? out : undefined;
}

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
    return { nombre: ws.name, filaCabecera: fc, columnas, colCodigo, cubo: leerCubo(filas),
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

// ---------------------------------------------------------------------------
// Saldos de cuenta corriente (cubo de Albor) → anticipos B2 y descuento en B1
// ---------------------------------------------------------------------------
const NOTA_CTA = 'Saldo cuenta corriente Albor';
const norm = (x: unknown) => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/gi, '').toUpperCase();
const r2 = (x: number) => Math.round(x * 100) / 100;

export type FilaSaldo = {
  codigo: string; nombre: string; vinculo_id: number; vinculo_b1: number | null; saldo: number | null; neto: number;
  anticipo: number; pagar: number; descuentoB1: number; nota?: string; corregido?: string;
};

/**
 * Regla (confirmada por RRHH):
 *  - Saldo negativo en Albor = lo que le queda en su cuenta corriente → se le paga en la B2; anticipos del mes = neto B2 − ese saldo.
 *  - Saldo positivo = gastó más de lo que tenía → anticipos B2 = todo su neto (saldo B2 = 0) y el exceso se descuenta en la B1.
 * "Neto B2" = ingresos menos préstamos y cooperativa del mes, calculado por el sistema antes de anticipos.
 */
export async function previsualizarSaldos(periodoId: number, saldos: SaldoAlbor[]) {
  const trab = await sql<{ codigo: string; nombre: string; vinculo_id: number; trabajador_id: number; neto: number }[]>`
    select t.codigo, concat_ws(' ', t.ap_paterno, t.ap_materno, t.nombres) nombre, pt.vinculo_id, t.id trabajador_id,
           pt.liquido + coalesce((select sum(l.monto) from planilla_linea l join concepto c on c.id = l.concepto_id
                                  where l.planilla_trabajador_id = pt.id and c.codigo = 511), 0) neto
    from planilla_trabajador pt join vinculo v on v.id = pt.vinculo_id join trabajador t on t.id = v.trabajador_id
    where pt.periodo_id = ${periodoId} and pt.planilla = 'B2' order by nombre`;
  if (!trab.length) throw new Error('Primero calcule la B2 del periodo (paso 2).');
  const b1 = await sql<{ trabajador_id: number; vinculo_id: number }[]>`
    select v.trabajador_id, v.id vinculo_id from vinculo v join periodo p on p.id = ${periodoId}
    where v.en_b1 and v.fecha_ingreso <= p.fecha_fin and (v.fecha_retiro is null or v.fecha_retiro >= p.fecha_inicio)`;
  const porCod = new Map(saldos.map((x) => [x.codigo, x]));
  const porNom = new Map(saldos.map((x) => [norm(x.nombre), x]));
  const usados = new Set<string>();
  const filas: FilaSaldo[] = trab.map((t) => {
    let s = porCod.get(t.codigo.toUpperCase());
    let corregido: string | undefined;
    if (!s) { s = porNom.get(norm(t.nombre)); if (s) corregido = `${s.codigo} → ${t.codigo}`; }
    if (s) usados.add(s.codigo);
    const neto = Number(t.neto);
    const vb1 = b1.find((x) => x.trabajador_id === t.trabajador_id)?.vinculo_id ?? null;
    if (!s) return { codigo: t.codigo, nombre: t.nombre, vinculo_id: t.vinculo_id, vinculo_b1: vb1, saldo: null, neto, anticipo: 0, pagar: neto, descuentoB1: 0,
      nota: 'No figura en el archivo de Albor: se le paga todo su neto B2' };
    const pagarAlbor = Math.max(0, -s.saldo), descuentoB1 = Math.max(0, s.saldo);
    let anticipo = r2(neto - pagarAlbor), nota: string | undefined;
    if (anticipo < 0) { nota = `El saldo de Albor (${pagarAlbor}) es mayor a su neto del mes: arrastra saldo de meses anteriores`; anticipo = 0; }
    if (descuentoB1 && !vb1) nota = 'Gastó más que su cuenta corriente pero no está en B1: el descuento queda pendiente';
    return { codigo: t.codigo, nombre: t.nombre, vinculo_id: t.vinculo_id, vinculo_b1: vb1, saldo: s.saldo, neto, anticipo, pagar: r2(neto - anticipo), descuentoB1, nota, corregido };
  });
  const sobrantes = saldos.filter((x) => !usados.has(x.codigo) && x.saldo !== 0);
  return { filas, sobrantes };
}

export async function aplicarSaldos(periodoId: number, importacionId: number, saldos: SaldoAlbor[]) {
  const { filas, sobrantes } = await previsualizarSaldos(periodoId, saldos);
  const [c511b2] = await sql<{ id: number }[]>`select id from concepto where planilla = 'B2' and codigo = 511`;
  const [c511b1] = await sql<{ id: number }[]>`select id from concepto where planilla = 'B1' and codigo = 511`;
  const nuevas = [
    ...filas.filter((f) => f.anticipo > 0).map((f) => ({ periodo_id: periodoId, vinculo_id: f.vinculo_id, concepto_id: c511b2.id, monto: f.anticipo, origen: 'ALBOR', importacion_id: importacionId, nota: NOTA_CTA })),
    ...filas.filter((f) => f.descuentoB1 > 0 && f.vinculo_b1).map((f) => ({ periodo_id: periodoId, vinculo_id: f.vinculo_b1!, concepto_id: c511b1.id, monto: f.descuentoB1, origen: 'ALBOR', importacion_id: importacionId, nota: NOTA_CTA })),
  ];
  await sql.begin(async (tx) => {
    await tx`delete from novedad where periodo_id = ${periodoId} and concepto_id in ${tx([c511b2.id, c511b1.id])} and (nota = ${NOTA_CTA} or (origen = 'ALBOR' and concepto_id = ${c511b2.id}))`;
    if (nuevas.length) await tx`insert into novedad ${tx(nuevas, 'periodo_id', 'vinculo_id', 'concepto_id', 'monto', 'origen', 'importacion_id', 'nota')}`;
    await tx`update importacion set filas_ok = ${nuevas.length}, filas_error = ${sobrantes.length},
             log = log || ${tx.json(JSON.parse(JSON.stringify({ aplicado: { tipo: 'SALDOS_CTA_CTE', sobrantes } })))} where id = ${importacionId}`;
  });
  return { anticipos: filas.filter((f) => f.anticipo > 0).length, descuentosB1: filas.filter((f) => f.descuentoB1 > 0 && f.vinculo_b1).length, filas, sobrantes };
}

/**
 * Recalcula la B2 manteniendo los saldos de cuenta corriente de Albor ya importados en el periodo:
 * si cambió algo (préstamos, bonos, faltas), los anticipos se vuelven a sacar para que el saldo a pagar siga igual al de Albor.
 */
export async function recalcularB2(periodoId: number, calcular: (pl: Planilla) => Promise<{ calculados: number; avisos: string[] }>): Promise<{ calculados: number; avisos: string[]; saldos: boolean; b1?: string }> {
  const r = await calcular('B2');
  const [imp] = await sql<{ id: number; log: { hojas: Hoja[]; aplicado?: { tipo?: string } } }[]>`
    select id, log from importacion where periodo_id = ${periodoId} and log -> 'aplicado' ->> 'tipo' = 'SALDOS_CTA_CTE' order by id desc limit 1`;
  const saldos = imp?.log.hojas.find((h) => h.cubo)?.cubo;
  if (!imp || !saldos) return { ...r, saldos: false };
  await aplicarSaldos(periodoId, imp.id, saldos);
  const r2b = await calcular('B2');
  let b1 = '';
  try { const x = await calcular('B1'); b1 = `B1 recalculada (${x.calculados})`; } catch (e) { b1 = `B1 no se recalculó: ${(e as Error).message}`; }
  return { ...r2b, saldos: true, b1 };
}
