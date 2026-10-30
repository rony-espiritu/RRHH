import Link from 'next/link';
import { redirect } from 'next/navigation';
import { usuarioActual } from '@/lib/auth';
import { hoyBo, listarSolicitudes, trabajadorVacaciones } from '@/lib/datos/vacaciones';
import { EstadoChip, larga, num } from '../vacaciones/formulario';
import { NuevaSolicitud } from '../vacaciones/nueva';

export const dynamic = 'force-dynamic';

/** Portal del trabajador (pensado para el celular). */
export default async function MisVacaciones({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const u = await usuarioActual();
  if (!u) redirect('/login');
  const sp = await searchParams;
  if (!u.trabajador_id) return (<><h2>Mis vacaciones</h2><p className="sub">Tu usuario no está vinculado a un trabajador. Las solicitudes se gestionan desde <Link href="/vacaciones">Vacaciones</Link>.</p></>);
  const [t, lista] = await Promise.all([trabajadorVacaciones(u.trabajador_id), listarSolicitudes({ trabajadorId: u.trabajador_id })]);
  if (!t) return (<><h2>Mis vacaciones</h2><p className="sub">No tenés un vínculo laboral activo. Consultá con Recursos Humanos.</p></>);
  return (
    <>
      <h2>Hola, {t.nombre.split(' ')[0]}</h2>
      <p className="sub">{t.cargo ?? ''} · {t.empresa} · ingreso {larga(t.fecha_ingreso)}</p>
      {sp.msg && <div className="panel" style={{ borderColor: 'var(--ok)' }}>{sp.msg}</div>}
      {sp.err && <div className="error">{sp.err}</div>}
      <div className="portal-saldo">
        <div><b>{num(t.saldo)}</b><span>días disponibles</span></div>
        <div><b>{num(t.pendientes)}</b><span>en trámite</span></div>
        <div><b>{num(t.usados)}</b><span>ya tomados</span></div>
      </div>
      <NuevaSolicitud t={t} volver="/mis-vacaciones" hoy={hoyBo()} />
      <h3>Mis solicitudes</h3>
      {lista.length === 0 && <p className="sub">Todavía no hiciste ninguna solicitud.</p>}
      {lista.map((s) => (
        <Link key={s.id} href={`/mis-vacaciones/${s.id}`} className="vac-tarjeta" style={{ color: 'inherit', textDecoration: 'none' }}>
          <div className="fila" style={{ justifyContent: 'space-between' }}><b>Del {larga(s.desde)} al {larga(s.hasta)}</b><EstadoChip e={s.estado} /></div>
          <span className="sub">{num(s.dias)} día(s) · retorna {larga(s.retorno)} · N° {s.id}</span>
          {s.estado === 'RECHAZADA' && s.motivo_rechazo && <span style={{ color: 'var(--bad)' }}>Motivo: {s.motivo_rechazo}</span>}
        </Link>))}
    </>
  );
}
