import type {
  Linea, NovedadesB1, NovedadesB2, Parametros, Periodo, TrabajadorB1, TrabajadorB2,
} from './tipos';

/** Redondeo a centavos, igual que SIDPLAN (cada concepto se redondea por separado). */
// Sin corrección de épsilon a propósito: así redondea SIDPLAN (4055 × 0,5% = 20,27).
export const r2 = (x: number) => Math.round(x * 100) / 100;

/** Aplica una tasa como lo hace SIDPLAN: base × porcentaje / 100 (0,5% de 4.055 = 20,27). */
export const tasa = (base: number, t: number) => (base * (Math.round(t * 1e6) / 1e4)) / 100;

const finDeMes = (p: Periodo) => new Date(Date.UTC(p.anio, p.mes, 0));

/** Años cumplidos entre una fecha ISO y el último día del periodo. */
export function aniosCumplidos(desdeIso: string, p: Periodo): number {
  const d = new Date(desdeIso + 'T00:00:00Z');
  const c = finDeMes(p);
  let a = c.getUTCFullYear() - d.getUTCFullYear();
  if (c.getUTCMonth() < d.getUTCMonth() || (c.getUTCMonth() === d.getUTCMonth() && c.getUTCDate() < d.getUTCDate())) a--;
  return a;
}

export function porcentajeAntiguedad(anios: number, prm: Parametros): number {
  let pct = 0;
  for (const t of [...prm.tablaAntiguedad].sort((a, b) => a.aniosDesde - b.aniosDesde)) {
    if (anios >= t.aniosDesde) pct = t.porcentaje;
  }
  return pct;
}

const suma = (o?: Record<string, number>) => Object.values(o ?? {}).reduce((s, v) => s + v, 0);

// ---------------------------------------------------------------------------
// RC-IVA (dependientes) — mismo orden de columnas que la planilla impositiva
// ---------------------------------------------------------------------------
export interface ResultadoRciva {
  neto: number; noImponible: number; baseImponible: number; impuesto: number; computoMinimos: number;
  impuestoNeto: number; creditoF110: number; saldoFisco: number; saldoDependiente: number;
  saldoAnterior: number; mantenimiento: number; saldoAnteriorActualizado: number;
  saldoUtilizado: number; retenido: number; saldoSiguiente: number;
}

export function calcularRciva(neto: number, facturas: number, saldoAnterior: number, prm: Parametros, p: Periodo): ResultadoRciva {
  const noImponible = r2(prm.RCIVA_MIN_SMN * prm.SMN);
  const baseImponible = r2(Math.max(0, neto - noImponible));
  const impuesto = r2(tasa(baseImponible, prm.RCIVA_TASA));
  const computoMinimos = baseImponible > 0 ? r2(tasa(prm.RCIVA_COMPUTO_SMN * prm.SMN, prm.RCIVA_TASA)) : 0;
  const impuestoNeto = r2(Math.max(0, impuesto - computoMinimos));
  const creditoF110 = r2(tasa(facturas, prm.RCIVA_TASA));
  const saldoFisco = r2(Math.max(0, impuestoNeto - creditoF110));
  const saldoDependiente = r2(Math.max(0, creditoF110 - impuestoNeto));
  const factorUfv = p.ufvInicio && p.ufvFin ? p.ufvFin / p.ufvInicio : 1;
  const mantenimiento = r2(saldoAnterior * (factorUfv - 1));
  const saldoAnteriorActualizado = r2(saldoAnterior + mantenimiento);
  const saldoUtilizado = r2(Math.min(saldoFisco, saldoAnteriorActualizado));
  const retenido = r2(saldoFisco - saldoUtilizado);
  const saldoSiguiente = r2(saldoDependiente + saldoAnteriorActualizado - saldoUtilizado);
  return { neto, noImponible, baseImponible, impuesto, computoMinimos, impuestoNeto, creditoF110, saldoFisco,
    saldoDependiente, saldoAnterior, mantenimiento, saldoAnteriorActualizado, saldoUtilizado, retenido, saldoSiguiente };
}

// ---------------------------------------------------------------------------
// B1 — planilla oficial
// ---------------------------------------------------------------------------
export interface ResultadoB1 {
  codigo: string;
  dias: number;
  anios: number;
  basico: number;
  antiguedad: number;
  horasExtra: number;
  bonos: number;
  totalGanado: number;
  gestora: number;
  solidario: number;
  rciva: ResultadoRciva;
  otrosDescuentos: number;
  totalDescuentos: number;
  liquido: number;
  patronal: { caja: number; riesgo: number; proVivienda: number; solidario: number; total: number };
  provisiones: { aguinaldo: number; indemnizacion: number };
  lineas: Linea[];
}

export function calcularB1(t: TrabajadorB1, n: NovedadesB1, prm: Parametros, p: Periodo): ResultadoB1 {
  const lineas: Linea[] = [];
  const dias = n.dias ?? 30;

  const basico = r2((t.sueldo * dias) / 30);
  lineas.push({ concepto: 'Sueldo básico', codigo: 2, tipo: 'INGRESO', cantidad: dias, base: t.sueldo, monto: basico, formula: 'sueldo × días / 30' });

  const anios = aniosCumplidos(t.fechaIngreso, p);
  const pctAnt = t.aplicaAntiguedad === false ? 0 : porcentajeAntiguedad(anios, prm);
  const antiguedad = r2(((3 * prm.SMN * pctAnt) / 100) * dias / 30);
  if (antiguedad) lineas.push({ concepto: 'Bono de antigüedad', codigo: 8, tipo: 'INGRESO', cantidad: pctAnt, base: 3 * prm.SMN, monto: antiguedad, formula: `3 SMN × ${pctAnt}% × días / 30 (${anios} años)` });

  const horasExtra = n.heHoras ? r2(((basico + antiguedad) / 30 / 8) * n.heHoras * prm.HE_FACTOR_B1) : 0;
  if (horasExtra) lineas.push({ concepto: 'Horas extra', codigo: 4, tipo: 'INGRESO', cantidad: n.heHoras, tasa: prm.HE_FACTOR_B1, monto: horasExtra, formula: '(básico + antigüedad) / 240 × horas × factor' });

  const bonos = r2((t.bonoNivel ?? 0) + (n.otrosBonos ?? 0));
  if (t.bonoNivel) lineas.push({ concepto: 'Bono nivel', codigo: 24, tipo: 'INGRESO', monto: r2(t.bonoNivel) });
  if (n.otrosBonos) lineas.push({ concepto: 'Otros bonos', tipo: 'INGRESO', monto: r2(n.otrosBonos) });

  const totalGanado = r2(basico + antiguedad + horasExtra + bonos);

  // Aportes laborales
  let gestora = 0, solidario = 0;
  if (t.aportaGestora !== false) {
    const edad = t.fechaNacimiento ? aniosCumplidos(t.fechaNacimiento, p) : 0;
    const tasaG = t.tasas?.GESTORA_LAB ?? (edad >= prm.EDAD_GESTORA_REDUCIDA ? prm.GESTORA_LAB_65 : prm.GESTORA_LAB);
    gestora = r2(tasa(totalGanado, tasaG));
    lineas.push({ concepto: 'Gestora', codigo: 517, tipo: 'DESCUENTO', base: totalGanado, tasa: tasaG, monto: gestora });

    if (t.tasas?.SOLIDARIO_LAB !== undefined) {
      solidario = r2(tasa(totalGanado, t.tasas.SOLIDARIO_LAB));
      lineas.push({ concepto: 'Fondo solidario', codigo: 525, tipo: 'DESCUENTO', base: totalGanado, tasa: t.tasas.SOLIDARIO_LAB, monto: solidario, formula: 'tasa propia del trabajador' });
    } else {
      let s = tasa(totalGanado, prm.SOLIDARIO_LAB);
      for (const tr of prm.tramosSolidario) if (totalGanado > tr.desde) s += ((totalGanado - tr.desde) * tr.porcentaje) / 100;
      solidario = r2(s);
      lineas.push({ concepto: 'Fondo solidario', codigo: 525, tipo: 'DESCUENTO', base: totalGanado, tasa: prm.SOLIDARIO_LAB, monto: solidario, formula: '0,5% + tramos' });
    }
  }

  const neto = r2(totalGanado - gestora - solidario);
  const rciva = calcularRciva(neto, n.facturasF110 ?? 0, n.saldoRcivaAnterior ?? 0, prm, p);
  if (rciva.retenido) lineas.push({ concepto: 'RC-IVA', codigo: 501, tipo: 'DESCUENTO', base: neto, tasa: prm.RCIVA_TASA, monto: rciva.retenido });

  const otrosDescuentos = r2(suma(n.descuentos));
  for (const [cod, m] of Object.entries(n.descuentos ?? {})) lineas.push({ concepto: `Descuento ${cod}`, codigo: Number(cod), tipo: 'DESCUENTO', monto: r2(m) });

  const totalDescuentos = r2(gestora + solidario + rciva.retenido + otrosDescuentos);
  const liquido = r2(totalGanado - totalDescuentos);

  const patronal = {
    caja: r2(tasa(totalGanado, prm.CAJA_PAT)),
    riesgo: r2(tasa(totalGanado, prm.RIESGO_PAT)),
    proVivienda: r2(tasa(totalGanado, prm.PROVIV_PAT)),
    solidario: r2(tasa(totalGanado, prm.SOLIDARIO_PAT)),
    total: 0,
  };
  patronal.total = r2(patronal.caja + patronal.riesgo + patronal.proVivienda + patronal.solidario);
  const provisiones = { aguinaldo: r2(tasa(totalGanado, prm.PREV_AGUINALDO)), indemnizacion: r2(tasa(totalGanado, prm.PREV_INDEMN)) };

  return { codigo: t.codigo, dias, anios, basico, antiguedad, horasExtra, bonos, totalGanado, gestora, solidario, rciva,
    otrosDescuentos, totalDescuentos, liquido, patronal, provisiones, lineas };
}

// ---------------------------------------------------------------------------
// B2 — cuenta corriente (sin cargas sociales ni RC-IVA)
// ---------------------------------------------------------------------------
export interface ResultadoB2 {
  codigo: string; dias: number; abono: number; horasExtra: number; bonos: number; totalIngresos: number;
  aporteCoop: number; descuentos: number; totalDescuentos: number; saldo: number; lineas: Linea[];
}

export function calcularB2(t: TrabajadorB2, n: NovedadesB2, prm: Parametros, p: Periodo): ResultadoB2 {
  const lineas: Linea[] = [];
  const dias = n.dias ?? 30;
  const abono = r2((t.abonoMensual * dias) / 30);
  lineas.push({ concepto: 'Abono buen desempeño', codigo: 2, tipo: 'INGRESO', cantidad: dias, base: t.abonoMensual, monto: abono });
  const horasExtra = n.heHoras ? r2((t.abonoMensual / 240) * n.heHoras * prm.HE_FACTOR_B2) : 0;
  if (horasExtra) lineas.push({ concepto: 'Horas extra B2', codigo: 7, tipo: 'INGRESO', cantidad: n.heHoras, monto: horasExtra, formula: 'abono / 240 × horas × factor' });
  const bonos = r2(suma(n.bonos));
  for (const [cod, m] of Object.entries(n.bonos ?? {})) lineas.push({ concepto: `Bono ${cod}`, codigo: Number(cod), tipo: 'INGRESO', monto: r2(m) });
  const totalIngresos = r2(abono + horasExtra + bonos);

  const aporteCoop = n.aporteCoopUsd ? r2(n.aporteCoopUsd * (p.tcUsd ?? 6.96)) : 0;
  if (aporteCoop) lineas.push({ concepto: 'Aporte cooperativa', codigo: 521, tipo: 'DESCUENTO', cantidad: n.aporteCoopUsd, tasa: p.tcUsd, monto: aporteCoop });
  const descuentos = r2(suma(n.descuentos));
  for (const [cod, m] of Object.entries(n.descuentos ?? {})) lineas.push({ concepto: `Descuento ${cod}`, codigo: Number(cod), tipo: 'DESCUENTO', monto: r2(m) });
  const totalDescuentos = r2(aporteCoop + descuentos);
  const saldo = r2(totalIngresos - totalDescuentos);
  return { codigo: t.codigo, dias, abono, horasExtra, bonos, totalIngresos, aporteCoop, descuentos, totalDescuentos, saldo, lineas };
}
