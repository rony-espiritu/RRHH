import Link from 'next/link';
import { notFound } from 'next/navigation';
import { nombreMes, obtenerPeriodo, resumenPorEmpresa, type Planilla } from '@/lib/datos/planilla';
import { bs } from '@/lib/formato';
import { accionCalcular, accionEstado } from '../acciones';

export const dynamic = 'force-dynamic';

function Acciones({ id, pl, estado }: { id: number; pl: Planilla; estado: string }) {
  const boton = (accion: string, texto: string, sec = false) => (
    <form action={accionEstado} style={{ display: 'inline' }}>
      <input type="hidden" name="periodo" value={id} /><input type="hidden" name="planilla" value={pl} />
      <input type="hidden" name="accion" value={accion} />
      <button className={sec ? 'sec' : ''}>{texto}</button>
    </form>
  );
  return (
    <div className="fila">
      {['ABIERTO', 'NOVEDADES', 'CALCULADO'].includes(estado) && (
        <form action={accionCalcular} style={{ display: 'inline' }}>
          <input type="hidden" name="periodo" value={id} /><input type="hidden" name="planilla" value={pl} />
          <button className={estado === 'CALCULADO' ? 'sec' : ''}>{estado === 'CALCULADO' ? 'Recalcular' : 'Calcular'} {pl}</button>
        </form>
      )}
      {estado === 'CALCULADO' && boton('ENVIAR_REVISION', 'Enviar a Gerencia')}
      {estado === 'EN_REVISION' && <>{boton('APROBAR', 'Aprobar')}{boton('OBSERVAR', 'Observar', true)}</>}
      {estado === 'APROBADO' && boton('CERRAR', 'Cerrar periodo')}
      <Link className="btn sec" href={`/periodos/${id}/novedades?pl=${pl}`}>Novedades {pl}</Link>
      <Link className="btn sec" href={`/periodos/${id}/planilla?pl=${pl}`}>Ver planilla {pl}</Link>
      {pl === 'B2' && ['ABIERTO', 'NOVEDADES', 'CALCULADO'].includes(estado) && <Link className="btn sec" href={`/periodos/${id}/importar`}>Importar Albor</Link>}
    </div>
  );
}

export default async function PeriodoDetalle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  const id = Number((await params).id);
  const { msg } = await searchParams;
  const p = await obtenerPeriodo(id);
  if (!p) notFound();
  const res = await resumenPorEmpresa(id);
  const b1 = res.filter((r) => r.planilla === 'B1'), b2 = res.filter((r) => r.planilla === 'B2');
  const tot = (xs: typeof res, k: keyof (typeof res)[number]) => xs.reduce((s, x) => s + Number(x[k]), 0);
  const empresas = [...new Set(res.map((r) => r.empresa))].sort();
  const [titulo, ...avisos] = (msg ?? '').split('|');

  return (
    <>
      <h2>Planilla de {nombreMes(p.mes)} {p.anio}</h2>
      <p className="sub">Campaña Albor {p.campana_albor} · UFV {p.ufv_inicio ?? '—'} → {p.ufv_fin ?? '—'} · TC {p.tc_usd}</p>
      {msg && <div className={titulo.startsWith('ERROR') ? 'error' : 'panel'}><b>{titulo === 'ERROR' ? 'No se pudo calcular' : titulo}</b>
        {avisos.map((a, i) => <div key={i} className={titulo === 'ERROR' ? '' : 'aviso'}>{a}</div>)}</div>}

      {(['B1', 'B2'] as const).map((pl) => {
        const filas = pl === 'B1' ? b1 : b2;
        const estado = pl === 'B1' ? p.estado_b1 : p.estado_b2;
        return (
          <div className="panel" key={pl}>
            <div className="fila" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{pl === 'B1' ? 'B1 — Planilla oficial' : 'B2 — Cuenta corriente'} <span className={`chip ${estado}`}>{estado}</span></h3>
              <Acciones id={id} pl={pl} estado={estado} />
            </div>
            {filas.length > 0 && (
              <table style={{ marginTop: 12 }}>
                <thead><tr><th>Empresa</th><th className="n">Trab.</th><th className="n">{pl === 'B1' ? 'Total ganado' : 'Ingresos'}</th>
                  <th className="n">Descuentos</th><th className="n">{pl === 'B1' ? 'Líquido pagable' : 'Saldo cuenta corriente'}</th>
                  {pl === 'B1' && <><th className="n">Aportes patronales</th><th className="n">Previsiones</th></>}</tr></thead>
                <tbody>
                  {filas.map((r) => (
                    <tr key={r.empresa}><td>{r.empresa} <small style={{ color: 'var(--muted)' }}>{r.razon_social}</small></td>
                      <td className="n">{r.trabajadores}</td><td className="n">{bs(r.total_ganado)}</td><td className="n">{bs(r.descuentos)}</td>
                      <td className="n">{bs(r.liquido)}</td>{pl === 'B1' && <><td className="n">{bs(r.patronal)}</td><td className="n">{bs(r.provisiones)}</td></>}</tr>
                  ))}
                  <tr className="total"><td>Total</td><td className="n">{tot(filas, 'trabajadores')}</td><td className="n">{bs(tot(filas, 'total_ganado'))}</td>
                    <td className="n">{bs(tot(filas, 'descuentos'))}</td><td className="n">{bs(tot(filas, 'liquido'))}</td>
                    {pl === 'B1' && <><td className="n">{bs(tot(filas, 'patronal'))}</td><td className="n">{bs(tot(filas, 'provisiones'))}</td></>}</tr>
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {b1.length > 0 && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Archivos de salida</h3>
          <table>
            <thead><tr><th>Empresa</th><th>Banco Unión (TXT)</th><th>Ministerio de Trabajo (OVT)</th></tr></thead>
            <tbody>
              {b1.map((r) => (
                <tr key={r.empresa}><td>{r.empresa}</td>
                  <td>{r.empresa === 'BASP' ? '—' : <a href={`/periodos/${id}/descargas?tipo=union&empresa=${r.empresa}`}>bco-{r.empresa}.txt</a>}</td>
                  <td><a href={`/periodos/${id}/descargas?tipo=ovt&empresa=${r.empresa}`}>OVT {r.empresa}.csv</a></td></tr>
              ))}
            </tbody>
          </table>
          <div className="fila" style={{ marginTop: 12 }}>
            <a className="btn sec" href={`/periodos/${id}/descargas?tipo=bnb`}>Referencia BNB (Baspel)</a>
            <a className="btn sec" href={`/periodos/${id}/descargas?tipo=efectivo&pl=B1`}>Pago en efectivo B1</a>
            {b2.length > 0 && <a className="btn sec" href={`/periodos/${id}/descargas?tipo=efectivo&pl=B2`}>Planilla de pago B2</a>}
          </div>
          <h3>Asientos para Albor</h3>
          <div className="fila">
            {b2.length > 0 && <a className="btn sec" href={`/periodos/${id}/descargas?tipo=albor&grupo=B2`}>B2 · carga inicial (día 1)</a>}
            <a className="btn sec" href={`/periodos/${id}/descargas?tipo=albor&grupo=P1`}>P1 · planilla B1</a>
            <a className="btn sec" href={`/periodos/${id}/descargas?tipo=albor&grupo=PREV_P1`}>PrevP1 · cargas y previsiones B1</a>
            {b2.length > 0 && <a className="btn sec" href={`/periodos/${id}/descargas?tipo=albor&grupo=PREV_P2`}>PrevP2 · previsiones B2</a>}
          </div>
        </div>
      )}

      {b1.length > 0 && b2.length > 0 && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Consolidado B1 + B2 (para aprobación de Gerencia)</h3>
          <table>
            <thead><tr><th>Empresa</th><th className="n">Líquido B1</th><th className="n">Saldo B2</th><th className="n">Total a pagar</th>
              <th className="n">Aportes y previsiones</th><th className="n">Costo total</th></tr></thead>
            <tbody>
              {empresas.map((e) => {
                const x1 = b1.find((r) => r.empresa === e), x2 = b2.find((r) => r.empresa === e);
                const pagar = Number(x1?.liquido ?? 0) + Number(x2?.liquido ?? 0);
                const cargas = Number(x1?.patronal ?? 0) + Number(x1?.provisiones ?? 0);
                const costo = Number(x1?.total_ganado ?? 0) + Number(x2?.total_ganado ?? 0) + cargas;
                return <tr key={e}><td>{e}</td><td className="n">{bs(x1?.liquido)}</td><td className="n">{bs(x2?.liquido)}</td>
                  <td className="n">{bs(pagar)}</td><td className="n">{bs(cargas)}</td><td className="n">{bs(costo)}</td></tr>;
              })}
              <tr className="total"><td>Total</td><td className="n">{bs(tot(b1, 'liquido'))}</td><td className="n">{bs(tot(b2, 'liquido'))}</td>
                <td className="n">{bs(tot(b1, 'liquido') + tot(b2, 'liquido'))}</td><td className="n">{bs(tot(b1, 'patronal') + tot(b1, 'provisiones'))}</td>
                <td className="n">{bs(tot(b1, 'total_ganado') + tot(b2, 'total_ganado') + tot(b1, 'patronal') + tot(b1, 'provisiones'))}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
