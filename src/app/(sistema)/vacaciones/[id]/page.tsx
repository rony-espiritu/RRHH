import { notFound, redirect } from 'next/navigation';
import { puede, usuarioActual } from '@/lib/auth';
import { obtenerSolicitud } from '@/lib/datos/vacaciones';
import { DetalleSolicitud } from '../detalle';

export const dynamic = 'force-dynamic';

export default async function Solicitud({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const u = await usuarioActual();
  if (!u) redirect('/login');
  const s = await obtenerSolicitud(Number((await params).id));
  if (!s) notFound();
  const sp = await searchParams;
  return <DetalleSolicitud s={s} gestor={puede(u, 'vacaciones')} propia={s.trabajador_id === u.trabajador_id} base="/vacaciones" msg={sp.msg} err={sp.err} />;
}
