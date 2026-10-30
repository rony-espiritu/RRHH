/** Cálculo de días de vacación (sirve en el navegador y en el servidor). */
export type ReglasDias = { sabadoLibre: boolean; feriados: Record<string, string> };
export type DiaVac = { fecha: string; valor: number; motivo?: string };

const d = (s: string) => new Date(s + 'T12:00:00Z');
const iso = (x: Date) => x.toISOString().slice(0, 10);
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const diaSemana = (s: string) => DIAS[d(s).getUTCDay()];

/** ¿Por qué no se trabaja ese día? (null = es laborable) */
export function noLaborable(fecha: string, r: ReglasDias): string | null {
  const w = d(fecha).getUTCDay();
  if (w === 0) return 'domingo';
  if (r.feriados[fecha]) return `feriado: ${r.feriados[fecha]}`;
  if (w === 6 && r.sabadoLibre) return 'sábado (no trabaja)';
  return null;
}

/**
 * Días entre `desde` y `hasta`: domingo y feriados no cuentan; el sábado cuenta 1 día (salvo quien no trabaja sábado).
 * medioInicio = el primer día sale a la tarde (cuenta 0,5); medioFin = el último día vuelve a la tarde (cuenta 0,5).
 */
export function calcularDias(desde: string, hasta: string, medioInicio: boolean, medioFin: boolean, r: ReglasDias) {
  const dias: DiaVac[] = [];
  if (!desde || !hasta || hasta < desde) return { total: 0, dias, retorno: '', retornoTarde: false };
  for (let x = d(desde); x <= d(hasta) && dias.length < 400; x.setUTCDate(x.getUTCDate() + 1)) {
    const f = iso(x), nl = noLaborable(f, r);
    let v = nl ? 0 : 1;
    if (v && f === desde && medioInicio) v -= 0.5;
    if (v && f === hasta && medioFin) v -= 0.5;
    dias.push({ fecha: f, valor: Math.max(0, v), motivo: nl ?? undefined });
  }
  const total = dias.reduce((s, x) => s + x.valor, 0);
  // Retorno: la misma tarde si el último día es medio día; si no, el siguiente día laborable
  let retorno = hasta, retornoTarde = false;
  if (medioFin && !noLaborable(hasta, r)) retornoTarde = true;
  else { const x = d(hasta); let n = 0; do { x.setUTCDate(x.getUTCDate() + 1); n++; } while (noLaborable(iso(x), r) && n < 60); retorno = iso(x); }
  return { total, dias, retorno, retornoTarde };
}
