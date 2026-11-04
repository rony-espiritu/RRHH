import Link from 'next/link';
import { Fragment } from 'react';
import { nombreMes, novedadesDelPeriodo, obtenerPeriodo, personalDelPeriodo, type Planilla } from '@/lib/datos/planilla';
import { accionNovedades } from '../../acciones';
import { FiltroEmpresas, elegirEmpresas } from '../../../filtro-empresas';

export const dynamic = 'force-dynamic';

type Col = { codigo: number; titulo: string; campo: 'cantidad' | 'monto'; corto: string; grupo: 'Ingresos' | 'Descuentos'; ayuda?: string };
/** Conceptos que se pueden cargar a mano en el mes (lo fijo sale de la ficha del trabajador). */
const COLUMNAS: Record<Planilla, Col[]> = {
  B1: [
    { codigo: 4, titulo: 'Horas extra (h)', corto: 'HE', campo: 'cantidad', grupo: 'Ingresos' },
    { codigo: 9, titulo: 'Bono natalidad / defunción (Bs)', corto: 'Natalidad', campo: 'monto', grupo: 'Ingresos' },
    { codigo: 71, titulo: 'Retroactivo incremento (Bs)', corto: 'Retroactivo', campo: 'monto', grupo: 'Ingresos' },
    { codigo: 520, titulo: 'Faltas (días)', corto: 'Faltas', campo: 'cantidad', grupo: 'Descuentos', ayuda: 'Sueldo ÷ 30 × días, en Bs' },
    { codigo: 511, titulo: 'Anticipos (Bs)', corto: 'Anticipos', campo: 'monto', grupo: 'Descuentos' },
    { codigo: 508, titulo: 'Préstamo interno (Bs)', corto: 'Préstamo int.', campo: 'monto', grupo: 'Descuentos' },
    { codigo: 509, titulo: 'Interés préstamo interno (Bs)', corto: 'Interés int.', campo: 'monto', grupo: 'Descuentos' },
    { codigo: 516, titulo: 'Pedido a comerciante (Bs)', corto: 'Comerciante', campo: 'monto', grupo: 'Descuentos' },
  ],
  B2: [
    { codigo: 7, titulo: 'Horas extra B2 (h)', corto: 'HE', campo: 'cantidad', grupo: 'Ingresos' },
    { codigo: 25, titulo: 'Bono rendimiento (Bs)', corto: 'B. rendimiento', campo: 'monto', grupo: 'Ingresos', ayuda: 'Se suma al fijo de la ficha' },
    { codigo: 12, titulo: 'Bono apoyo alimentación (Bs)', corto: 'B. alimentación', campo: 'monto', grupo: 'Ingresos', ayuda: 'Se suma al fijo de la ficha' },
    { codigo: 13, titulo: 'Bono carne (Bs)', corto: 'B. carne', campo: 'monto', grupo: 'Ingresos', ayuda: 'Se suma al fijo de la ficha' },
    { codigo: 11, titulo: 'Gratificación puestero (Bs)', corto: 'Puestero', campo: 'monto', grupo: 'Ingresos', ayuda: 'Se suma al fijo de la ficha' },
    { codigo: 19, titulo: 'Bono combustible (Bs)', corto: 'B. combustible', campo: 'monto', grupo: 'Ingresos' },
    { codigo: 23, titulo: 'Bono uso de motorizados (Bs)', corto: 'B. motorizados', campo: 'monto', grupo: 'Ingresos' },
    { codigo: 75, titulo: 'Bono cumplimiento (Bs)', corto: 'B. cumplimiento', campo: 'monto', grupo: 'Ingresos' },
    { codigo: 9, titulo: 'Bono natalidad / defunción (Bs)', corto: 'Natalidad', campo: 'monto', grupo: 'Ingresos' },
    { codigo: 26, titulo: 'Abono comidas (Bs)', corto: 'Abono comidas', campo: 'monto', grupo: 'Ingresos', ayuda: 'Viene de Albor: no genera asiento' },
    { codigo: 70, titulo: 'Abono por error en descuentos (Bs)', corto: 'Abono error', campo: 'monto', grupo: 'Ingresos' },
    { codigo: 520, titulo: 'Faltas (días)', corto: 'Faltas', campo: 'cantidad', grupo: 'Descuentos', ayuda: 'Abono ÷ 30 × días, en Bs' },
    { codigo: 511, titulo: 'Anticipos (Bs)', corto: 'Anticipos', campo: 'monto', grupo: 'Descuentos', ayuda: 'Reemplaza al de Albor' },
    { codigo: 506, titulo: 'Amort. préstamo coop. (Bs)', corto: 'Préstamo coop.', campo: 'monto', grupo: 'Descuentos', ayuda: 'Se suma a Cooperativa' },
    { codigo: 507, titulo: 'Interés préstamo coop. (Bs)', corto: 'Interés coop.', campo: 'monto', grupo: 'Descuentos', ayuda: 'Se suma a Cooperativa' },
    { codigo: 508, titulo: 'Préstamo interno (Bs)', corto: 'Préstamo int.', campo: 'monto', grupo: 'Descuentos' },
    { codigo: 509, titulo: 'Interés préstamo interno (Bs)', corto: 'Interés int.', campo: 'monto', grupo: 'Descuentos' },
    { codigo: 512, titulo: 'Ventas pulpería y almacenes (Bs)', corto: 'Pulpería', campo: 'monto', grupo: 'Descuentos' },
    { codigo: 516, titulo: 'Pedido a comerciante (Bs)', corto: 'Comerciante', campo: 'monto', grupo: 'Descuentos' },
  ],
};

export default async function Novedades({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pl?: string; msg?: string; empresa?: string; cc?: string; q?: string; orden?: string; dir?: string; editar?: string }> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const pl = (sp.pl === 'B2' ? 'B2' : 'B1') as Planilla;
  const p = (await obtenerPeriodo(id))!;
  const estado = pl === 'B1' ? p.estado_b1 : p.estado_b2;
  const bloqueado = ['EN_REVISION', 'APROBADO', 'CERRADO', 'ANULADO'].includes(estado);
  const todos = (await personalDelPeriodo(p)).filter((v) => (pl === 'B1' ? v.en_b1 : v.en_b2));
  const emp = (v: (typeof todos)[number]) => (pl === 'B1' ? v.empresa : v.empresa_b2);
  const empresas = [...new Set(todos.map(emp))].sort();
  const centros = [...new Set(todos.map((v) => v.centro_costo ?? 'Sin CC'))].sort();
  const { elegidas } = elegirEmpresas(empresas, sp.empresa);
  const q = (sp.q ?? '').trim().toLowerCase();
  const personal = todos.filter((v) => elegidas.includes(emp(v)) && (!sp.cc || (v.centro_costo ?? 'Sin CC') === sp.cc)
    && (!q || v.nombre.toLowerCase().includes(q) || v.codigo.toLowerCase().includes(q)));
  // Orden por columna (clic en el título): código, nombre, empresa o centro de costo
  const ORDEN: Record<string, (v: (typeof todos)[number]) => string> = { codigo: (v) => v.codigo, nombre: (v) => v.nombre, empresa: (v) => emp(v) ?? '', cc: (v) => v.centro_costo ?? '' };
  const orden = sp.orden && ORDEN[sp.orden] ? sp.orden : undefined, desc = sp.dir === 'desc';
  if (orden) personal.sort((a, b) => (ORDEN[orden](a).localeCompare(ORDEN[orden](b), 'es') || a.nombre.localeCompare(b.nombre, 'es')) * (desc ? -1 : 1));
  const url = (c: Record<string, string | undefined>) => {
    const x = new URLSearchParams(); const v = { pl, empresa: sp.empresa, cc: sp.cc, q: sp.q, orden: sp.orden, dir: sp.dir, editar: sp.editar, ...c };
    for (const [k, y] of Object.entries(v)) if (y) x.set(k, y);
    return `?${x}`;
  };
  const nov = await novedadesDelPeriodo(id, pl);
  const valor = (vinc: number, cod: number, campo: 'cantidad' | 'monto') => {
    const xs = nov.filter((n) => n.vinculo_id === vinc && n.codigo === cod && n.origen === 'MANUAL');
    const s = xs.reduce((a, n) => a + Number(n[campo] ?? 0), 0);
    return xs.length ? String(s) : '';
  };
  const importadas = (vinc: number, cod: number) => nov.filter((n) => n.vinculo_id === vinc && n.codigo === cod && n.origen !== 'MANUAL').reduce((a, n) => a + Number(n.monto ?? n.cantidad ?? 0), 0);
  const cols = COLUMNAS[pl];
  const fmt = (x: number) => x.toLocaleString('es-BO', { maximumFractionDigits: 2 });
  const Th = ({ k, t }: { k: string; t: string }) => (
    <th><Link className="ordenar" href={url({ orden: k, dir: orden === k && !desc ? 'desc' : undefined })}>{t}{orden === k ? (desc ? ' ▼' : ' ▲') : ''}</Link></th>);
  return (
    <>
      <p><Link href={`/periodos/${id}`}>← {nombreMes(p.mes)} {p.anio}</Link></p>
      <h2>Novedades {pl} · {nombreMes(p.mes)} {p.anio}</h2>
      <p className="sub">Solo lo variable del mes. Sueldo, bono nivel, abono B2 y bonos fijos salen de la ficha del trabajador. Faltas: se cargan en días (p.ej. 0,5); no restan días pagados, se descuentan en Bs (sueldo ÷ 30 × días; 3.300 ÷ 30 × 0,5 = 55 Bs).
        {bloqueado && ' La planilla está en revisión o cerrada: no se puede modificar.'}</p>
      {pl === 'B2' && <p className="sub"><b>Anticipos B2:</b> salen de los saldos de cuenta corriente de Albor. Si escribís un monto, reemplaza al de Albor para ese trabajador
        (no hace falta volver a subir el archivo); dejalo vacío para volver al de Albor. Préstamos e intereses salen de Cooperativa: lo que pongas acá se suma.</p>}
      {sp.msg && <div className="panel"><b>{sp.msg}</b> — recuerde recalcular la planilla.</div>}
      <div className="panel filtros">
        <div className="fila"><span className="etq">Planilla</span>
          <Link className={`btn ${pl === 'B1' ? '' : 'sec'}`} href={url({ pl: 'B1', empresa: undefined, cc: undefined })}>B1</Link>
          <Link className={`btn ${pl === 'B2' ? '' : 'sec'}`} href={url({ pl: 'B2', empresa: undefined, cc: undefined })}>B2</Link></div>
        <FiltroEmpresas todas={empresas} param={sp.empresa} href={(e) => url({ empresa: e })} />
        <div className="fila"><span className="etq">Centro de costo</span>
          <Link className={`btn ${sp.cc ? 'sec' : ''}`} href={url({ cc: undefined })}>Todos</Link>
          {centros.map((c) => <Link key={c} className={`btn ${sp.cc === c ? '' : 'sec'}`} href={url({ cc: c })}>{c}</Link>)}</div>
        <form className="fila"><span className="etq">Buscar</span>
          <input type="hidden" name="pl" value={pl} />{sp.empresa && <input type="hidden" name="empresa" value={sp.empresa} />}{sp.cc && <input type="hidden" name="cc" value={sp.cc} />}{sp.orden && <input type="hidden" name="orden" value={sp.orden} />}{sp.dir && <input type="hidden" name="dir" value={sp.dir} />}
          <input name="q" defaultValue={sp.q ?? ''} placeholder="Nombre o código" /><button className="sec">Buscar</button>
          {sp.q && <Link href={url({ q: undefined })}>Quitar búsqueda</Link>}
          <span className="sub">{personal.length} de {todos.length} trabajadores</span></form>
      </div>
      <p className="sub">Hacé clic en el <b>nombre</b> para ver y editar todos sus conceptos del mes.</p>
      <div className="tabla">
        <table className="compacta">
          <thead><tr><Th k="codigo" t="Código" /><Th k="nombre" t="Nombre" /><Th k="empresa" t="Empresa" /><Th k="cc" t="CC" /><th>Novedades del mes</th><th></th></tr></thead>
          <tbody>
            {personal.map((v) => {
              const abierto = sp.editar === String(v.vinculo_id);
              const resumen = cols.map((c) => {
                const man = valor(v.vinculo_id, c.codigo, c.campo), imp = importadas(v.vinculo_id, c.codigo);
                const tot = pl === 'B2' && c.codigo === 511 ? (man !== '' ? Number(man) : imp) : (man !== '' ? Number(man) : 0) + imp;
                if (!tot) return null;
                return <span key={c.codigo} className={`chip ${c.grupo === 'Descuentos' ? 'desc' : ''}`}>{c.corto} {fmt(tot)}{c.campo === 'cantidad' ? (c.codigo === 520 ? ' d' : ' h') : ''}</span>;
              }).filter(Boolean);
              return (<Fragment key={v.vinculo_id}>
                <tr id={`v${v.vinculo_id}`} className={abierto ? 'fila-abierta' : ''}>
                  <td>{v.codigo}</td>
                  <td><Link href={`/periodos/${id}/novedades${url({ editar: abierto ? undefined : String(v.vinculo_id) })}`} scroll={false}><b>{v.nombre}</b></Link></td>
                  <td>{emp(v)}</td><td>{v.centro_costo}</td>
                  <td>{resumen.length ? <span className="nov-resumen">{resumen}</span> : <span className="sub">—</span>}</td>
                  <td><Link className="sub" href={`/periodos/${id}/novedades${url({ editar: abierto ? undefined : String(v.vinculo_id) })}`} scroll={false}>{abierto ? 'Cerrar ▲' : 'Editar ▼'}</Link></td>
                </tr>
                {abierto && (
                  <tr className="fila-editor"><td colSpan={6}>
                    <form action={accionNovedades} className="nov-editor">
                      <input type="hidden" name="periodo" value={id} /><input type="hidden" name="planilla" value={pl} />
                      <input type="hidden" name="volver" value={url({}).slice(1)} />
                      {(['Ingresos', 'Descuentos'] as const).map((g) => (
                        <fieldset key={g}><legend>{g}</legend>
                          <div className="nov-campos">
                            {cols.filter((c) => c.grupo === g).map((c) => {
                              const k = `n|${v.vinculo_id}|${pl}|${c.codigo}|${c.campo}`;
                              const val = valor(v.vinculo_id, c.codigo, c.campo);
                              const imp = importadas(v.vinculo_id, c.codigo);
                              return (
                                <label key={c.codigo} className="campo"><span>{c.titulo}</span>
                                  <input type="hidden" name={'o' + k.slice(1)} value={val} />
                                  <input name={k} className="num" defaultValue={val} disabled={bloqueado} inputMode="decimal" />
                                  <small>{pl === 'B2' && c.codigo === 511
                                    ? (imp ? (val ? `reemplaza ${fmt(imp)} de Albor` : `Albor: ${fmt(imp)}`) : c.ayuda)
                                    : imp ? `+${fmt(imp)} ${[506, 507, 508, 509].includes(c.codigo) ? 'de Cooperativa' : 'ya cargado (importado)'}` : c.ayuda}</small>
                                </label>);
                            })}
                          </div>
                        </fieldset>))}
                      {!bloqueado && <div className="fila"><button>Guardar novedades de {v.nombre.split(' ').slice(-1)[0]}</button>
                        <Link href={`/periodos/${id}/novedades${url({ editar: undefined })}`} scroll={false}>Cerrar</Link></div>}
                    </form>
                  </td></tr>)}
              </Fragment>);
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
