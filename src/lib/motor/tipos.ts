// Tipos del motor de cálculo de planillas — ERP RRHH Estancias Espíritu.
// El motor es puro: recibe datos, devuelve resultados con traza. No toca la base de datos.

export type Tramo = { desde: number; porcentaje: number };
export type TramoAntiguedad = { aniosDesde: number; porcentaje: number };

/** Parámetros vigentes para el periodo (tabla `parametro`, `tramo_solidario`, `tabla_antiguedad`). */
export interface Parametros {
  SMN: number;
  GESTORA_LAB: number;
  GESTORA_LAB_65: number;
  EDAD_GESTORA_REDUCIDA: number;
  SOLIDARIO_LAB: number;
  CAJA_PAT: number;
  RIESGO_PAT: number;
  PROVIV_PAT: number;
  SOLIDARIO_PAT: number;
  PREV_AGUINALDO: number;
  PREV_INDEMN: number;
  RCIVA_TASA: number;
  RCIVA_MIN_SMN: number;      // mínimo no imponible, en SMN (2)
  RCIVA_COMPUTO_SMN: number;  // SMN sobre los que se calcula el 13% de cómputo (según planilla impositiva actual: 1)
  HE_FACTOR_B1: number;
  HE_FACTOR_B2: number;
  tramosSolidario: Tramo[];
  tablaAntiguedad: TramoAntiguedad[];
}

export interface Periodo {
  anio: number;
  mes: number;         // 1-12
  ufvInicio?: number;  // UFV al inicio (para mantener de valor el saldo RC-IVA)
  ufvFin?: number;
  tcUsd?: number;      // tipo de cambio para conceptos en dólares (aporte cooperativa)
}

/** Línea de resultado: un concepto calculado con su traza. */
export interface Linea {
  concepto: string;
  codigo?: number;
  tipo: 'INGRESO' | 'DESCUENTO' | 'APORTE_PATRONAL' | 'PROVISION' | 'INFORMATIVO';
  cantidad?: number;
  base?: number;
  tasa?: number;
  monto: number;
  formula?: string;
}

export interface TrabajadorB1 {
  codigo: string;
  fechaNacimiento?: string | null; // ISO
  fechaIngreso: string;            // ingreso del vínculo vigente (base de antigüedad)
  sueldo: number;                  // haber básico mensual
  bonoNivel?: number;
  aplicaAntiguedad?: boolean;      // por defecto true
  aportaGestora?: boolean;         // por defecto true
  tasas?: Partial<Record<'GESTORA_LAB' | 'SOLIDARIO_LAB', number>>; // excepciones (tasa_trabajador)
}

export interface NovedadesB1 {
  dias?: number;                         // días pagados (30 por defecto)
  heHoras?: number;                      // horas extra B1
  otrosBonos?: number;                   // bonos eventuales del mes
  descuentos?: Record<string, number>;   // código concepto → monto (anticipos, préstamos de Albor, faltas…)
  facturasF110?: number;                 // monto de facturas del Form. 110
  saldoRcivaAnterior?: number;           // saldo a favor del dependiente del mes anterior
}

export interface TrabajadorB2 {
  codigo: string;
  abonoMensual: number;            // "Abono buen desempeño" a 30 días
}

export interface NovedadesB2 {
  dias?: number;
  heHoras?: number;
  bonos?: Record<string, number>;       // 11 puestero, 12 alimentación, 13/14 carne, 25 rendimiento…
  descuentos?: Record<string, number>;  // 506/507 coop., 508 préstamo interno, 511 cuenta corriente (Albor)
  aporteCoopUsd?: number;               // 521 aporte cooperativa en dólares
}
