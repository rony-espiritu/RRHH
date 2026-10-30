import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { puede, ROLES, usuarioActual } from '@/lib/auth';
import { accionSalir } from '../login/acciones';
import Menu from './menu';
import Procesando from './procesando';

const MENU: { href: string; texto: string; permiso?: 'usuarios' }[] = [
  { href: '/', texto: 'Inicio' }, { href: '/periodos', texto: 'Periodos' }, { href: '/personal', texto: 'Personal' }, { href: '/vacaciones', texto: 'Vacaciones' },
  { href: '/cooperativa', texto: 'Cooperativa' }, { href: '/configuracion', texto: 'Configuración' }, { href: '/usuarios', texto: 'Usuarios', permiso: 'usuarios' },
];

/** Todo el sistema (menos la página de ingreso): exige sesión válida y usuario activo. */
export default async function Sistema({ children }: Readonly<{ children: React.ReactNode }>) {
  const u = await usuarioActual();
  if (!u) redirect('/login');
  // Contraseña temporal: primero hay que cambiarla
  const ruta = (await headers()).get('x-ruta') ?? '';
  if (u.debe_cambiar_clave && !ruta.startsWith('/cuenta')) redirect('/cuenta');
  // El trabajador solo ve su portal
  const trabajador = u.rol === 'TRABAJADOR';
  if (trabajador && !ruta.startsWith('/mis-vacaciones') && !ruta.startsWith('/cuenta')) redirect('/mis-vacaciones');
  const menu = trabajador ? [{ href: '/mis-vacaciones', texto: 'Mis vacaciones' }, { href: '/cuenta', texto: 'Mi contraseña' }]
    : MENU.filter((m) => !m.permiso || puede(u, m.permiso)).map(({ href, texto }) => ({ href, texto }));
  return (
    <div className={trabajador ? 'app portal' : 'app'}>
      <nav className="nav">
        <div className="nav-marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" />
          <div><h1>RRHH Espíritu</h1><small>Estancias Espíritu</small></div>
        </div>
        <Menu items={menu} />
        <div className="nav-usuario">
          <Link href="/cuenta"><b>{u.nombre || u.email}</b><span>{ROLES.find((r) => r.rol === u.rol)?.nombre ?? u.rol}</span></Link>
          <form action={accionSalir}><button className="sec">Salir</button></form>
        </div>
      </nav>
      <main>{children}</main>
      <Suspense fallback={null}><Procesando /></Suspense>
    </div>
  );
}
