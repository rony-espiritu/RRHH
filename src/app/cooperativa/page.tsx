import Link from 'next/link';
import { cuentasAhorro, cuotaDelPeriodo, listarPrestamos, movimientosAhorro, tiposPrestamo } from '@/lib/datos/cooperativa';
import { bs } from '@/lib/formato';
import { sql } from '@/lib/db';
import { accionAporte, accionMovAhorro, accionNuevoPrestamo, accionSaldosAhorro } from './acciones';

export const dynamic = 'force-dynamic';

const PESTANAS = [['prestamos', 'Préstamos activos'], ['ahorros', 'Ahorros'], ['nuevo', 'Nuevo préstamo'], ['pagados', 'Pagados y anulados']] as const;
const hoy = () => new Date().toISOString().slice(0, 10);
const primeroDeMes = () => hoy().slice(0, 8) + '01';
const TIPOS_MOV = [['DEPOSITO', 'Depósito (fuera de planilla)'], ['RETIRO', 'Retiro'], ['SALDO_INICIAL', 'Saldo inicial'], ['INTERES', 'Interés ganado'], ['AJUSTE', 'Ajuste (+/−)']];

async function Prestamos({ estado }: { estado: 'ACTIVO' | 'OTROS' }) {
  const ps = estado === 'ACTIVO' ? await listarPrestamos('ACTIVO') : [...await listarPrestamos('PAGADO'), ...await listarPrestamos('ANULADO')];
  const [{ tc }] = await sql<{ tc: number }[]>`select coalesce((select valor from parametro where clave = 'TC_USD' order by vigente_desde desc limit 1), 6.96) tc`;
  const tipos = [...new Set(ps.map((p) => p.tipo_nombre))];
  const bsDe = (p: (typeof ps)[number], x: number) => (p.moneda === 'USD' ? x * Number(tc) : x);
  return (
    <>
      {estado === 'ACTIVO' && <p className="sub">Cada vez que se abre un periodo se descuenta en la B2 la cuota de capital y el interés del mes (interés sobre el saldo).
        Los préstamos en $us se convierten con el tipo de cambio del periodo.</p>}
      {tipos.map((tp) => {
        const xs = ps.filter((p) => p.tipo_nombre === tp);
        return (
          <div className="panel" key={tp}>
            <h3 style={{ marginTop: 0 }}>{tp} <span className="sub">({xs.length})</span></h3>
            <div className="tabla"><table>
              <thead><tr><th>Trabajador</th><th>Fecha</th><th>Mon.</th><th className="n">Monto</th><th className="n">Pagado</th><th className="n">Saldo</th>
                <th className="n">Cuota</th><th className="n">Interés %</th>{estado === 'ACTIVO' && <><th className="n">Próx. interés</th><th className="n">Próx. descuento Bs</th><th className="n">Cuotas rest.</th></>}
                <th>Estado</th></tr></thead>
              <tbody>
                {xs.map((p) => {
                  const c = cuotaDelPeriodo(p, Number(p.saldo));
                  return (
                    <tr key={p.id}><td><Link href={`/cooperativa/prestamo/${p.id}`}>{p.codigo} · {p.nombre}</Link></td><td>{p.fecha}</td><td>{p.moneda === 'USD' ? '$us' : 'Bs'}</td>
                      <td className="n">{bs(p.capital)}</td><td className="n">{bs(p.pagado)}</td><td className="n"><b>{bs(p.saldo)}</b></td><td className="n">{bs(p.cuota)}</td>
                      <td className="n">{Number(p.tasa_mensual) ? `${Number(p.tasa_mensual)} %` : '—'}</td>
                      {estado === 'ACTIVO' && <><td className="n">{c.interes ? bs(c.interes) : ''}</td><td className="n">{bs(bsDe(p, c.capital) + bsDe(p, c.interes))}</td>
                        <td className="n">{Math.ceil(Number(p.saldo) / Number(p.cuota) - 0.0001)}</td></>}
                      <td><span className={`chip ${p.estado === 'ACTIVO' ? '' : 'CERRADO'}`}>{p.estado}</span></td></tr>
                  );
                })}
                <tr className="total"><td colSpan={3}>Total (en Bs)</td><td className="n">{bs(xs.reduce((s, p) => s + bsDe(p, Number(p.capital)), 0))}</td>
                  <td className="n">{bs(xs.reduce((s, p) => s + bsDe(p, Number(p.pagado)), 0))}</td><td className="n">{bs(xs.reduce((s, p) => s + bsDe(p, Number(p.saldo)), 0))}</td>
                  <td className="n">{bs(xs.reduce((s, p) => s + bsDe(p, Number(p.cuota)), 0))}</td><td colSpan={estado === 'ACTIVO' ? 5 : 2}></td></tr>
              </tbody>
            </table></div>
          </div>
        );
      })}
      {!ps.length && <p className="sub">No hay préstamos.</p>}
    </>
  );
}

async function Ahorros({ sel }: { sel?: string }) {
  const cs = await cuentasAhorro();
  const elegido = cs.find((c) => c.codigo === sel);
  const movs = elegido ? await movimientosAhorro(elegido.trabajador_id) : [];
  return (
    <>
      <p className="sub">El aporte mensual (en $us) se descuenta en la B2 y queda como movimiento en la cuenta de ahorro al abrir cada periodo.
        Los depósitos en caja, retiros e intereses se registran a mano.</p>
      <div className="panel">
        <div className="tabla"><table>
          <thead><tr><th>Trabajador</th><th>Aporte mensual</th><th className="n">Aportes por planilla</th><th className="n">Saldo de ahorro</th><th></th></tr></thead>
          <tbody>
            {cs.map((c) => (
              <tr key={c.trabajador_id} style={c.codigo === sel ? { background: 'var(--accent-soft)' } : undefined}>
                <td>{c.codigo} · {c.nombre}{!c.activo && <span className="sub"> (retirado)</span>}</td>
                <td>{c.vinculo_id ? <form action={accionAporte} className="fila" style={{ flexWrap: 'nowrap' }}>
                  <input type="hidden" name="vinculo" value={c.vinculo_id} /><input type="hidden" name="codigo" value={c.codigo} />
                  <input name="usd" className="num" defaultValue={c.aporte_usd ?? ''} placeholder="$us" style={{ width: 70 }} /> $us
                  desde <input type="date" name="desde" defaultValue={primeroDeMes()} style={{ width: 140 }} />
                  <button className="sec">Cambiar</button></form> : <span className="sub">—</span>}</td>
                <td className="n">{bs(c.aportes)}</td><td className="n"><b>{bs(c.saldo)}</b></td>
                <td><Link href={`?tab=ahorros&t=${c.codigo}`}>Movimientos ({c.movimientos})</Link></td></tr>
            ))}
            <tr className="total"><td colSpan={2}>Total</td><td className="n">{bs(cs.reduce((s, c) => s + Number(c.aportes), 0))}</td>
              <td className="n">{bs(cs.reduce((s, c) => s + Number(c.saldo), 0))}</td><td></td></tr>
          </tbody>
        </table></div>
      </div>
      {elegido && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Movimientos de {elegido.codigo} · {elegido.nombre}</h3>
          <table><thead><tr><th>Fecha</th><th>Tipo</th><th className="n">Monto Bs</th><th className="n">Saldo</th><th>Nota</th><th></th></tr></thead><tbody>
            {movs.reduce<{ rows: React.ReactNode[]; saldo: number }>((acc, m) => {
              acc.saldo += Number(m.monto);
              acc.rows.push(<tr key={m.id}><td>{m.fecha}</td><td>{m.tipo.replace('_', ' ').toLowerCase()}</td><td className="n">{bs(m.monto)}</td><td className="n">{bs(acc.saldo)}</td><td className="sub">{m.nota}</td>
                <td>{m.tipo !== 'APORTE_PLANILLA' && <form action={accionMovAhorro}><input type="hidden" name="codigo" value={elegido.codigo} /><input type="hidden" name="eliminar" value={m.id} /><button className="sec">Quitar</button></form>}</td></tr>);
              return acc;
            }, { rows: [], saldo: 0 }).rows}
          </tbody></table>
        </div>
      )}
      <form action={accionMovAhorro} className="panel fila">
        <b>Registrar movimiento</b>
        <input name="codigo" placeholder="Código" defaultValue={sel ?? ''} required style={{ width: 90 }} />
        <select name="tipo">{TIPOS_MOV.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input type="date" name="fecha" defaultValue={hoy()} required />
        <input name="monto" className="num" placeholder="Monto Bs" required style={{ width: 110 }} />
        <input name="nota" placeholder="Nota" /><button>Registrar</button>
      </form>
      <form action={accionSaldosAhorro} className="panel fila">
        <b>Saldos iniciales desde Albor</b>
        <span className="sub">Cubo de Albor de la cuenta 21010200401 (Cooperativa Espíritu AHORROS) con “Codigo Personal” y “Saldo”, al</span>
        <input type="date" name="fecha" defaultValue="2026-08-31" required />
        <input type="file" name="archivo" accept=".xlsx" /><button>Cargar saldos</button>
      </form>
    </>
  );
}

async function Nuevo() {
  const tipos = await tiposPrestamo();
  const trab = await sql<{ codigo: string; nombre: string }[]>`
    select distinct t.codigo, concat_ws(' ', t.ap_paterno, t.ap_materno, t.nombres) nombre from trabajador t join vinculo v on v.trabajador_id = t.id
    where v.fecha_retiro is null order by nombre`;
  return (
    <form action={accionNuevoPrestamo} className="panel">
      <p className="sub" style={{ marginTop: 0 }}>El préstamo se descuenta en la B2 desde el primer periodo que se abra (o se regenere) después de la fecha del préstamo.</p>
      <div className="grilla">
        <label className="campo ancho"><span>Trabajador *</span><select name="codigo" required><option value=""></option>{trab.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre} ({t.codigo})</option>)}</select></label>
        <label className="campo"><span>Tipo de préstamo *</span><select name="tipo">{tipos.map((t) => <option key={t.codigo} value={t.codigo}>{t.codigo} · {t.nombre} ({t.concepto_amort}/{t.concepto_int})</option>)}</select></label>
        <label className="campo"><span>Fecha del préstamo *</span><input type="date" name="fecha" defaultValue={hoy()} required /></label>
        <label className="campo ancho"><span>Descripción</span><input name="descripcion" placeholder="p. ej. Compra motorizado" /></label>
        <label className="campo"><span>Moneda</span><select name="moneda"><option value="BS">Bolivianos</option><option value="USD">Dólares</option></select></label>
        <label className="campo"><span>Monto del préstamo (capital) *</span><input name="capital" className="num" required /></label>
        <label className="campo"><span>Amortización por periodo *</span><input name="cuota" className="num" required /></label>
        <label className="campo"><span>Interés mensual %</span><input name="tasa" className="num" defaultValue="0" /></label>
        <label className="campo"><span>Tipo de interés</span><select name="tipo_interes"><option value="S">Sobre saldo</option><option value="P">Sobre capital original</option></select></label>
        <label className="campo ancho"><span>Nota</span><input name="nota" /></label>
      </div>
      <p><button>Registrar préstamo</button></p>
    </form>
  );
}

export default async function Cooperativa({ searchParams }: { searchParams: Promise<{ tab?: string; msg?: string; err?: string; t?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab ?? 'prestamos';
  return (
    <>
      <h2>Cooperativa y préstamos</h2>
      <p className="sub">Préstamos de la cooperativa e internos (motorizados, dental…) y ahorros de los socios.</p>
      {sp.msg && <div className="panel" style={{ borderColor: 'var(--ok)' }}>{sp.msg}</div>}
      {sp.err && <div className="error">{sp.err}</div>}
      <nav className="pestanas">{PESTANAS.map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={k === tab ? 'activa' : ''}>{l}</Link>)}</nav>
      {tab === 'prestamos' && <Prestamos estado="ACTIVO" />}
      {tab === 'pagados' && <Prestamos estado="OTROS" />}
      {tab === 'ahorros' && <Ahorros sel={sp.t} />}
      {tab === 'nuevo' && <Nuevo />}
    </>
  );
}
