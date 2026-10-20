import Link from 'next/link';
import { detallePlanilla, nombreMes, obtenerPeriodo, type Planilla } from '@/lib/datos/planilla';
import { bs } from '@/lib/formato';

export const dynamic = 'force-dynamic';

export default async function VerPlanilla({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pl?: string; empresa?: string }> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const pl = (sp.pl === 'B2' ? 'B2' : 'B1') as Planilla;
  const p = (await obtenerPeriodo(id))!;
  let filas = await detallePlanilla(id, pl);
  const empresas = [...new Set(filas.map((f) => f.empresa))];
  if (sp.empresa) filas = filas.filter((f) => f.empresa === sp.empresa);
  // columnas = conceptos presentes (sin aportes ni previsiones)
  const cols = new Map<number, string>();
  for (const f of filas) for (const l of f.lineas) if (l.codigo < 900) cols.set(l.codigo, l.nombre);
  const codigos = [...cols.keys()].sort((a, b) => a - b);
  const ingresos = codigos.filter((c) => c < 500), descuentos = codigos.filter((c) => c >= 500);
  const val = (f: (typeof filas)[number], c: number) => f.lineas.filter((l) => l.codigo === c).reduce((s, l) => s + Number(l.monto), 0);
  const suma = (c: number) => filas.reduce((s, f) => s + val(f, c), 0);
  return (
    <>
      <p><Link href={`/periodos/${id}`}>← {nombreMes(p.mes)} {p.anio}</Link></p>
      <h2>Planilla {pl} · {nombreMes(p.mes)} {p.anio}</h2>
      <p className="sub">{filas.length} trabajadores</p>
      <div className="fila panel">
        <Link className={`btn ${sp.empresa ? 'sec' : ''}`} href={`?pl=${pl}`}>Todas</Link>
        {empresas.map((e) => <Link key={e} className={`btn ${sp.empresa === e ? '' : 'sec'}`} href={`?pl=${pl}&empresa=${e}`}>{e}</Link>)}
      </div>
      <div className="tabla">
        <table>
          <thead><tr><th>Código</th><th>Nombre</th><th>Emp.</th><th>CC</th><th className="n">Días</th>
            {ingresos.map((c) => <th key={c} className="n">{cols.get(c)}</th>)}
            <th className="n">Total ganado</th>
            {descuentos.map((c) => <th key={c} className="n">{cols.get(c)}</th>)}
            <th className="n">Total desc.</th><th className="n">{pl === 'B1' ? 'Líquido' : 'Saldo'}</th><th>Pago</th></tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}><td>{f.codigo}</td><td>{f.nombre}</td><td>{f.empresa}</td><td>{f.centro_costo}</td><td className="n">{f.dias}</td>
                {ingresos.map((c) => <td key={c} className="n">{bs(val(f, c) || null)}</td>)}
                <td className="n"><b>{bs(f.total_ganado)}</b></td>
                {descuentos.map((c) => <td key={c} className="n">{bs(val(f, c) || null)}</td>)}
                <td className="n">{bs(f.total_descuentos)}</td><td className="n" style={{ color: f.liquido < 0 ? 'var(--bad)' : undefined }}><b>{bs(f.liquido)}</b></td>
                <td>{f.forma_pago}</td></tr>
            ))}
            <tr className="total"><td colSpan={5}>Total</td>
              {ingresos.map((c) => <td key={c} className="n">{bs(suma(c))}</td>)}
              <td className="n">{bs(filas.reduce((s, f) => s + Number(f.total_ganado), 0))}</td>
              {descuentos.map((c) => <td key={c} className="n">{bs(suma(c))}</td>)}
              <td className="n">{bs(filas.reduce((s, f) => s + Number(f.total_descuentos), 0))}</td>
              <td className="n">{bs(filas.reduce((s, f) => s + Number(f.liquido), 0))}</td><td></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
