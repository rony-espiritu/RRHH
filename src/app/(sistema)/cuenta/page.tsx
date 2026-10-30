import { redirect } from 'next/navigation';
import { ROLES, usuarioActual } from '@/lib/auth';
import { accionCambiarClave } from './acciones';

export const dynamic = 'force-dynamic';

export default async function Cuenta({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const u = await usuarioActual();
  if (!u) redirect('/login');
  const { err } = await searchParams;
  return (
    <>
      <h2>Mi cuenta</h2>
      <p className="sub">{u.nombre} · {u.email} · {ROLES.find((r) => r.rol === u.rol)?.nombre ?? u.rol}</p>
      {u.debe_cambiar_clave && <div className="aviso">Estás usando una contraseña temporal: cambiala para continuar.</div>}
      {err && <div className="error">{err}</div>}
      <form action={accionCambiarClave} className="panel" style={{ maxWidth: 420 }}>
        <h3 style={{ marginTop: 0 }}>Cambiar contraseña</h3>
        <label className="campo"><span>Contraseña actual</span><input type="password" name="actual" required autoComplete="current-password" /></label>
        <label className="campo"><span>Nueva contraseña (8+, letras y números)</span><input type="password" name="nueva" required minLength={8} autoComplete="new-password" /></label>
        <label className="campo"><span>Repetir nueva contraseña</span><input type="password" name="nueva2" required minLength={8} autoComplete="new-password" /></label>
        <p><button>Cambiar contraseña</button></p>
      </form>
    </>
  );
}
