'use client';
import { useMemo, useState } from 'react';
import { calcularDias, diaSemana } from '@/lib/vac-calculo';
import type { TrabVac } from '@/lib/datos/vacaciones';
import { accionNuevaSolicitud } from './acciones';

const larga = (s: string) => (s ? `${diaSemana(s)} ${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
const num = (n: number) => n.toLocaleString('es-BO', { maximumFractionDigits: 1 });

/** Formulario para pedir vacación: calcula los días y el retorno mientras se eligen las fechas. */
export function NuevaSolicitud({ t, volver, hoy }: { t: TrabVac; volver: string; hoy: string }) {
  const [desde, setDesde] = useState(''), [hasta, setHasta] = useState('');
  const [inicio, setInicio] = useState<'completo' | 'tarde'>('completo');
  const [fin, setFin] = useState<'completo' | 'manana'>('completo');
  const [jornada, setJornada] = useState<'completo' | 'manana' | 'tarde'>('completo');
  const unDia = !!desde && desde === hasta;
  const medioInicio = unDia ? jornada === 'tarde' : inicio === 'tarde';
  const medioFin = unDia ? jornada === 'manana' : fin === 'manana';
  const c = useMemo(() => calcularDias(desde, hasta || desde, medioInicio, medioFin, t.reglas), [desde, hasta, medioInicio, medioFin, t.reglas]);
  const disponibles = t.saldo - t.pendientes, quedan = disponibles - c.total;
  const excluidos = c.dias.filter((x) => x.motivo);
  return (
    <form action={accionNuevaSolicitud} className="panel">
      <h3 style={{ marginTop: 0 }}>Nueva solicitud{volver.startsWith('/vacaciones') ? ` — ${t.nombre}` : ''}</h3>
      <input type="hidden" name="trabajador_id" value={t.trabajador_id} />
      <input type="hidden" name="volver" value={volver} />
      <input type="hidden" name="medio_inicio" value={medioInicio ? '1' : '0'} />
      <input type="hidden" name="medio_fin" value={medioFin ? '1' : '0'} />
      <input type="hidden" name="hasta" value={hasta || desde} />
      <div className="grilla">
        <label className="campo"><span>Del (primer día de vacación) *</span>
          <input type="date" name="desde" required min={hoy.slice(0, 4) + '-01-01'} value={desde}
            onChange={(e) => { setDesde(e.target.value); if (!hasta || hasta < e.target.value) setHasta(e.target.value); }} /></label>
        <label className="campo"><span>Al (último día de vacación) *</span>
          <input type="date" required min={desde || undefined} value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
        {unDia ? (
          <label className="campo"><span>Jornada</span>
            <select value={jornada} onChange={(e) => setJornada(e.target.value as typeof jornada)}>
              <option value="completo">Día completo</option><option value="manana">Solo la mañana (½ día)</option><option value="tarde">Solo la tarde (½ día)</option></select></label>
        ) : (<>
          <label className="campo"><span>El primer día sale…</span>
            <select value={inicio} onChange={(e) => setInicio(e.target.value as typeof inicio)}>
              <option value="completo">Día completo</option><option value="tarde">Desde la tarde (½ día)</option></select></label>
          <label className="campo"><span>El último día…</span>
            <select value={fin} onChange={(e) => setFin(e.target.value as typeof fin)}>
              <option value="completo">Día completo</option><option value="manana">Solo la mañana (½ día)</option></select></label>
        </>)}
      </div>
      {desde && (
        <div className="vac-calculo">
          <div><span>Días a tomar</span><b>{num(c.total)}</b></div>
          <div><span>Retorna</span><b>{larga(c.retorno)}{c.retornoTarde ? ' (tarde)' : ''}</b></div>
          <div><span>Le quedan</span><b className={quedan < 0 ? 'neg' : ''}>{num(quedan)}</b></div>
          {excluidos.length > 0 && <p>No se cuentan: {excluidos.map((x) => `${larga(x.fecha)} (${x.motivo})`).join(' · ')}</p>}
          {quedan < 0 && <p className="neg">Pide más de lo que tiene: {num(-quedan)} día(s) quedan como vacación adelantada.</p>}
        </div>)}
      <label className="campo" style={{ marginTop: 12 }}><span>Observaciones</span><textarea name="observaciones" rows={2} placeholder="p.ej. Gestión 2026-2027 (adelantada)" /></label>
      <p className="sub">Domingos y feriados no se cuentan; el sábado cuenta 1 día{t.reglas.sabadoLibre ? ' (en este caso no, porque no trabaja los sábados)' : ''}.
        Días disponibles: <b>{num(disponibles)}</b>{t.pendientes > 0 && <> (descontando {num(t.pendientes)} en trámite)</>}.</p>
      <p><button disabled={!desde || c.total <= 0}>Enviar solicitud</button></p>
    </form>
  );
}
