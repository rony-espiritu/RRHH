'use server';
import { redirect } from 'next/navigation';
import { cambiarMiClave, usuarioActual } from '@/lib/auth';

export async function accionCambiarClave(fd: FormData) {
  const u = await usuarioActual();
  if (!u) redirect('/login');
  let err = '';
  try {
    if (fd.get('nueva') !== fd.get('nueva2')) throw new Error('Las contraseñas nuevas no coinciden');
    await cambiarMiClave(u, String(fd.get('actual')), String(fd.get('nueva')));
  } catch (e) { err = (e as Error).message; }
  redirect(err ? `/cuenta?err=${encodeURIComponent(err)}` : '/?msg=' + encodeURIComponent('Contraseña cambiada'));
}
