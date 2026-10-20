import Link from 'next/link';
import { DESTINOS, obtenerImportacion, sugerencias } from '@/lib/datos/importacion';
import { nombreMes, obtenerPeriodo } from '@/lib/datos/planilla';
import { accionAplicarAlbor, accionSubirAlbor } from '../../acciones';

export const dynamic = 'force-dynamic';

export default async function Importar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ imp?: string; hoja?: string; msg?: string }> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const p = (await obtenerPeriodo(id))!;
  const imp = sp.imp ? await obtenerImportacion(Number(sp.imp)) : null;
  const hojas = imp?.log.hojas ?? [];
  const hoja = hojas.find((h) => h.nombre === sp.hoja) ?? hojas.find((h) => sugerencias(h).some(Boolean)) ?? hojas[0];
  const sug = hoja ? sugerencias(hoja) : [];
  const numericas = hoja ? hoja.columnas.map((_, i) => i).filter((i) => i !== hoja.colCodigo && hoja.filas.some((f) => typeof f[i] === 'number')) : [];
  return (
    <>
      <p><Link href={`/periodos/${id}`}>← {nombreMes(p.mes)} {p.anio}</Link></p>
      <h2>Importar Excel de Albor</h2>
      <p className="sub">Anticipos, préstamos y bonos variables del mes. Cada columna se carga al concepto elegido (origen Albor), en valor absoluto, y reemplaza una importación anterior de ese concepto. Los bonos que ya son fijos en la ficha del trabajador no deben importarse otra vez.</p>
      {sp.msg && <div className="aviso">{sp.msg}</div>}
      <form action={accionSubirAlbor} className="panel fila">
        <input type="hidden" name="periodo" value={id} />
        <input type="file" name="archivo" accept=".xlsx,.xls" />
        <button>{imp ? 'Subir otro archivo' : 'Leer archivo'}</button>
      </form>
      {imp && hoja && (
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
