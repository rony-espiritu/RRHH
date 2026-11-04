import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { correoConfigurado } from '@/lib/correo';
import { listarUsuarios, puede, ROLES, usuarioActual } from '@/lib/auth';
import { trabajadoresActivos } from '@/lib/datos/vacaciones';
import { accionCrearUsuario, accionEditarUsuario, accionRestablecer } from './acciones';

export const dynamic = 'force-dynamic';

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const yo = await usuarioActual();
  if (!puede(yo, 'usuarios')) redirect('/');
  const sp = await searchParams;
  const [us, trabs] = await Promise.all([listarUsuarios(), trabajadoresActivos()]);
  const conAcceso = new Set(us.map((u) => u.trabajador_id).filter(Boolean));
  let flash: { usuario: string; clave: string; motivo: string } | null = null;
  try { const c = (await cookies()).get('flash_clave')?.value; flash = c ? JSON.parse(c) : null; } catch { flash = null; }
  const conCorreo = correoConfigurado();
  const SelRol = ({ f, v }: { f?: string; v: string }) => <select form={f} name="rol" defaultValue={v}>{ROLES.filter((r) => r.rol !== 'TRABAJADOR').map((r) => <option key={r.rol} value={r.rol}>{r.nombre}</option>)}</select>;
  return (
    <>
      <h2>Usuarios</h2>
      <p className="sub">Quién puede entrar al sistema y qué puede hacer. Las contraseñas se guardan cifradas: nadie, ni el administrador, puede verlas.</p>
      {sp.msg && <div className="panel" style={{ borderColor: 'var(--ok)' }}>{sp.msg}</div>}
      {sp.err && <div className="error">{sp.err}</div>}
      {flash && sp.msg && <div className="panel" style={{ borderColor: 'var(--dorado)', background: '#fffaf4' }}>
        <b>Contraseña temporal</b> — {flash.motivo}<br />
        Usuario: <b>{flash.usuario}</b> · Contraseña: <b style={{ fontFamily: 'monospace', fontSize: 18, letterSpacing: 1 }}>{flash.clave}</b>
        <div className="sub" style={{ margin: '4px 0 0' }}>Anotala ahora: no se vuelve a mostrar (desaparece en 2 minutos). Al ingresar se le pedirá cambiarla.</div></div>}
      {!conCorreo && <div className="aviso">El envío de la contraseña por correo todavía no está configurado: mientras tanto el sistema la genera y la muestra acá para que se la pases.</div>}
      <div className="panel">
        <table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Activo</th><th>Último ingreso</th><th></th><th>Restablecer contraseña</th></tr></thead><tbody>
          {us.map((u) => { const f = `u${u.id}`; return (
            <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.55 }}>
              <td><input form={f} name="nombre" defaultValue={u.nombre ?? ''} style={{ width: 170 }} /></td>
              <td>{u.email.endsWith('@trabajador.local') ? <span className="sub">entra con su código <b>{u.codigo}</b></span> : u.email}{u.id === yo!.id && <span className="chip" style={{ marginLeft: 6 }}>vos</span>}{u.bloqueado && <span className="chip CALCULADO" style={{ marginLeft: 6 }}>bloqueado</span>}
                {u.debe_cambiar_clave && <div className="sub">debe cambiar su contraseña</div>}</td>
              <td>{u.rol === 'TRABAJADOR' ? <><input form={f} type="hidden" name="rol" value="TRABAJADOR" />Trabajador <span className="sub">({u.codigo})</span></> : <SelRol f={f} v={u.rol} />}</td>
              <td><input form={f} type="checkbox" name="activo" defaultChecked={u.activo} /></td>
              <td className="sub">{u.ultimo_ingreso ?? 'nunca'}</td>
              <td><form id={f} action={accionEditarUsuario}><input type="hidden" name="id" value={u.id} /><button>Guardar</button></form></td>
              <td><form action={accionRestablecer} className="fila"><input type="hidden" name="id" value={u.id} />
                <input type="text" name="clave" placeholder="Vacío = automática" minLength={8} style={{ width: 150 }} autoComplete="off" /><button className="sec">Restablecer</button></form></td>
            </tr>
          ); })}
        </tbody></table>
      </div>
      <form action={accionCrearUsuario} className="panel">
        <h3 style={{ marginTop: 0 }}>Nuevo usuario</h3>
        <div className="grilla">
          <label className="campo"><span>Nombre *</span><input name="nombre" required /></label>
          <label className="campo"><span>Correo *</span><input type="email" name="email" required autoComplete="off" /></label>
          <label className="campo"><span>Rol *</span><SelRol v="RRHH" /></label>
          <label className="campo"><span>Contraseña temporal (opcional)</span><input type="text" name="clave" minLength={8} autoComplete="off" placeholder="vacío = se genera sola" /></label>
        </div>
        <p className="sub">Si dejás la contraseña vacía, el sistema genera una y {conCorreo ? <b>se la envía a su correo</b> : 'te la muestra para que se la pases'}. Al ingresar por primera vez se le pedirá cambiarla.</p>
        <p><button>Crear usuario</button></p>
      </form>
      <form action={accionCrearUsuario} className="panel">
        <h3 style={{ marginTop: 0 }}>Acceso para un trabajador (portal de vacaciones)</h3>
        <p className="sub">El trabajador entra desde su celular con su <b>código</b> (p.ej. IJ1510) o con su correo, y solo ve su portal: pedir vacaciones y ver sus solicitudes.</p>
        <input type="hidden" name="rol" value="TRABAJADOR" />
        <div className="grilla">
          <label className="campo"><span>Trabajador *</span><select name="trabajador_id" required defaultValue="">
            <option value="" disabled>Elegir…</option>
            {trabs.filter((t) => !conAcceso.has(t.id)).map((t) => <option key={t.id} value={t.id}>{t.nombre} ({t.codigo})</option>)}</select></label>
          <label className="campo"><span>Correo (opcional)</span><input type="email" name="email" autoComplete="off" placeholder="si no tiene, entra con su código" /></label>
          <label className="campo"><span>Contraseña temporal (opcional)</span><input type="text" name="clave" minLength={8} autoComplete="off" placeholder="vacío = se genera sola" /></label>
        </div>
        <p><button>Crear acceso</button></p>
      </form>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Qué puede hacer cada rol</h3>
        <table><tbody>{ROLES.map((r) => <tr key={r.rol}><td><b>{r.nombre}</b></td><td>{r.descripcion}</td></tr>)}</tbody></table>
      </div>
    </>
  );
}
