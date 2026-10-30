import 'server-only';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { COOKIE, DURACION_H, firmar, verificar } from './sesion-firma';

export type Rol = 'ADMIN' | 'RRHH' | 'GERENCIA' | 'CONSULTA' | 'TRABAJADOR';
export type Usuario = { id: string; email: string; nombre: string | null; rol: Rol; debe_cambiar_clave: boolean; trabajador_id: number | null };

export const ROLES: { rol: Rol; nombre: string; descripcion: string }[] = [
  { rol: 'ADMIN', nombre: 'Administrador', descripcion: 'Todo, incluidos usuarios y configuración' },
  { rol: 'RRHH', nombre: 'Recursos Humanos', descripcion: 'Carga, calcula y corrige planillas, fichas, cooperativa y configuración' },
  { rol: 'GERENCIA', nombre: 'Gerencia', descripcion: 'Ve todo; aprueba, observa, cierra y reabre planillas' },
  { rol: 'CONSULTA', nombre: 'Consulta', descripcion: 'Solo ve y descarga; no modifica nada' },
  { rol: 'TRABAJADOR', nombre: 'Trabajador', descripcion: 'Solo su portal: pide vacaciones desde el celular y ve sus solicitudes' },
];

/** Qué puede hacer cada rol. */
const PERMISOS: Record<string, Rol[]> = {
  editar: ['ADMIN', 'RRHH'],            // novedades, cálculo, fichas, cooperativa, importaciones
  configurar: ['ADMIN', 'RRHH'],        // parámetros, conceptos, centros, cuentas, empresas
  enviar: ['ADMIN', 'RRHH'],            // enviar a Gerencia
  aprobar: ['ADMIN', 'GERENCIA'],       // aprobar, observar, cerrar
  reabrir: ['ADMIN', 'GERENCIA', 'RRHH'],
  usuarios: ['ADMIN'],
  vacaciones: ['ADMIN', 'RRHH', 'GERENCIA'],   // cargar solicitudes de otros, aprobar, rechazar, anular
};
export type Permiso = keyof typeof PERMISOS;
export const puede = (u: Pick<Usuario, 'rol'> | null, p: Permiso) => !!u && PERMISOS[p].includes(u.rol);

// ------------------------------------------------------------------ contraseñas (scrypt)
export function hashClave(clave: string) {
  const sal = randomBytes(16).toString('hex');
  return `scrypt$${sal}$${scryptSync(clave, sal, 64).toString('hex')}`;
}
export function claveCorrecta(clave: string, hash: string | null) {
  if (!hash?.startsWith('scrypt$')) return false;
  const [, sal, h] = hash.split('$');
  const a = Buffer.from(h, 'hex'), b = scryptSync(clave, sal, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function validarClave(clave: string) {
  if (clave.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
  if (!/[A-Za-z]/.test(clave) || !/[0-9]/.test(clave)) throw new Error('La contraseña debe tener letras y números');
}

// ------------------------------------------------------------------ sesión
export async function usuarioActual(): Promise<Usuario | null> {
  const s = await verificar((await cookies()).get(COOKIE)?.value);
  if (!s) return null;
  const [u] = await sql<Usuario[]>`select id, email, nombre, rol::text rol, coalesce(debe_cambiar_clave, false) debe_cambiar_clave, trabajador_id
                                   from usuario where id = ${s.u} and activo`;
  return u ?? null;
}

/** Corta la acción si el usuario no tiene permiso (o no inició sesión). */
export async function exigir(p: Permiso) {
  const u = await usuarioActual();
  if (!u) redirect('/login');
  if (!puede(u, p)) redirect(`/sin-permiso?p=${p}`);
  return u!;
}

export async function hayUsuarios() {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int n from usuario where clave_hash is not null`;
  return n > 0;
}

export async function iniciarSesion(email: string, clave: string) {
  const [u] = await sql<{ id: string; rol: string; clave_hash: string | null; activo: boolean; intentos_fallidos: number; bloqueado_hasta: Date | null; debe_cambiar_clave: boolean }[]>`
    select id, rol::text, clave_hash, activo, coalesce(debe_cambiar_clave, false) debe_cambiar_clave, coalesce(intentos_fallidos, 0) intentos_fallidos, bloqueado_hasta from usuario
    where lower(email) = lower(${email.trim()})
       or (position('@' in ${email.trim()}) = 0 and trabajador_id = (select id from trabajador where upper(codigo) = upper(${email.trim()})))
    limit 1`;
  if (u?.bloqueado_hasta && u.bloqueado_hasta > new Date()) throw new Error('Usuario bloqueado por varios intentos fallidos. Probá de nuevo en 15 minutos.');
  if (!u || !u.activo || !claveCorrecta(clave, u.clave_hash)) {
    if (u) await sql`update usuario set intentos_fallidos = coalesce(intentos_fallidos, 0) + 1,
                     bloqueado_hasta = case when coalesce(intentos_fallidos, 0) + 1 >= 5 then now() + interval '15 minutes' else null end where id = ${u.id}`;
    await new Promise((r) => setTimeout(r, 700));
    throw new Error('Usuario o contraseña incorrectos');
  }
  await sql`update usuario set intentos_fallidos = 0, bloqueado_hasta = null, ultimo_ingreso = now() where id = ${u.id}`;
  const valor = await firmar({ u: u.id, r: u.rol, exp: Date.now() + DURACION_H * 3600_000 });
  (await cookies()).set(COOKIE, valor, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: DURACION_H * 3600 });
  return { debeCambiar: u.debe_cambiar_clave };
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}

// ------------------------------------------------------------------ administración de usuarios
export async function listarUsuarios() {
  return [...await sql<(Usuario & { activo: boolean; ultimo_ingreso: string | null; bloqueado: boolean; codigo: string | null })[]>`
    select u.id, email, nombre, rol::text rol, coalesce(debe_cambiar_clave, false) debe_cambiar_clave, activo, u.trabajador_id,
           (select codigo from trabajador where id = u.trabajador_id) codigo,
           to_char(ultimo_ingreso at time zone 'America/La_Paz', 'DD/MM/YYYY HH24:MI') ultimo_ingreso, coalesce(bloqueado_hasta > now(), false) bloqueado
    from usuario u order by (rol = 'TRABAJADOR'), activo desc, nombre, email`];
}
export async function crearUsuario(d: { email: string; nombre: string; rol: Rol; clave: string; trabajadorId?: number | null }, por?: string) {
  let email = d.email.trim(), nombre = d.nombre.trim();
  if (d.rol === 'TRABAJADOR') {
    const [t] = await sql<{ codigo: string; nombre: string }[]>`select codigo, trim(concat_ws(' ', nombres, ap_paterno, ap_materno)) nombre from trabajador where id = ${d.trabajadorId ?? 0}`;
    if (!t) throw new Error('Elegí el trabajador');
    const [y] = await sql`select email from usuario where trabajador_id = ${d.trabajadorId!}`;
    if (y) throw new Error(`Ese trabajador ya tiene acceso (${y.email})`);
    if (!email) email = `${t.codigo.toLowerCase()}@trabajador.local`;   // sin correo: entra con su código
    if (!nombre) nombre = t.nombre;
  } else if (d.trabajadorId) throw new Error('Solo el rol Trabajador se vincula a un trabajador');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Correo inválido');
  validarClave(d.clave);
  const [x] = await sql`select 1 from usuario where lower(email) = lower(${email})`;
  if (x) throw new Error('Ya existe un usuario con ese correo');
  await sql`insert into usuario (email, nombre, rol, clave_hash, debe_cambiar_clave, activo, trabajador_id)
            values (${email.toLowerCase()}, ${nombre}, ${d.rol}::rol_usuario, ${hashClave(d.clave)}, ${!!por}, true, ${d.rol === 'TRABAJADOR' ? d.trabajadorId! : null})`;
  await sql`insert into auditoria (tabla, registro_id, accion, despues, usuario_id) values ('usuario', ${email}, 'INSERT', ${sql.json({ rol: d.rol, nombre })}, ${por ?? null})`;
}
export async function editarUsuario(id: string, d: { nombre: string; rol: Rol; activo: boolean }, por: string) {
  if (id === por && (d.rol !== 'ADMIN' || !d.activo)) throw new Error('No podés quitarte el rol de administrador ni desactivarte a vos mismo');
  const [u] = await sql<{ trabajador_id: number | null }[]>`select trabajador_id from usuario where id = ${id}`;
  if (u && (d.rol === 'TRABAJADOR') !== (u.trabajador_id != null)) throw new Error('El rol Trabajador solo es para accesos vinculados a un trabajador');
  await sql`update usuario set nombre = ${d.nombre}, rol = ${d.rol}::rol_usuario, activo = ${d.activo} where id = ${id}`;
  await sql`insert into auditoria (tabla, registro_id, accion, despues, usuario_id) values ('usuario', ${id}, 'UPDATE', ${sql.json(d)}, ${por})`;
}
export async function restablecerClave(id: string, clave: string, por: string) {
  validarClave(clave);
  await sql`update usuario set clave_hash = ${hashClave(clave)}, debe_cambiar_clave = ${id !== por}, intentos_fallidos = 0, bloqueado_hasta = null where id = ${id}`;
  await sql`insert into auditoria (tabla, registro_id, accion, usuario_id) values ('usuario', ${id}, 'CLAVE', ${por})`;
}
export async function cambiarMiClave(u: Usuario, actual: string, nueva: string) {
  const [x] = await sql<{ clave_hash: string }[]>`select clave_hash from usuario where id = ${u.id}`;
  if (!claveCorrecta(actual, x?.clave_hash ?? null)) throw new Error('La contraseña actual no es correcta');
  validarClave(nueva);
  if (actual === nueva) throw new Error('La nueva contraseña debe ser distinta');
  await sql`update usuario set clave_hash = ${hashClave(nueva)}, debe_cambiar_clave = false where id = ${u.id}`;
}
