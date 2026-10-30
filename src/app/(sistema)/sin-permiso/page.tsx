import Link from 'next/link';
import { ROLES, usuarioActual } from '@/lib/auth';

export default async function SinPermiso() {
  const u = await usuarioActual();
  return (
    <div className="panel" style={{ maxWidth: 560 }}>
      <h2 style={{ marginTop: 0 }}>Sin permiso</h2>
      <p>Tu usuario ({ROLES.find((r) => r.rol === u?.rol)?.nombre ?? u?.rol}) no tiene permiso para esa acción. Si la necesitás, pedíselo al administrador.</p>
      <p><Link href="/">Volver al inicio</Link></p>
    </div>
  );
}
