import type { Parametros } from './tipos';

/** Parámetros vigentes a septiembre 2026 (semilla; en producción se leen de la tabla `parametro`). */
export const PARAMETROS_2026: Parametros = {
  SMN: 3300,
  GESTORA_LAB: 0.1221,
  GESTORA_LAB_65: 0.105,
  EDAD_GESTORA_REDUCIDA: 65,
  SOLIDARIO_LAB: 0.005,
  CAJA_PAT: 0.1,
  RIESGO_PAT: 0.0171,
  RIESGO_PAT_65: 0,
  PROVIV_PAT: 0.02,
  SOLIDARIO_PAT: 0.035,
  PREV_AGUINALDO: 0.0833, // como en Previsiones y Provisiones de SIDPLAN
  PREV_INDEMN: 0.0833,
  RCIVA_TASA: 0.13,
  RCIVA_MIN_SMN: 2,
  RCIVA_COMPUTO_SMN: 1,
  HE_FACTOR_B1: 1,
  HE_FACTOR_B2: 1,
  tramosSolidario: [
    { desde: 13000, porcentaje: 1 },
    { desde: 25000, porcentaje: 5 },
    { desde: 35000, porcentaje: 10 },
  ],
  tablaAntiguedad: [
    { aniosDesde: 2, porcentaje: 5 },
    { aniosDesde: 5, porcentaje: 11 },
    { aniosDesde: 8, porcentaje: 18 },
    { aniosDesde: 11, porcentaje: 26 },
    { aniosDesde: 15, porcentaje: 34 },
    { aniosDesde: 20, porcentaje: 42 },
    { aniosDesde: 25, porcentaje: 50 },
  ],
};
