import { sql } from '@/lib/db';
import { bs } from '@/lib/formato';

export const dynamic = 'force-dynamic';

export default async function Personal({ searchParams }: { searchParams: Promise<{ empresa?: string; q?: string }> }) {
  const { empresa = '', q = '' } = await searchParams;
  const empresas = await sql<{ codigo: string; razon_social: string }[]>`select codigo, razon_social from empresa where activo order by codigo`;
  const filas = await sql<{ codigo: string; nombre: string; ci: string; empresa: string; empresa_b2: string; en_b1: boolean; cargo: string; cc: string; fecha_ingreso: string; sueldo: number; bono: number; abono: number; forma: string; cuenta: string }[]>`
    select t.codigo, trim(concat_ws(' ', t.ap_paterno, t.ap_materno, t.nombres)) nombre, concat_ws(' ', t.ci, t.ci_expedido) ci,
           e.codigo empresa, coalesce(e2.codigo, e.codigo) empresa_b2, v.en_b1, c.descripcion cargo,
           (select cc.codigo from asignacion_cc a join centro_costo cc on cc.id = a.centro_costo_id where a.vinculo_id = v.id and a.vigente_hasta is null order by a.porcentaje desc limit 1) cc,
           v.fecha_ingreso::text,
           (select f.monto from concepto_fijo f join concepto k on k.id = f.concepto_id where f.vinculo_id = v.id and k.planilla = 'B1' and k.codigo = 2 and f.vigente_hasta is null) sueldo,
           (select f.monto from concepto_fijo f join concepto k on k.id = f.concepto_id where f.vinculo_id = v.id and k.planilla = 'B1' and k.codigo = 24 and f.vigente_hasta is null) bono,
           (select f.monto from concepto_fijo f join concepto k on k.id = f.concepto_id where f.vinculo_id = v.id and k.planilla = 'B2' and k.codigo = 2 and f.vigente_hasta is null) abono,
           (select tp.forma::text from trabajador_pago tp where tp.trabajador_id = t.id and tp.vigente_hasta is null limit 1) forma,
           (select tp.nro_cuenta from trabajador_pago tp where tp.trabajador_id = t.id and tp.vigente_hasta is null limit 1) cuenta
    from vinculo v join trabajador t on t.id = v.trabajador_id join empresa e on e.id = v.empresa_id
    left join empresa e2 on e2.id = v.empresa_b2_id left join cargo c on c.id = v.cargo_id
    where v.fecha_retiro is null
      ${empresa ? sql`and (e.codigo = ${empresa} or e2.codigo = ${empresa})` : sql``}
      ${q ? sql`and (t.codigo ilike ${'%' + q + '%'} or t.ci ilike ${'%' + q + '%'} or concat_ws(' ', t.ap_paterno, t.ap_materno, t.nombres) ilike ${'%' + q + '%'})` : sql``}
    order by e.codigo, nombre`;
  return (
    <>
      <h2>Personal</h2>
      <p className="sub">{filas.length} trabajadores activos</p>
      <form className="fila panel">
        <select name="empresa" defaultValue={empresa}>
          <option value="">Todas las empresas</option>
          {empresas.map((e) => <option key={e.codigo} value={e.codigo}>{e.codigo} — {e.razon_social}</option>)}
        </select>
        <input name="q" placeholder="Nombre, código o CI" defaultValue={q} />
        <button>Filtrar</button>
      </form>
      <div className="tabla">
        <table>
          <thead><tr><th>Código</th><th>Nombre</th><th>CI</th><th>Empresa</th><th>Cargo</th><th>Centro de costo</th><th>Ingreso</th>
            <th className="n">Sueldo B1</th><th className="n">Bono nivel</th><th className="n">Abono B2</th><th>Pago B1</th><th>Cuenta</th></tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.codigo}>
                <td>{f.codigo}</td><td>{f.nombre}</td><td>{f.ci}</td>
                <td>{f.en_b1 ? f.empresa : <span title="Solo B2">{f.empresa_b2} (B2)</span>}</td>
                <td>{f.cargo}</td><td>{f.cc}</td><td>{f.fecha_ingreso}</td>
                <td className="n">{bs(f.sueldo)}</td><td className="n">{bs(f.bono)}</td><td className="n">{bs(f.abono)}</td>
                <td>{f.en_b1 ? f.forma : ''}</td><td>{f.en_b1 ? f.cuenta : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
