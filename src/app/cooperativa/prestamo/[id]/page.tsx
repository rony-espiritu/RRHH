import Link from 'next/link';
import { notFound } from 'next/navigation';
import { obtenerPrestamo, proyeccion, restoMinimo } from '@/lib/datos/cooperativa';
import { bs } from '@/lib/formato';
import { accionEditarPrestamo, accionPagoExterno } from '../../acciones';

export const dynamic = 'force-dynamic';

export default async function VerPrestamo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const p = await obtenerPrestamo(id);
  if (!p) notFound();
  const mon = p.moneda === 'USD' ? '$us' : 'Bs';
  const ultimo = p.pagos.at(-1)?.fecha ?? p.fecha;
  const [y, m] = ultimo.split('-').map(Number);
  const sigue = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const plan = p.estado === 'ACTIVO' ? proyeccion(p, sigue, 120, await restoMinimo()) : [];
  let saldo = Number(p.capital);
  return (
    <>
      <p><Link href="/cooperativa">← Cooperativa y préstamos</Link></p>
      <h2>{p.tipo_nombre} · {p.nombre}</h2>
      <p className="sub">{p.codigo} · préstamo del {p.fecha} · <Link href={`/personal/${p.codigo}`}>ver ficha</Link></p>
      {sp.msg && <div className="panel" style={{ borderColor: 'var(--ok)' }}>{sp.msg}</div>}
      {sp.err && <div className="error">{sp.err}</div>}
      <div className="tarjetas">
        <div className="tarjeta"><span>Monto del préstamo</span><b>{mon} {bs(p.capital)}</b></div>
        <div className="tarjeta"><span>Amortizado</span><b>{mon} {bs(p.pagado)}</b></div>
        <div className="tarjeta"><span>Saldo</span><b>{mon} {bs(p.saldo)}</b></div>
        <div className="tarjeta"><span>Cuota / interés</span><b>{bs(p.cuota)} · {Number(p.tasa_mensual)} %</b></div>
      </div>

      <form action={accionEditarPrestamo} className="panel">
        <input type="hidden" name="id" value={p.id} />
        <div className="grilla">
          <label className="campo ancho"><span>Descripción</span><input name="descripcion" defaultValue={p.descripcion ?? ''} /></label>
          <label className="campo"><span>Amortización por periodo ({mon})</span><input name="cuota" className="num" defaultValue={p.cuota} /></label>
          <label className="campo"><span>Interés mensual %</span><input name="tasa" className="num" defaultValue={p.tasa_mensual} /></label>
          <label className="campo"><span>Tipo de interés</span><select name="tipo_interes" defaultValue={p.tipo_interes}><option value="S">Sobre saldo</option><option value="P">Sobre capital original</option></select></label>
          <label className="campo"><span>Estado</span><select name="estado" defaultValue={p.estado}><option>ACTIVO</option><option>PAGADO</option><option>ANULADO</option></select></label>
          <label className="campo ancho"><span>Nota</span><input name="nota" defaultValue={p.nota ?? ''} /></label>
        </div>
        <p className="sub">Conceptos: amortización {p.concepto_amort} · interés {p.concepto_int} · planilla {p.planilla}. Los cambios rigen desde el próximo periodo que se genere.</p>
        <p><button>Guardar cambios</button></p>
      </form>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Pagos</h3>
        <table><thead><tr><th>Fecha</th><th>Tipo</th><th className="n">Capital</th><th className="n">Interés</th><th className="n">Saldo</th><th>Nota</th><th></th></tr></thead><tbody>
          {p.pagos.map((x) => {
            saldo -= Number(x.capital);
            return <tr key={x.id}><td>{x.fecha}</td><td>{x.tipo.toLowerCase()}</td><td className="n">{bs(x.capital)}</td><td className="n">{bs(x.interes)}</td>
              <td className="n">{bs(saldo)}</td><td className="sub">{x.nota}</td>
              <td>{x.tipo !== 'PLANILLA' && <form action={accionPagoExterno}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="eliminar" value={x.id} /><button className="sec">Quitar</button></form>}</td></tr>;
          })}
          {!p.pagos.length && <tr><td colSpan={7} className="sub">Sin pagos todavía.</td></tr>}
        </tbody></table>
        <form action={accionPagoExterno} className="fila" style={{ marginTop: 12 }}>
          <input type="hidden" name="id" value={p.id} />
          <b>Pago fuera de planilla</b>
          <input type="date" name="fecha" defaultValue={new Date().toISOString().slice(0, 10)} required />
          capital <input name="capital" className="num" required style={{ width: 100 }} /> interés <input name="interes" className="num" defaultValue="0" style={{ width: 80 }} />
          <input name="nota" placeholder="Nota / recibo" /><button>Registrar pago</button>
        </form>
      </div>

      {plan.length > 0 && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Plan de pagos pendiente ({plan.length} cuotas)</h3>
          <div className="tabla" style={{ maxHeight: 360 }}><table>
            <thead><tr><th>Periodo</th><th className="n">Capital</th><th className="n">Interés</th><th className="n">Total</th><th className="n">Saldo</th></tr></thead>
            <tbody>{plan.map((c) => <tr key={c.fecha}><td>{c.fecha.slice(0, 7)}</td><td className="n">{bs(c.capital)}</td><td className="n">{bs(c.interes)}</td>
              <td className="n">{bs(c.capital + c.interes)}</td><td className="n">{bs(c.saldo)}</td></tr>)}</tbody>
          </table></div>
        </div>
      )}
    </>
  );
}
