import Link from 'next/link';
import { obtenerHE, previsualizarHE } from '@/lib/datos/horas-extras';
import { nombreMes, obtenerPeriodo } from '@/lib/datos/planilla';
import { accionAplicarHE, accionSubirHE } from '../../acciones';

export const dynamic = 'force-dynamic';
const n = (x: number) => x.toLocaleString('es-BO', { maximumFractionDigits: 2 });

export default async function HorasExtras({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ imp?: string; hoja?: string; err?: string }> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const p = (await obtenerPeriodo(id))!;
  const mesP = `${p.anio}-${String(p.mes).padStart(2, '0')}`;
  const imp = sp.imp ? await obtenerHE(Number(sp.imp)) : null;
  const hojas = imp?.log.hojasHE ?? [];
  const hoja = hojas.find((h) => h.nombre === sp.hoja) ?? hojas.find((h) => h.mes === mesP) ?? hojas.find((h) => h.filas.length);
  const vista = hoja ? await previsualizarHE(id, hoja.filas) : [];
  const ok = vista.filter((f) => f.vinculo_id), mal = vista.filter((f) => !f.vinculo_id);
  const abierto = ['ABIERTO', 'NOVEDADES', 'CALCULADO'].includes(p.estado_b1) || ['ABIERTO', 'NOVEDADES', 'CALCULADO'].includes(p.estado_b2);
  return (
    <>
      <p><Link href={`/periodos/${id}`}>← {nombreMes(p.mes)} {p.anio}</Link></p>
      <h2>Horas extras — Excel aprobado</h2>
      <p className="sub">Subí el Excel de jornadas extras ya aprobado por el Gerente Técnico. Se toma solo el <b>código</b> y la <b>cantidad de horas</b> de la pestaña del mes;
        el valor lo calcula el sistema en la B1 y la B2 (según el sueldo y la cuenta corriente de cada uno). Reemplaza todas las horas extra cargadas en este mes.</p>
      {sp.err && <div className="error">{sp.err}</div>}
      {!abierto && <div className="error">Las planillas de este mes ya están aprobadas o cerradas: reabrilas para cargar horas extras.</div>}
      <form action={accionSubirHE} className="panel fila">
        <input type="hidden" name="periodo" value={id} />
        <input type="file" name="archivo" accept=".xlsx" required />
        <button>{imp ? 'Subir otro archivo' : 'Leer archivo'}</button>
      </form>
      {imp && hoja && (
        <form action={accionAplicarHE} className="panel">
          <input type="hidden" name="periodo" value={id} /><input type="hidden" name="imp" value={imp.id} /><input type="hidden" name="hoja" value={hoja.nombre} />
          <div className="fila" style={{ marginBottom: 10 }}><b>{imp.archivo_nombre}</b> · pestaña:
            {hojas.filter((h) => h.filas.length && (!h.oculta || h.nombre === hoja.nombre)).map((h) => <Link key={h.nombre} className={`btn ${h.nombre === hoja.nombre ? '' : 'sec'}`}
              href={`?imp=${imp.id}&hoja=${encodeURIComponent(h.nombre)}`}>{h.nombre}{h.mes === mesP ? ' ✓' : ''}</Link>)}
          </div>
          <p className="sub" style={{ marginTop: -4 }}>Se muestran las pestañas visibles del Excel; si la del mes está oculta, igual se elige sola.</p>
          {hoja.mes && hoja.mes !== mesP && <div className="error">Esta pestaña es de {hoja.mes} y el periodo es {mesP}. Revisá que sea la correcta.</div>}
          <p className="sub">{hoja.titulo}</p>
          <div className="tabla"><table className="compacta">
            <thead><tr><th>Código</th><th>Trabajador</th><th>Emp.</th><th>Trabajo realizado</th><th>Fechas</th><th className="num">Horas</th><th className="num">Cargadas hoy B1 / B2</th><th>Va a</th></tr></thead>
            <tbody>
              {vista.map((f) => (
                <tr key={f.codigo + f.trabajo} className={!f.vinculo_id ? 'fila-alerta' : ''}>
                  <td>{f.codigo}</td><td>{f.nombre}</td><td>{f.empresa ?? ''}</td><td>{f.trabajo}</td><td className="sub">{f.fechas}</td>
                  <td className="num"><b>{n(f.horas)}</b></td><td className="num sub">{f.actualB1 || f.actualB2 ? `${n(f.actualB1)} / ${n(f.actualB2)}` : ''}</td>
                  <td>{f.vinculo_id ? [f.b1 && 'B1', f.b2 && 'B2'].filter(Boolean).join(' + ') : ''}{f.aviso && <span className="sub"> {f.aviso}</span>}</td></tr>))}
              <tr className="total"><td colSpan={5}>Total ({ok.length} trabajadores)</td><td className="num">{n(ok.reduce((s, f) => s + f.horas, 0))}</td><td colSpan={2} /></tr>
            </tbody>
          </table></div>
          {mal.length > 0 && <div className="error">No se cargan (no están en la planilla de este mes): {mal.map((f) => `${f.codigo} ${f.nombre}`).join(' · ')}</div>}
          {abierto && <p><button disabled={!ok.length}>Cargar horas extras y recalcular B1 y B2</button></p>}
        </form>
      )}
      {imp && !hoja && <div className="error">El archivo no tiene filas con horas extras.</div>}
    </>
  );
}
