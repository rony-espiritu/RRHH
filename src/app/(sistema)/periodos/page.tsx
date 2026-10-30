import Link from 'next/link';
import { listarPeriodos, nombreMes } from '@/lib/datos/planilla';
import { accionAbrir } from './acciones';

export const dynamic = 'force-dynamic';

export default async function Periodos() {
  const ps = await listarPeriodos();
  const hoy = new Date();
  return (
    <>
      <h2>Periodos</h2>
      <p className="sub">Cada mes se abre un periodo; B1 y B2 se calculan y aprueban por separado.</p>
      <form action={accionAbrir} className="panel fila">
        <b>Abrir periodo</b>
        <select name="mes" defaultValue={hoy.getMonth() + 1}>
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{nombreMes(i + 1)}</option>)}
        </select>
        <input name="anio" className="num" defaultValue={hoy.getFullYear()} />
        <input name="ufv_inicio" className="num" placeholder="UFV inicio" />
        <input name="ufv_fin" className="num" placeholder="UFV fin" />
        <button>Abrir</button>
      </form>
      <table>
        <thead><tr><th>Periodo</th><th>Campaña</th><th>Estado B1</th><th>Estado B2</th></tr></thead>
        <tbody>
          {ps.map((p) => (
            <tr key={p.id}>
              <td><Link href={`/periodos/${p.id}`}>{nombreMes(p.mes)} {p.anio}</Link>{p.tipo !== 'MENSUAL' && ` · ${p.tipo}`}</td>
              <td>{p.campana_albor}</td>
              <td><span className={`chip ${p.estado_b1}`}>{p.estado_b1}</span></td>
              <td><span className={`chip ${p.estado_b2}`}>{p.estado_b2}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
