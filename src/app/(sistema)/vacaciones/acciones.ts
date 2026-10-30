'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigir, puede, usuarioActual } from '@/lib/auth';
import { anularSolicitud, aprobarSolicitud, crearSolicitud, rechazarSolicitud } from '@/lib/datos/vacaciones';

const volverA = (fd: FormData, def: string) => { const v = String(fd.get('volver') ?? ''); return v.startsWith('/') && !v.startsWith('//') ? v : def; };
const con = (url: string, k: string, v: string) => `${url}${url.includes('?') ? '&' : '?'}${k}=${encodeURIComponent(v)}`;

async function correr(fd: FormData, def: string, f: () => Promise<string | number | void>, ok: string, destinoOk?: (r: unknown) => string) {
  let err = '', r: unknown;
  try { r = await f(); } catch (e) { err = (e as Error).message; }
  revalidatePath('/vacaciones'); revalidatePath('/mis-vacaciones'); revalidatePath('/');
  const url = volverA(fd, def);
  redirect(err ? con(url, 'err', err) : con(destinoOk ? destinoOk(r) : url, 'msg', ok));
}

/** Nueva solicitud: el trabajador para sí mismo; RRHH/Gerencia para cualquiera. */
export async function accionNuevaSolicitud(fd: FormData) {
  const u = await usuarioActual();
  if (!u) redirect('/login');
  const gestor = puede(u, 'vacaciones');
  const trabajadorId = gestor && fd.get('trabajador_id') ? Number(fd.get('trabajador_id')) : u.trabajador_id;
  const def = gestor ? '/vacaciones' : '/mis-vacaciones';
  await correr(fd, def, async () => {
    if (!trabajadorId) throw new Error('Tu usuario no está vinculado a un trabajador');
    return crearSolicitud({ trabajadorId, desde: String(fd.get('desde')), hasta: String(fd.get('hasta')),
      medioInicio: fd.get('medio_inicio') === '1', medioFin: fd.get('medio_fin') === '1',
      observaciones: String(fd.get('observaciones') ?? '') }, u);
  }, 'Solicitud enviada. Queda pendiente de aprobación.', (id) => `${gestor ? '/vacaciones' : '/mis-vacaciones'}/${id}`);
}
export async function accionAprobar(fd: FormData) {
  const u = await exigir('vacaciones');
  await correr(fd, '/vacaciones', () => aprobarSolicitud(Number(fd.get('id')), u), 'Solicitud aprobada: los días se descontaron del saldo de vacaciones.');
}
export async function accionRechazar(fd: FormData) {
  const u = await exigir('vacaciones');
  await correr(fd, '/vacaciones', () => rechazarSolicitud(Number(fd.get('id')), String(fd.get('motivo') ?? ''), u), 'Solicitud rechazada.');
}
export async function accionAnular(fd: FormData) {
  const u = await usuarioActual();
  if (!u) redirect('/login');
  await correr(fd, '/mis-vacaciones', () => anularSolicitud(Number(fd.get('id')), u, puede(u, 'vacaciones')), 'Solicitud anulada.');
}
