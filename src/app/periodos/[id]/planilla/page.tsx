import Link from 'next/link';
import { detallePlanilla, nombreMes, obtenerPeriodo, type Planilla } from '@/lib/datos/planilla';
import { bs } from '@/lib/formato';

export const dynamic = 'force-dynamic';

export default async function VerPlanilla({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pl?: string; empresa?: string; cc?: string; agrupar?: string }> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const pl = (sp.pl === 'B2' ? 'B2' : 'B1') as Planilla;
  const p = (await obtenerPeriodo(id))!;
  let filas = await detallePlanilla(id, pl);
  const empresas = [...new Set(filas.map((f) => f.empresa))];
  const centros = [...new Set(filas.map((f) => f.centro_costo ?? 'Sin CC'))].sort();
  if (sp.empresa) filas = filas.filter((f) => f.empresa === sp.empresa);
  if (sp.cc) filas = filas.filter((f) => (f.centro_costo ?? 'Sin CC') === sp.cc);
  const agrupar = sp.agrupar === 'cc' || sp.agrupar === 'empresa' ? sp.agrupar : '';
  const clave = (f: (typeof filas)[number]) => (agrupar === 'cc' ? f.centro_costo ?? 'Sin CC' : agrupar === 'empresa' ? f.empresa : '');
  if (agrupar) filas = [...filas].sort((a, b) => clave(a).localeCompare(clave(b)) || a.nombre.localeCompare(b.nombre));
  const grupos = agrupar ? [...new Set(filas.map(clave))] : [''];
  const url = (cambios: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const v = { pl, empresa: sp.empresa, cc: sp.cc, agrupar: agrupar || undefined, ...cambios };
    for (const [k, x] of Object.entries(v)) if (x) q.set(k, x);
    return `?${q}`;
  };
  // columnas = conceptos presentes (sin aportes ni previsiones)
  const cols = new Map<number, string>();
  for (const f of filas) for (const l of f.lineas) if (l.codigo < 900) cols.set(l.codigo, l.nombre);
  const codigos = [...cols.keys()].sort((a, b) => a - b);
  const ingresos = codigos.filter((c) => c < 500), descuentos = codigos.filter((c) => c >= 500);
  const val = (f: (typeof filas)[number], c: number) => f.lineas.filter((l) => l.codigo === c).reduce((s, l) => s + Number(l.monto), 0);
  type F = (typeof filas)[number];
  const Totales = ({ xs, titulo, clase }: { xs: F[]; titulo: string; clase: string }) => (
    <tr className={clase}><td colSpan={5} className="fsub">{titulo} <span className="sub">({xs.length})</span></td>
      {ingresos.map((c) => <td key={c} className="n">{bs(xs.reduce((s, f) => s + val(f, c), 0) || null)}</td>)}
      <td className="n">{bs(xs.reduce((s, f) => s + Number(f.total_ganado), 0))}</td>
      {descuentos.map((c) => <td key={c} className="n">{bs(xs.reduce((s, f) => s + val(f, c), 0) || null)}</td>)}
      <td className="n">{bs(xs.reduce((s, f) => s + Number(f.total_descuentos), 0))}</td>
      <td className="n">{bs(xs.reduce((s, f) => s + Number(f.liquido), 0))}</td><td></td></tr>
  );
  return (
    <>
      <p><Link href={`/periodos/${id}`}>← {nombreMes(p.mes)} {p.anio}</Link></p>
      <h2>Planilla {pl} · {nombreMes(p.mes)} {p.anio}</h2>
      <p className="sub">{filas.length} trabajadores</p>
      <div className="panel filtros">
        <div className="fila"><span className="etq">Propietario</span>
          <Link className={`btn ${sp.empresa ? 'sec' : ''}`} href={url({ empresa: undefined })}>Todas</Link>
          {empresas.map((e) => <Link key={e} className={`btn ${sp.empresa === e ? '' : 'sec'}`} href={url({ empresa: e })}>{e}</Link>)}</div>
        <div className="fila"><span className="etq">Centro de costo</span>
          <Link className={`btn ${sp.cc ? 'sec' : ''}`} href={url({ cc: undefined })}>Todos</Link>
          {centros.map((c) => <Link key={c} className={`btn ${sp.cc === c ? '' : 'sec'}`} href={url({ cc: c })}>{c}</Link>)}</div>
        <div className="fila"><span className="etq">Subtotales por</span>
          <Link className={`btn ${agrupar ? 'sec' : ''}`} href={url({ agrupar: undefined })}>Sin subtotales</Link>
          <Link className={`btn ${agrupar === 'empresa' ? '' : 'sec'}`} href={url({ agrupar: 'empresa' })}>Propietario</Link>
          <Link className={`btn ${agrupar === 'cc' ? '' : 'sec'}`} href={url({ agrupar: 'cc' })}>Centro de costo</Link></div>
      </div>
      <div className="tabla planilla-fija">
        <table>
          <thead><tr><th className="f1">Código</th><th className="f2">Nombre</th><th className="f3">Emp.</th><th className="f4">CC</th><th className="n f5">Días</th>
            {ingresos.map((c) => <th key={c} className="n">{cols.get(c)}</th>)}
            <th className="n">Total ganado</th>
            {descuentos.map((c) => <th key={c} className="n">{cols.get(c)}</th>)}
            <th className="n">Total desc.</th><th className="n">{pl === 'B1' ? 'Líquido' : 'Saldo'}</th><th>Pago</th></tr></thead>
          <tbody>
            {grupos.map((g) => { const xs = filas.filter((f) => clave(f) === g); return [
            ...xs.map((f) => (
              <tr key={f.id}><td className="f1"><Link href={`/personal/${f.codigo}`}>{f.codigo}</Link></td><td className="f2"><Link href={`/periodos/${id}/boleta/${f.vinculo_id}?pl=${pl}`} target="_blank" title={`${f.nombre} — ver boleta`}>{f.nombre}</Link></td><td className="f3">{f.empresa}</td><td className="f4">{f.centro_costo}</td><td className="n f5">{f.dias}</td>
                {ingresos.map((c) => <td key={c} className="n">{bs(val(f, c) || null)}</td>)}
                <td className="n"><b>{bs(f.total_ganado)}</b></td>
                {descuentos.map((c) => <td key={c} className="n">{bs(val(f, c) || null)}</td>)}
                <td className="n">{bs(f.total_descuentos)}</td><td className="n" style={{ color: f.liquido < 0 ? 'var(--bad)' : undefined }}><b>{bs(f.liquido)}</b></td>
                <td>{f.forma_pago}</td></tr>
            )),
            agrupar ? <Totales key={`t${g}`} xs={xs} titulo={`Subtotal ${g}`} clase="subtotal" /> : null,
            ]; })}
            <Totales xs={filas} titulo="Total" clase="total" />
          </tbody>
        </table>
      </div>
    </>
  );
}
