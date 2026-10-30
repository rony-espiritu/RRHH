import Link from 'next/link';
import { sql } from '@/lib/db';
import { listarPeriodos, nombreMes } from '@/lib/datos/planilla';
import { proximosRotar } from '@/lib/datos/inicio';

const fmt = (d: string | null) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const [c] = await sql<{ trabajadores: number; empresas: number; b1: number; b2solo: number }[]>`
    select (select count(*) from vinculo where fecha_retiro is null)::int trabajadores,
           (select count(*) from empresa where activo)::int empresas,
           (select count(*) from vinculo where fecha_retiro is null and en_b1)::int b1,
           (select count(*) from vinculo where fecha_retiro is null and not en_b1)::int b2solo`;
  const periodos = (await listarPeriodos()).slice(0, 4);
  const rot = await proximosRotar(6);
  const yaCumplieron = rot.filter((r) => r.dias <= 0).length, sinContrato = rot.filter((r) => !r.contrato_fecha && !r.contrato_vence).length;
  return (
    <>
      <h2>Inicio</h2>
      <p className="sub">Grupo Ganadero Estancias Espíritu</p>
      <div className="tarjetas">
        <div className="tarjeta"><span>Trabajadores activos</span><b>{c.trabajadores}</b></div>
        <div className="tarjeta"><span>En planilla B1</span><b>{c.b1}</b></div>
        <div className="tarjeta"><span>Solo B2</span><b>{c.b2solo}</b></div>
        <div className="tarjeta"><span>Empresas activas</span><b>{c.empresas}</b></div>
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Próximos a cumplir 2 años — rotación de empresa</h3>
        <p className="sub" style={{ marginTop: -6 }}>Personal que cumple 2 años en su empresa actual en los próximos 6 meses (sin Baspel, que tiene contrato indefinido).
          {' '}{yaCumplieron > 0 && <span className="chip alerta">{yaCumplieron} ya cumplieron</span>}{' '}
          {sinContrato > 0 && <span className="chip sin">{sinContrato} sin contrato en el sistema</span>}</p>
        {rot.length === 0 ? <p className="sub">Nadie cumple 2 años en los próximos 6 meses.</p> : (
        <table><thead><tr><th>Código</th><th>Trabajador</th><th>Empresa</th><th>CC</th><th>Cargo</th><th>Ingreso</th><th>Cumple 2 años</th><th>Faltan</th><th>Contrato en sistema</th></tr></thead><tbody>
          {rot.map((r) => (
            <tr key={r.codigo} className={r.dias <= 0 ? 'fila-alerta' : r.dias <= 30 ? 'fila-pronto' : ''}>
              <td><Link href={`/personal/${r.codigo}`}>{r.codigo}</Link></td><td>{r.nombre}</td>
              <td>{r.empresa}{!r.en_b1 && <span className="sub"> (solo B2)</span>}</td><td>{r.cc ?? ''}</td><td>{r.ocupacion ?? ''}</td>
              <td>{fmt(r.fecha_ingreso)}</td><td><b>{fmt(r.fecha_2anios)}</b></td>
              <td>{r.dias <= 0 ? <span className="chip alerta">Ya cumplió</span> : r.dias <= 30 ? <span className="chip pronto">{r.dias} días</span> : (() => { const m = Math.round(r.dias / 30.4); return m === 1 ? "1 mes" : `${m} meses`; })()}</td>
              <td>{r.contrato_fecha || r.contrato_vence ? <span className="chip CERRADO">Sí{r.contrato_vence ? ` · vence ${fmt(r.contrato_vence)}` : ''}</span> : <span className="chip sin">No</span>}</td>
            </tr>))}
        </tbody></table>)}
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Últimos periodos</h3>
        <table><thead><tr><th>Periodo</th><th>B1</th><th>B2</th></tr></thead><tbody>
          {periodos.map((p) => (
            <tr key={p.id}><td><Link href={`/periodos/${p.id}`}>{nombreMes(p.mes)} {p.anio}</Link></td>
              <td><span className={`chip ${p.estado_b1}`}>{p.estado_b1}</span></td><td><span className={`chip ${p.estado_b2}`}>{p.estado_b2}</span></td></tr>
          ))}
        </tbody></table>
      </div>
    </>
  );
}
