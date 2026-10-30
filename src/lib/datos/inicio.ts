import 'server-only';
import { sql } from '@/lib/db';

export type Rotacion = {
  codigo: string; nombre: string; empresa: string; en_b1: boolean; ocupacion: string | null; cc: string | null;
  fecha_ingreso: string; fecha_2anios: string; dias: number;
  contrato_fecha: string | null; contrato_vence: string | null;
};

/** Personal (sin Baspel) que cumple 2 años en su empresa actual dentro de `meses` meses, o que ya los cumplió. */
export async function proximosRotar(meses = 6) {
  return [...await sql<Rotacion[]>`
    with base as (
      select t.id tid, t.codigo, trim(concat_ws(' ', t.ap_paterno, t.ap_materno, t.nombres)) nombre, e.codigo empresa, v.en_b1, v.ocupacion,
             (select cc.codigo from asignacion_cc a join centro_costo cc on cc.id = a.centro_costo_id
               where a.vinculo_id = v.id and a.vigente_hasta is null order by a.porcentaje desc limit 1) cc,
             v.fecha_ingreso, (v.fecha_ingreso + interval '2 years')::date f2
      from vinculo v join trabajador t on t.id = v.trabajador_id join empresa e on e.id = v.empresa_id
      where v.fecha_retiro is null and e.codigo <> 'BASP')
    select b.codigo, b.nombre, b.empresa, b.en_b1, b.ocupacion, b.cc, b.fecha_ingreso::text, b.f2::text fecha_2anios, (b.f2 - current_date)::int dias,
           d.fecha::text contrato_fecha, d.vence::text contrato_vence
    from base b
    left join lateral (select fecha, vence from documento where trabajador_id = b.tid and tipo = 'CT' order by coalesce(fecha, vence) desc nulls last limit 1) d on true
    where b.f2 <= current_date + make_interval(months => ${meses})
    order by b.f2, b.nombre`];
}
