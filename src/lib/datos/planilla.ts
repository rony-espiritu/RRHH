import 'server-only';
import { sql } from '@/lib/db';
import { calcularB1, calcularB2, r2 } from '@/lib/motor/calculo';
import type { Linea, Parametros, Periodo } from '@/lib/motor/tipos';

export type Planilla = 'B1' | 'B2';

export interface PeriodoFila {
  id: number; anio: number; mes: number; tipo: string; estado_b1: string; estado_b2: string;
  fecha_inicio: string; fecha_fin: string; campana_albor: string | null;
  ufv_inicio: number | null; ufv_fin: number | null; tc_usd: number | null;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = (m: number) => MESES[m - 1];
const iso = (d: Date | string | null) => (d == null ? null : typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/** Campaña Albor: de julio (CAMPANA_MES_INICIO) a junio. Octubre 2026 → "26/27". */
export function campana(anio: number, mes: number, mesInicio = 7) {
  const a = mes >= mesInicio ? anio : anio - 1;
  return `${String(a % 100).padStart(2, '0')}/${String((a + 1) % 100).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Parámetros vigentes a una fecha
// ---------------------------------------------------------------------------
export async function cargarParametros(fecha: string): Promise<Parametros & { TC_USD: number; CAMPANA_MES_INICIO: number }> {
  const filas = await sql<{ clave: string; valor: number }[]>`
    select distinct on (clave) clave, valor from parametro where vigente_desde <= ${fecha}
    order by clave, vigente_desde desc`;
  const v = Object.fromEntries(filas.map((f) => [f.clave, Number(f.valor)]));
  const tramos = await sql<{ desde: number; porcentaje: number }[]>`
    select desde, porcentaje from tramo_solidario
    where vigente_desde = (select max(vigente_desde) from tramo_solidario where vigente_desde <= ${fecha}) order by desde`;
  const ant = await sql<{ anios_desde: number; porcentaje: number }[]>`
    select anios_desde, porcentaje from tabla_antiguedad where vigente_desde <= ${fecha} order by anios_desde`;
  const falta = ['SMN', 'GESTORA_LAB', 'SOLIDARIO_LAB', 'CAJA_PAT', 'RIESGO_PAT', 'PROVIV_PAT', 'SOLIDARIO_PAT', 'PREV_AGUINALDO', 'PREV_INDEMN', 'RCIVA_TASA', 'RCIVA_MIN_SMN']
    .filter((k) => v[k] === undefined);
  if (falta.length) throw new Error(`Faltan parámetros vigentes: ${falta.join(', ')}`);
  return {
    SMN: v.SMN, GESTORA_LAB: v.GESTORA_LAB, GESTORA_LAB_65: v.GESTORA_LAB_65 ?? v.GESTORA_LAB,
    EDAD_GESTORA_REDUCIDA: v.EDAD_GESTORA_REDUCIDA ?? 200, SOLIDARIO_LAB: v.SOLIDARIO_LAB, CAJA_PAT: v.CAJA_PAT,
    RIESGO_PAT: v.RIESGO_PAT, RIESGO_PAT_65: v.RIESGO_PAT_65 ?? 0, PROVIV_PAT: v.PROVIV_PAT, SOLIDARIO_PAT: v.SOLIDARIO_PAT, PREV_AGUINALDO: v.PREV_AGUINALDO,
    PREV_INDEMN: v.PREV_INDEMN, RCIVA_TASA: v.RCIVA_TASA, RCIVA_MIN_SMN: v.RCIVA_MIN_SMN, RCIVA_COMPUTO_SMN: v.RCIVA_COMPUTO_SMN ?? 2,
    HE_FACTOR_B1: v.HE_FACTOR_B1 ?? 1, HE_FACTOR_B2: v.HE_FACTOR_B2 ?? 1, TC_USD: v.TC_USD ?? 6.96,
    CAMPANA_MES_INICIO: v.CAMPANA_MES_INICIO ?? 7,
    tramosSolidario: tramos.map((t) => ({ desde: Number(t.desde), porcentaje: Number(t.porcentaje) })),
    tablaAntiguedad: ant.map((t) => ({ aniosDesde: t.anios_desde, porcentaje: Number(t.porcentaje) })),
  };
}

// ---------------------------------------------------------------------------
// Periodos
// ---------------------------------------------------------------------------
export async function listarPeriodos() {
  return sql<PeriodoFila[]>`select * from periodo order by anio desc, mes desc, tipo`;
}

export async function obtenerPeriodo(id: number) {
  const [p] = await sql<PeriodoFila[]>`select * from periodo where id = ${id}`;
  return p ?? null;
}

export async function abrirPeriodo(anio: number, mes: number, ufvInicio?: number, ufvFin?: number) {
  const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const fin = iso(new Date(Date.UTC(anio, mes, 0)))!;
  const prm = await cargarParametros(fin);
  const [p] = await sql<{ id: number }[]>`
    insert into periodo (anio, mes, tipo, estado_b1, estado_b2, fecha_inicio, fecha_fin, campana_albor, ufv_inicio, ufv_fin, tc_usd)
    values (${anio}, ${mes}, 'MENSUAL', 'NOVEDADES', 'NOVEDADES', ${inicio}, ${fin}, ${campana(anio, mes, prm.CAMPANA_MES_INICIO)},
            ${ufvInicio ?? null}, ${ufvFin ?? null}, ${prm.TC_USD})
    returning id`;
  return p.id;
}

export async function cambiarEstado(periodoId: number, planilla: Planilla, estado: string, accion: string, comentario?: string, usuarioId?: string) {
  await sql.begin(async (tx) => {
    if (planilla === 'B1') await tx`update periodo set estado_b1 = ${estado}::estado_periodo where id = ${periodoId}`;
    else await tx`update periodo set estado_b2 = ${estado}::estado_periodo where id = ${periodoId}`;
    await tx`insert into aprobacion (periodo_id, planilla, accion, comentario, usuario_id) values (${periodoId}, ${planilla}::tipo_planilla, ${accion}, ${comentario ?? null}, ${usuarioId ?? null})`;
  });
}

// ---------------------------------------------------------------------------
// Personal vigente en el periodo
// ---------------------------------------------------------------------------
export interface VinculoPeriodo {
  vinculo_id: number; trabajador_id: number; codigo: string; nombre: string; ci: string;
  fecha_nacimiento: string | null; fecha_ingreso: string; fecha_retiro: string | null;
  aporta_gestora: boolean; en_b1: boolean; en_b2: boolean;
  empresa_id: number; empresa: string; empresa_b2_id: number; empresa_b2: string;
  cargo: string | null; ocupacion: string | null; centro_costo_id: number | null; centro_costo: string | null;
  forma_pago: string | null; nro_cuenta: string | null;
}

export async function personalDelPeriodo(p: PeriodoFila): Promise<VinculoPeriodo[]> {
  const ini = iso(p.fecha_inicio)!, fin = iso(p.fecha_fin)!;
  const filas = await sql<VinculoPeriodo[]>`
    select v.id vinculo_id, t.id trabajador_id, t.codigo,
           trim(concat_ws(' ', t.ap_paterno, t.ap_materno, t.nombres)) nombre, t.ci,
           t.fecha_nacimiento::text, v.fecha_ingreso::text, v.fecha_retiro::text, t.aporta_gestora, v.en_b1, v.en_b2,
           e.id empresa_id, e.codigo empresa, coalesce(e2.id, e.id) empresa_b2_id, coalesce(e2.codigo, e.codigo) empresa_b2,
           c.descripcion cargo, v.ocupacion,
           (select a.centro_costo_id from asignacion_cc a where a.vinculo_id = v.id and a.vigente_desde <= ${fin}
              and (a.vigente_hasta is null or a.vigente_hasta >= ${ini}) and coalesce(a.planilla, 'B1') = 'B1'
            order by a.porcentaje desc limit 1) centro_costo_id,
           (select cc.codigo from asignacion_cc a join centro_costo cc on cc.id = a.centro_costo_id where a.vinculo_id = v.id
              and a.vigente_desde <= ${fin} and (a.vigente_hasta is null or a.vigente_hasta >= ${ini})
            order by a.porcentaje desc limit 1) centro_costo,
           (select tp.forma::text from trabajador_pago tp where tp.trabajador_id = t.id and tp.vigente_desde <= ${fin}
              and (tp.vigente_hasta is null or tp.vigente_hasta >= ${ini}) order by tp.vigente_desde desc limit 1) forma_pago,
           (select tp.nro_cuenta from trabajador_pago tp where tp.trabajador_id = t.id and tp.vigente_desde <= ${fin}
              and (tp.vigente_hasta is null or tp.vigente_hasta >= ${ini}) order by tp.vigente_desde desc limit 1) nro_cuenta
    from vinculo v
    join trabajador t on t.id = v.trabajador_id
    join empresa e on e.id = v.empresa_id
    left join empresa e2 on e2.id = v.empresa_b2_id
    left join cargo c on c.id = v.cargo_id
    where v.fecha_ingreso <= ${fin} and (v.fecha_retiro is null or v.fecha_retiro >= ${ini})
    order by e.codigo, nombre`;
  return filas;
}

// Fijos vigentes (por vínculo y código de concepto) y novedades del mes
async function fijos(p: PeriodoFila, planilla: Planilla) {
  const ini = iso(p.fecha_inicio)!, fin = iso(p.fecha_fin)!;
  const filas = await sql<{ vinculo_id: number; codigo: number; cantidad: number | null; monto: number | null }[]>`
    select f.vinculo_id, c.codigo, f.cantidad, f.monto from concepto_fijo f join concepto c on c.id = f.concepto_id
    where c.planilla = ${planilla}::tipo_planilla and f.vigente_desde <= ${fin} and (f.vigente_hasta is null or f.vigente_hasta >= ${ini})`;
  const m = new Map<number, Map<number, { cantidad: number | null; monto: number | null }>>();
  for (const f of filas) {
    if (!m.has(f.vinculo_id)) m.set(f.vinculo_id, new Map());
    m.get(f.vinculo_id)!.set(f.codigo, { cantidad: f.cantidad, monto: f.monto });
  }
  return m;
}

export async function novedadesDelPeriodo(periodoId: number, planilla?: Planilla) {
  const filas = await sql<{ id: number; vinculo_id: number; concepto_id: number; codigo: number; planilla: Planilla; nombre: string; modo: string; cantidad: number | null; monto: number | null; origen: string; nota: string | null }[]>`
    select n.id, n.vinculo_id, n.concepto_id, c.codigo, c.planilla::text planilla, c.nombre, c.modo::text modo, n.cantidad, n.monto, n.origen::text origen, n.nota
    from novedad n join concepto c on c.id = n.concepto_id
    where n.periodo_id = ${periodoId} ${planilla ? sql`and c.planilla = ${planilla}::tipo_planilla` : sql``}
    order by n.vinculo_id, c.codigo`;
  return filas;
}

/** Reemplaza las novedades MANUALES de un concepto para un vínculo (cantidad o monto; vacío = borra). */
export async function guardarNovedad(periodoId: number, vinculoId: number, planilla: Planilla, codigo: number,
  valor: { cantidad?: number | null; monto?: number | null }) {
  await sql.begin(async (tx) => {
    const [c] = await tx<{ id: number }[]>`select id from concepto where planilla = ${planilla}::tipo_planilla and codigo = ${codigo}`;
    if (!c) throw new Error(`Concepto ${planilla}-${codigo} no existe`);
    await tx`delete from novedad where periodo_id = ${periodoId} and vinculo_id = ${vinculoId} and concepto_id = ${c.id} and origen = 'MANUAL'`;
    if ((valor.cantidad ?? 0) !== 0 || (valor.monto ?? 0) !== 0) {
      await tx`insert into novedad (periodo_id, vinculo_id, concepto_id, cantidad, monto, origen)
               values (${periodoId}, ${vinculoId}, ${c.id}, ${valor.cantidad ?? null}, ${valor.monto ?? null}, 'MANUAL')`;
    }
  });
}

const DESC_B1 = new Set([506, 507, 508, 509, 511, 512, 516, 521, 570, 600, 601]);
const DESC_B2 = new Set([506, 507, 508, 509, 511, 512, 516, 570, 600, 601]);
const BONOS_FIJOS_B2 = [11, 12, 13, 14, 25];

/** Días pagados: 30 menos faltas, prorrateado si ingresa o se retira dentro del mes. */
function diasPagados(v: VinculoPeriodo, p: PeriodoFila, faltas: number) {
  const ini = iso(p.fecha_inicio)!, fin = iso(p.fecha_fin)!;
  let dias = 30;
  // Ingreso a mitad de mes: se cuentan los días que faltan hasta el 30 (ingreso el 10 → 20 días), como SIDPLAN.
  if (v.fecha_ingreso > ini) dias -= Number(v.fecha_ingreso.slice(8, 10));
  if (v.fecha_retiro && v.fecha_retiro < fin) dias -= 30 - Math.min(30, Number(v.fecha_retiro.slice(8, 10)));
  return Math.max(0, dias - faltas);
}

// ---------------------------------------------------------------------------
// Cálculo y guardado
// ---------------------------------------------------------------------------
export async function calcularPlanilla(periodoId: number, planilla: Planilla) {
  const p = await obtenerPeriodo(periodoId);
  if (!p) throw new Error('Periodo no encontrado');
  const estado = planilla === 'B1' ? p.estado_b1 : p.estado_b2;
  if (['APROBADO', 'CERRADO', 'ANULADO'].includes(estado)) throw new Error(`La planilla ${planilla} está ${estado}`);

  const fin = iso(p.fecha_fin)!;
  const prm = await cargarParametros(fin);
  const periodo: Periodo = { anio: p.anio, mes: p.mes, ufvInicio: p.ufv_inicio ?? undefined, ufvFin: p.ufv_fin ?? undefined, tcUsd: p.tc_usd ?? prm.TC_USD };
  const personal = (await personalDelPeriodo(p)).filter((v) => (planilla === 'B1' ? v.en_b1 : v.en_b2));
  const fx = await fijos(p, planilla);
  const nov = await novedadesDelPeriodo(periodoId, planilla);
  const conceptos = new Map((await sql<{ id: number; codigo: number }[]>`select id, codigo from concepto where planilla = ${planilla}::tipo_planilla`).map((c) => [c.codigo, c.id]));

  // Tasas propias y saldos RC-IVA
  const tasas = await sql<{ trabajador_id: number; parametro_clave: string; valor: number }[]>`
    select distinct on (trabajador_id, parametro_clave) trabajador_id, parametro_clave, valor from tasa_trabajador
    where vigente_desde <= ${fin} and (vigente_hasta is null or vigente_hasta >= ${fin})
    order by trabajador_id, parametro_clave, vigente_desde desc`;
  const saldos = await sql<{ trabajador_id: number; saldo_siguiente: number }[]>`
    select distinct on (s.trabajador_id) s.trabajador_id, s.saldo_siguiente from rciva_saldo s join periodo pp on pp.id = s.periodo_id
    where (pp.anio, pp.mes) < (${p.anio}, ${p.mes}) order by s.trabajador_id, pp.anio desc, pp.mes desc`;
  const f110 = await sql<{ trabajador_id: number; monto: number }[]>`
    select trabajador_id, sum(monto_facturas) monto from rciva_declaracion where periodo_id = ${periodoId} group by 1`;
  const mTasas = new Map<number, Record<string, number>>();
  for (const t of tasas) mTasas.set(t.trabajador_id, { ...(mTasas.get(t.trabajador_id) ?? {}), [t.parametro_clave]: Number(t.valor) });
  const mSaldo = new Map(saldos.map((s) => [s.trabajador_id, Number(s.saldo_siguiente)]));
  const mF110 = new Map(f110.map((s) => [s.trabajador_id, Number(s.monto)]));

  const resultados: { v: VinculoPeriodo; dias: number; tg: number; cot: number; desc: number; liq: number; lineas: (Linea & { concepto_id?: number })[]; rciva?: ReturnType<typeof calcularB1>['rciva'] }[] = [];
  const avisos: string[] = [];

  for (const v of personal) {
    const f = fx.get(v.vinculo_id) ?? new Map();
    const n = nov.filter((x) => x.vinculo_id === v.vinculo_id);
    const sumaCant = (cod: number) => n.filter((x) => x.codigo === cod).reduce((s, x) => s + Number(x.cantidad ?? 0), 0);
    const descuentos: Record<string, number> = {};
    const otrosIngresos: { codigo: number; monto: number; nombre: string }[] = [];
    // B2: si el anticipo (511) se modificó a mano, reemplaza al que salió de los saldos de Albor
    const anticipoManual = planilla === 'B2' && n.some((x) => x.codigo === 511 && x.origen === 'MANUAL');
    for (const x of n) {
      if (anticipoManual && x.codigo === 511 && x.origen !== 'MANUAL') continue;
      if ((planilla === 'B1' ? DESC_B1 : DESC_B2).has(x.codigo)) descuentos[x.codigo] = r2((descuentos[x.codigo] ?? 0) + Number(x.monto ?? 0));
      else if (x.codigo < 500 && x.monto && !(planilla === 'B1' ? [2, 4, 8] : [2, 7]).includes(x.codigo))
        otrosIngresos.push({ codigo: x.codigo, monto: Number(x.monto), nombre: x.nombre });
    }
    const dias = diasPagados(v, p, sumaCant(520));
    const extra = otrosIngresos.map((o) => ({ concepto: o.nombre, codigo: o.codigo, tipo: 'INGRESO' as const, monto: r2(o.monto) }));

    if (planilla === 'B1') {
      const sueldo = Number(f.get(2)?.monto ?? 0);
      if (!sueldo) { avisos.push(`${v.codigo} ${v.nombre}: sin sueldo B1 vigente`); continue; }
      const r = calcularB1(
        { codigo: v.codigo, fechaNacimiento: v.fecha_nacimiento, fechaIngreso: v.fecha_ingreso, sueldo, bonoNivel: Number(f.get(24)?.monto ?? 0),
          aportaGestora: v.aporta_gestora, tasas: mTasas.get(v.trabajador_id) },
        { dias, heHoras: sumaCant(4), otrosBonos: otrosIngresos.reduce((s, o) => s + o.monto, 0), descuentos,
          facturasF110: mF110.get(v.trabajador_id), saldoRcivaAnterior: mSaldo.get(v.trabajador_id) },
        prm, periodo);
      const lineas: Linea[] = [...r.lineas.filter((l) => l.concepto !== 'Otros bonos'), ...extra,
        { concepto: 'Caja CORDES patronal', codigo: 910, tipo: 'APORTE_PATRONAL', base: r.totalGanado, tasa: prm.CAJA_PAT, monto: r.patronal.caja },
        { concepto: 'Pro Vivienda patronal', codigo: 911, tipo: 'APORTE_PATRONAL', base: r.totalGanado, tasa: prm.PROVIV_PAT, monto: r.patronal.proVivienda },
        { concepto: 'SIP patronal (riesgo + solidario)', codigo: 912, tipo: 'APORTE_PATRONAL', base: r.totalGanado, tasa: r.patronal.riesgo ? prm.RIESGO_PAT + prm.SOLIDARIO_PAT : prm.SOLIDARIO_PAT, monto: r2(r.patronal.riesgo + r.patronal.solidario) },
        { concepto: 'Previsión aguinaldo', codigo: 913, tipo: 'PROVISION', base: r.totalGanado, tasa: prm.PREV_AGUINALDO, monto: r.provisiones.aguinaldo },
        { concepto: 'Previsión indemnización', codigo: 914, tipo: 'PROVISION', base: r.totalGanado, tasa: prm.PREV_INDEMN, monto: r.provisiones.indemnizacion }];
      resultados.push({ v, dias, tg: r.totalGanado, cot: r.totalGanado, desc: r.totalDescuentos, liq: r.liquido, lineas, rciva: r.rciva });
    } else {
      const abono = Number(f.get(2)?.monto ?? 0);
      const bonos: Record<string, number> = {};
      for (const c of BONOS_FIJOS_B2) if (f.get(c)?.monto) bonos[c] = Number(f.get(c)!.monto);
      for (const o of otrosIngresos) bonos[o.codigo] = r2((bonos[o.codigo] ?? 0) + o.monto);
      const r = calcularB2({ codigo: v.codigo, abonoMensual: abono },
        { dias, heHoras: sumaCant(7), bonos, descuentos, aporteCoopUsd: Number(f.get(521)?.cantidad ?? 0) }, prm, periodo);
      if (r.saldo < 0) avisos.push(`${v.codigo} ${v.nombre}: saldo B2 negativo (${r.saldo}) — ajustar en Albor y descontar en B1`);
      const nombres = new Map(n.map((x) => [x.codigo, x.nombre]));
      resultados.push({ v, dias, tg: r.totalIngresos, cot: 0, desc: r.totalDescuentos, liq: r.saldo,
        lineas: r.lineas.map((l) => (l.concepto.startsWith('Bono ') && l.codigo && nombres.get(l.codigo) ? { ...l, concepto: nombres.get(l.codigo)! } : l)) });
    }
  }

  await sql.begin(async (tx) => {
    await tx`delete from planilla_trabajador where periodo_id = ${periodoId} and planilla = ${planilla}::tipo_planilla`;
    if (planilla === 'B1') await tx`delete from rciva_saldo where periodo_id = ${periodoId}`;
    for (const r of resultados) {
      const [pt] = await tx<{ id: number }[]>`
        insert into planilla_trabajador (periodo_id, planilla, vinculo_id, empresa_id, centro_costo_id, cargo_texto, dias_pagados, horas_dia,
          total_ganado, total_cotizable, total_descuentos, liquido, forma_pago, nro_cuenta, es_alta, es_baja)
        values (${periodoId}, ${planilla}::tipo_planilla, ${r.v.vinculo_id}, ${planilla === 'B1' ? r.v.empresa_id : r.v.empresa_b2_id}, ${r.v.centro_costo_id},
          ${r.v.ocupacion ?? r.v.cargo}, ${r.dias}, 8, ${r.tg}, ${r.cot}, ${r.desc}, ${r.liq},
          ${planilla === 'B1' ? r.v.forma_pago ?? 'EFECTIVO' : 'EFECTIVO'}::forma_pago, ${planilla === 'B1' ? r.v.nro_cuenta : null},
          ${r.v.fecha_ingreso >= iso(p.fecha_inicio)!}, ${!!r.v.fecha_retiro && r.v.fecha_retiro <= fin})
        returning id`;
      const filas = r.lineas.filter((l) => l.codigo && conceptos.has(l.codigo)).map((l) => ({
        planilla_trabajador_id: pt.id, concepto_id: conceptos.get(l.codigo!)!, codigo: l.codigo!, cantidad: l.cantidad ?? null,
        base: l.base ?? null, tasa: l.tasa ?? null, monto: l.monto, detalle: JSON.stringify({ concepto: l.concepto, formula: l.formula ?? null }),
      }));
      if (filas.length) await tx`insert into planilla_linea ${tx(filas)}`;
      if (r.rciva && (r.rciva.saldoSiguiente || r.rciva.retenido || r.rciva.saldoAnterior)) {
        await tx`insert into rciva_saldo (trabajador_id, periodo_id, saldo_anterior, actualizacion, credito_mes, impuesto_mes, retenido, saldo_siguiente)
                 values (${r.v.trabajador_id}, ${periodoId}, ${r.rciva.saldoAnterior}, ${r.rciva.mantenimiento}, ${r.rciva.creditoF110},
                         ${r.rciva.impuestoNeto}, ${r.rciva.retenido}, ${r.rciva.saldoSiguiente})`;
      }
    }
    if (planilla === 'B1') await tx`update periodo set estado_b1 = 'CALCULADO' where id = ${periodoId}`;
    else await tx`update periodo set estado_b2 = 'CALCULADO' where id = ${periodoId}`;
    await tx`insert into aprobacion (periodo_id, planilla, accion, comentario) values (${periodoId}, ${planilla}::tipo_planilla, 'CALCULAR', ${`${resultados.length} trabajadores`})`;
  });
  return { calculados: resultados.length, avisos };
}

// ---------------------------------------------------------------------------
// Consultas de resultados
// ---------------------------------------------------------------------------
export type ResumenEmpresa = { planilla: Planilla; empresa: string; razon_social: string; trabajadores: number; total_ganado: number; descuentos: number; liquido: number; patronal: number; provisiones: number };
export async function resumenPorEmpresa(periodoId: number): Promise<ResumenEmpresa[]> {
  return [...await sql<{ planilla: Planilla; empresa: string; razon_social: string; trabajadores: number; total_ganado: number; descuentos: number; liquido: number; patronal: number; provisiones: number }[]>`
    select pt.planilla::text planilla, e.codigo empresa, e.razon_social, count(*)::int trabajadores,
           sum(pt.total_ganado) total_ganado, sum(pt.total_descuentos) descuentos, sum(pt.liquido) liquido,
           coalesce(sum((select sum(l.monto) from planilla_linea l where l.planilla_trabajador_id = pt.id and l.codigo in (910, 911, 912))), 0) patronal,
           coalesce(sum((select sum(l.monto) from planilla_linea l where l.planilla_trabajador_id = pt.id and l.codigo in (913, 914))), 0) provisiones
    from planilla_trabajador pt join empresa e on e.id = pt.empresa_id
    where pt.periodo_id = ${periodoId} group by 1, 2, 3 order by 1, 2`];
}

export type FilaPlanilla = { id: number; vinculo_id: number; codigo: string; nombre: string; empresa: string; centro_costo: string | null; lugar: string | null; dias: number; total_ganado: number; total_descuentos: number; liquido: number; forma_pago: string; lineas: { codigo: number; nombre: string; monto: number; cantidad: number | null }[] };
export async function detallePlanilla(periodoId: number, planilla: Planilla): Promise<FilaPlanilla[]> {
  return [...await sql<{ id: number; vinculo_id: number; codigo: string; nombre: string; empresa: string; centro_costo: string | null; lugar: string | null; dias: number; total_ganado: number; total_descuentos: number; liquido: number; forma_pago: string; lineas: { codigo: number; nombre: string; monto: number; cantidad: number | null }[] }[]>`
    select pt.id, pt.vinculo_id, t.codigo, trim(concat_ws(' ', t.ap_paterno, t.ap_materno, t.nombres)) nombre, e.codigo empresa, cc.codigo centro_costo, (select l.codigo || ' · ' || l.nombre from lugar l where l.id = cc.lugar_id) lugar,
           pt.dias_pagados dias, pt.total_ganado, pt.total_descuentos, pt.liquido, pt.forma_pago::text forma_pago,
           coalesce((select json_agg(json_build_object('codigo', l.codigo, 'nombre', c.nombre, 'monto', l.monto, 'cantidad', l.cantidad) order by l.codigo)
                     from planilla_linea l join concepto c on c.id = l.concepto_id where l.planilla_trabajador_id = pt.id), '[]') lineas
    from planilla_trabajador pt join vinculo v on v.id = pt.vinculo_id join trabajador t on t.id = v.trabajador_id
    join empresa e on e.id = pt.empresa_id left join centro_costo cc on cc.id = pt.centro_costo_id
    where pt.periodo_id = ${periodoId} and pt.planilla = ${planilla}::tipo_planilla
    order by e.codigo, nombre`];
}
