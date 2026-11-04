'use server';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { correoBienvenida, correoConfigurado, enviarCorreo } from '@/lib/correo';
import { crearUsuario, editarUsuario, exigir, generarClave, restablecerClave, type Rol } from '@/lib/auth';

async function correr(f: () => Promise<string>) {
  let err = '', ok = '';
  try { ok = await f(); } catch (e) { err = (e as Error).message; }
  revalidatePath('/usuarios');
  redirect(`/usuarios?${err ? 'err=' + encodeURIComponent(err) : 'msg=' + encodeURIComponent(ok)}`);
}

/** Dirección del sistema (para el enlace del correo). */
async function urlSistema() {
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}/login`;
}

/**
 * Entrega la contraseña temporal: por correo si hay correo real y el envío está configurado;
 * si no, se muestra una sola vez en pantalla (aviso que dura 2 minutos, no queda en la dirección).
 */
async function entregar(d: { email: string; nombre: string; usuario: string; clave: string; nuevo: boolean }) {
  const real = !d.email.endsWith('@trabajador.local');
  if (real && correoConfigurado()) {
    try {
      const c = correoBienvenida({ nombre: d.nombre, usuario: d.usuario, clave: d.clave, url: await urlSistema(), nuevo: d.nuevo });
      await enviarCorreo({ para: d.email, ...c });
      return `Se envió la contraseña temporal a ${d.email}. Al ingresar deberá cambiarla.`;
    } catch (e) { (await cookies()).set('flash_clave', JSON.stringify({ usuario: d.usuario, clave: d.clave, motivo: `No se pudo enviar el correo: ${(e as Error).message}` }), { httpOnly: true, path: '/usuarios', maxAge: 120, sameSite: 'strict' }); return 'Usuario listo, pero el correo no salió: pasale la contraseña que figura abajo.'; }
  }
  (await cookies()).set('flash_clave', JSON.stringify({ usuario: d.usuario, clave: d.clave,
    motivo: real ? 'El envío de correos todavía no está configurado.' : 'No tiene correo: entra con su código.' }), { httpOnly: true, path: '/usuarios', maxAge: 120, sameSite: 'strict' });
  return 'Listo. Pasale la contraseña temporal que figura abajo: al ingresar deberá cambiarla.';
}

export async function accionCrearUsuario(fd: FormData) {
  const yo = await exigir('usuarios');
  await correr(async () => {
    const clave = String(fd.get('clave') ?? '').trim() || generarClave();
    const u = await crearUsuario({ email: String(fd.get('email') ?? ''), nombre: String(fd.get('nombre') ?? ''), rol: String(fd.get('rol')) as Rol, clave,
      trabajadorId: fd.get('trabajador_id') ? Number(fd.get('trabajador_id')) : null }, yo.id);
    const [t] = fd.get('trabajador_id') ? await sql<{ codigo: string }[]>`select codigo from trabajador where id = ${Number(fd.get('trabajador_id'))}` : [];
    return entregar({ email: u.email, nombre: u.nombre, usuario: t ? (u.email.endsWith('@trabajador.local') ? t.codigo : `${t.codigo} o ${u.email}`) : u.email, clave, nuevo: true });
  });
}
export async function accionEditarUsuario(fd: FormData) {
  const yo = await exigir('usuarios');
  await correr(async () => { await editarUsuario(String(fd.get('id')), { nombre: String(fd.get('nombre')), rol: String(fd.get('rol')) as Rol, activo: fd.get('activo') === 'on' }, yo.id); return 'Usuario actualizado'; });
}
export async function accionRestablecer(fd: FormData) {
  const yo = await exigir('usuarios');
  await correr(async () => {
    const id = String(fd.get('id')), clave = String(fd.get('clave') ?? '').trim() || generarClave();
    await restablecerClave(id, clave, yo.id);
    const [u] = await sql<{ email: string; nombre: string | null; codigo: string | null }[]>`
      select u.email, u.nombre, t.codigo from usuario u left join trabajador t on t.id = u.trabajador_id where u.id = ${id}`;
    return entregar({ email: u.email, nombre: u.nombre ?? u.email, usuario: u.codigo ?? u.email, clave, nuevo: false });
  });
}
