import 'server-only';
import { sql } from '@/lib/db';
import type { Usuario } from '@/lib/auth';
import { derechoVacaciones } from './personal';

export type EstadoSol = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'ANULADA';
export type Solicitud = {
  id: number; trabajador_id: number; vinculo_id: number; codigo: string; nombre: string; cargo: string | null; area: string | null; empresa: string;
  fecha_solicitud: string; desde: string; hasta: string; retorno: string | null; dias: number; saldo_antes: number | null; observaciones: string | null;
  estado: EstadoSol; creado_por_nombre: string | null; revisado_por_nombre: string | null; revisado_en: string | null; motivo_rechazo: string | null;
};
export type TrabVac = { trabajador_id: number; vinculo_id: number; codigo: string; nombre: string; cargo: string | null; area: string | null; empresa: string;
  fecha_ingreso: string; derecho: number; usados: number; saldo: number; pendientes: number };

/** Fecha de hoy en Bolivia (YYYY-MM-DD). */
export const hoyBo = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);
const d = (s: string) => new Date(s + 'T12:00:00Z');
const iso = (x: Date) => x.toISOString().slice(0, 10);

/** Días de vacación entre dos fechas: de lunes a sábado (el domingo no se cuenta), como en el formulario manual. */
export function diasHabiles(desde: string, hasta: string) {
  let n = 0;
  for (let x = d(desde); x <= d(hasta); x.setUTCDate(x.getUTCDate() + 1)) if (x.getUTCDay() !== 0) n++;
  return n;
}
/** Día de retorno: el siguiente día hábil después del último de vacación. */
export function diaRetorno(hasta: string) {
  const x = d(hasta);
  do x.setUTCDate(x.getUTCDate() + 1); while (x.getUTCDay() === 0);
  return iso(x);
}

/** Datos y saldo de vacaciones de un trabajador activo. */
export async function trabajadorVacaciones(trabajadorId: number, corte = hoyBo()): Promise<TrabVac | null> {
  const [t] = await sql<Omit<TrabVac, 'derecho' | 'usados' | 'saldo' | 'pendientes'>[]>`
    select t.id trabajador_id, v.id vinculo_id, t.codigo, trim(concat_ws(' ', t.nombres, t.ap_paterno, t.ap_materno)) nombre,
           coalesce(cg.descripcion, v.ocupacion) cargo, coalesce(a.descripcion, cc.descripcion) area, e.codigo empresa, v.fecha_ingreso::text
    from trabajador t join vinculo v on v.trabajador_id = t.id and v.fecha_retiro is null join empresa e on e.id = v.empresa_id
    left join cargo cg on cg.id = v.cargo_id left join area a on a.id = v.area_id
    left join lateral (select c.descripcion from asignacion_cc x join centro_costo c on c.id = x.centro_costo_id
                       where x.vinculo_id = v.id and x.vigente_hasta is null order by x.porcentaje desc limit 1) cc on true
    where t.id = ${trabajadorId} order by v.fecha_ingreso desc limit 1`;
  if (!t) return null;
  const [m] = await sql<{ mov: string; pend: string }[]>`
    select coalesce((select sum(dias) from vacacion_mov where vinculo_id = ${t.vinculo_id} and tipo <> 'DEVENGADO'), 0) mov,
           coalesce((select sum(dias) from vacacion_solicitud where vinculo_id = ${t.vinculo_id} and estado = 'PENDIENTE'), 0) pend`;
  const derecho = derechoVacaciones(t.fecha_ingreso, corte).total, mov = Number(m.mov);
  return { ...t, derecho, usados: -mov, saldo: derecho + mov, pendientes: Number(m.pend) };
}

export async function trabajadoresActivos() {
  return [...await sql<{ id: number; codigo: string; nombre: string }[]>`
    select t.id, t.codigo, trim(concat_ws(' ', t.ap_paterno, t.ap_materno, t.nombres)) nombre
    from trabajador t where exists (select 1 from vinculo v where v.trabajador_id = t.id and v.fecha_retiro is null) order by 3`];
}

export async function listarSolicitudes(f: { estado?: EstadoSol | 'TODAS'; trabajadorId?: number; desdeFecha?: string } = {}) {
  return [...await sql<Solicitud[]>`
    select s.id, s.trabajador_id, s.vinculo_id, t.codigo, trim(concat_ws(' ', t.ap_paterno, t.ap_materno, t.nombres)) nombre,
           coalesce(cg.descripcion, v.ocupacion) cargo, a.descripcion area, e.codigo empresa,
           s.fecha_solicitud::text, s.desde::text, s.hasta::text, s.retorno::text, s.dias::float dias, s.saldo_antes::float saldo_antes, s.observaciones,
           s.estado, uc.nombre creado_por_nombre, ur.nombre revisado_por_nombre,
           to_char(s.revisado_en at time zone 'America/La_Paz', 'DD/MM/YYYY HH24:MI') revisado_en, s.motivo_rechazo
    from vacacion_solicitud s join trabajador t on t.id = s.trabajador_id join vinculo v on v.id = s.vinculo_id join empresa e on e.id = v.empresa_id
    left join cargo cg on cg.id = v.cargo_id left join area a on a.id = v.area_id
    left join usuario uc on uc.id = s.creado_por left join usuario ur on ur.id = s.revisado_por
    where (${f.estado ?? 'TODAS'} = 'TODAS' or s.estado = ${f.estado ?? 'TODAS'})
      and (${f.trabajadorId ?? null}::int is null or s.trabajador_id = ${f.trabajadorId ?? null})
      and (${f.desdeFecha ?? null}::date is null or s.hasta >= ${f.desdeFecha ?? null})
    order by case s.estado when 'PENDIENTE' then 0 else 1 end, s.desde desc, s.id desc`];
}
export async function obtenerSolicitud(id: number) {
  const [s] = await sql<{ id: number }[]>`select id from vacacion_solicitud where id = ${id}`;
  if (!s) return null;
  return (await listarSolicitudes()).find((x) => x.id === id) ?? null;
}

export async function crearSolicitud(x: { trabajadorId: number; desde: string; hasta: string; dias?: number | null; observaciones?: string | null }, por: Usuario) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x.desde) || !/^\d{4}-\d{2}-\d{2}$/.test(x.hasta)) throw new Error('Indicá las fechas Del y Al');
  if (x.hasta < x.desde) throw new Error('La fecha "Al" no puede ser anterior a "Del"');
  const t = await trabajadorVacaciones(x.trabajadorId);
  if (!t) throw new Error('El trabajador no tiene un vínculo activo');
  const calc = diasHabiles(x.desde, x.hasta);
  const dias = x.dias && x.dias > 0 ? x.dias : calc;
  if (dias <= 0) throw new Error('El rango elegido no tiene días hábiles (solo domingo)');
  if (Math.round(dias * 2) !== dias * 2) throw new Error('Los días van de medio en medio día (p.ej. 1, 1.5, 2)');
  if (dias > calc) throw new Error(`Entre esas fechas hay ${calc} día(s) hábil(es); no se pueden pedir ${dias}`);
  const [cruce] = await sql`select id from vacacion_solicitud where trabajador_id = ${x.trabajadorId} and estado in ('PENDIENTE', 'APROBADA')
                            and desde <= ${x.hasta} and hasta >= ${x.desde} limit 1`;
  if (cruce) throw new Error(`Ya hay una solicitud (N° ${cruce.id}) que se cruza con esas fechas`);
  const [n] = await sql<{ id: number }[]>`
    insert into vacacion_solicitud (trabajador_id, vinculo_id, fecha_solicitud, desde, hasta, retorno, dias, saldo_antes, observaciones, creado_por)
    values (${t.trabajador_id}, ${t.vinculo_id}, ${hoyBo()}, ${x.desde}, ${x.hasta}, ${diaRetorno(x.hasta)}, ${dias}, ${t.saldo}, ${x.observaciones?.trim() || null}, ${por.id})
    returning id`;
  return n.id;
}

/** Aprobar: descuenta los días en el kardex de vacaciones (tipo GOZADO). */
export async function aprobarSolicitud(id: number, por: Usuario) {
  await sql.begin(async (tx) => {
    const [s] = await tx<{ vinculo_id: number; desde: string; hasta: string; dias: string; estado: string }[]>`
      select vinculo_id, desde::text, hasta::text, dias, estado from vacacion_solicitud where id = ${id} for update`;
    if (!s) throw new Error('Solicitud no encontrada');
    if (s.estado !== 'PENDIENTE') throw new Error(`La solicitud ya está ${s.estado.toLowerCase()}`);
    const [m] = await tx<{ id: number }[]>`insert into vacacion_mov (vinculo_id, fecha_desde, fecha_hasta, dias, tipo, referencia)
      values (${s.vinculo_id}, ${s.desde}, ${s.hasta}, ${-Number(s.dias)}, 'GOZADO', ${'Solicitud de vacación N° ' + id}) returning id`;
    await tx`update vacacion_solicitud set estado = 'APROBADA', revisado_por = ${por.id}, revisado_en = now(), vacacion_mov_id = ${m.id} where id = ${id}`;
  });
}
export async function rechazarSolicitud(id: number, motivo: string, por: Usuario) {
  if (!motivo.trim()) throw new Error('Indicá el motivo del rechazo');
  const r = await sql`update vacacion_solicitud set estado = 'RECHAZADA', revisado_por = ${por.id}, revisado_en = now(), motivo_rechazo = ${motivo.trim()}
                      where id = ${id} and estado = 'PENDIENTE'`;
  if (!r.count) throw new Error('Solo se puede rechazar una solicitud pendiente');
}
/** Anular: el trabajador puede anular las suyas pendientes; RRHH también las aprobadas (devuelve los días al kardex). */
export async function anularSolicitud(id: number, por: Usuario, gestor: boolean) {
  await sql.begin(async (tx) => {
    const [s] = await tx<{ estado: string; trabajador_id: number; vacacion_mov_id: number | null }[]>`
      select estado, trabajador_id, vacacion_mov_id from vacacion_solicitud where id = ${id} for update`;
    if (!s) throw new Error('Solicitud no encontrada');
    if (!gestor && (s.trabajador_id !== por.trabajador_id || s.estado !== 'PENDIENTE')) throw new Error('Solo podés anular tus solicitudes pendientes');
    if (s.estado !== 'PENDIENTE' && s.estado !== 'APROBADA') throw new Error(`La solicitud ya está ${s.estado.toLowerCase()}`);
    await tx`update vacacion_solicitud set estado = 'ANULADA', revisado_por = ${por.id}, revisado_en = now(), vacacion_mov_id = null where id = ${id}`;
    if (s.vacacion_mov_id) await tx`delete from vacacion_mov where id = ${s.vacacion_mov_id}`;
  });
}
