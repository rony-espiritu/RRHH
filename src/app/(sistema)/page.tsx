import Link from 'next/link';
import { sql } from '@/lib/db';
import { listarPeriodos, nombreMes } from '@/lib/datos/planilla';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const [c] = await sql<{ trabajadores: number; empresas: number; b1: number; b2solo: number }[]>`
    select (select count(*) from vinculo where fecha_retiro is null)::int trabajadores,
           (select count(*) from empresa where activo)::int empresas,
           (select count(*) from vinculo where fecha_retiro is null and en_b1)::int b1,
           (select count(*) from vinculo where fecha_retiro is null and not en_b1)::int b2solo`;
  const periodos = (await listarPeriodos()).slice(0, 4);
  return (
    <>
      <h2>Inicio</h2>
      <p className="sub">Grupo Ganadero Estancias Espíritu</p>
      <div className="tarjetas">
        <div className="tarjeta"><span>Trabajadores activos</span><b>{c.trabajadores}</b></div>
        <div className="tarjeta"><span>En planilla B1</span><b>{c.b1}</b></div>
        <div className="tarjeta"><span>Solo B2</span><b>{c.b2solo}</b></div>
        <div className="tarjeta"><span>Empresas activas</span><b>{c.empresas}</b></div>
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Últimos periodos</h3>
        <table><thead><tr><th>Periodo</th><th>B1</th><th>B2</th></tr></thead><tbody>
          {periodos.map((p) => (
            <tr key={p.id}><td><Link href={`/periodos/${p.id}`}>{nombreMes(p.mes)} {p.anio}</Link></td>
              <td><span className={`chip ${p.estado_b1}`}>{p.estado_b1}</span></td><td><span className={`chip ${p.estado_b2}`}>{p.estado_b2}</span></td></tr>
          ))}
        </tbody></table>
      </div>
    </>
  );
}
