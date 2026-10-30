import Link from 'next/link';
import { notFound } from 'next/navigation';
import { catalogos, obtenerFicha, saldoVacaciones, type Ficha } from '@/lib/datos/personal';
import { nombreMes } from '@/lib/datos/planilla';
import { bs } from '@/lib/formato';
import {
  accionBaja, accionCambiarEmpresa, accionCentroCosto, accionDatosPersonales, accionDependiente, accionFijo, accionLaboral,
  accionPago, accionSeguridad, accionTasa, accionVacacion,
} from '../acciones';

export const dynamic = 'force-dynamic';

const PESTANAS = [
  ['personal', 'Datos personales'], ['laboral', 'Laboral'], ['b1', 'Planilla B1'], ['b2', 'Planilla B2'], ['gestora', 'Gestora y Caja'],
  ['banco', 'Banco'], ['boletas', 'Boletas'], ['vacaciones', 'Vacaciones'], ['finiquitos', 'Finiquitos'],
] as const;
const MOTIVOS = [[1, '1 – Retiro voluntario'], [2, '2 – Retiro forzoso / despido'], [3, '3 – Conclusión de contrato'], [4, '4 – Jubilación'], [5, '5 – Fallecimiento'], [6, '6 – Otro']] as const;
const FINIQUITOS = [['', '—'], ['FINI1', 'Finiquito liquidación 1 año'], ['FINI2', 'Finiquito liquidación 2 años'], ['FINI3', 'Finiquito liquidación 3 años'],
  ['QUIN', 'Quinquenio'], ['RETIRO', 'Retiro forzoso'], ['VOLUNT', 'Liquidación voluntaria']] as const;
const hoy = () => new Date().toISOString().slice(0, 10);
const primeroDeMes = () => hoy().slice(0, 8) + '01';

function Campo({ label, children, ancho }: { label: string; children: React.ReactNode; ancho?: boolean }) {
  return <label className={`campo ${ancho ? 'ancho' : ''}`}><span>{label}</span>{children}</label>;
}
function Ocultos({ codigo, extra }: { codigo: string; extra?: Record<string, string | number> }) {
  return <><input type="hidden" name="codigo" value={codigo} />{Object.entries(extra ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}</>;
}

// ---------------------------------------------------------------------------
function DatosPersonales({ f }: { f: Ficha }) {
  const t = f.t;
  return (
    <>
      <form action={accionDatosPersonales} className="panel">
        <Ocultos codigo={t.codigo} extra={{ id: t.id }} />
        <div className="grilla">
          <Campo label="Apellido paterno"><input name="ap_paterno" defaultValue={t.ap_paterno ?? ''} /></Campo>
          <Campo label="Apellido materno"><input name="ap_materno" defaultValue={t.ap_materno ?? ''} /></Campo>
          <Campo label="Nombres *"><input name="nombres" defaultValue={t.nombres} required /></Campo>
          <Campo label="Tipo de documento"><select name="tipo_documento" defaultValue={t.tipo_documento}>{['CI', 'PASAPORTE', 'CE'].map((x) => <option key={x}>{x}</option>)}</select></Campo>
          <Campo label="N° de documento *"><input name="ci" defaultValue={t.ci} required /></Campo>
          <Campo label="Complemento"><input name="ci_complemento" defaultValue={t.ci_complemento ?? ''} /></Campo>
          <Campo label="Expedido en"><select name="ci_expedido" defaultValue={t.ci_expedido ?? ''}>{['', 'BE', 'SC', 'LP', 'CB', 'CH', 'OR', 'PT', 'TJ', 'PD'].map((x) => <option key={x}>{x}</option>)}</select></Campo>
          <Campo label="Fecha de nacimiento"><input type="date" name="fecha_nacimiento" defaultValue={t.fecha_nacimiento ?? ''} /></Campo>
          <Campo label="Sexo"><select name="sexo" defaultValue={t.sexo ?? ''}><option value=""></option><option value="M">Masculino</option><option value="F">Femenino</option></select></Campo>
          <Campo label="Estado civil"><select name="estado_civil" defaultValue={t.estado_civil ?? ''}>{[['', ''], ['S', 'Soltero/a'], ['C', 'Casado/a'], ['V', 'Viudo/a'], ['D', 'Divorciado/a'], ['U', 'Unión libre']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Campo>
          <Campo label="Nacionalidad"><input name="nacionalidad" defaultValue={t.nacionalidad ?? ''} /></Campo>
          <Campo label="País (OVT)"><input name="pais_nacionalidad" defaultValue={t.pais_nacionalidad} /></Campo>
          <Campo label="Teléfono"><input name="telefono" defaultValue={t.telefono ?? ''} /></Campo>
          <Campo label="Correo"><input type="email" name="email" defaultValue={t.email ?? ''} /></Campo>
          <Campo label="Grupo sanguíneo"><input name="grupo_sanguineo" defaultValue={t.grupo_sanguineo ?? ''} /></Campo>
          <Campo label="Dirección" ancho><input name="direccion" defaultValue={t.direccion ?? ''} /></Campo>
          <Campo label="Contacto de emergencia" ancho><input name="contacto_emergencia" defaultValue={t.contacto_emergencia ?? ''} /></Campo>
          <Campo label="Observaciones" ancho><input name="observaciones" defaultValue={t.observaciones ?? ''} /></Campo>
          <label className="check"><input type="checkbox" name="discapacidad" defaultChecked={t.discapacidad} /> Persona con discapacidad</label>
          <label className="check"><input type="checkbox" name="tutor_discapacidad" defaultChecked={t.tutor_discapacidad} /> Tutor de persona con discapacidad</label>
        </div>
        <p><button>Guardar datos personales</button></p>
      </form>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Dependientes</h3>
        <table><thead><tr><th>Nombre</th><th>Parentesco</th><th>Nacimiento</th><th>CI</th><th></th></tr></thead><tbody>
          {f.dependientes.map((d) => (
            <tr key={d.id}><td>{d.nombre}</td><td>{d.parentesco === 'H' ? 'Hijo/a' : d.parentesco === 'C' ? 'Cónyuge' : d.parentesco}</td><td>{d.fecha_nacimiento}</td><td>{d.ci}</td>
              <td><form action={accionDependiente}><Ocultos codigo={t.codigo} extra={{ eliminar: d.id }} /><button className="sec">Quitar</button></form></td></tr>
          ))}
        </tbody></table>
        <form action={accionDependiente} className="fila" style={{ marginTop: 10 }}>
          <Ocultos codigo={t.codigo} extra={{ id: t.id }} />
          <input name="nombre" placeholder="Nombre completo" required />
          <select name="parentesco"><option value="H">Hijo/a</option><option value="C">Cónyuge</option><option value="P">Padre/Madre</option><option value="O">Otro</option></select>
          <input type="date" name="fecha_nacimiento" /><input name="ci" placeholder="CI" className="num" />
          <button>Agregar</button>
        </form>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
async function Laboral({ f }: { f: Ficha }) {
  const v = f.vigente;
  if (!v) return <p>Sin vínculo laboral.</p>;
  const c = await catalogos();
  const activa = !v.fecha_retiro;
  const ccVig = f.asignaciones.filter((a) => !a.vigente_hasta);
  return (
    <>
      <form action={accionLaboral} className="panel">
        <Ocultos codigo={f.t.codigo} extra={{ vinculo: v.id }} />
        <div className="grilla">
          <Campo label="Empresa (B1)"><input value={`${v.empresa} — ${v.empresa_nombre}`} disabled /></Campo>
          <Campo label="Fecha de ingreso"><input value={v.fecha_ingreso} disabled /></Campo>
          <Campo label="Empresa B2 (si es distinta)"><select name="empresa_b2_id" defaultValue={v.empresa_b2_id ?? ''}><option value="">La misma de B1</option>{c.empresas.map((e) => <option key={e.id} value={e.id}>{e.codigo} — {e.razon_social}</option>)}</select></Campo>
          <Campo label="Cargo"><select name="cargo_id" defaultValue={v.cargo_id ?? ''}><option value=""></option>{c.cargos.map((x) => <option key={x.id} value={x.id}>{x.descripcion}</option>)}</select></Campo>
          <Campo label="Ocupación (planilla y OVT)"><input name="ocupacion" defaultValue={v.ocupacion ?? ''} /></Campo>
          <Campo label="Área"><select name="area_id" defaultValue={v.area_id ?? ''}><option value=""></option>{c.areas.map((x) => <option key={x.id} value={x.id}>{x.descripcion}</option>)}</select></Campo>
          <Campo label="Modalidad de contrato (OVT)"><select name="modalidad_contrato" defaultValue={v.modalidad_contrato ?? 2}><option value="1">1 – Tiempo indefinido</option><option value="2">2 – Plazo fijo</option><option value="3">3 – Por temporada</option><option value="4">4 – Por obra</option></select></Campo>
          <Campo label="Tipo de contrato (OVT)"><select name="tipo_contrato" defaultValue={v.tipo_contrato ?? 1}><option value="1">1 – Escrito</option><option value="2">2 – Verbal</option></select></Campo>
          <Campo label="Horas por día"><input name="horas_dia" type="number" defaultValue={v.horas_dia ?? 8} /></Campo>
          <label className="check"><input type="checkbox" name="en_b1" defaultChecked={v.en_b1} /> Está en planilla B1 (oficial)</label>
          <label className="check"><input type="checkbox" name="en_b2" defaultChecked={v.en_b2} /> Está en B2 (cuenta corriente)</label>
          <Campo label="Observación" ancho><input name="observacion" defaultValue={v.observacion ?? ''} /></Campo>
        </div>
        <p><button disabled={!activa}>Guardar datos laborales</button></p>
      </form>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Centro de costo y destino en Albor</h3>
        <table><thead><tr><th>Centro</th><th>Planilla</th><th className="n">%</th><th>CC Albor</th><th>UN</th><th>Desde</th><th>Hasta</th></tr></thead><tbody>
          {f.asignaciones.map((a) => <tr key={a.id} style={{ color: a.vigente_hasta ? 'var(--muted)' : undefined }}><td>{a.centro} {a.descripcion}</td><td>{a.planilla ?? 'B1 y B2'}</td><td className="n">{a.porcentaje}</td><td>{a.albor_cc}</td><td>{a.albor_un}</td><td>{a.vigente_desde}</td><td>{a.vigente_hasta ?? 'vigente'}</td></tr>)}
        </tbody></table>
        {activa && <form action={accionCentroCosto} className="fila" style={{ marginTop: 10 }}>
          <Ocultos codigo={f.t.codigo} extra={{ vinculo: v.id }} />
          <select name="centro_costo_id" defaultValue={ccVig[0]?.centro_costo_id}>{c.centros.map((x) => <option key={x.id} value={x.id}>{x.codigo} — {x.descripcion} (CC {x.albor_cc} / UN {x.albor_unidad_negocio})</option>)}</select>
          desde <input type="date" name="desde" defaultValue={primeroDeMes()} required />
          <button>Cambiar centro de costo</button>
        </form>}
      </div>

      {activa && <div className="panel">
        <h3 style={{ marginTop: 0 }}>Cambio de empresa</h3>
        <p className="sub">Cierra este vínculo el día anterior con su retiro y abre uno nuevo en la empresa destino, con el mismo cargo, montos y centro de costo. La antigüedad corre desde la nueva fecha.</p>
        <form action={accionCambiarEmpresa} className="fila">
          <Ocultos codigo={f.t.codigo} extra={{ vinculo: v.id }} />
          <select name="empresa_id" required>{c.empresas.filter((e) => e.id !== v.empresa_id).map((e) => <option key={e.id} value={e.id}>{e.codigo} — {e.razon_social}</option>)}</select>
          desde <input type="date" name="fecha" defaultValue={primeroDeMes()} required />
          <select name="motivo_retiro">{MOTIVOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select name="tipo_finiquito">{FINIQUITOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <button>Registrar cambio</button>
        </form>
        <h3>Baja</h3>
        <form action={accionBaja} className="fila">
          <Ocultos codigo={f.t.codigo} extra={{ vinculo: v.id }} />
          Último día trabajado <input type="date" name="fecha" required />
          <select name="motivo_retiro">{MOTIVOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select name="tipo_finiquito">{FINIQUITOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <button className="sec">Dar de baja</button>
        </form>
      </div>}
    </>
  );
}

// ---------------------------------------------------------------------------
async function Conceptos({ f, planilla }: { f: Ficha; planilla: 'B1' | 'B2' }) {
  const v = f.vigente;
  if (!v) return <p>Sin vínculo laboral.</p>;
  const c = await catalogos();
  const fijos = f.fijos.filter((x) => x.planilla === planilla);
  const h = hoy();
  const vigentes = fijos.filter((x) => !x.vigente_hasta || x.vigente_hasta >= h);
  const historial = fijos.filter((x) => x.vigente_hasta && x.vigente_hasta < h);
  const disponibles = c.conceptos.filter((x) => x.planilla === planilla && !vigentes.some((y) => y.concepto_id === x.id));
  const tab = planilla.toLowerCase();
  const enPlanilla = planilla === 'B1' ? v.en_b1 : v.en_b2;
  const ayuda = planilla === 'B1'
    ? 'Sueldo básico (30 días), bono nivel y otros montos fijos de la planilla oficial. Las horas extra, faltas y anticipos se cargan cada mes en Novedades.'
    : 'Abono buen desempeño, bonos fijos y aporte a la cooperativa (en $us). Los anticipos llegan de Albor a fin de mes.';
  return (
    <>
      {!enPlanilla && <div className="aviso">Este trabajador no está marcado en {planilla}; sus conceptos no se calculan.</div>}
      <p className="sub">{ayuda} Cada cambio rige desde la fecha indicada; el valor anterior queda en el historial.</p>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Conceptos vigentes</h3>
        <table><thead><tr><th>Código</th><th>Concepto</th><th className="n">Cantidad</th><th className="n">Monto Bs</th><th>Desde</th><th>Cambiar desde</th><th></th></tr></thead><tbody>
          {vigentes.map((x) => (
            <tr key={x.id}><td>{x.codigo}</td><td>{x.nombre}</td><td className="n">{x.cantidad ?? ''}</td><td className="n">{bs(x.monto)}</td><td>{x.vigente_desde}{x.vigente_desde > h && <span className="chip"> programado</span>}{x.vigente_hasta && <span className="sub"> hasta {x.vigente_hasta}</span>}</td>
              <td>{!x.vigente_hasta && <form action={accionFijo} className="fila">
                <Ocultos codigo={f.t.codigo} extra={{ vinculo: v.id, concepto_id: x.concepto_id, tab }} />
                <input name="cantidad" className="num" defaultValue={x.cantidad ?? ''} placeholder="cant." title={x.codigo === 521 ? 'Dólares' : 'Días u horas'} />
                <input name="monto" className="num" defaultValue={x.monto ?? ''} placeholder="monto" />
                <input type="date" name="desde" defaultValue={primeroDeMes()} required />
                <input name="motivo" placeholder="Motivo" style={{ width: 130 }} />
                <button>Aplicar</button>
              </form>}</td>
              <td>{!x.vigente_hasta && <form action={accionFijo}><Ocultos codigo={f.t.codigo} extra={{ vinculo: v.id, concepto_id: x.concepto_id, tab, quitar: 1, desde: primeroDeMes() }} /><button className="sec" title="Deja de pagarse desde el 1° de este mes">Quitar</button></form>}</td></tr>
          ))}
          {!vigentes.length && <tr><td colSpan={7} className="sub">Sin conceptos fijos.</td></tr>}
        </tbody></table>
        <form action={accionFijo} className="fila" style={{ marginTop: 12 }}>
          <Ocultos codigo={f.t.codigo} extra={{ vinculo: v.id, tab }} />
          <b>Agregar</b>
          <select name="concepto_id">{disponibles.map((x) => <option key={x.id} value={x.id}>{x.codigo} — {x.nombre}</option>)}</select>
          <input name="cantidad" className="num" placeholder="cant." /><input name="monto" className="num" placeholder="monto" />
          desde <input type="date" name="desde" defaultValue={primeroDeMes()} required />
          <input name="motivo" placeholder="Motivo" /><button>Agregar</button>
        </form>
      </div>
      {historial.length > 0 && <div className="panel">
        <h3 style={{ marginTop: 0 }}>Historial</h3>
        <table><thead><tr><th>Concepto</th><th className="n">Cantidad</th><th className="n">Monto</th><th>Desde</th><th>Hasta</th><th>Motivo</th></tr></thead><tbody>
          {historial.map((x) => <tr key={x.id}><td>{x.codigo} {x.nombre}</td><td className="n">{x.cantidad ?? ''}</td><td className="n">{bs(x.monto)}</td><td>{x.vigente_desde}</td><td>{x.vigente_hasta}</td><td>{x.motivo}</td></tr>)}
        </tbody></table>
      </div>}
    </>
  );
}

// ---------------------------------------------------------------------------
function Gestora({ f }: { f: Ficha }) {
  const t = f.t;
  const tasas = f.tasas;
  return (
    <>
      <form action={accionSeguridad} className="panel">
        <Ocultos codigo={t.codigo} extra={{ id: t.id }} />
        <div className="grilla">
          <Campo label="NUA / CUA"><input name="nua_cua" defaultValue={t.nua_cua ?? ''} /></Campo>
          <Campo label="N° asegurado Caja CORDES"><input name="nro_asegurado" defaultValue={t.nro_asegurado ?? ''} /></Campo>
          <label className="check"><input type="checkbox" name="aporta_gestora" defaultChecked={t.aporta_gestora} /> Aporta a la Gestora</label>
          <label className="check"><input type="checkbox" name="jubilado" defaultChecked={t.jubilado} /> Jubilado</label>
        </div>
        <p className="sub">Desde los 65 años la Gestora se descuenta automáticamente con la tasa reducida (parámetro GESTORA_LAB_65).</p>
        <p><button>Guardar</button></p>
      </form>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Tasas propias del trabajador</h3>
        <p className="sub">Solo cuando el trabajador tiene un porcentaje distinto al general (por ejemplo, el aporte solidario de Sandra Meneses).</p>
        <table><thead><tr><th>Tasa</th><th className="n">Valor</th><th>Desde</th><th>Hasta</th><th>Motivo</th></tr></thead><tbody>
          {tasas.map((x) => <tr key={x.id}><td>{x.parametro_clave === 'SOLIDARIO_LAB' ? 'Aporte solidario laboral' : 'Gestora laboral'}</td><td className="n">{(Number(x.valor) * 100).toFixed(4)} %</td><td>{x.vigente_desde}</td><td>{x.vigente_hasta ?? 'vigente'}</td><td>{x.motivo}</td></tr>)}
          {!tasas.length && <tr><td colSpan={5} className="sub">Usa las tasas generales.</td></tr>}
        </tbody></table>
        <form action={accionTasa} className="fila" style={{ marginTop: 10 }}>
          <Ocultos codigo={t.codigo} extra={{ id: t.id }} />
          <select name="clave"><option value="SOLIDARIO_LAB">Aporte solidario laboral</option><option value="GESTORA_LAB">Gestora laboral</option></select>
          <input name="valor" className="num" placeholder="% (vacío = quitar)" /> %
          desde <input type="date" name="desde" defaultValue={primeroDeMes()} required />
          <input name="motivo" placeholder="Motivo" /><button>Registrar</button>
        </form>
      </div>
    </>
  );
}

function Banco({ f }: { f: Ficha }) {
  const vig = f.pagos.find((p) => !p.vigente_hasta);
  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>Pago de la planilla B1</h3>
      <p className="sub">La B2 siempre se paga en efectivo.</p>
      <table><thead><tr><th>Forma</th><th>N° de cuenta</th><th>Desde</th><th>Hasta</th></tr></thead><tbody>
        {f.pagos.map((p) => <tr key={p.id} style={{ color: p.vigente_hasta ? 'var(--muted)' : undefined }}><td>{p.forma.replace('_', ' ')}</td><td>{p.nro_cuenta}</td><td>{p.vigente_desde}</td><td>{p.vigente_hasta ?? 'vigente'}</td></tr>)}
      </tbody></table>
      <form action={accionPago} className="fila" style={{ marginTop: 10 }}>
        <Ocultos codigo={f.t.codigo} extra={{ id: f.t.id }} />
        <select name="forma" defaultValue={vig?.forma}><option value="BANCO_UNION">Banco Unión</option><option value="BNB">BNB</option><option value="EFECTIVO">Efectivo</option></select>
        <input name="nro_cuenta" placeholder="N° de cuenta" defaultValue={vig?.nro_cuenta ?? ''} />
        desde <input type="date" name="desde" defaultValue={primeroDeMes()} required />
        <button>Cambiar</button>
      </form>
    </div>
  );
}

function Boletas({ f }: { f: Ficha }) {
  return (
    <div className="panel">
      <table><thead><tr><th>Periodo</th><th>Planilla</th><th>Empresa</th><th className="n">Total ganado</th><th className="n">Descuentos</th><th className="n">Líquido / saldo</th><th>Estado</th><th></th></tr></thead><tbody>
        {f.boletas.map((b) => (
          <tr key={`${b.periodo_id}${b.planilla}`}><td>{nombreMes(b.mes)} {b.anio}</td><td>{b.planilla}</td><td>{b.empresa}</td><td className="n">{bs(b.total_ganado)}</td>
            <td className="n">{bs(b.total_descuentos)}</td><td className="n"><b>{bs(b.liquido)}</b></td><td><span className={`chip ${b.estado}`}>{b.estado}</span></td>
            <td><Link href={`/periodos/${b.periodo_id}/boleta/${b.vinculo_id}?pl=${b.planilla}`} target="_blank">Ver boleta</Link></td></tr>
        ))}
        {!f.boletas.length && <tr><td colSpan={8} className="sub">Todavía no hay planillas calculadas.</td></tr>}
      </tbody></table>
    </div>
  );
}

function Vacaciones({ f }: { f: Ficha }) {
  const s = saldoVacaciones(f);
  const v = f.vigente;
  return (
    <>
      <div className="tarjetas">
        <div className="tarjeta"><span>Años en el vínculo</span><b>{s.anios}</b></div>
        <div className="tarjeta"><span>Días ganados</span><b>{s.derecho + s.ajustes}</b></div>
        <div className="tarjeta"><span>Días tomados</span><b>{s.tomados}</b></div>
        <div className="tarjeta"><span>Saldo</span><b>{s.saldo}</b></div>
      </div>
      <p className="sub">Por cada año cumplido desde el {v?.fecha_ingreso}: 15 días (1 a 4 años), 20 días (5 a 9) y 30 días (10 o más).</p>
      {v && !v.fecha_retiro && <form action={accionVacacion} className="panel fila">
        <Ocultos codigo={f.t.codigo} extra={{ vinculo: v.id }} />
        <select name="tipo"><option value="GOZADO">Vacación tomada</option><option value="PAGADO">Vacación pagada</option><option value="AJUSTE">Ajuste (+/−)</option><option value="SALDO_INICIAL">Saldo inicial</option></select>
        <input type="date" name="desde" /> a <input type="date" name="hasta" />
        <input name="dias" className="num" placeholder="días" required /><input name="referencia" placeholder="Referencia" />
        <button>Registrar</button>
      </form>}
      <div className="panel">
        <table><thead><tr><th>Desde</th><th>Hasta</th><th>Tipo</th><th className="n">Días</th><th>Referencia</th><th></th></tr></thead><tbody>
          {f.vacaciones.filter((m) => m.vinculo_id === v?.id).map((m) => (
            <tr key={m.id}><td>{m.fecha_desde}</td><td>{m.fecha_hasta}</td><td>{m.tipo}</td><td className="n">{m.dias}</td><td>{m.referencia}</td>
              <td><form action={accionVacacion}><Ocultos codigo={f.t.codigo} extra={{ eliminar: m.id }} /><button className="sec">Quitar</button></form></td></tr>
          ))}
        </tbody></table>
      </div>
    </>
  );
}

function Finiquitos({ f }: { f: Ficha }) {
  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>Historial de vínculos</h3>
      <table><thead><tr><th>Empresa</th><th>Ingreso</th><th>Retiro</th><th>Motivo</th><th>Tipo de finiquito</th><th>Cargo</th></tr></thead><tbody>
        {f.vinculos.map((v) => <tr key={v.id}><td>{v.empresa}</td><td>{v.fecha_ingreso}</td><td>{v.fecha_retiro ?? 'vigente'}</td><td>{v.motivo_retiro ?? ''}</td><td>{v.tipo_finiquito ?? ''}</td><td>{v.ocupacion ?? v.cargo}</td></tr>)}
      </tbody></table>
      <p className="sub" style={{ marginTop: 12 }}>Ingreso al grupo: {f.t.fecha_ingreso_grupo ?? '—'}. El cálculo del finiquito (indemnización, aguinaldo y vacaciones proporcionales) se agrega en la fase 2.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
export default async function FichaTrabajador({ params, searchParams }: { params: Promise<{ codigo: string }>; searchParams: Promise<{ tab?: string; msg?: string; err?: string }> }) {
  const { codigo } = await params;
  const sp = await searchParams;
  const f = await obtenerFicha(decodeURIComponent(codigo));
  if (!f) notFound();
  const tab = sp.tab ?? 'personal';
  const v = f.vigente;
  const nombre = [f.t.ap_paterno, f.t.ap_materno, f.t.nombres].filter(Boolean).join(' ');
  return (
    <>
      <p><Link href="/personal">← Personal</Link></p>
      <div className="fila" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2>{nombre}</h2>
          <p className="sub">{f.t.codigo} · {f.t.tipo_documento} {f.t.ci} {f.t.ci_expedido ?? ''} · {v ? `${v.empresa} desde ${v.fecha_ingreso}` : 'sin vínculo'}
            {v?.fecha_retiro ? ` · retirado ${v.fecha_retiro}` : ''} · {v?.en_b1 ? 'B1 + B2' : 'solo B2'}</p>
        </div>
      </div>
      {sp.msg && <div className="panel" style={{ borderColor: 'var(--ok)' }}>{sp.msg}</div>}
      {sp.err && <div className="error">{sp.err}</div>}
      <nav className="pestanas">
        {PESTANAS.map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={k === tab ? 'activa' : ''}>{l}</Link>)}
      </nav>
      {tab === 'personal' && <DatosPersonales f={f} />}
      {tab === 'laboral' && <Laboral f={f} />}
      {tab === 'b1' && <Conceptos f={f} planilla="B1" />}
      {tab === 'b2' && <Conceptos f={f} planilla="B2" />}
      {tab === 'gestora' && <Gestora f={f} />}
      {tab === 'banco' && <Banco f={f} />}
      {tab === 'boletas' && <Boletas f={f} />}
      {tab === 'vacaciones' && <Vacaciones f={f} />}
      {tab === 'finiquitos' && <Finiquitos f={f} />}
    </>
  );
}
