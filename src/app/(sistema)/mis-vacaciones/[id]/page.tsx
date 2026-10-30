import { notFound, redirect } from 'next/navigation';
import { usuarioActual } from '@/lib/auth';
import { obtenerSolicitud } from '@/lib/datos/vacaciones';
import { DetalleSolicitud } from '../../vacaciones/detalle';

export const dynamic = 'force-dynamic';

export default async function MiSolicitud({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const u = await usuarioActual();
  if (!u) redirect('/login');
  const s = await obtenerSolicitud(Number((await params).id));
  if (!s || s.trabajador_id !== u.trabajador_id) notFound();   // solo las propias
  const sp = await searchParams;
  return <DetalleSolicitud s={s} gestor={false} propia base="/mis-vacaciones" msg={sp.msg} err={sp.err} />;
}
