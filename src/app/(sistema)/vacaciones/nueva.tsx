import { accionNuevaSolicitud } from './acciones';
import type { TrabVac } from '@/lib/datos/vacaciones';
import { num } from './formulario';

/** Formulario para pedir vacación (lo usa el trabajador en el celular y RRHH en su nombre). */
export function NuevaSolicitud({ t, volver, hoy }: { t: TrabVac; volver: string; hoy: string }) {
  return (
    <form action={accionNuevaSolicitud} className="panel">
      <h3 style={{ marginTop: 0 }}>Nueva solicitud{volver.startsWith('/vacaciones') ? ` — ${t.nombre}` : ''}</h3>
      <input type="hidden" name="trabajador_id" value={t.trabajador_id} />
      <input type="hidden" name="volver" value={volver} />
      <div className="grilla">
        <label className="campo"><span>Del (primer día de vacación) *</span><input type="date" name="desde" required min={hoy.slice(0, 4) + '-01-01'} /></label>
        <label className="campo"><span>Al (último día de vacación) *</span><input type="date" name="hasta" required /></label>
        <label className="campo"><span>Días (opcional: medio día = 0.5)</span><input name="dias" inputMode="decimal" placeholder="se calcula solo" /></label>
      </div>
      <label className="campo" style={{ marginTop: 12 }}><span>Observaciones</span><textarea name="observaciones" rows={2} placeholder="p.ej. Gestión 2026-2027 (adelantada)" /></label>
      <p className="sub">Se cuentan de lunes a sábado (el domingo no). Días pendientes hoy: <b>{num(t.saldo - t.pendientes)}</b>
        {t.pendientes > 0 && <> (descontando {num(t.pendientes)} en solicitudes pendientes)</>}. Si pedís más, queda como vacación adelantada.</p>
      <p><button>Enviar solicitud</button></p>
    </form>
  );
}
