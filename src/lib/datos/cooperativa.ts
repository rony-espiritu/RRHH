import 'server-only';
import { sql } from '@/lib/db';
import { r2 } from '@/lib/motor/calculo';
import { cambiarFijo } from './personal';
import { obtenerPeriodo, personalDelPeriodo } from './planilla';

/**
 * Cooperativa y préstamos.
 *  - Préstamos: cada periodo se descuenta la cuota de capital (o el saldo, si es menor) y el interés.
 *    Interés tipo S = saldo antes de la cuota × tasa mensual; tipo P = capital original × tasa.
 *    Préstamos en dólares: cuota e interés se convierten con el tipo de cambio del periodo.
 *  - Ahorros: el aporte mensual es el concepto fijo 521 (en $us) de la B2; cada periodo queda un movimiento en la cuenta de ahorro.
 * Todo se genera al abrir el periodo (y se puede regenerar mientras la B2 no esté aprobada).
 */
export type Prestamo = {
  id: number; trabajador_id: number; codigo: string; nombre: string; tipo: string; tipo_nombre: string; descripcion: string | null; fecha: string;
  moneda: 'BS' | 'USD'; capital: number; cuota: number; tasa_mensual: number; tipo_interes: string; planilla: string; estado: string; nota: string | null;
  pagado: number; saldo: number; concepto_amort: number; concepto_int: number;
};

const selPrestamo = () => sql`
  select p.id, p.trabajador_id, t.codigo, concat_ws(' ', t.ap_paterno, t.ap_materno, t.nombres) nombre, p.tipo, pt.nombre tipo_nombre, p.descripcion,
         p.fecha::text, p.moneda, p.capital, p.cuota, p.tasa_mensual, p.tipo_interes, p.planilla::text planilla, p.estado, p.nota,
         coalesce((select sum(x.capital) from prestamo_pago x where x.prestamo_id = p.id), 0) pagado,
         p.capital - coalesce((select sum(x.capital) from prestamo_pago x where x.prestamo_id = p.id), 0) saldo,
         pt.concepto_amort, pt.concepto_int
  from prestamo p join trabajador t on t.id = p.trabajador_id join prestamo_tipo pt on pt.codigo = p.tipo`;

export async function listarPrestamos(estado = 'ACTIVO') {
  return [...await sql<Prestamo[]>`${selPrestamo()} where p.estado = ${estado} order by nombre, p.fecha`];
}

export async function obtenerPrestamo(id: number) {
  const [p] = await sql<Prestamo[]>`${selPrestamo()} where p.id = ${id}`;
  if (!p) return null;
  const pagos = [...await sql<{ id: number; fecha: string; capital: number; interes: number; tipo: string; nota: string | null; periodo_id: number | null }[]>`
    select id, fecha::text, capital, interes, tipo, nota, periodo_id from prestamo_pago where prestamo_id = ${id} order by fecha, id`];
  return { ...p, pagos };
}

export async function tiposPrestamo() {
  return [...await sql<{ codigo: string; nombre: string; concepto_amort: number; concepto_int: number }[]>`select codigo, nombre, concepto_amort, concepto_int from prestamo_tipo order by codigo`];
}

async function auditar(tabla: string, id: string, accion: string, despues: unknown) {
  await sql`insert into auditoria (tabla, registro_id, accion, despues) values (${tabla}, ${id}, ${accion}, ${sql.json(JSON.parse(JSON.stringify(despues ?? null)))})`;
}

export async function crearPrestamo(d: { codigo: string; tipo: string; descripcion: string | null; fecha: string; moneda: string; capital: number; cuota: number;
  tasa_mensual: number; tipo_interes: string; nota: string | null }) {
  if (!(d.capital > 0) || !(d.cuota > 0)) throw new Error('El monto y la cuota deben ser mayores a 0');
  const [t] = await sql<{ id: number }[]>`select id from trabajador where upper(codigo) = upper(${d.codigo})`;
  if (!t) throw new Error(`No existe el trabajador ${d.codigo}`);
  const [p] = await sql<{ id: number }[]>`
    insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
    values (${t.id}, ${d.tipo}, ${d.descripcion}, ${d.fecha}, ${d.moneda}, ${d.capital}, ${d.cuota}, ${d.tasa_mensual}, ${d.tipo_interes}, ${d.nota}) returning id`;
  await auditar('prestamo', String(p.id), 'INSERT', d);
  return p.id;
}

export async function editarPrestamo(id: number, d: { cuota: number; tasa_mensual: number; tipo_interes: string; estado: string; descripcion: string | null; nota: string | null }) {
  await sql`update prestamo set cuota = ${d.cuota}, tasa_mensual = ${d.tasa_mensual}, tipo_interes = ${d.tipo_interes}, estado = ${d.estado},
            descripcion = ${d.descripcion}, nota = ${d.nota} where id = ${id}`;
  await auditar('prestamo', String(id), 'UPDATE', d);
}

/** Pago fuera de planilla (el trabajador paga en caja): baja el saldo del préstamo. */
export async function pagoExterno(id: number, fecha: string, capital: number, interes: number, nota: string | null) {
  await sql`insert into prestamo_pago (prestamo_id, fecha, capital, interes, tipo, nota) values (${id}, ${fecha}, ${capital}, ${interes}, 'EXTERNO', ${nota})`;
  await sql`update prestamo p set estado = 'PAGADO' where id = ${id}
            and p.capital <= (select coalesce(sum(capital), 0) from prestamo_pago where prestamo_id = ${id}) + 0.009`;
  await auditar('prestamo_pago', String(id), 'EXTERNO', { fecha, capital, interes, nota });
}

export async function eliminarPago(pagoId: number) {
  const [x] = await sql<{ prestamo_id: number; tipo: string }[]>`select prestamo_id, tipo from prestamo_pago where id = ${pagoId}`;
  if (!x) return;
  if (x.tipo === 'PLANILLA') throw new Error('Las cuotas de planilla se regeneran desde el periodo; no se borran a mano.');
  await sql`delete from prestamo_pago where id = ${pagoId}`;
  await sql`update prestamo set estado = 'ACTIVO' where id = ${x.prestamo_id} and estado = 'PAGADO'`;
  await auditar('prestamo_pago', String(pagoId), 'DELETE', x);
}

/** Cuota e interés que corresponden a un periodo, según el saldo antes de ese periodo. */
export function cuotaDelPeriodo(p: Pick<Prestamo, 'capital' | 'cuota' | 'tasa_mensual' | 'tipo_interes'>, saldoAntes: number, restoMinimo = 1) {
  let capital = r2(Math.min(Number(p.cuota), saldoAntes));
  // si después de esta cuota queda un resto menor al mínimo (parámetro PRESTAMO_RESTO_MINIMO), se cobra junto con ella
  if (saldoAntes - capital > 0 && saldoAntes - capital < restoMinimo) capital = r2(saldoAntes);
  const base = p.tipo_interes === 'P' ? Number(p.capital) : saldoAntes;
  const interes = (base * Number(p.tasa_mensual)) / 100; // sin redondear: se redondea al convertir a Bs (como SIDPLAN)
  return { capital, interes };
}

/** Parámetro PRESTAMO_RESTO_MINIMO vigente a la fecha (sin parámetro vigente = 0: no se junta el resto). */
export async function restoMinimo(fecha = new Date().toISOString().slice(0, 10)) {
  const [r] = await sql<{ valor: number }[]>`select valor from parametro where clave = 'PRESTAMO_RESTO_MINIMO' and vigente_desde <= ${fecha} order by vigente_desde desc limit 1`;
  return r ? Number(r.valor) : 0;
}

/** Tabla de pagos proyectada desde el saldo actual (para la pantalla del préstamo). */
export function proyeccion(p: Prestamo, desde: string, maxCuotas = 120, restoMinimo = 1) {
  const out: { fecha: string; capital: number; interes: number; saldo: number }[] = [];
  let saldo = Number(p.saldo);
  let [y, m] = desde.split('-').map(Number);
  while (saldo > 0.009 && out.length < maxCuotas) {
    const c = cuotaDelPeriodo(p, saldo, restoMinimo);
    saldo = r2(saldo - c.capital);
    out.push({ fecha: `${y}-${String(m).padStart(2, '0')}-01`, capital: c.capital, interes: r2(c.interes), saldo });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Generación del periodo
// ---------------------------------------------------------------------------
export async function generarCooperativaPeriodo(periodoId: number) {
  const per = await obtenerPeriodo(periodoId);
  if (!per) throw new Error('Periodo no encontrado');
  if (['APROBADO', 'CERRADO', 'ANULADO'].includes(per.estado_b2)) throw new Error(`La B2 está ${per.estado_b2}: no se pueden regenerar préstamos y ahorros`);
  const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);
  const ini = iso(per.fecha_inicio), fin = iso(per.fecha_fin);
  const tc = Number(per.tc_usd ?? 6.96);
  const restoMin = await restoMinimo(fin);
  const personal = await personalDelPeriodo(per);
  const avisos: string[] = [];

  const prestamos = [...await sql<(Prestamo & { pagado_antes: number })[]>`
    select q.*, coalesce((select sum(x.capital) from prestamo_pago x where x.prestamo_id = q.id
                            and not (x.periodo_id = ${periodoId} and x.tipo = 'PLANILLA') and x.fecha < ${ini}), 0) pagado_antes
    from (${selPrestamo()} where p.estado in ('ACTIVO', 'PAGADO') and p.fecha <= ${fin}) q`];
  const conceptos = await sql<{ id: number; planilla: string; codigo: number }[]>`select id, planilla::text, codigo from concepto where codigo between 500 and 530`;
  const cid = (pl: string, cod: number) => conceptos.find((c) => c.planilla === pl && c.codigo === cod)?.id;

  const novedades: { periodo_id: number; vinculo_id: number; concepto_id: number; monto: number; origen: string; nota: string }[] = [];
  const pagos: { prestamo_id: number; periodo_id: number; fecha: string; capital: number; interes: number; tipo: string; nota: string }[] = [];
  const pagados: number[] = [], reactivados: number[] = [];
  for (const p of prestamos) {
    const saldoAntes = r2(Number(p.capital) - Number(p.pagado_antes));
    if (saldoAntes <= 0.009) { if (p.estado === 'ACTIVO') pagados.push(p.id); continue; }
    if (p.estado === 'PAGADO') reactivados.push(p.id);
    const v = personal.find((x) => x.trabajador_id === p.trabajador_id && (p.planilla === 'B1' ? x.en_b1 : x.en_b2));
    if (!v) { avisos.push(`${p.codigo} ${p.nombre}: tiene préstamo ${p.tipo_nombre} pero no está en ${p.planilla} este mes`); continue; }
    const c = cuotaDelPeriodo(p, saldoAntes, restoMin);
    const f = p.moneda === 'USD' ? tc : 1;
    const nota = `Préstamo #${p.id} ${p.tipo_nombre}`;
    novedades.push({ periodo_id: periodoId, vinculo_id: v.vinculo_id, concepto_id: cid(p.planilla, p.concepto_amort)!, monto: r2(c.capital * f), origen: 'SISTEMA', nota });
    if (c.interes) novedades.push({ periodo_id: periodoId, vinculo_id: v.vinculo_id, concepto_id: cid(p.planilla, p.concepto_int)!, monto: r2(c.interes * f), origen: 'SISTEMA', nota });
    pagos.push({ prestamo_id: p.id, periodo_id: periodoId, fecha: ini, capital: c.capital, interes: r2(c.interes), tipo: 'PLANILLA', nota: `Planilla ${per.mes}/${per.anio}` });
    if (r2(saldoAntes - c.capital) <= 0.009) pagados.push(p.id);
  }

  // Ahorros: aporte mensual (concepto fijo 521 en $us) de quienes están en la B2
  const aportes = await sql<{ vinculo_id: number; trabajador_id: number; cantidad: number | null; monto: number | null }[]>`
    select f.vinculo_id, v.trabajador_id, f.cantidad, f.monto from concepto_fijo f join concepto c on c.id = f.concepto_id join vinculo v on v.id = f.vinculo_id
    where c.planilla = 'B2' and c.codigo = 521 and f.vigente_desde <= ${fin} and (f.vigente_hasta is null or f.vigente_hasta >= ${fin})`;
  const movs = aportes.filter((a) => personal.some((x) => x.vinculo_id === a.vinculo_id && x.en_b2))
    .map((a) => ({ trabajador_id: a.trabajador_id, fecha: ini, tipo: 'APORTE_PLANILLA', monto: r2(a.cantidad ? Number(a.cantidad) * tc : Number(a.monto ?? 0)), periodo_id: periodoId,
      nota: a.cantidad ? `Aporte ${Number(a.cantidad)} $us × ${tc}` : 'Aporte mensual' }))
    .filter((m) => m.monto > 0);

  const ids = [...new Set(prestamos.flatMap((p) => [cid(p.planilla, p.concepto_amort), cid(p.planilla, p.concepto_int)]).concat(
    [506, 507, 508, 509].flatMap((c) => [cid('B1', c), cid('B2', c)])).filter((x): x is number => !!x))];
  await sql.begin(async (tx) => {
    // un solo proceso a la vez por periodo (evita duplicados si se presiona dos veces)
    await tx`select pg_advisory_xact_lock(4242, ${periodoId})`;
    // reemplaza lo generado antes y lo que haya venido de SIDPLAN o de un Excel de Albor: los préstamos salen solo de este módulo
    // (se respeta lo cargado a mano en Novedades)
    await tx`delete from novedad where periodo_id = ${periodoId} and origen in ('SISTEMA', 'ALBOR') and concepto_id in ${tx(ids)}`;
    await tx`delete from prestamo_pago where periodo_id = ${periodoId} and tipo = 'PLANILLA'`;
    await tx`delete from ahorro_mov where periodo_id = ${periodoId} and tipo = 'APORTE_PLANILLA'`;
    if (novedades.length) await tx`insert into novedad ${tx(novedades, 'periodo_id', 'vinculo_id', 'concepto_id', 'monto', 'origen', 'nota')}`;
    if (pagos.length) await tx`insert into prestamo_pago ${tx(pagos, 'prestamo_id', 'periodo_id', 'fecha', 'capital', 'interes', 'tipo', 'nota')}`;
    if (movs.length) await tx`insert into ahorro_mov ${tx(movs, 'trabajador_id', 'fecha', 'tipo', 'monto', 'periodo_id', 'nota')}`;
    if (reactivados.length) await tx`update prestamo set estado = 'ACTIVO' where id in ${tx(reactivados)}`;
    if (pagados.length) await tx`update prestamo set estado = 'PAGADO' where id in ${tx(pagados)}`;
  });
  return { cuotas: pagos.length, aportes: movs.length, terminados: pagados.length, avisos };
}

// ---------------------------------------------------------------------------
// Ahorros
// ---------------------------------------------------------------------------
export async function cuentasAhorro() {
  return [...await sql<{ trabajador_id: number; codigo: string; nombre: string; vinculo_id: number | null; aporte_usd: number | null; aporte_bs: number | null;
    saldo: number; aportes: number; movimientos: number; activo: boolean }[]>`
    with fijo as (
      select v.trabajador_id, v.id vinculo_id, f.cantidad, f.monto from concepto_fijo f join concepto c on c.id = f.concepto_id join vinculo v on v.id = f.vinculo_id
      where c.planilla = 'B2' and c.codigo = 521 and f.vigente_hasta is null and v.fecha_retiro is null)
    select t.id trabajador_id, t.codigo, concat_ws(' ', t.ap_paterno, t.ap_materno, t.nombres) nombre,
           (select v.id from vinculo v where v.trabajador_id = t.id and v.fecha_retiro is null and v.en_b2 order by v.fecha_ingreso desc limit 1) vinculo_id,
           fijo.cantidad aporte_usd, fijo.monto aporte_bs,
           coalesce((select sum(m.monto) from ahorro_mov m where m.trabajador_id = t.id), 0) saldo,
           coalesce((select sum(m.monto) from ahorro_mov m where m.trabajador_id = t.id and m.tipo = 'APORTE_PLANILLA'), 0) aportes,
           (select count(*)::int from ahorro_mov m where m.trabajador_id = t.id) movimientos,
           exists (select 1 from vinculo v where v.trabajador_id = t.id and v.fecha_retiro is null) activo
    from trabajador t left join fijo on fijo.trabajador_id = t.id
    where fijo.trabajador_id is not null or exists (select 1 from ahorro_mov m where m.trabajador_id = t.id)
    order by nombre`];
}

export async function movimientosAhorro(trabajadorId: number) {
  return [...await sql<{ id: number; fecha: string; tipo: string; monto: number; nota: string | null; periodo_id: number | null }[]>`
    select id, fecha::text, tipo, monto, nota, periodo_id from ahorro_mov where trabajador_id = ${trabajadorId} order by fecha, id`];
}

export async function movimientoAhorro(codigo: string, fecha: string, tipo: string, monto: number, nota: string | null) {
  const [t] = await sql<{ id: number }[]>`select id from trabajador where upper(codigo) = upper(${codigo})`;
  if (!t) throw new Error(`No existe el trabajador ${codigo}`);
  if (!monto) throw new Error('Indique el monto');
  const m = tipo === 'RETIRO' ? -Math.abs(monto) : tipo === 'AJUSTE' ? monto : Math.abs(monto);
  if (tipo === 'SALDO_INICIAL') await sql`delete from ahorro_mov where trabajador_id = ${t.id} and tipo = 'SALDO_INICIAL'`;
  await sql`insert into ahorro_mov (trabajador_id, fecha, tipo, monto, nota) values (${t.id}, ${fecha}, ${tipo}, ${m}, ${nota})`;
  await auditar('ahorro_mov', codigo, tipo, { fecha, monto: m, nota });
}

export async function eliminarMovAhorro(id: number) {
  const [m] = await sql<{ tipo: string }[]>`select tipo from ahorro_mov where id = ${id}`;
  if (m?.tipo === 'APORTE_PLANILLA') throw new Error('Los aportes de planilla se regeneran desde el periodo; no se borran a mano.');
  await sql`delete from ahorro_mov where id = ${id}`;
  await auditar('ahorro_mov', String(id), 'DELETE', m);
}

/**
 * Saldos de ahorro desde Albor (cuenta 21010200401, por personal) a una fecha: el saldo acreedor (negativo en Albor) es el ahorro.
 * Como el sistema ya tiene movimientos hasta esa fecha (aportes de planilla, depósitos), el saldo inicial es la diferencia,
 * fechado el día anterior al primer movimiento: así el saldo del sistema a esa fecha queda igual al de Albor.
 */
export async function cargarSaldosIniciales(saldos: { codigo: string; nombre: string; saldo: number }[], fecha: string) {
  const trab = await sql<{ id: number; codigo: string; nombre: string }[]>`select id, codigo, concat_ws(' ', ap_paterno, ap_materno, nombres) nombre from trabajador`;
  const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/gi, '').toUpperCase();
  const ok: string[] = [], faltan: string[] = [];
  await sql.begin(async (tx) => {
    for (const s of saldos) {
      // por código; si no hay, por nombre; y por nombre en otro orden (p. ej. "Wilber Pedro" / "Pedro Wilber")
      const palabras = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split(/[^A-Z]+/).filter(Boolean).sort().join(' ');
      const t = (s.codigo && trab.find((x) => x.codigo.toUpperCase() === s.codigo)) || trab.find((x) => norm(x.nombre) === norm(s.nombre))
        || trab.find((x) => palabras(x.nombre) === palabras(s.nombre));
      if (!t) { if (s.saldo) faltan.push(`${s.codigo} ${s.nombre}`.trim()); continue; }
      await tx`delete from ahorro_mov where trabajador_id = ${t.id} and tipo = 'SALDO_INICIAL'`;
      const [m] = await tx<{ suma: number; primera: string | null }[]>`
        select coalesce(sum(monto), 0) suma, (min(fecha) - 1)::text primera from ahorro_mov where trabajador_id = ${t.id} and fecha <= ${fecha}`;
      const inicial = r2(-s.saldo - Number(m.suma));
      const f = m.primera && m.primera < fecha ? m.primera : fecha;
      if (inicial) await tx`insert into ahorro_mov (trabajador_id, fecha, tipo, monto, nota)
                            values (${t.id}, ${f}, 'SALDO_INICIAL', ${inicial}, ${`Saldo inicial para cuadrar con Albor al ${fecha} (${r2(-s.saldo)})`})`;
      ok.push(t.codigo);
    }
  });
  return { cargados: ok.length, faltan };
}

export async function cambiarAporte(vinculoId: number, usd: number | null, desde: string) {
  const [c] = await sql<{ id: number }[]>`select id from concepto where planilla = 'B2' and codigo = 521`;
  await cambiarFijo(vinculoId, c.id, desde, usd, null, 'Cambio de aporte a la cooperativa');
}
