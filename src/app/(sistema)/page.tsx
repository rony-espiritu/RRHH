import Link from 'next/link';
import { sql } from '@/lib/db';
import { listarPeriodos, nombreMes } from '@/lib/datos/planilla';
import { proximosRotar } from '@/lib/datos/inicio';
import { hoyBo, listarSolicitudes } from '@/lib/datos/vacaciones';
import { EstadoChip } from './vacaciones/formulario';

const fmt = (d: string | null) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(2, 4) : '');
const falta = (dias: number) => (dias <= 0 ? <span className="chip alerta">Ya cumplió</span>
  : dias <= 30 ? <span className="chip pronto">{dias} d</span> : <span className="sub">{Math.round(dias / 30.4)} m</span>);

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const [c] = await sql<{ trabajadores: number; empresas: number; b1: number; b2solo: number }[]>`
    select (select count(*) from vinculo where fecha_retiro is null)::int trabajadores,
           (select count(*) from empresa where activo)::int empresas,
           (select count(*) from vinculo where fecha_retiro is null and en_b1)::int b1,
           (select count(*) from vinculo where fecha_retiro is null and not en_b1)::int b2solo`;
  const porEmpresa = [...await sql<{ codigo: string; n: number }[]>`
    select e.codigo, count(*)::int n from vinculo v join empresa e on e.id = v.empresa_id
    where v.fecha_retiro is null and v.en_b1 group by e.codigo order by n desc, e.codigo`];
  const periodos = (await listarPeriodos()).slice(0, 4);
  const hoy = hoyBo(), en30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const [rot, vacPend, vacApr] = await Promise.all([proximosRotar(6), listarSolicitudes({ estado: 'PENDIENTE' }), listarSolicitudes({ estado: 'APROBADA', desdeFecha: hoy })]);
  const vac = [...vacPend, ...vacApr.filter((v) => v.desde <= en30)].sort((a, b) => a.desde.localeCompare(b.desde));
  const deVacacion = vacApr.filter((v) => v.desde <= hoy).length;
  const rot30 = rot.filter((r) => r.dias <= 30).length, sinContrato = rot.filter((r) => !r.contrato_fecha && !r.contrato_vence).length;
  const max = Math.max(1, ...porEmpresa.map((x) => x.n));
  return (
    <div className="dash">
      <h2>Inicio</h2>
      <p className="sub">Grupo Ganadero Estancias Espíritu</p>
      <div className="tarjetas dash-kpi">
        <div className="tarjeta"><span>Trabajadores activos</span><b>{c.trabajadores}</b></div>
        <div className="tarjeta"><span>En planilla B1</span><b>{c.b1}</b></div>
        <div className="tarjeta"><span>Solo B2</span><b>{c.b2solo}</b></div>
        <div className="tarjeta"><span>Empresas activas</span><b>{c.empresas}</b></div>
        <div className={`tarjeta${rot30 ? ' kpi-alerta' : ''}`}><span>Rotar en 30 días</span><b>{rot30}</b></div>
        <div className={`tarjeta${vacPend.length ? ' kpi-pronto' : ''}`}><span>Vacaciones por aprobar</span><b>{vacPend.length}</b></div>
        <div className="tarjeta"><span>De vacación hoy</span><b>{deVacacion}</b></div>
      </div>
      <div className="dash-grid">
        <section className="panel dash-card">
          <header><h3>Rotación de empresa — cumplen 2 años</h3><span className="sub">B1 sin Baspel · próximos 6 meses</span></header>
          {sinContrato > 0 && <p className="dash-nota"><span className="chip sin">{sinContrato} de {rot.length} sin contrato en el sistema</span></p>}
          {rot.length === 0 ? <p className="sub">Nadie cumple 2 años en los próximos 6 meses.</p> : (
            <div className="dash-scroll"><table className="compacta"><thead><tr><th>Trabajador</th><th>Emp.</th><th>Cumple</th><th>Falta</th><th>Contrato</th></tr></thead><tbody>
              {rot.map((r) => (
                <tr key={r.codigo} className={r.dias <= 0 ? 'fila-alerta' : r.dias <= 30 ? 'fila-pronto' : ''}>
                  <td><Link href={`/personal/${r.codigo}`}>{r.nombre}</Link><div className="sub">{r.codigo} · {r.ocupacion ?? ''}</div></td>
                  <td>{r.empresa}</td><td>{fmt(r.fecha_2anios)}</td><td>{falta(r.dias)}</td>
                  <td>{r.contrato_fecha || r.contrato_vence ? <span className="chip CERRADO">Sí{r.contrato_vence ? ` ${fmt(r.contrato_vence)}` : ''}</span> : <span className="chip sin">No</span>}</td>
                </tr>))}
            </tbody></table></div>)}
        </section>
        <section className="panel dash-card">
          <header><h3>Vacaciones</h3><Link href="/vacaciones" className="sub">Ver todas →</Link></header>
          <p className="dash-nota sub">Solicitudes pendientes y salidas de los próximos 30 días</p>
          {vac.length === 0 ? <p className="sub">Sin solicitudes pendientes ni salidas próximas.</p> : (
            <div className="dash-scroll"><table className="compacta"><thead><tr><th>Trabajador</th><th>Del</th><th>Al</th><th className="num">Días</th><th>Estado</th></tr></thead><tbody>
              {vac.map((v) => (
                <tr key={v.id}><td><Link href={`/vacaciones/${v.id}`}>{v.nombre}</Link><div className="sub">{v.codigo} · {v.empresa}</div></td>
                  <td>{fmt(v.desde)}</td><td>{fmt(v.hasta)}</td><td className="num">{v.dias}</td>
                  <td>{v.estado === 'APROBADA' && v.desde <= hoy ? <span className="chip vac-APROBADA">De vacación</span> : <EstadoChip e={v.estado} />}</td></tr>))}
            </tbody></table></div>)}
        </section>
        <section className="panel dash-card">
          <header><h3>Personal B1 por empresa</h3><span className="sub">{c.b1} trabajadores</span></header>
          <div className="barras">
            {porEmpresa.map((x) => (
              <div key={x.codigo} className="barra"><span>{x.codigo}</span><div><i style={{ width: `${(x.n / max) * 100}%` }} /></div><b>{x.n}</b></div>))}
          </div>
        </section>
        <section className="panel dash-card">
          <header><h3>Últimos periodos</h3><Link href="/periodos" className="sub">Ver todos →</Link></header>
          <table className="compacta"><thead><tr><th>Periodo</th><th>B1</th><th>B2</th></tr></thead><tbody>
            {periodos.map((p) => (
              <tr key={p.id}><td><Link href={`/periodos/${p.id}`}>{nombreMes(p.mes)} {p.anio}</Link></td>
                <td><span className={`chip ${p.estado_b1}`}>{p.estado_b1}</span></td><td><span className={`chip ${p.estado_b2}`}>{p.estado_b2}</span></td></tr>))}
          </tbody></table>
        </section>
      </div>
    </div>
  );
}
