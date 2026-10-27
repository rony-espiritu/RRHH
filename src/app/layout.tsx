import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import Procesando from './procesando';
import './globals.css';

export const metadata: Metadata = { title: 'RRHH Estancias Espíritu', description: 'Planillas y RRHH multiempresa' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
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
            </ul>
          </nav>
          <main>{children}</main>
          <Suspense fallback={null}><Procesando /></Suspense>
        </div>
      </body>
    </html>
  );
}
