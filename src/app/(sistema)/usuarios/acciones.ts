'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { crearUsuario, editarUsuario, exigir, restablecerClave, type Rol } from '@/lib/auth';

async function correr(f: () => Promise<unknown>, ok: string) {
  let err = '';
  try { await f(); } catch (e) { err = (e as Error).message; }
  revalidatePath('/usuarios');
  redirect(`/usuarios?${err ? 'err=' + encodeURIComponent(err) : 'msg=' + encodeURIComponent(ok)}`);
}

export async function accionCrearUsuario(fd: FormData) {
  const yo = await exigir('usuarios');
  await correr(() => crearUsuario({ email: String(fd.get('email') ?? ''), nombre: String(fd.get('nombre') ?? ''), rol: String(fd.get('rol')) as Rol, clave: String(fd.get('clave')),
    trabajadorId: fd.get('trabajador_id') ? Number(fd.get('trabajador_id')) : null }, yo.id),
    `Usuario ${fd.get('email') || 'del trabajador'} creado. Pasale la contraseña temporal: al ingresar la primera vez se le pedirá cambiarla.`);
}
export async function accionEditarUsuario(fd: FormData) {
  const yo = await exigir('usuarios');
  await correr(() => editarUsuario(String(fd.get('id')), { nombre: String(fd.get('nombre')), rol: String(fd.get('rol')) as Rol, activo: fd.get('activo') === 'on' }, yo.id), 'Usuario actualizado');
}
export async function accionRestablecer(fd: FormData) {
  const yo = await exigir('usuarios');
  await correr(() => restablecerClave(String(fd.get('id')), String(fd.get('clave')), yo.id), 'Contraseña restablecida. El usuario deberá cambiarla al ingresar.');
}
