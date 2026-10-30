import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { puede, ROLES, usuarioActual } from '@/lib/auth';
import { accionSalir } from '../login/acciones';
import Procesando from './procesando';

/** Todo el sistema (menos la página de ingreso): exige sesión válida y usuario activo. */
export default async function Sistema({ children }: Readonly<{ children: React.ReactNode }>) {
  const u = await usuarioActual();
  if (!u) redirect('/login');
  // Contraseña temporal: primero hay que cambiarla
  const ruta = (await headers()).get('x-ruta') ?? '';
  if (u.debe_cambiar_clave && !ruta.startsWith('/cuenta')) redirect('/cuenta');
  return (
    <div className="app">
      <nav className="nav">
        <h1>RRHH Espíritu</h1>
        <small>Planillas B1 · B2</small>
        <ul>
          <li><Link href="/">Inicio</Link></li>
          <li><Link href="/periodos">Periodos</Link></li>
          <li><Link href="/personal">Personal</Link></li>
          <li><Link href="/cooperativa">Cooperativa</Link></li>
          <li><Link href="/configuracion">Configuración</Link></li>
          {puede(u, 'usuarios') && <li><Link href="/usuarios">Usuarios</Link></li>}
        </ul>
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
