import { redirect } from 'next/navigation';
import { hayUsuarios, usuarioActual } from '@/lib/auth';
import { accionIngresar, accionPrimerAdmin } from './acciones';

export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<{ err?: string; email?: string; volver?: string; msg?: string }> }) {
  const sp = await searchParams;
  if (await usuarioActual()) redirect(sp.volver ?? '/');
  const primero = !(await hayUsuarios());
  return (
    <div className="login">
      <div className="login-caja">
        <div className="login-marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Estancias Espíritu" />
          <b>RRHH Espíritu</b><span>Grupo Ganadero Estancias Espíritu</span>
        </div>
        {sp.err && <div className="error">{sp.err}</div>}
        {sp.msg && <div className="panel">{sp.msg}</div>}
        {primero ? (
          <form action={accionPrimerAdmin} className="login-form">
            <h2>Crear el primer administrador</h2>
            <p className="sub">Todavía no hay usuarios. Creá tu cuenta de administrador; después vas a poder crear los demás desde <b>Usuarios</b>.</p>
            <label className="campo"><span>Nombre</span><input name="nombre" required /></label>
            <label className="campo"><span>Correo</span><input type="email" name="email" required autoComplete="username" /></label>
            <label className="campo"><span>Contraseña (mínimo 8, con letras y números)</span><input type="password" name="clave" required minLength={8} autoComplete="new-password" /></label>
            <label className="campo"><span>Repetir contraseña</span><input type="password" name="clave2" required minLength={8} autoComplete="new-password" /></label>
            <label className="campo"><span>Clave de instalación (la de APP_CLAVE en Vercel)</span><input type="password" name="instalacion" required /></label>
            <button>Crear administrador e ingresar</button>
          </form>
        ) : (
          <form action={accionIngresar} className="login-form">
            <h2>Iniciar sesión</h2>
            <input type="hidden" name="volver" value={sp.volver ?? '/'} />
            <label className="campo"><span>Correo o código de trabajador</span><input type="text" name="email" required autoFocus autoCapitalize="none" defaultValue={sp.email ?? ''} autoComplete="username" /></label>
            <label className="campo"><span>Contraseña</span><input type="password" name="clave" required autoComplete="current-password" /></label>
            <button>Ingresar</button>
            <p className="sub">¿Olvidaste tu contraseña? Pedile al administrador que la restablezca.</p>
          </form>
        )}
      </div>
    </div>
  );
}
