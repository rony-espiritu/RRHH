import Link from 'next/link';
import { redirect } from 'next/navigation';
import { puede, usuarioActual } from '@/lib/auth';
import { hoyBo, listarSolicitudes, trabajadoresActivos, trabajadorVacaciones, type EstadoSol } from '@/lib/datos/vacaciones';
import { EstadoChip, larga, num } from './formulario';
import { NuevaSolicitud } from './nueva';

export const dynamic = 'force-dynamic';
const PESTANAS: [EstadoSol | 'TODAS', string][] = [['PENDIENTE', 'Pendientes'], ['APROBADA', 'Aprobadas'], ['TODAS', 'Todas']];

export default async function Vacaciones({ searchParams }: { searchParams: Promise<{ e?: string; t?: string; msg?: string; err?: string }> }) {
  const u = await usuarioActual();
  if (!u) redirect('/login');
  const sp = await searchParams, gestor = puede(u, 'vacaciones'), hoy = hoyBo();
  const e = (PESTANAS.find(([k]) => k === sp.e)?.[0] ?? 'PENDIENTE') as EstadoSol | 'TODAS';
  const [lista, trabs, aprobadas] = await Promise.all([listarSolicitudes({ estado: e }), trabajadoresActivos(), listarSolicitudes({ estado: 'APROBADA', desdeFecha: hoy })]);
  const t = gestor && sp.t ? await trabajadorVacaciones(Number(sp.t)) : null;
  const en30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const ahora = aprobadas.filter((s) => s.desde <= hoy), proximas = aprobadas.filter((s) => s.desde > hoy && s.desde <= en30);
  return (
    <>
      <h2>Vacaciones</h2>
      <p className="sub">Solicitudes hechas por el trabajador desde su celular o cargadas por RRHH. Al aprobar, los días se descuentan del saldo (kardex de vacaciones).</p>
      {sp.msg && <div className="panel" style={{ borderColor: 'var(--ok)' }}>{sp.msg}</div>}
      {sp.err && <div className="error">{sp.err}</div>}
      <div className="tarjetas">
        <div className="tarjeta"><span>Pendientes de aprobar</span><b>{(e === 'PENDIENTE' ? lista : await listarSolicitudes({ estado: 'PENDIENTE' })).length}</b></div>
        <div className="tarjeta"><span>De vacación hoy</span><b>{ahora.length}</b></div>
        <div className="tarjeta"><span>Salen en los próximos 30 días</span><b>{proximas.length}</b></div>
      </div>
      {gestor && (
        <form className="panel fila" method="get">
          <b>Cargar una solicitud a nombre de:</b>
          <select name="t" defaultValue={sp.t ?? ''} required style={{ minWidth: 280 }}>
            <option value="" disabled>Elegir trabajador…</option>
            {trabs.map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.codigo})</option>)}
          </select>
          <input type="hidden" name="e" value={e} /><button className="sec">Elegir</button>
        </form>
      )}
      {t && (<>
        <div className="panel fila"><span><b>{t.nombre}</b> · {t.codigo} · {t.empresa} · ingreso {larga(t.fecha_ingreso)}</span>
          <span className="chip">Derecho {num(t.derecho)}</span><span className="chip">Tomados {num(t.usados)}</span><span className="chip CERRADO">Saldo {num(t.saldo)}</span>
          {t.pendientes > 0 && <span className="chip vac-PENDIENTE">Pendiente de aprobar {num(t.pendientes)}</span>}</div>
        <NuevaSolicitud t={t} volver={`/vacaciones?t=${t.trabajador_id}`} hoy={hoy} />
      </>)}
      {gestor && sp.t && !t && <div className="error">Ese trabajador no tiene un vínculo activo.</div>}
      <nav className="pestanas">{PESTANAS.map(([k, l]) => <Link key={k} href={`?e=${k}`} className={k === e ? 'activa' : ''}>{l}</Link>)}</nav>
      <div className="panel">
        {lista.length === 0 ? <p className="sub">No hay solicitudes {e === 'PENDIENTE' ? 'pendientes' : e === 'APROBADA' ? 'aprobadas' : ''}.</p> : (
          <table><thead><tr><th>N°</th><th>Trabajador</th><th>Empresa</th><th>Solicitada</th><th>Del</th><th>Al</th><th>Retorna</th><th className="num">Días</th><th className="num">Pendientes</th><th>Estado</th><th>Cargada por</th></tr></thead><tbody>
            {lista.map((s) => (
              <tr key={s.id}><td><Link href={`/vacaciones/${s.id}`}>{s.id}</Link></td><td><Link href={`/vacaciones/${s.id}`}>{s.nombre}</Link> <span className="sub">{s.codigo}</span></td>
                <td>{s.empresa}</td><td>{larga(s.fecha_solicitud)}</td><td>{larga(s.desde)}</td><td>{larga(s.hasta)}</td><td>{larga(s.retorno)}</td>
                <td className="num"><b>{num(s.dias)}</b></td><td className="num">{num(s.saldo_antes)}</td><td><EstadoChip e={s.estado} /></td><td className="sub">{s.creado_por_nombre}</td></tr>))}
          </tbody></table>)}
      </div>
    </>
  );
}
