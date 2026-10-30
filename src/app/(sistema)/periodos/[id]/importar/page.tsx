import Link from 'next/link';
import { DESTINOS, obtenerImportacion, previsualizarSaldos, sugerencias } from '@/lib/datos/importacion';
import { bs } from '@/lib/formato';
import { nombreMes, obtenerPeriodo } from '@/lib/datos/planilla';
import { accionAplicarAlbor, accionAplicarSaldos, accionSubirAlbor } from '../../acciones';

export const dynamic = 'force-dynamic';

export default async function Importar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ imp?: string; hoja?: string; msg?: string }> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const p = (await obtenerPeriodo(id))!;
  const imp = sp.imp ? await obtenerImportacion(Number(sp.imp)) : null;
  const hojas = imp?.log.hojas ?? [];
  const hoja = hojas.find((h) => h.nombre === sp.hoja) ?? hojas.find((h) => h.cubo) ?? hojas.find((h) => sugerencias(h).some(Boolean)) ?? hojas[0];
  let vista: Awaited<ReturnType<typeof previsualizarSaldos>> | null = null, errVista = '';
  if (hoja?.cubo) { try { vista = await previsualizarSaldos(id, hoja.cubo); } catch (e) { errVista = (e as Error).message; } }
  const sug = hoja ? sugerencias(hoja) : [];
  const numericas = hoja ? hoja.columnas.map((_, i) => i).filter((i) => i !== hoja.colCodigo && hoja.filas.some((f) => typeof f[i] === 'number')) : [];
  return (
    <>
      <p><Link href={`/periodos/${id}`}>← {nombreMes(p.mes)} {p.anio}</Link></p>
      <h2>Importar Excel de Albor</h2>
      <p className="sub"><b>Fin de mes:</b> subí el cubo de Albor con los <b>saldos de Cuenta Corriente Personal</b>; el sistema calcula los anticipos de cada trabajador,
        lo que le queda por cobrar en la B2 y lo que se le descuenta en la B1 si gastó de más.</p>
      <p className="sub">También acepta otros Excel de Albor por columnas: anticipos, préstamos y bonos variables del mes. Cada columna se carga al concepto elegido (origen Albor), en valor absoluto, y reemplaza una importación anterior de ese concepto. Los bonos que ya son fijos en la ficha del trabajador no deben importarse otra vez.</p>
      {sp.msg && <div className="aviso">{sp.msg}</div>}
      <form action={accionSubirAlbor} className="panel fila">
        <input type="hidden" name="periodo" value={id} />
        <input type="file" name="archivo" accept=".xlsx,.xls" />
        <button>{imp ? 'Subir otro archivo' : 'Leer archivo'}</button>
      </form>
      {imp && hoja?.cubo && (
        <form action={accionAplicarSaldos} className="panel">
          <input type="hidden" name="periodo" value={id} /><input type="hidden" name="imp" value={imp.id} /><input type="hidden" name="hoja" value={hoja.nombre} />
          <h3 style={{ marginTop: 0 }}>Saldos de cuenta corriente — {imp.archivo_nombre}</h3>
          <p className="sub">Saldo negativo en Albor = le queda por cobrar (se paga en B2). Saldo positivo = gastó de más (anticipo = todo su neto B2 y el exceso se descuenta en B1).</p>
          {errVista && <div className="error">{errVista}</div>}
          {vista && <>
            <div className="tabla"><table>
              <thead><tr><th>Código</th><th>Trabajador</th><th className="n">Saldo Albor</th><th className="n">Neto B2 del mes</th><th className="n">Anticipos</th>
                <th className="n">Saldo a pagar B2</th><th className="n">Descuento B1</th><th>Observación</th></tr></thead>
              <tbody>
                {vista.filas.map((f) => (
                  <tr key={f.vinculo_id} style={f.nota ? { background: 'var(--warn-soft)' } : undefined}>
                    <td>{f.codigo}</td><td>{f.nombre}</td><td className="n">{f.saldo == null ? '—' : bs(f.saldo)}</td><td className="n">{bs(f.neto)}</td>
                    <td className="n">{bs(f.anticipo)}</td><td className="n"><b>{bs(f.pagar)}</b></td><td className="n">{f.descuentoB1 ? <b>{bs(f.descuentoB1)}</b> : ''}</td>
                    <td className="sub">{[f.corregido && `Código en Albor ${f.corregido}`, f.nota].filter(Boolean).join(' · ')}</td></tr>
                ))}
                <tr className="total"><td colSpan={3}>Total</td><td className="n">{bs(vista.filas.reduce((s, f) => s + f.neto, 0))}</td>
                  <td className="n">{bs(vista.filas.reduce((s, f) => s + f.anticipo, 0))}</td><td className="n">{bs(vista.filas.reduce((s, f) => s + f.pagar, 0))}</td>
                  <td className="n">{bs(vista.filas.reduce((s, f) => s + f.descuentoB1, 0))}</td><td></td></tr>
              </tbody>
            </table></div>
            {vista.sobrantes.length > 0 && <div className="aviso">Con saldo en Albor pero sin B2 en este periodo (no se importan): {vista.sobrantes.map((x) => `${x.codigo} ${x.nombre} (${bs(x.saldo)})`).join(' · ')}</div>}
            <p><button>Aplicar y recalcular B2 y B1</button></p>
          </>}
        </form>
      )}
      {imp && hoja && !hoja.cubo && (
        <form action={accionAplicarAlbor} className="panel">
          <input type="hidden" name="periodo" value={id} /><input type="hidden" name="imp" value={imp.id} /><input type="hidden" name="hoja" value={hoja.nombre} />
          <div className="fila" style={{ marginBottom: 12 }}>
            <b>{imp.archivo_nombre}</b> · hoja:
            {hojas.map((h) => <Link key={h.nombre} className={`btn ${h.nombre === hoja.nombre ? '' : 'sec'}`} href={`?imp=${imp.id}&hoja=${encodeURIComponent(h.nombre)}`}>{h.nombre}</Link>)}
          </div>
          <p className="sub">Columna de código: <b>{hoja.columnas[hoja.colCodigo]}</b> · {hoja.filas.length} filas. Elija a qué descuento va cada columna con montos.</p>
          <div className="tabla">
            <table>
              <thead>
                <tr><th>{hoja.columnas[hoja.colCodigo]}</th>{numericas.map((i) => <th key={i} className="n">{hoja.columnas[i]}</th>)}</tr>
                <tr><th></th>{numericas.map((i) => (
                  <th key={i}><select name={`col_${i}`} defaultValue={sug[i]}>{DESTINOS.map((d) => <option key={d.valor} value={d.valor}>{d.texto}</option>)}</select></th>
                ))}</tr>
              </thead>
              <tbody>
                {hoja.filas.slice(0, 12).map((f, r) => (
                  <tr key={r}><td>{String(f[hoja.colCodigo])}</td>{numericas.map((i) => <td key={i} className="n">{typeof f[i] === 'number' ? Number(f[i]).toFixed(2) : ''}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sub">Mostrando 12 de {hoja.filas.length} filas.</p>
          <button>Importar a novedades</button>
        </form>
      )}
    </>
  );
}
