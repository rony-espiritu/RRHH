import Link from 'next/link';
import { saldosVacaciones } from '@/lib/datos/vacaciones';
import { elegirEmpresas, FiltroEmpresas } from '../filtro-empresas';
import Imprimir from '../periodos/[id]/boleta/[vinculo]/imprimir';
import { larga, num } from './formulario';

/** Reporte: saldo de vacaciones por trabajador. */
export async function Saldos({ empresa, orden }: { empresa?: string; orden?: string }) {
  const todos = await saldosVacaciones();
  const emps = [...new Set(todos.map((x) => x.empresa))].sort();
  const { elegidas } = elegirEmpresas(emps, empresa);
  const xs = todos.filter((x) => elegidas.includes(x.empresa));
  if (orden === 'saldo') xs.sort((a, b) => b.saldo - a.saldo);
  const tot = xs.reduce((s, x) => ({ derecho: s.derecho + x.derecho, tomados: s.tomados + x.tomados, ajustes: s.ajustes + x.ajustes, tramite: s.tramite + x.tramite, saldo: s.saldo + x.saldo }),
    { derecho: 0, tomados: 0, ajustes: 0, tramite: 0, saldo: 0 });
  const q = (o: Record<string, string | undefined>) => '?' + new URLSearchParams(Object.entries({ e: 'SALDOS', empresa, orden, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  const neg = xs.filter((x) => x.saldo < 0).length, acum = xs.filter((x) => x.saldo >= 30).length;
  return (
    <>
      <div className="panel no-print">
        <FiltroEmpresas todas={emps} param={empresa} href={(e) => q({ empresa: e })} etiqueta="Empresa" />
        <div className="fila" style={{ marginTop: 8 }}><span className="etq">Orden</span>
          <Link className={`btn ${orden === 'saldo' ? 'sec' : ''}`} href={q({ orden: undefined })}>Empresa y nombre</Link>
          <Link className={`btn ${orden === 'saldo' ? '' : 'sec'}`} href={q({ orden: 'saldo' })}>Mayor saldo primero</Link>
          <span className="sub" style={{ margin: 0 }}>{neg > 0 && <span className="chip alerta">{neg} con saldo negativo (adelantadas)</span>} {acum > 0 && <span className="chip pronto">{acum} con 30 días o más acumulados</span>}</span>
        </div>
        <Imprimir />
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Saldo de vacaciones por trabajador <span className="sub">al {larga(new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10))} · {elegidas.join(', ')}</span></h3>
        <table className="compacta"><thead><tr>
          <th>Código</th><th>Trabajador</th><th>Emp.</th><th>Cargo</th><th>Ingreso</th><th className="num">Años</th><th className="num">Días/año</th>
          <th className="num">Derecho</th><th className="num">Tomados</th><th className="num">Ajustes</th><th className="num">Saldo</th><th className="num">En trámite</th>
          <th>Última vacación</th><th>Próxima gestión</th></tr></thead><tbody>
          {xs.map((x) => (
            <tr key={x.codigo} className={x.saldo < 0 ? 'fila-alerta' : x.saldo >= 30 ? 'fila-pronto' : ''}>
              <td><Link href={`/personal/${x.codigo}?tab=vacaciones`}>{x.codigo}</Link></td><td>{x.nombre}</td><td>{x.empresa}</td><td>{x.cargo ?? ''}</td>
              <td>{larga(x.fecha_ingreso)}</td><td className="num">{x.anios}</td><td className="num">{x.dias_gestion || '—'}</td>
              <td className="num">{num(x.derecho)}</td><td className="num">{num(x.tomados)}</td><td className="num">{x.ajustes ? num(x.ajustes) : ''}</td>
              <td className="num"><b style={{ color: x.saldo < 0 ? 'var(--bad)' : undefined }}>{num(x.saldo)}</b></td>
              <td className="num">{x.tramite ? num(x.tramite) : ''}</td><td>{larga(x.ultima)}</td>
              <td>{larga(x.proximo)} <span className="sub">+{x.proximo_dias}</span></td>
            </tr>))}
          <tr className="total"><td colSpan={7}>TOTAL ({xs.length} trabajadores)</td><td className="num">{num(tot.derecho)}</td><td className="num">{num(tot.tomados)}</td>
            <td className="num">{num(tot.ajustes)}</td><td className="num">{num(tot.saldo)}</td><td className="num">{num(tot.tramite)}</td><td colSpan={2} /></tr>
        </tbody></table>
        <p className="sub" style={{ marginBottom: 0 }}>Derecho = 15 días por año cumplido (1 a 4 años), 20 (5 a 9) y 30 (10 o más), desde el ingreso a la empresa actual. Saldo = derecho + ajustes − tomados.
          Lo que está en trámite todavía no se descuenta.</p>
      </div>
    </>
  );
}
