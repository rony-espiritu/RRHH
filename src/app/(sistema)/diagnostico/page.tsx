import { conexionSinClave, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Diagnostico() {
  const pruebas: { nombre: string; ok: boolean; detalle: string }[] = [];
  pruebas.push({ nombre: 'Variable DATABASE_URL', ok: !!process.env.DATABASE_URL, detalle: conexionSinClave() });
  try {
    const [r] = await sql<{ v: string }[]>`select version() v`;
    pruebas.push({ nombre: 'Conexión a la base', ok: true, detalle: r.v.split(',')[0] });
    const t = await sql<{ tabla: string; n: number }[]>`
      select 'trabajador' tabla, (select count(*) from trabajador)::int n union all
      select 'empresa', (select count(*) from empresa)::int union all
      select 'concepto', (select count(*) from concepto)::int union all
      select 'parametro', (select count(*) from parametro)::int union all
      select 'periodo', (select count(*) from periodo)::int`;
    for (const x of t) pruebas.push({ nombre: `Tabla ${x.tabla}`, ok: x.n > 0 || x.tabla === 'periodo', detalle: `${x.n} filas` });
    const [p] = await sql<{ n: number }[]>`select count(*)::int n from parametro where clave in ('RCIVA_COMPUTO_SMN','HE_FACTOR_B2','TC_USD')`;
    pruebas.push({ nombre: 'Migración 2 (parámetros)', ok: p.n === 3, detalle: p.n === 3 ? 'aplicada' : 'falta ejecutar migracion_2_parametros_y_saldos.sql' });
  } catch (e) {
    const err = e as Error & { code?: string };
    pruebas.push({ nombre: 'Conexión a la base', ok: false, detalle: `${err.code ?? ''} ${err.message}`.trim() });
  }
  return (
    <>
      <h2>Diagnóstico</h2>
      <p className="sub">Estado de la conexión con Supabase.</p>
      <table>
        <thead><tr><th>Prueba</th><th>Resultado</th><th>Detalle</th></tr></thead>
        <tbody>{pruebas.map((p) => (
          <tr key={p.nombre}><td>{p.nombre}</td><td><span className={`chip ${p.ok ? 'APROBADO' : ''}`} style={p.ok ? {} : { background: 'var(--bad-soft)', color: 'var(--bad)' }}>{p.ok ? 'OK' : 'ERROR'}</span></td>
            <td style={{ whiteSpace: 'normal' }}>{p.detalle}</td></tr>
        ))}</tbody>
      </table>
    </>
  );
}
