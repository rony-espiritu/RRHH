import { redirect } from 'next/navigation';
import { listarUsuarios, puede, ROLES, usuarioActual } from '@/lib/auth';
import { accionCrearUsuario, accionEditarUsuario, accionRestablecer } from './acciones';

export const dynamic = 'force-dynamic';

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const yo = await usuarioActual();
  if (!puede(yo, 'usuarios')) redirect('/');
  const sp = await searchParams;
  const us = await listarUsuarios();
  const SelRol = ({ f, v }: { f?: string; v: string }) => <select form={f} name="rol" defaultValue={v}>{ROLES.map((r) => <option key={r.rol} value={r.rol}>{r.nombre}</option>)}</select>;
  return (
    <>
      <h2>Usuarios</h2>
      <p className="sub">Quién puede entrar al sistema y qué puede hacer. Las contraseñas se guardan cifradas: nadie, ni el administrador, puede verlas.</p>
      {sp.msg && <div className="panel" style={{ borderColor: 'var(--ok)' }}>{sp.msg}</div>}
      {sp.err && <div className="error">{sp.err}</div>}
      <div className="panel">
        <table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Activo</th><th>Último ingreso</th><th></th><th>Restablecer contraseña</th></tr></thead><tbody>
          {us.map((u) => { const f = `u${u.id}`; return (
            <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.55 }}>
              <td><input form={f} name="nombre" defaultValue={u.nombre ?? ''} style={{ width: 170 }} /></td>
              <td>{u.email}{u.id === yo!.id && <span className="chip" style={{ marginLeft: 6 }}>vos</span>}{u.bloqueado && <span className="chip CALCULADO" style={{ marginLeft: 6 }}>bloqueado</span>}
                {u.debe_cambiar_clave && <div className="sub">debe cambiar su contraseña</div>}</td>
              <td><SelRol f={f} v={u.rol} /></td>
              <td><input form={f} type="checkbox" name="activo" defaultChecked={u.activo} /></td>
              <td className="sub">{u.ultimo_ingreso ?? 'nunca'}</td>
              <td><form id={f} action={accionEditarUsuario}><input type="hidden" name="id" value={u.id} /><button>Guardar</button></form></td>
              <td><form action={accionRestablecer} className="fila"><input type="hidden" name="id" value={u.id} />
                <input type="text" name="clave" placeholder="Contraseña temporal" minLength={8} required style={{ width: 150 }} autoComplete="off" /><button className="sec">Restablecer</button></form></td>
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
          <label className="campo"><span>Contraseña temporal * (8+, letras y números)</span><input type="text" name="clave" required minLength={8} autoComplete="off" /></label>
        </div>
        <p className="sub">Al ingresar por primera vez se le pedirá cambiar la contraseña.</p>
        <p><button>Crear usuario</button></p>
      </form>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Qué puede hacer cada rol</h3>
        <table><tbody>{ROLES.map((r) => <tr key={r.rol}><td><b>{r.nombre}</b></td><td>{r.descripcion}</td></tr>)}</tbody></table>
      </div>
    </>
  );
}
