import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cantidad, datosImpresion, enLetras, MESES, monto, type EmpresaImp, type FilaImp } from '@/lib/datos/impresiones';
import type { Planilla } from '@/lib/datos/planilla';
import Imprimir from '../boleta/[vinculo]/imprimir';

export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------------------------------------
 * Impresiones de respaldo para contabilidad y Ministerio de Trabajo (se guardan como PDF desde el navegador).
 * B1: planilla de sueldos, aportes patronales, previsiones (por empresa), boletas, planilla detallada y resúmenes.
 * B2: boletas (liquidación de cuenta corriente), planilla detallada y resúmenes.
 * La planilla detallada se divide en varias hojas según el ancho (repite código y nombre en cada hoja).
 * ---------------------------------------------------------------------------------------------- */

const n2 = (x: number | null | undefined) => (x == null ? '' : Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const z2 = (x: number | null | undefined) => n2(x ?? 0);
const fecha = (d: string | null | undefined, corta = false) => {
  if (!d) return '';
  const [y, m, dd] = d.slice(0, 10).split('-');
  return `${dd}/${m}/${corta ? y.slice(2) : y}`;
};
const suma = (xs: FilaImp[], f: (x: FilaImp) => number) => xs.reduce((s, x) => s + f(x), 0);

type Ctx = { p: Awaited<ReturnType<typeof datosImpresion>>['p']; prm: Awaited<ReturnType<typeof datosImpresion>>['prm']; fin: string; mes: string; pl: Planilla };

function CabeceraEmpresa({ e }: { e: EmpresaImp }) {
  return (
    <div className="imp-cab">
      <div><b>NOMBRE O RAZÓN SOCIAL:</b> {e.razon_social}</div>
      <div><b>N° EMPLEADOR MINISTERIO DE TRABAJO:</b> {e.nro_empleador_mintrab}</div>
      <div><b>N° NIT:</b> {e.nit}</div>
      <div><b>N° EMPLEADOR (Caja de Salud):</b> {e.nro_empleador_caja}</div>
      <div><b>DIRECCIÓN:</b> {e.direccion}</div>
      <div><b>TELÉFONOS:</b> {e.telefonos}</div>
    </div>
  );
}
function Firma({ e, fechaTxt }: { e: EmpresaImp; fechaTxt: string }) {
  return (
    <div className="imp-firma">
      <div><span>{e.rep_legal_nombre}</span>Nombre del Empleador o Representante Legal</div>
      <div><span>{e.rep_legal_ci}</span>N° de Documento de Identidad</div>
      <div><span>&nbsp;</span>Firma</div>
      <div className="imp-fecha">Fecha: {fechaTxt}</div>
    </div>
  );
}
const Titulo = ({ t, sub, ctx }: { t: string; sub?: string; ctx: Ctx }) => (
  <div className="imp-titulo"><h1>{t}</h1>{sub && <div>{sub}</div>}<div>(En Bolivianos)</div><div className="imp-mes">Correspondiente al mes de {ctx.mes}</div></div>
);
const DatosPersona = ({ f, i }: { f: FilaImp; i: number }) => (<>
  <td className="c">{i + 1}</td><td>{f.ci}{f.ci_expedido ? ` ${f.ci_expedido}` : ''}</td><td>{f.nombre_coma}</td><td>{f.nacionalidad}</td><td>{fecha(f.fecha_nacimiento)}</td>
  <td className="c">{f.sexo}</td><td>{f.ocupacion}</td><td>{fecha(f.fecha_ingreso)}</td><td className="c">{Number(f.dias)}</td><td className="c">{f.horas_dia}</td>
</>);
const CabPersona = () => (<>
  <th>N°</th><th>Carnet de Identidad</th><th>Nombre Completo</th><th>Nacionalidad</th><th>Fecha de Nacimiento</th><th>Sexo F/M</th><th>Ocupación que desempeña</th>
  <th>Fecha de Ingreso</th><th>Días Pag. Mes</th><th>Hrs. Pag. Día</th>
</>);

// ---------------------------------------------------------------------------------------- B1 Ministerio
const ORDEN_DESC = (f: FilaImp) => f.lineas.filter((l) => l.naturaleza === 'DESCUENTO' && ![517, 501].includes(l.codigo)).reduce((s, l) => s + l.monto, 0);
const sueldoBase = (f: FilaImp) => Number(f.lineas.find((l) => l.codigo === 2)?.base ?? monto(f, 2));
const otrosBonos = (f: FilaImp) => f.lineas.filter((l) => l.naturaleza === 'INGRESO' && ![2, 4, 8, 24].includes(l.codigo)).reduce((s, l) => s + l.monto, 0);

function Sueldos({ e, xs, ctx }: { e: EmpresaImp; xs: FilaImp[]; ctx: Ctx }) {
  return (
    <section className="hoja a4l">
      <CabeceraEmpresa e={e} />
      <Titulo t="PLANILLA DE SUELDOS Y SALARIOS" sub="PERSONAL PERMANENTE" ctx={ctx} />
      <table className="imp">
        <thead>
          <tr><CabPersona /><th>Sueldo Básico</th><th>Salario Ganado</th><th>Bono Antigüedad</th><th>H.E. Número</th><th>H.E. Monto</th><th>Bonos Otros</th>
            <th>Bono Nivel</th><th>Total Ganado</th><th>Gestora</th><th>RC-IVA</th><th>Otros Desc.</th><th>Total Descuentos</th><th>Líquido Pagable</th><th className="firma-col">Firma</th></tr>
        </thead>
        <tbody>
          {xs.map((f, i) => (
            <tr key={f.pt_id}><DatosPersona f={f} i={i} />
              <td className="n">{z2(sueldoBase(f))}</td><td className="n">{z2(monto(f, 2))}</td><td className="n">{z2(monto(f, 8))}</td><td className="n">{z2(cantidad(f, 4))}</td>
              <td className="n">{z2(monto(f, 4))}</td><td className="n">{z2(otrosBonos(f))}</td><td className="n">{z2(monto(f, 24))}</td><td className="n b">{z2(f.total_ganado)}</td>
              <td className="n">{z2(monto(f, 517))}</td><td className="n">{z2(monto(f, 501))}</td><td className="n">{z2(ORDEN_DESC(f))}</td><td className="n">{z2(f.total_descuentos)}</td>
              <td className="n b">{z2(f.liquido)}</td><td className="firma-col">__________</td></tr>
          ))}
          <tr className="tot"><td colSpan={10}>TOTAL</td><td className="n">{z2(suma(xs, sueldoBase))}</td><td className="n">{z2(suma(xs, (f) => monto(f, 2)))}</td>
            <td className="n">{z2(suma(xs, (f) => monto(f, 8)))}</td><td className="n">{z2(suma(xs, (f) => cantidad(f, 4)))}</td><td className="n">{z2(suma(xs, (f) => monto(f, 4)))}</td>
            <td className="n">{z2(suma(xs, otrosBonos))}</td><td className="n">{z2(suma(xs, (f) => monto(f, 24)))}</td><td className="n">{z2(suma(xs, (f) => Number(f.total_ganado)))}</td>
            <td className="n">{z2(suma(xs, (f) => monto(f, 517)))}</td><td className="n">{z2(suma(xs, (f) => monto(f, 501)))}</td><td className="n">{z2(suma(xs, ORDEN_DESC))}</td>
            <td className="n">{z2(suma(xs, (f) => Number(f.total_descuentos)))}</td><td className="n">{z2(suma(xs, (f) => Number(f.liquido)))}</td><td></td></tr>
        </tbody>
      </table>
      <Firma e={e} fechaTxt={ctx.mes} />
    </section>
  );
}

function Patronal({ e, xs, ctx }: { e: EmpresaImp; xs: FilaImp[]; ctx: Ctx }) {
  const tasaR = ctx.prm.RIESGO_PAT;
  const riesgo = (f: FilaImp) => { const l = f.lineas.find((x) => x.codigo === 912); return l && Number(l.tasa) > ctx.prm.SOLIDARIO_PAT + 1e-6 ? Math.round(Number(f.total_ganado) * tasaR * 100) / 100 : 0; };
  const solid = (f: FilaImp) => Math.round((monto(f, 912) - riesgo(f)) * 100) / 100;
  const total = (f: FilaImp) => monto(f, 910) + monto(f, 911) + monto(f, 912);
  const pc = (x: number) => `${Number((x * 100).toFixed(2))}%`;
  return (
    <section className="hoja ltl">
      <CabeceraEmpresa e={e} />
      <Titulo t="PLANILLA DE APORTES PATRONALES" sub="PERSONAL PERMANENTE" ctx={ctx} />
      <table className="imp">
        <thead><tr><CabPersona /><th>Haber Básico</th><th>Riesgo Prof. {pc(tasaR)}</th><th>Pro Vivienda {pc(ctx.prm.PROVIV_PAT)}</th>
          <th>Aporte Solidario {pc(ctx.prm.SOLIDARIO_PAT)}</th><th>Caja Cordes {pc(ctx.prm.CAJA_PAT)}</th><th>Total Aporte Patronal</th></tr></thead>
        <tbody>
          {xs.map((f, i) => <tr key={f.pt_id}><DatosPersona f={f} i={i} /><td className="n">{z2(f.total_ganado)}</td><td className="n">{z2(riesgo(f))}</td>
            <td className="n">{z2(monto(f, 911))}</td><td className="n">{z2(solid(f))}</td><td className="n">{z2(monto(f, 910))}</td><td className="n b">{z2(total(f))}</td></tr>)}
          <tr className="tot"><td colSpan={10}>Totales</td><td className="n">{z2(suma(xs, (f) => Number(f.total_ganado)))}</td><td className="n">{z2(suma(xs, riesgo))}</td>
            <td className="n">{z2(suma(xs, (f) => monto(f, 911)))}</td><td className="n">{z2(suma(xs, solid))}</td><td className="n">{z2(suma(xs, (f) => monto(f, 910)))}</td>
            <td className="n">{z2(suma(xs, total))}</td></tr>
        </tbody>
      </table>
      <Firma e={e} fechaTxt={fecha(ctx.fin)} />
    </section>
  );
}

function Previsiones({ e, xs, ctx }: { e: EmpresaImp; xs: FilaImp[]; ctx: Ctx }) {
  return (
    <section className="hoja ltl">
      <CabeceraEmpresa e={e} />
      <Titulo t="PLANILLA DE REGISTRO DE PREVISIONES Y PROVISIONES" ctx={ctx} />
      <table className="imp">
        <thead><tr><CabPersona /><th>Total Ganado</th><th>Previsión Indemnización</th><th>Provisión Aguinaldo</th><th>Total</th></tr></thead>
        <tbody>
          {xs.map((f, i) => <tr key={f.pt_id}><DatosPersona f={f} i={i} /><td className="n">{z2(f.total_ganado)}</td><td className="n">{z2(monto(f, 914))}</td>
            <td className="n">{z2(monto(f, 913))}</td><td className="n b">{z2(monto(f, 913) + monto(f, 914))}</td></tr>)}
          <tr className="tot"><td colSpan={10}>Totales</td><td className="n">{z2(suma(xs, (f) => Number(f.total_ganado)))}</td><td className="n">{z2(suma(xs, (f) => monto(f, 914)))}</td>
            <td className="n">{z2(suma(xs, (f) => monto(f, 913)))}</td><td className="n">{z2(suma(xs, (f) => monto(f, 913) + monto(f, 914)))}</td></tr>
        </tbody>
      </table>
      <Firma e={e} fechaTxt={fecha(ctx.fin)} />
    </section>
  );
}

// ---------------------------------------------------------------------------------------- Boletas
function UnaBoleta({ f, e, ctx }: { f: FilaImp; e: EmpresaImp; ctx: Ctx }) {
  const ing = f.lineas.filter((l) => l.naturaleza === 'INGRESO' && l.monto);
  const des = f.lineas.filter((l) => l.naturaleza === 'DESCUENTO' && l.monto);
  const filas = Math.max(ing.length, des.length, 3);
  const b2 = ctx.pl === 'B2';
  const cant = (l: (typeof ing)[number]) => (l.tasa ? `${(Number(l.tasa) * 100).toFixed(2)}%`
    : l.cantidad == null ? '' : l.codigo === 8 && !b2 ? `${Number(l.cantidad)}%` : `${n2(l.cantidad)}${l.codigo === 2 ? ' Días' : l.codigo === 4 || l.codigo === 7 ? ' Hrs' : l.codigo === 521 ? ' $us' : ''}`);
  return (
    <div className="bol">
      <div className="bol-cab"><b>{e.razon_social}</b><span>NIT {e.nit}</span></div>
      <div className="bol-tit">{b2 ? 'Liquidación de Cuenta Corriente' : 'Boleta de Pago'} por el mes de {ctx.mes}</div>
      <table className="bol-datos"><tbody>
        <tr><th>Nombre</th><td>{f.nombre_coma} ({f.codigo})</td><th>{b2 ? 'Centro de costo' : 'N° Asegurado'}</th><td>{b2 ? `${f.cc ?? ''}` : f.nro_asegurado}</td></tr>
        <tr><th>C.I.</th><td>{f.ci} {f.ci_expedido}</td><th>{b2 ? 'Días' : 'Cotiza a'}</th><td>{b2 ? Number(f.dias) : f.nua_cua ? 'Gestora Pública' : '—'}</td></tr>
        <tr><th>Cargo</th><td>{f.ocupacion}</td><th>Fecha de Ingreso</th><td>{fecha(f.fecha_ingreso)}</td></tr>
      </tbody></table>
      <table className="bol-conc">
        <thead><tr><th>Concepto</th><th className="n">Cantidad</th><th className="n">Valor</th><th>Concepto</th><th className="n">Cantidad</th><th className="n">Valor</th></tr></thead>
        <tbody>
          {Array.from({ length: filas }, (_, i) => (
            <tr key={i}><td>{ing[i]?.nombre}</td><td className="n">{ing[i] ? cant(ing[i]) : ''}</td><td className="n">{ing[i] ? n2(ing[i].monto) : ''}</td>
              <td>{des[i]?.nombre}</td><td className="n">{des[i] ? cant(des[i]) : ''}</td><td className="n">{des[i] ? n2(des[i].monto) : ''}</td></tr>
          ))}
          <tr className="tot"><td colSpan={2} className="n">Total Ingresos</td><td className="n">{n2(f.total_ganado)}</td><td colSpan={2} className="n">Total Descuentos</td><td className="n">{n2(f.total_descuentos)}</td></tr>
        </tbody>
      </table>
      <div className="bol-pie">
        <div>
          <div className="bol-liq">{b2 ? 'Saldo a pagar' : 'Líquido Pagable'}: <b>{n2(f.liquido)}</b></div>
          <div>Son: {enLetras(Number(f.liquido))} Bolivianos</div>
          {!b2 && <div className="sub">RC-IVA saldo mes siguiente: {n2(f.rciva_siguiente ?? 0)} · Saldo vacaciones: {n2(f.saldo_vacaciones ?? 0)}</div>}
        </div>
        <div className="bol-firma">____________________<br />RECIBÍ CONFORME</div>
      </div>
    </div>
  );
}
function Boletas({ xs, emp, ctx }: { xs: FilaImp[]; emp: Map<number, EmpresaImp>; ctx: Ctx }) {
  return <>{xs.map((f) => (
    <section key={f.pt_id} className="hoja a4p bol-hoja">
      <UnaBoleta f={f} e={emp.get(f.empresa_id)!} ctx={ctx} />
      <div className="bol-corte">copia</div>
      <UnaBoleta f={f} e={emp.get(f.empresa_id)!} ctx={ctx} />
    </section>
  ))}</>;
}

// ---------------------------------------------------------------------------------------- Planilla detallada (varias hojas a lo ancho)
function Detalle({ xs, agrupar, ctx, titulo }: { xs: FilaImp[]; agrupar: 'cc' | 'empresa'; ctx: Ctx; titulo: string }) {
  const nombres = new Map<number, string>();
  for (const f of xs) for (const l of f.lineas) if (l.codigo < 900 && l.monto) nombres.set(l.codigo, l.nombre);
  const cods = [...nombres.keys()].sort((a, b) => a - b);
  type Col = { k: string; t: string; v: (f: FilaImp) => number; bold?: boolean };
  const cols: Col[] = [
    ...cods.filter((c) => c < 500).map((c) => ({ k: `c${c}`, t: nombres.get(c)!, v: (f: FilaImp) => monto(f, c) })),
    { k: 'tg', t: ctx.pl === 'B1' ? 'Total Ganado' : 'Total Ingresos', v: (f) => Number(f.total_ganado), bold: true },
    ...cods.filter((c) => c >= 500).map((c) => ({ k: `c${c}`, t: nombres.get(c)!, v: (f: FilaImp) => monto(f, c) })),
    { k: 'td', t: 'Total Descuentos', v: (f) => Number(f.total_descuentos) },
    { k: 'lq', t: ctx.pl === 'B1' ? 'Líquido Pagable' : 'Saldo Cuenta Corriente', v: (f) => Number(f.liquido), bold: true },
  ];
  // columnas por hoja: hasta 11, repartidas en partes iguales entre las hojas necesarias
  const nHojas = Math.ceil(cols.length / 11), porHoja = Math.ceil(cols.length / nHojas);
  const hojas: Col[][] = [];
  for (let i = 0; i < cols.length; i += porHoja) hojas.push(cols.slice(i, i + porHoja));
  const clave = (f: FilaImp) => (agrupar === 'cc' ? `${f.cc ?? 'Sin CC'}${f.cc_desc ? ' · ' + f.cc_desc : ''}` : f.empresa);
  const orden = [...xs].sort((a, b) => clave(a).localeCompare(clave(b)) || a.nombre.localeCompare(b.nombre));
  const grupos = [...new Set(orden.map(clave))];
  return <>{hojas.map((hc, h) => (
    <section key={h} className="hoja ltl">
      <div className="imp-titulo"><h1>{titulo}</h1><div>Correspondiente al mes de {ctx.mes} · {agrupar === 'cc' ? 'por centro de costo' : 'por propietario'}</div>
        <div className="imp-hoja">Hoja {h + 1} de {hojas.length}</div></div>
      <table className="imp det">
        <thead><tr><th>N°</th><th>Código</th><th>Nombre</th><th>{agrupar === 'cc' ? 'Emp.' : 'CC'}</th><th>Días</th>{hc.map((c) => <th key={c.k} className="n">{c.t}</th>)}</tr></thead>
        <tbody>
          {(() => { let i = 0; return grupos.map((g) => { const gx = orden.filter((f) => clave(f) === g); return [
            ...gx.map((f) => <tr key={f.pt_id}><td className="c">{++i}</td><td>{f.codigo}</td><td>{f.nombre_coma}</td><td>{agrupar === 'cc' ? f.empresa : f.cc}</td>
              <td className="c">{Number(f.dias)}</td>{hc.map((c) => <td key={c.k} className={`n ${c.bold ? 'b' : ''}`}>{c.v(f) ? n2(c.v(f)) : ''}</td>)}</tr>),
            <tr key={`s${g}`} className="sub-tot"><td colSpan={5}>Subtotal {g} ({gx.length})</td>{hc.map((c) => <td key={c.k} className="n">{n2(suma(gx, c.v))}</td>)}</tr>,
          ]; }); })()}
          <tr className="tot"><td colSpan={5}>TOTAL GENERAL ({xs.length})</td>{hc.map((c) => <td key={c.k} className="n">{n2(suma(xs, c.v))}</td>)}</tr>
        </tbody>
      </table>
    </section>
  ))}</>;
}

// ---------------------------------------------------------------------------------------- Resúmenes
function Resumen({ xs, emp, ctx }: { xs: FilaImp[]; emp: Map<number, EmpresaImp>; ctx: Ctx }) {
  const b1 = ctx.pl === 'B1';
  const cargas = (f: FilaImp) => monto(f, 517) + monto(f, 525) + monto(f, 501);
  const otros = (f: FilaImp) => Number(f.total_descuentos) - cargas(f);
  const prest = (f: FilaImp) => monto(f, 506) + monto(f, 507) + monto(f, 508) + monto(f, 509);
  const ef = (f: FilaImp) => (f.forma_pago === 'EFECTIVO' || !b1 ? Number(f.liquido) : 0);
  const bco = (f: FilaImp) => (f.forma_pago !== 'EFECTIVO' && b1 ? Number(f.liquido) : 0);
  const porEmp = [...new Set(xs.map((f) => f.empresa_id))].map((id) => ({ e: emp.get(id)!, xs: xs.filter((f) => f.empresa_id === id) }))
    .sort((a, b) => a.e.codigo.localeCompare(b.e.codigo));
  const ccs = [...new Set(xs.map((f) => f.cc ?? 'Sin CC'))].sort().map((cc) => ({ cc, desc: xs.find((f) => (f.cc ?? 'Sin CC') === cc)?.cc_desc ?? '', xs: xs.filter((f) => (f.cc ?? 'Sin CC') === cc) }));
  const altas = xs.filter((f) => f.fecha_ingreso >= ctx.fin.slice(0, 8) + '01');
  const bajas = xs.filter((f) => f.fecha_retiro && f.fecha_retiro <= ctx.fin);
  return (
    <section className="hoja a4p">
      <div className="imp-titulo"><h1>RESUMEN {b1 ? 'PLANILLA DE SUELDOS Y SALARIOS (B1)' : 'CUENTA CORRIENTE (B2)'}</h1><div>Correspondiente al mes de {ctx.mes}</div></div>
      <h2 className="imp-h2">Detalle por propietario</h2>
      <table className="imp res">
        <thead><tr><th>N°</th><th>Estancia / Empresa</th><th>Propietario</th><th className="n">Trab.</th><th className="n">{b1 ? 'Total Ganado' : 'Ingresos'}</th>
          {b1 ? <><th className="n">Cargas Sociales</th><th className="n">Total Ganado Interno</th></> : <><th className="n">Préstamos</th><th className="n">Aporte Coop.</th></>}
          <th className="n">{b1 ? 'Otros Desc.' : 'Anticipos'}</th><th className="n">{b1 ? 'Efectivo' : 'Saldo'}</th>{b1 && <th className="n">Transf. Banco</th>}</tr></thead>
        <tbody>
          {porEmp.map(({ e, xs: g }, i) => (
            <tr key={e.id}><td className="c">{i + 1}</td><td>{e.estancia ?? e.codigo}</td><td>{e.propietario ?? e.razon_social}</td><td className="n">{g.length}</td><td className="n">{n2(suma(g, (f) => Number(f.total_ganado)))}</td>
              {b1 ? <><td className="n">{n2(suma(g, cargas))}</td><td className="n">{n2(suma(g, (f) => Number(f.total_ganado) - cargas(f)))}</td></>
                : <><td className="n">{n2(suma(g, prest))}</td><td className="n">{n2(suma(g, (f) => monto(f, 521)))}</td></>}
              <td className="n">{n2(suma(g, b1 ? otros : (f) => monto(f, 511)))}</td><td className="n b">{n2(suma(g, ef))}</td>{b1 && <td className="n b">{n2(suma(g, bco))}</td>}</tr>
          ))}
          <tr className="tot"><td colSpan={3}>TOTALES</td><td className="n">{xs.length}</td><td className="n">{n2(suma(xs, (f) => Number(f.total_ganado)))}</td>
            {b1 ? <><td className="n">{n2(suma(xs, cargas))}</td><td className="n">{n2(suma(xs, (f) => Number(f.total_ganado) - cargas(f)))}</td></>
              : <><td className="n">{n2(suma(xs, prest))}</td><td className="n">{n2(suma(xs, (f) => monto(f, 521)))}</td></>}
            <td className="n">{n2(suma(xs, b1 ? otros : (f) => monto(f, 511)))}</td><td className="n">{n2(suma(xs, ef))}</td>{b1 && <td className="n">{n2(suma(xs, bco))}</td>}</tr>
          {b1 && <tr className="tot"><td colSpan={8}>TOTAL LÍQUIDO PAGABLE</td><td className="n" colSpan={2}>{n2(suma(xs, (f) => Number(f.liquido)))}</td></tr>}
        </tbody>
      </table>

      <h2 className="imp-h2">Resumen por centro de costo</h2>
      <table className="imp res">
        <thead><tr><th>Centro de costo</th><th>Descripción</th><th className="n">Trab.</th><th className="n">{b1 ? 'Total Ganado' : 'Ingresos'}</th><th className="n">Descuentos</th>
          <th className="n">{b1 ? 'Líquido Pagable' : 'Saldo'}</th></tr></thead>
        <tbody>
          {ccs.map((c) => <tr key={c.cc}><td>{c.cc}</td><td>{c.desc}</td><td className="n">{c.xs.length}</td><td className="n">{n2(suma(c.xs, (f) => Number(f.total_ganado)))}</td>
            <td className="n">{n2(suma(c.xs, (f) => Number(f.total_descuentos)))}</td><td className="n b">{n2(suma(c.xs, (f) => Number(f.liquido)))}</td></tr>)}
          <tr className="tot"><td colSpan={2}>TOTAL</td><td className="n">{xs.length}</td><td className="n">{n2(suma(xs, (f) => Number(f.total_ganado)))}</td>
            <td className="n">{n2(suma(xs, (f) => Number(f.total_descuentos)))}</td><td className="n">{n2(suma(xs, (f) => Number(f.liquido)))}</td></tr>
        </tbody>
      </table>

      <h2 className="imp-h2">Altas y bajas del mes</h2>
      <table className="imp res">
        <thead><tr><th>Movimiento</th><th>Trabajador</th><th>Empresa</th><th>Centro de costo</th><th>Fecha</th></tr></thead>
        <tbody>
          {altas.map((f) => <tr key={`a${f.pt_id}`}><td>Alta</td><td>{f.nombre_coma}</td><td>{f.empresa}</td><td>{f.cc}</td><td>{fecha(f.fecha_ingreso)}</td></tr>)}
          {bajas.map((f) => <tr key={`b${f.pt_id}`}><td>Baja</td><td>{f.nombre_coma}</td><td>{f.empresa}</td><td>{f.cc}</td><td>{fecha(f.fecha_retiro)}</td></tr>)}
          {!altas.length && !bajas.length && <tr><td colSpan={5}>Sin altas ni bajas en el mes.</td></tr>}
        </tbody>
      </table>
      <div className="imp-firmas3"><div>Elaborado por<br />RRHH</div><div>Revisado por<br />Contabilidad</div><div>Aprobado por<br />Gerencia</div></div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------- Página
const DOCS_B1 = [['paquete', 'Paquete completo B1'], ['resumen', 'Resúmenes'], ['detalle-cc', 'Planilla detallada por centro de costo'],
  ['detalle-prop', 'Planilla detallada por propietario'], ['sueldos', 'Planilla de sueldos (Ministerio)'], ['patronal', 'Aportes patronales'],
  ['previsiones', 'Previsiones y provisiones'], ['boletas', 'Boletas de pago']] as const;
const DOCS_B2 = [['paquete', 'Paquete completo B2'], ['resumen', 'Resúmenes'], ['detalle-cc', 'Planilla detallada por centro de costo'],
  ['detalle-prop', 'Planilla detallada por propietario'], ['boletas', 'Liquidaciones (boletas) B2']] as const;

export default async function Imprimir_({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pl?: string; doc?: string; empresa?: string }> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const pl: Planilla = sp.pl === 'B2' ? 'B2' : 'B1';
  const doc = sp.doc ?? 'paquete';
  let d;
  try { d = await datosImpresion(id, pl); } catch { notFound(); }
  const ctx: Ctx = { p: d.p, prm: d.prm, fin: d.fin, mes: `${MESES[d.p.mes - 1]} de ${d.p.anio}`, pl };
  const emp = new Map(d.empresas.map((e) => [e.id, e]));
  const filas = sp.empresa ? d.filas.filter((f) => f.empresa === sp.empresa) : d.filas;
  const empresas = [...new Set(filas.map((f) => f.empresa_id))].map((x) => emp.get(x)!).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const porEmpresa = (C: typeof Sueldos) => empresas.map((e) => <C key={e.id} e={e} xs={filas.filter((f) => f.empresa_id === e.id)} ctx={ctx} />);
  const ver = (k: string) => doc === k || doc === 'paquete';
  const docs = pl === 'B1' ? DOCS_B1 : DOCS_B2;
  const todasEmp = [...new Set(d.filas.map((f) => f.empresa))].sort();
  const url = (c: Record<string, string | undefined>) => {
    const q = new URLSearchParams(); const v = { pl, doc, empresa: sp.empresa, ...c };
    for (const [k, x] of Object.entries(v)) if (x) q.set(k, x);
    return `?${q}`;
  };
  return (
    <div className="impresion">
      <div className="no-print imp-barra">
        <p><Link href={`/periodos/${id}`}>← Volver al periodo</Link></p>
        <h2 style={{ margin: '4px 0' }}>Impresiones {pl} · {ctx.mes}</h2>
        <div className="fila">
          <Link className={`btn ${pl === 'B1' ? '' : 'sec'}`} href={url({ pl: 'B1', doc: 'paquete' })}>B1</Link>
          <Link className={`btn ${pl === 'B2' ? '' : 'sec'}`} href={url({ pl: 'B2', doc: 'paquete' })}>B2</Link>
          <span className="sub">|</span>
          {docs.map(([k, t]) => <Link key={k} className={`btn ${doc === k ? '' : 'sec'}`} href={url({ doc: k })}>{t}</Link>)}
        </div>
        <div className="fila" style={{ marginTop: 6 }}>
          <span className="sub">Empresa:</span>
          <Link className={`btn ${sp.empresa ? 'sec' : ''}`} href={url({ empresa: undefined })}>Todas</Link>
          {todasEmp.map((e) => <Link key={e} className={`btn ${sp.empresa === e ? '' : 'sec'}`} href={url({ empresa: e })}>{e}</Link>)}
        </div>
        <div className="fila" style={{ marginTop: 10 }}>
          <Imprimir />
          <span className="sub">En el cuadro de impresión elegí <b>Destino: Guardar como PDF</b>, márgenes <b>Predeterminados</b> y activá <b>Gráficos de fondo</b>.
            Cada documento sale con su tamaño y orientación (oficio/carta horizontal, A4 vertical para boletas y resumen).</span>
        </div>
      </div>
      {!filas.length && <p className="no-print">La planilla {pl} de este periodo todavía no está calculada.</p>}
      {ver('resumen') && <Resumen xs={filas} emp={emp} ctx={ctx} />}
      {ver('detalle-cc') && <Detalle xs={filas} agrupar="cc" ctx={ctx} titulo={pl === 'B1' ? 'PLANILLA DE SUELDOS B1' : 'PLANILLA CUENTA CORRIENTE B2'} />}
      {ver('detalle-prop') && <Detalle xs={filas} agrupar="empresa" ctx={ctx} titulo={pl === 'B1' ? 'PLANILLA DE SUELDOS B1' : 'PLANILLA CUENTA CORRIENTE B2'} />}
      {pl === 'B1' && ver('sueldos') && porEmpresa(Sueldos)}
      {pl === 'B1' && ver('patronal') && porEmpresa(Patronal)}
      {pl === 'B1' && ver('previsiones') && porEmpresa(Previsiones)}
      {ver('boletas') && <Boletas xs={filas} emp={emp} ctx={ctx} />}
    </div>
  );
}
