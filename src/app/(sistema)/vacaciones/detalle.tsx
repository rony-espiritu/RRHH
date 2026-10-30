import Link from 'next/link';
import type { Solicitud } from '@/lib/datos/vacaciones';
import Imprimir from '../periodos/[id]/boleta/[vinculo]/imprimir';
import { accionAnular, accionAprobar, accionRechazar } from './acciones';
import { EstadoChip, FormularioVacacion } from './formulario';

/** Detalle de una solicitud: acciones según quién mira + el formulario para imprimir. */
export function DetalleSolicitud({ s, gestor, propia, base, msg, err }: { s: Solicitud; gestor: boolean; propia: boolean; base: string; msg?: string; err?: string }) {
  const volver = `${base}/${s.id}`;
  return (
    <>
      <div className="no-print">
        <p><Link href={base}>← Volver</Link></p>
        <h2>Solicitud de vacación N° {s.id} <EstadoChip e={s.estado} /></h2>
        {msg && <div className="panel" style={{ borderColor: 'var(--ok)' }}>{msg}</div>}
        {err && <div className="error">{err}</div>}
        {s.estado === 'PENDIENTE' && gestor && (
          <div className="panel fila">
            <form action={accionAprobar}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="volver" value={volver} /><button>Aprobar</button></form>
            <form action={accionRechazar} className="fila"><input type="hidden" name="id" value={s.id} /><input type="hidden" name="volver" value={volver} />
              <input name="motivo" placeholder="Motivo del rechazo" required style={{ minWidth: 240 }} /><button className="sec">Rechazar</button></form>
          </div>)}
        {((s.estado === 'PENDIENTE' && (propia || gestor)) || (s.estado === 'APROBADA' && gestor)) && (
          <details className="panel"><summary>Anular la solicitud{s.estado === 'APROBADA' ? ' (devuelve los días al saldo)' : ''}</summary>
            <form action={accionAnular} style={{ marginTop: 8 }}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="volver" value={volver} /><button className="sec">Sí, anular</button></form>
          </details>)}
        <Imprimir />
      </div>
      <FormularioVacacion s={s} />
    </>
  );
}
