import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'RRHH Estancias Espíritu', description: 'Planillas y RRHH multiempresa' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
