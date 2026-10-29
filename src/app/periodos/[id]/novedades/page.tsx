import Link from 'next/link';
import { nombreMes, novedadesDelPeriodo, obtenerPeriodo, personalDelPeriodo, type Planilla } from '@/lib/datos/planilla';
import { accionNovedades } from '../../acciones';

export const dynamic = 'force-dynamic';

const COLUMNAS: Record<Planilla, { codigo: number; titulo: string; campo: 'cantidad' | 'monto' }[]> = {
  B1: [
    { codigo: 4, titulo: 'Horas extra (h)', campo: 'cantidad' },
    { codigo: 520, titulo: 'Faltas (días)', campo: 'cantidad' },
    { codigo: 511, titulo: 'Anticipos (Bs)', campo: 'monto' },
    { codigo: 508, titulo: 'Préstamo interno (Bs)', campo: 'monto' },
  ],
  B2: [
    { codigo: 7, titulo: 'Horas extra B2 (h)', campo: 'cantidad' },
    { codigo: 520, titulo: 'Faltas (días)', campo: 'cantidad' },
    { codigo: 506, titulo: 'Amort. préstamo coop. (Bs)', campo: 'monto' },
    { codigo: 507, titulo: 'Interés préstamo coop. (Bs)', campo: 'monto' },
    { codigo: 508, titulo: 'Préstamo interno (Bs)', campo: 'monto' },
    { codigo: 511, titulo: 'Anticipos (Bs)', campo: 'monto' },
  ],
};

export default async function Novedades({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pl?: string; msg?: string }> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const pl = (sp.pl === 'B2' ? 'B2' : 'B1') as Planilla;
  const p = (await obtenerPeriodo(id))!;
  const estado = pl === 'B1' ? p.estado_b1 : p.estado_b2;
  const bloqueado = ['EN_REVISION', 'APROBADO', 'CERRADO', 'ANULADO'].includes(estado);
  const personal = (await personalDelPeriodo(p)).filter((v) => (pl === 'B1' ? v.en_b1 : v.en_b2));
  const nov = await novedadesDelPeriodo(id, pl);
  const valor = (vinc: number, cod: number, campo: 'cantidad' | 'monto') => {
    const xs = nov.filter((n) => n.vinculo_id === vinc && n.codigo === cod && n.origen === 'MANUAL');
    const s = xs.reduce((a, n) => a + Number(n[campo] ?? 0), 0);
    return xs.length ? String(s) : '';
  };
  const importadas = (vinc: number, cod: number) => nov.filter((n) => n.vinculo_id === vinc && n.codigo === cod && n.origen !== 'MANUAL').reduce((a, n) => a + Number(n.monto ?? n.cantidad ?? 0), 0);
  const cols = COLUMNAS[pl];
  return (
    <>
      <p><Link href={`/periodos/${id}`}>← {nombreMes(p.mes)} {p.anio}</Link></p>
      <h2>Novedades {pl} · {nombreMes(p.mes)} {p.anio}</h2>
      <p className="sub">Solo lo variable del mes. Sueldo, bono nivel, abono B2 y bonos fijos salen de la ficha del trabajador.
        {bloqueado && ' La planilla está en revisión o cerrada: no se puede modificar.'}</p>
      {pl === 'B2' && <p className="sub"><b>Anticipos B2:</b> salen de los saldos de cuenta corriente de Albor. Si escribís un monto, reemplaza al de Albor para ese trabajador
        (no hace falta volver a subir el archivo); dejalo vacío para volver al de Albor. Préstamos e intereses salen de Cooperativa: lo que pongas acá se suma.</p>}
      {sp.msg && <div className="panel"><b>{sp.msg}</b> — recuerde recalcular la planilla.</div>}
      <div className="fila panel">
        <Link className={`btn ${pl === 'B1' ? '' : 'sec'}`} href="?pl=B1">B1</Link>
        <Link className={`btn ${pl === 'B2' ? '' : 'sec'}`} href="?pl=B2">B2</Link>
      </div>
      <form action={accionNovedades}>
        <input type="hidden" name="periodo" value={id} /><input type="hidden" name="planilla" value={pl} />
        <div className="tabla">
          <table>
            <thead><tr><th>Código</th><th>Nombre</th><th>Empresa</th>{cols.map((c) => <th key={c.codigo} className="n">{c.titulo}</th>)}</tr></thead>
            <tbody>
              {personal.map((v) => (
                <tr key={v.vinculo_id}>
                  <td>{v.codigo}</td><td>{v.nombre}</td><td>{pl === 'B1' ? v.empresa : v.empresa_b2}</td>
                  {cols.map((c) => {
                    const k = `n|${v.vinculo_id}|${pl}|${c.codigo}|${c.campo}`;
                    const val = valor(v.vinculo_id, c.codigo, c.campo);
                    const imp = importadas(v.vinculo_id, c.codigo);
                    return (
                      <td key={c.codigo} className="n">
                        <input type="hidden" name={'o' + k.slice(1)} value={val} />
                        <input name={k} className="num" defaultValue={val} disabled={bloqueado} inputMode="decimal" />
                        {pl === 'B2' && c.codigo === 511
                          ? (imp ? <div style={{ fontSize: 11, color: val ? 'var(--warn)' : 'var(--muted)' }}>{val ? `reemplaza ${imp} de Albor` : `Albor: ${imp}`}</div> : null)
                          : imp ? <div style={{ fontSize: 11, color: 'var(--muted)' }}>+{imp} {[506, 507, 508, 509].includes(c.codigo) ? 'Cooperativa' : 'Albor'}</div> : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!bloqueado && <p><button>Guardar novedades</button></p>}
      </form>
    </>
  );
}
