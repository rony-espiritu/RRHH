import 'server-only';
import { sql } from '@/lib/db';
import { cargarParametros, obtenerPeriodo, type Planilla } from './planilla';
import { derechoVacaciones } from './personal';

export type LineaImp = { codigo: number; nombre: string; naturaleza: string; cantidad: number | null; base: number | null; tasa: number | null; monto: number };
export type FilaImp = {
  pt_id: number; vinculo_id: number; codigo: string; nombre: string; nombre_coma: string; ci: string; ci_expedido: string | null; nacionalidad: string | null;
  fecha_nacimiento: string | null; sexo: string | null; ocupacion: string | null; fecha_ingreso: string; fecha_retiro: string | null; dias: number; horas_dia: number;
  nua_cua: string | null; nro_asegurado: string | null; empresa: string; empresa_id: number; cc: string | null; cc_desc: string | null;
  total_ganado: number; total_descuentos: number; liquido: number; forma_pago: string | null; nro_cuenta: string | null;
  lineas: LineaImp[]; rciva_siguiente: number | null; saldo_vacaciones: number | null;
};
export type EmpresaImp = { id: number; codigo: string; razon_social: string; nit: string | null; nro_empleador_mintrab: string | null; nro_empleador_caja: string | null;
  direccion: string | null; telefonos: string | null; rep_legal_nombre: string | null; rep_legal_ci: string | null; estancia: string | null; propietario: string | null };

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export async function datosImpresion(periodoId: number, planilla: Planilla) {
  const p = await obtenerPeriodo(periodoId);
  if (!p) throw new Error('Periodo no encontrado');
  const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);
  const fin = iso(p.fecha_fin);
  const prm = await cargarParametros(fin);
  const empresas = [...await sql<EmpresaImp[]>`
    select id, codigo, razon_social, nit, nro_empleador_mintrab, nro_empleador_caja, direccion, telefonos, rep_legal_nombre, rep_legal_ci, estancia, propietario
    from empresa order by codigo`];
  const filas = [...await sql<Omit<FilaImp, 'saldo_vacaciones'>[]>`
    select pt.id pt_id, pt.vinculo_id, t.codigo, trim(concat_ws(' ', t.ap_paterno, t.ap_materno, t.nombres)) nombre,
           concat_ws(', ', nullif(t.ap_paterno, ''), nullif(t.ap_materno, ''), t.nombres) nombre_coma,
           t.ci, t.ci_expedido, coalesce(t.nacionalidad, 'Boliviana') nacionalidad, t.fecha_nacimiento::text, t.sexo, coalesce(pt.cargo_texto, v.ocupacion) ocupacion,
           v.fecha_ingreso::text, v.fecha_retiro::text, pt.dias_pagados dias, coalesce(pt.horas_dia, v.horas_dia, 8) horas_dia, t.nua_cua, t.nro_asegurado,
           e.codigo empresa, e.id empresa_id, cc.codigo cc, cc.descripcion cc_desc, pt.total_ganado, pt.total_descuentos, pt.liquido, pt.forma_pago::text, pt.nro_cuenta,
           coalesce((select json_agg(json_build_object('codigo', l.codigo, 'nombre', c.nombre, 'naturaleza', c.naturaleza, 'cantidad', l.cantidad, 'base', l.base,
                                                       'tasa', l.tasa, 'monto', l.monto) order by c.orden, l.codigo)
                     from planilla_linea l join concepto c on c.id = l.concepto_id where l.planilla_trabajador_id = pt.id), '[]') lineas,
           (select s.saldo_siguiente from rciva_saldo s where s.trabajador_id = t.id and s.periodo_id = pt.periodo_id limit 1) rciva_siguiente
    from planilla_trabajador pt join vinculo v on v.id = pt.vinculo_id join trabajador t on t.id = v.trabajador_id
    join empresa e on e.id = pt.empresa_id left join centro_costo cc on cc.id = pt.centro_costo_id
    where pt.periodo_id = ${periodoId} and pt.planilla = ${planilla}::tipo_planilla
    order by e.codigo, t.ap_paterno, t.ap_materno, t.nombres`];
  // Saldo de vacaciones al cierre del mes (solo B1)
  const vac = planilla === 'B1' ? new Map((await sql<{ vinculo_id: number; dias: number }[]>`
    select vinculo_id, sum(dias) dias from vacacion_mov where vinculo_id in ${sql(filas.map((f) => f.vinculo_id).concat(0))} group by vinculo_id`)
    .map((x) => [x.vinculo_id, Number(x.dias)])) : new Map<number, number>();
  const out: FilaImp[] = filas.map((f) => ({
    ...f,
    lineas: f.lineas.map((l) => ({ ...l, monto: Number(l.monto), cantidad: l.cantidad == null ? null : Number(l.cantidad), base: l.base == null ? null : Number(l.base), tasa: l.tasa == null ? null : Number(l.tasa) })),
    saldo_vacaciones: planilla === 'B1' ? derechoVacaciones(f.fecha_ingreso, fin).total + (vac.get(f.vinculo_id) ?? 0) : null,
  }));
  return { p, prm, fin, empresas, filas: out };
}

export const monto = (f: FilaImp, cod: number) => f.lineas.filter((l) => l.codigo === cod).reduce((s, l) => s + l.monto, 0);
export const cantidad = (f: FilaImp, cod: number) => f.lineas.filter((l) => l.codigo === cod).reduce((s, l) => s + Number(l.cantidad ?? 0), 0);

/** Número en letras (Bolivia): 2957.39 → "dos mil novecientos cincuenta y siete 39/100". */
export function enLetras(n: number) {
  const U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
    'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis',
    'veintisiete', 'veintiocho', 'veintinueve'];
  const D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  const menor1000 = (x: number): string => {
    if (x === 0) return '';
    if (x === 100) return 'cien';
    const c = Math.floor(x / 100), r = x % 100;
    const dec = r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' y ' + U[r % 10] : '');
    return [C[c], dec].filter(Boolean).join(' ');
  };
  const entero = Math.floor(Math.abs(n) + 1e-9), cent = Math.round((Math.abs(n) - entero) * 100);
  const millones = Math.floor(entero / 1e6), miles = Math.floor((entero % 1e6) / 1000), resto = entero % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? 'un millón' : menor1000(millones).replace(/uno$/, 'un') + ' millones');
  if (miles) partes.push(miles === 1 ? 'mil' : menor1000(miles).replace(/uno$/, 'un') + ' mil');
  if (resto) partes.push(menor1000(resto));
  return `${partes.join(' ') || 'cero'} ${String(cent).padStart(2, '0')}/100`;
}
