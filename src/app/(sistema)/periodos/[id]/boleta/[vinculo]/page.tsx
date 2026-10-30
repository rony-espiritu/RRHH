import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { nombreMes } from '@/lib/datos/planilla';
import { bs } from '@/lib/formato';
import Imprimir from './imprimir';

export const dynamic = 'force-dynamic';

type Cab = { anio: number; mes: number; planilla: string; razon_social: string; nit: string | null; nro_empleador_mintrab: string | null; codigo: string; nombre: string;
  ci: string; cargo_texto: string | null; fecha_ingreso: string; dias_pagados: number; total_ganado: number; total_descuentos: number; liquido: number;
  forma_pago: string | null; nro_cuenta: string | null; nua_cua: string | null; centro: string | null; id: number };
type Linea = { codigo: number; nombre: string; naturaleza: string; cantidad: number | null; monto: number };

export default async function Boleta({ params, searchParams }: { params: Promise<{ id: string; vinculo: string }>; searchParams: Promise<{ pl?: string }> }) {
  const { id, vinculo } = await params;
  const pl = (await searchParams).pl === 'B2' ? 'B2' : 'B1';
  const [c] = await sql<Cab[]>`
    select p.anio, p.mes, pt.planilla::text planilla, e.razon_social, e.nit, e.nro_empleador_mintrab, t.codigo,
           trim(concat_ws(' ', t.ap_paterno, t.ap_materno, t.nombres)) nombre, concat_ws(' ', t.ci, t.ci_expedido) ci, pt.cargo_texto,
           v.fecha_ingreso::text, pt.dias_pagados, pt.total_ganado, pt.total_descuentos, pt.liquido, pt.forma_pago::text, pt.nro_cuenta, t.nua_cua,
           cc.codigo || ' ' || cc.descripcion centro, pt.id
    from planilla_trabajador pt join periodo p on p.id = pt.periodo_id join vinculo v on v.id = pt.vinculo_id join trabajador t on t.id = v.trabajador_id
    join empresa e on e.id = pt.empresa_id left join centro_costo cc on cc.id = pt.centro_costo_id
    where pt.periodo_id = ${Number(id)} and pt.vinculo_id = ${Number(vinculo)} and pt.planilla = ${pl}`;
  if (!c) notFound();
  const lineas = [...await sql<Linea[]>`
    select k.codigo, k.nombre, k.naturaleza::text, l.cantidad, l.monto from planilla_linea l join concepto k on k.id = l.concepto_id
    where l.planilla_trabajador_id = ${c.id} and k.naturaleza in ('INGRESO','DESCUENTO') and l.monto <> 0 order by k.orden, k.codigo`];
  const ing = lineas.filter((l) => l.naturaleza === 'INGRESO'), des = lineas.filter((l) => l.naturaleza === 'DESCUENTO');
  const filas = Math.max(ing.length, des.length);
  const b2 = c.planilla === 'B2';
  return (
    <div className="boleta">
      <Imprimir />
      <header>
        <div><b>{c.razon_social}</b>{c.nit && <div>NIT {c.nit}</div>}{!b2 && c.nro_empleador_mintrab && <div>N° empleador {c.nro_empleador_mintrab}</div>}</div>
        <div style={{ textAlign: 'right' }}><h1>{b2 ? 'Liquidación de cuenta corriente' : 'Boleta de pago'}</h1><div>{nombreMes(c.mes)} {c.anio}</div></div>
      </header>
      <table className="datos"><tbody>
        <tr><th>Trabajador</th><td>{c.nombre}</td><th>Código</th><td>{c.codigo}</td></tr>
        <tr><th>Documento</th><td>{c.ci}</td><th>Ingreso</th><td>{c.fecha_ingreso}</td></tr>
        <tr><th>Cargo</th><td>{c.cargo_texto}</td><th>Días pagados</th><td>{c.dias_pagados}</td></tr>
        <tr><th>Centro de costo</th><td>{c.centro}</td><th>{b2 ? 'Pago' : 'NUA/CUA'}</th><td>{b2 ? 'Efectivo' : c.nua_cua}</td></tr>
      </tbody></table>
      <table className="conceptos">
        <thead><tr><th colSpan={3}>Ingresos</th><th colSpan={3}>Descuentos</th></tr></thead>
        <tbody>
          {Array.from({ length: filas }, (_, i) => (
            <tr key={i}>
              <td>{ing[i]?.nombre}</td><td className="n">{ing[i]?.cantidad ?? ''}</td><td className="n">{ing[i] ? bs(ing[i].monto) : ''}</td>
              <td>{des[i]?.nombre}</td><td className="n">{des[i]?.cantidad ?? ''}</td><td className="n">{des[i] ? bs(des[i].monto) : ''}</td>
            </tr>
          ))}
          <tr className="tot"><td colSpan={2}>Total ganado</td><td className="n">{bs(c.total_ganado)}</td><td colSpan={2}>Total descuentos</td><td className="n">{bs(c.total_descuentos)}</td></tr>
        </tbody>
      </table>
      <p className="liquido">{b2 ? 'Saldo a pagar' : 'Líquido pagable'}: <b>Bs {bs(c.liquido)}</b>
        {!b2 && c.forma_pago && <span> · {c.forma_pago === 'EFECTIVO' ? 'Efectivo' : `${c.forma_pago.replace('_', ' ')} cta. ${c.nro_cuenta ?? ''}`}</span>}</p>
      <div className="firmas"><div>Firma empleador</div><div>Recibí conforme<br />{c.nombre}</div></div>
    </div>
  );
}
