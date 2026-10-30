'use server';
import { redirect } from 'next/navigation';
import { cerrarSesion, crearUsuario, hayUsuarios, iniciarSesion } from '@/lib/auth';

const destino = (v: FormDataEntryValue | null) => { const s = String(v ?? ''); return s.startsWith('/') && !s.startsWith('//') ? s : '/'; };

export async function accionIngresar(fd: FormData) {
  let volver = destino(fd.get('volver'));
  try { if ((await iniciarSesion(String(fd.get('email') ?? ''), String(fd.get('clave') ?? ''))).debeCambiar) volver = '/cuenta'; }
  catch (e) { redirect(`/login?err=${encodeURIComponent((e as Error).message)}&email=${encodeURIComponent(String(fd.get('email') ?? ''))}${volver !== '/' ? '&volver=' + encodeURIComponent(volver) : ''}`); }
  redirect(volver);
}

/** Primer administrador: solo funciona mientras no exista ningún usuario, y pide la clave de instalación (APP_CLAVE). */
export async function accionPrimerAdmin(fd: FormData) {
  let err = '';
  try {
    if (await hayUsuarios()) throw new Error('Ya existe un administrador. Ingresá con tu correo.');
    const inst = process.env.APP_CLAVE;
    if (!inst) throw new Error('Falta la variable APP_CLAVE en Vercel (clave de instalación)');
    if (String(fd.get('instalacion') ?? '') !== inst) throw new Error('La clave de instalación no es correcta');
    if (fd.get('clave') !== fd.get('clave2')) throw new Error('Las contraseñas no coinciden');
    await crearUsuario({ email: String(fd.get('email')), nombre: String(fd.get('nombre')), rol: 'ADMIN', clave: String(fd.get('clave')) });
    await iniciarSesion(String(fd.get('email')), String(fd.get('clave')));
  } catch (e) { err = (e as Error).message; }
  redirect(err ? `/login?err=${encodeURIComponent(err)}` : '/usuarios?msg=' + encodeURIComponent('Administrador creado. Ahora podés crear los demás usuarios.'));
}

export async function accionSalir() {
  await cerrarSesion();
  redirect('/login');
}
