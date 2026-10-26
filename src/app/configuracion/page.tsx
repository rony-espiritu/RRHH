import Link from 'next/link';
import { centros, conceptos, cuentas, empresas, parametros, tablas } from '@/lib/datos/configuracion';
import { accionAntiguedad, accionCentro, accionConcepto, accionCuenta, accionEmpresa, accionParametro, accionTramo } from './acciones';

export const dynamic = 'force-dynamic';

const PESTANAS = [['parametros', 'Parámetros'], ['tablas', 'Antigüedad y solidario'], ['conceptos-b1', 'Conceptos B1'], ['conceptos-b2', 'Conceptos B2'],
  ['centros', 'Centros de costo'], ['cuentas', 'Cuentas Albor'], ['empresas', 'Empresas']] as const;
const MESES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const TIPOS = [['001', '001 Remuneraciones'], ['002', '002 Horas extra'], ['003', '003 Cargas sociales'], ['004', '004 Finiquitos'], ['006', '006 Premios y bonos'], ['007', '007 Otros']];
const primeroDeMes = () => new Date().toISOString().slice(0, 8) + '01';

function mostrar(valor: number | undefined, tipo: string) {
  if (valor == null) return '—';
  const v = Number(valor);
  if (tipo === 'pct') return `${(v * 100).toLocaleString('es-BO', { maximumFractionDigits: 4 })} %`;
  if (tipo === 'bs') return `Bs ${v.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
  if (tipo === 'mes') return MESES[v] ?? String(v);
  if (tipo === 'anios') return `${v} años`;
  return v.toLocaleString('es-BO', { maximumFractionDigits: 6 });
}
const enInput = (valor: number | undefined, tipo: string) => (valor == null ? '' : tipo === 'pct' ? String(Number((Number(valor) * 100).toFixed(4))) : String(Number(valor)));

async function Parametros() {
  const ps = await parametros();
  const grupos = [...new Set(ps.map((p) => p.meta.grupo))];
  return (
    <>
      <p className="sub">Cada cambio rige desde la fecha que indiques: las planillas de meses anteriores siguen usando el valor anterior. Los porcentajes se escriben en % (p. ej. 12,21).</p>
      {grupos.map((g) => (
        <div className="panel" key={g}>
          <h3 style={{ marginTop: 0 }}>{g}</h3>
          <table><thead><tr><th>Parámetro</th><th className="n">Valor vigente</th><th>Desde</th><th>Cambiar</th><th>Historial</th></tr></thead><tbody>
            {ps.filter((p) => p.meta.grupo === g).map((p) => (
              <tr key={p.clave}>
                <td><b>{p.meta.nombre}</b><div className="sub">{p.clave}{p.vigente?.nota ? ` · ${p.vigente.nota}` : ''}</div></td>
                <td className="n"><b>{mostrar(p.vigente?.valor, p.meta.tipo)}</b>
                  {p.programado && <div className="chip">desde {p.programado.vigente_desde}: {mostrar(p.programado.valor, p.meta.tipo)}</div>}</td>
                <td>{p.vigente?.vigente_desde ?? '—'}</td>
                <td><form action={accionParametro} className="fila">
                  <input type="hidden" name="clave" value={p.clave} />
                  <input name="valor" className="num" defaultValue={enInput(p.vigente?.valor, p.meta.tipo)} required style={{ width: 90 }} />{p.meta.tipo === 'pct' ? '%' : ''}
                  <input type="date" name="desde" defaultValue={primeroDeMes()} required />
                  <input name="nota" placeholder="Motivo / norma" style={{ width: 140 }} />
                  <button>Guardar</button>
                </form></td>
                <td>{p.historial.length > 1 ? <details><summary>{p.historial.length} valores</summary>
                  {p.historial.map((h) => <form key={h.id} action={accionParametro} className="fila" style={{ fontSize: 12 }}>
                    <input type="hidden" name="eliminar" value={h.id} />{h.vigente_desde}: {mostrar(h.valor, p.meta.tipo)} <button className="sec" style={{ padding: '2px 6px' }}>×</button></form>)}
                </details> : <span className="sub">—</span>}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      ))}
    </>
  );
}

async function Tablas() {
  const t = await tablas();
  return (
    <>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Bono de antigüedad</h3>
        <p className="sub">Porcentaje sobre 3 salarios mínimos según los años cumplidos en el vínculo. Para una tabla nueva por ley, agregá las filas con la nueva fecha.</p>
        <table><thead><tr><th>Desde años</th><th>Hasta años</th><th>%</th><th>Vigente desde</th><th></th></tr></thead><tbody>
          {t.antiguedad.map((a) => (
            <tr key={a.id}><td colSpan={5}><form action={accionAntiguedad} className="fila">
              <input type="hidden" name="id" value={a.id} />
              <input name="anios_desde" className="num" defaultValue={a.anios_desde} style={{ width: 70 }} />
              <input name="anios_hasta" className="num" defaultValue={a.anios_hasta ?? ''} placeholder="o más" style={{ width: 70 }} />
              <input name="porcentaje" className="num" defaultValue={a.porcentaje} style={{ width: 70 }} />%
              <input type="date" name="vigente_desde" defaultValue={a.vigente_desde} />
              <button>Guardar</button>
              <button className="sec" name="eliminar" value={a.id}>Quitar</button>
            </form></td></tr>
          ))}
          <tr><td colSpan={5}><form action={accionAntiguedad} className="fila">
            <b>Nueva fila</b>
            <input name="anios_desde" className="num" placeholder="desde" style={{ width: 70 }} required />
            <input name="anios_hasta" className="num" placeholder="hasta" style={{ width: 70 }} />
            <input name="porcentaje" className="num" placeholder="%" style={{ width: 70 }} required />
            <input type="date" name="vigente_desde" defaultValue={primeroDeMes()} required /><button>Agregar</button>
          </form></td></tr>
        </tbody></table>
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Aporte nacional solidario — tramos</h3>
        <p className="sub">Además del aporte solidario laboral general, se descuenta este % sobre lo que el total ganado supere cada monto.</p>
        <table><tbody>
          {t.tramos.map((a) => (
            <tr key={a.id}><td><form action={accionTramo} className="fila">
              <input type="hidden" name="id" value={a.id} />
              sobre lo que exceda Bs <input name="desde" className="num" defaultValue={a.desde} style={{ width: 100 }} />
              <input name="porcentaje" className="num" defaultValue={a.porcentaje} style={{ width: 60 }} />%
              desde <input type="date" name="vigente_desde" defaultValue={a.vigente_desde} />
              <button>Guardar</button><button className="sec" name="eliminar" value={a.id}>Quitar</button>
            </form></td></tr>
          ))}
          <tr><td><form action={accionTramo} className="fila"><b>Nuevo tramo</b>
            Bs <input name="desde" className="num" required style={{ width: 100 }} /> <input name="porcentaje" className="num" required style={{ width: 60 }} />%
            desde <input type="date" name="vigente_desde" defaultValue={primeroDeMes()} required /><button>Agregar</button></form></td></tr>
        </tbody></table>
      </div>
    </>
  );
}

async function Conceptos({ planilla, todos }: { planilla: 'B1' | 'B2'; todos: boolean }) {
  const cs = (await conceptos(planilla)).filter((c) => todos || c.activo || c.usado);
  const tab = `conceptos-${planilla.toLowerCase()}`;
  return (
    <>
      <p className="sub">
        {planilla === 'B2' ? 'Qué conceptos forman la base de las previsiones B2 (aguinaldo e indemnización) y a qué cuenta de gasto van en Albor.'
          : 'A qué cuenta de gasto va cada concepto en Albor. En B1 los aportes y las previsiones se calculan sobre el total ganado.'}
        {' '}<Link href={`?tab=${tab}${todos ? '' : '&todos=1'}`}>{todos ? 'Ver solo activos y usados' : 'Ver también los inactivos'}</Link>
      </p>
      <div className="panel">
        <table><thead><tr><th>Cód.</th><th>Nombre</th><th>Tipo</th>{planilla === 'B2' && <><th title="Base de previsión de aguinaldo">Base aguinaldo</th><th title="Base de previsión de indemnización">Base indemn.</th></>}<th>Cuenta Albor</th><th>Activo</th><th></th></tr></thead><tbody>
          {cs.map((c) => {
            const f = `c${c.id}`;
            const ingreso = c.naturaleza === 'INGRESO';
            return (
              <tr key={c.id} style={{ opacity: c.activo ? 1 : 0.55 }}>
                <td>{c.codigo}</td>
                <td><input form={f} name="nombre" defaultValue={c.nombre} style={{ width: 230 }} /></td>
                <td className="sub">{c.naturaleza.toLowerCase()}</td>
                {planilla === 'B2' ? <>
                  <td><input form={f} type="checkbox" name="afecta_aguinaldo" defaultChecked={c.afecta_aguinaldo} /></td>
                  <td><input form={f} type="checkbox" name="afecta_indemn" defaultChecked={c.afecta_indemn} /></td></>
                  : null}
                <td>{ingreso ? <select form={f} name="tipo_contable" defaultValue={c.tipo_contable ?? '001'}>{TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  : <><input form={f} type="hidden" name="tipo_contable" value={c.tipo_contable ?? ''} /><span className="sub">ver Cuentas Albor</span></>}</td>
                <td><input form={f} type="checkbox" name="activo" defaultChecked={c.activo} /></td>
                <td><form id={f} action={accionConcepto}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="codigo" value={c.codigo} />
                  <input type="hidden" name="tab" value={tab} />
                  {planilla === 'B1' && c.afecta_aguinaldo && <input type="hidden" name="afecta_aguinaldo" value="on" />}
                  {planilla === 'B1' && c.afecta_indemn && <input type="hidden" name="afecta_indemn" value="on" />}
                  {c.cotizable && <input type="hidden" name="cotizable" value="on" />}{c.afecta_rciva && <input type="hidden" name="afecta_rciva" value="on" />}
                  <button>Guardar</button></form></td>
              </tr>
            );
          })}
        </tbody></table>
      </div>
    </>
  );
}

async function Centros() {
  const cs = await centros();
  return (
    <div className="panel">
      <p className="sub" style={{ marginTop: 0 }}>Cada centro de costo define el CC y la unidad de negocio con que se sube a Albor. La unidad de negocio decide la cuenta de gasto (ver Cuentas Albor).</p>
      <table><thead><tr><th>Código</th><th>Descripción</th><th>CC Albor</th><th>UN Albor</th><th className="n">Trabajadores</th><th>Activo</th><th></th></tr></thead><tbody>
        {cs.map((c) => { const f = `cc${c.id}`; return (
          <tr key={c.id}><td><input form={f} name="codigo" defaultValue={c.codigo} style={{ width: 110 }} /></td>
            <td><input form={f} name="descripcion" defaultValue={c.descripcion} style={{ width: 240 }} /></td>
            <td><input form={f} name="albor_cc" defaultValue={c.albor_cc} style={{ width: 60 }} /></td>
            <td><input form={f} name="albor_unidad_negocio" defaultValue={c.albor_unidad_negocio} style={{ width: 60 }} /></td>
            <td className="n">{c.trabajadores}</td>
            <td><input form={f} type="checkbox" name="activo" defaultChecked={c.activo} /></td>
            <td><form id={f} action={accionCentro}><input type="hidden" name="id" value={c.id} /><button>Guardar</button></form></td></tr>
        ); })}
        <tr><td><input form="ccnuevo" name="codigo" placeholder="Código" required style={{ width: 110 }} /></td>
          <td><input form="ccnuevo" name="descripcion" placeholder="Descripción" required style={{ width: 240 }} /></td>
          <td><input form="ccnuevo" name="albor_cc" placeholder="01" required style={{ width: 60 }} /></td>
          <td><input form="ccnuevo" name="albor_unidad_negocio" placeholder="02" required style={{ width: 60 }} /></td><td></td><td></td>
          <td><form id="ccnuevo" action={accionCentro}><button>Agregar</button></form></td></tr>
      </tbody></table>
    </div>
  );
}

async function Cuentas() {
  const cs = await cuentas();
  const fila = (c: (typeof cs)[number]) => (
    <tr key={c.clave}><td className="sub">{c.clave}</td>
      <td><input form={`k${c.clave}`} name="detalle" defaultValue={c.detalle} style={{ width: 300 }} /></td>
      <td><input form={`k${c.clave}`} name="cuenta" defaultValue={c.cuenta} className="num" style={{ width: 130 }} /></td>
      <td><form id={`k${c.clave}`} action={accionCuenta}><input type="hidden" name="clave" value={c.clave} /><button>Guardar</button></form></td></tr>
  );
  return (
    <>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Cuentas de gasto</h3>
        <p className="sub">Prefijo de 6 dígitos según la unidad de negocio; el sistema le agrega el sufijo del concepto (001 remuneraciones, 002 horas extra, 003 cargas, 004 finiquitos, 006 premios).
          Si ponés la cuenta completa (más de 6 dígitos), se usa tal cual.</p>
        <table><thead><tr><th>Clave</th><th>Detalle</th><th>Cuenta</th><th></th></tr></thead><tbody>{cs.filter((c) => c.grupo === 'GASTO').map(fila)}</tbody></table>
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Cuentas de pasivo (contrapartida, CC 150 / UN PAT)</h3>
        <p className="sub">La clave es el código del descuento o aporte (517 Gestora, 913 previsión aguinaldo…).</p>
        <table><thead><tr><th>Clave</th><th>Detalle</th><th>Cuenta</th><th></th></tr></thead><tbody>{cs.filter((c) => c.grupo === 'PASIVO').map(fila)}</tbody></table>
      </div>
    </>
  );
}

async function Empresas() {
  const es = await empresas();
  const campos = (f: string, e?: (typeof es)[number]) => (
    <div className="grilla">
      {!e && <label className="campo"><span>Código *</span><input form={f} name="codigo" required maxLength={8} /></label>}
      <label className="campo ancho"><span>Razón social *</span><input form={f} name="razon_social" defaultValue={e?.razon_social} required /></label>
      <label className="campo"><span>Propietario</span><input form={f} name="propietario" defaultValue={e?.propietario ?? ''} /></label>
      <label className="campo"><span>Estancia</span><input form={f} name="estancia" defaultValue={e?.estancia ?? ''} /></label>
      <label className="campo"><span>NIT</span><input form={f} name="nit" defaultValue={e?.nit ?? ''} /></label>
      <label className="campo"><span>N° empleador Min. Trabajo</span><input form={f} name="nro_empleador_mintrab" defaultValue={e?.nro_empleador_mintrab ?? ''} /></label>
      <label className="campo"><span>N° empleador Caja</span><input form={f} name="nro_empleador_caja" defaultValue={e?.nro_empleador_caja ?? ''} /></label>
      <label className="campo"><span>Tipo</span><select form={f} name="tipo" defaultValue={e?.tipo ?? 'OFICIAL'}><option value="OFICIAL">Oficial (B1 y B2)</option><option value="SOLO_B2">Solo B2</option></select></label>
      <label className="campo"><span>Banco de pago B1</span><select form={f} name="banco_pago" defaultValue={e?.banco_pago ?? 'BANCO_UNION'}><option value="BANCO_UNION">Banco Unión</option><option value="BNB">BNB</option><option value="EFECTIVO">Efectivo</option></select></label>
      <label className="check"><input form={f} type="checkbox" name="calcula_rciva" defaultChecked={e?.calcula_rciva} /> Calcula RC-IVA</label>
      {e && <label className="check"><input form={f} type="checkbox" name="activo" defaultChecked={e.activo} /> Activa</label>}
    </div>
  );
  return (
    <>
      {es.map((e) => (
        <details key={e.id} className="panel" open={false}>
          <summary><b>{e.codigo}</b> — {e.razon_social} <span className="sub">· {e.trabajadores} trabajadores{e.activo ? '' : ' · inactiva'}</span></summary>
          <div style={{ marginTop: 12 }}>{campos(`e${e.id}`, e)}</div>
          <form id={`e${e.id}`} action={accionEmpresa}><input type="hidden" name="id" value={e.id} /><p><button>Guardar</button></p></form>
        </details>
      ))}
      <details className="panel">
        <summary><b>+ Nueva empresa</b></summary>
        <div style={{ marginTop: 12 }}>{campos('enueva')}</div>
        <form id="enueva" action={accionEmpresa}><p><button>Crear empresa</button></p></form>
      </details>
    </>
  );
}

export default async function Configuracion({ searchParams }: { searchParams: Promise<{ tab?: string; msg?: string; err?: string; todos?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab ?? 'parametros';
  return (
    <>
      <h2>Configuración</h2>
      <p className="sub">Todo lo que usa el cálculo de planillas y los asientos de Albor. Los cambios quedan registrados en la auditoría.</p>
      {sp.msg && <div className="panel" style={{ borderColor: 'var(--ok)' }}>{sp.msg}</div>}
      {sp.err && <div className="error">{sp.err}</div>}
      <nav className="pestanas">{PESTANAS.map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={k === tab ? 'activa' : ''}>{l}</Link>)}</nav>
      {tab === 'parametros' && <Parametros />}
      {tab === 'tablas' && <Tablas />}
      {tab === 'conceptos-b1' && <Conceptos planilla="B1" todos={!!sp.todos} />}
      {tab === 'conceptos-b2' && <Conceptos planilla="B2" todos={!!sp.todos} />}
      {tab === 'centros' && <Centros />}
      {tab === 'cuentas' && <Cuentas />}
      {tab === 'empresas' && <Empresas />}
    </>
  );
}
