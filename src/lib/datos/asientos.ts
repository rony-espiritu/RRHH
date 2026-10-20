import 'server-only';
import ExcelJS from 'exceljs';
import { sql } from '@/lib/db';
import { r2 } from '@/lib/motor/calculo';
import { cargarParametros } from './planilla';

/**
 * Asientos para importar en Albor, con la misma estructura que hoy se sube a mano:
 *  - B2      (fecha 1° del mes): carga inicial de la cuenta corriente, sin anticipos.
 *  - P1      (fin de mes): planilla B1.
 *  - PREV_P1 (fin de mes): cargas sociales patronales y previsiones de B1.
 *  - PREV_P2 (fin de mes): previsiones de B2 (aguinaldo e indemnización).
 */
export type GrupoAsiento = 'B2' | 'P1' | 'PREV_P1' | 'PREV_P2';

interface Linea { detalle: string; cuenta: string; cc: string; un: string; personal: string; debe: number; haber: number }

// Cuentas de pasivo (contrapartidas en CC 150 / UN PAT)
const PASIVO: Record<string, { cuenta: string; detalle: string }> = {
  LIQUIDO: { cuenta: '210106001', detalle: 'Liquido Pagable' },
  CTA_CTE: { cuenta: '210106000', detalle: 'Cuenta corriente personal' },
  '511': { cuenta: '210106000', detalle: 'Anticipos' },
  '517': { cuenta: '210107004', detalle: 'Gestora Publica' },
  '513': { cuenta: '210107004', detalle: 'Gestora Publica' },
  '525': { cuenta: '210107004', detalle: 'Fondo Solidario' },
  '508': { cuenta: '110305005', detalle: 'Amortización Préstamo Interno' },
  '521': { cuenta: '21010200401', detalle: 'Aporte Cooperativa' },
  '506': { cuenta: '21010200402', detalle: 'Amortización Préstamo Coop.' },
  '507': { cuenta: '21010200403', detalle: 'Interés Préstamo Coop.' },
  '910': { cuenta: '210107001', detalle: 'Caja Nal.Salud, CORDES Ap.Pat' },
  '911': { cuenta: '210107002', detalle: 'Pro Vivienda, Aporte Patronal' },
  '912': { cuenta: '210107003', detalle: 'S.I.P. Aporte Patronal' },
  '913': { cuenta: '210106002', detalle: 'Prev.Aguinaldo' },
  '914': { cuenta: '220101001', detalle: 'Prev.Indeminizacion' },
};

/** Sufijo de la cuenta de gasto según el tipo de concepto. */
function tipoContable(planilla: string, codigo: number): string {
  if ((planilla === 'B1' && codigo === 4) || (planilla === 'B2' && codigo === 7)) return '002';
  if (planilla === 'B2' && codigo === 11) return '006';
  return '001';
}

/** Cuenta de gasto: prefijo según unidad de negocio (o comercialización) + sufijo según tipo. */
export function cuentaGasto(un: string, cc: string, tipo: string): string {
  if (un === '50') return '520407000';
  if (cc.startsWith('COMEC')) return '520101' + tipo;
  if (un === '02' || un === '11') return '510101' + tipo;
  if (un === '81') return '530101' + tipo;
  return '530201' + tipo;
}

/** Reparto de un vínculo en destinos Albor (CC + UN + %) vigentes en el periodo para la planilla. */
async function repartos(periodoId: number) {
  const filas = await sql<{ vinculo_id: number; planilla: string | null; porcentaje: number; cc: string; albor_cc: string; un: string }[]>`
    select a.vinculo_id, a.planilla::text planilla, a.porcentaje, c.codigo cc,
           coalesce(a.albor_cc, c.albor_cc) albor_cc, coalesce(a.albor_unidad_negocio, c.albor_unidad_negocio) un
    from asignacion_cc a join centro_costo c on c.id = a.centro_costo_id join periodo p on p.id = ${periodoId}
    where a.vigente_desde <= p.fecha_fin and (a.vigente_hasta is null or a.vigente_hasta >= p.fecha_inicio)`;
  return (vinculo: number, planilla: string) => {
    const propias = filas.filter((f) => f.vinculo_id === vinculo && f.planilla === planilla);
    const usar = propias.length ? propias : filas.filter((f) => f.vinculo_id === vinculo && f.planilla == null);
    const tot = usar.reduce((s, f) => s + Number(f.porcentaje), 0) || 100;
    return usar.length ? usar.map((f) => ({ cc: f.cc, albor_cc: f.albor_cc, un: f.un, factor: Number(f.porcentaje) / tot }))
      : [{ cc: '', albor_cc: '80', un: '80', factor: 1 }];
  };
}

/** Distribuye un monto en partes que suman exactamente el total (el último absorbe el redondeo). */
function distribuir(monto: number, partes: { factor: number }[]) {
  let acumulado = 0;
  return partes.map((p, i) => {
    const m = i === partes.length - 1 ? r2(monto - acumulado) : r2(monto * p.factor);
    acumulado = r2(acumulado + m);
    return m;
  });
}

export async function generarAsientos(periodoId: number, grupo: GrupoAsiento) {
  const [p] = await sql<{ anio: number; mes: number; fecha_inicio: string; fecha_fin: string; campana_albor: string }[]>`
    select anio, mes, fecha_inicio::text, fecha_fin::text, campana_albor from periodo where id = ${periodoId}`;
  const planilla = grupo === 'B2' || grupo === 'PREV_P2' ? 'B2' : 'B1';
  const prm = await cargarParametros(p.fecha_fin);
  const reparto = await repartos(periodoId);
  const trab = await sql<{ id: number; vinculo_id: number; codigo: string; liquido: number; lineas: { codigo: number; nombre: string; monto: number; aguinaldo: boolean }[] }[]>`
    select pt.id, pt.vinculo_id, t.codigo, pt.liquido,
           coalesce((select json_agg(json_build_object('codigo', l.codigo, 'nombre', c.nombre, 'monto', l.monto, 'aguinaldo', c.afecta_aguinaldo))
                     from planilla_linea l join concepto c on c.id = l.concepto_id where l.planilla_trabajador_id = pt.id), '[]') lineas
    from planilla_trabajador pt join vinculo v on v.id = pt.vinculo_id join trabajador t on t.id = v.trabajador_id
    where pt.periodo_id = ${periodoId} and pt.planilla = ${planilla}::tipo_planilla order by t.codigo`;

  const out: Linea[] = [];
  const debeGasto = (detalle: string, tipo: string, monto: number, vinculo: number) => {
    const partes = reparto(vinculo, planilla);
    distribuir(monto, partes).forEach((m, i) => {
      if (m) out.push({ detalle, cuenta: cuentaGasto(partes[i].un, partes[i].cc, tipo), cc: partes[i].albor_cc, un: partes[i].un, personal: '00', debe: m, haber: 0 });
    });
  };
  const pasivo = (clave: string, monto: number, personal: string, lado: 'debe' | 'haber' = 'haber', detalle?: string) => {
    const c = PASIVO[clave] ?? { cuenta: 'DEFINIR', detalle: `Concepto ${clave}` };
    if (monto) out.push({ detalle: detalle ?? c.detalle, cuenta: c.cuenta, cc: '150', un: 'PAT', personal, debe: lado === 'debe' ? monto : 0, haber: lado === 'haber' ? monto : 0 });
  };

  for (const t of trab) {
    const ingresos = t.lineas.filter((l) => l.codigo < 500);
    if (grupo === 'P1') {
      for (const l of ingresos) debeGasto(l.nombre, tipoContable('B1', l.codigo), Number(l.monto), t.vinculo_id);
      for (const l of t.lineas.filter((x) => x.codigo >= 500 && x.codigo < 900)) pasivo(String(l.codigo), Number(l.monto), t.codigo);
      pasivo('LIQUIDO', Number(t.liquido), t.codigo);
    } else if (grupo === 'PREV_P1') {
      const cargas = t.lineas.filter((l) => [910, 911, 912].includes(l.codigo)).reduce((s, l) => s + Number(l.monto), 0);
      debeGasto('Cargas Sociales', '003', r2(cargas), t.vinculo_id);
      for (const l of t.lineas.filter((x) => x.codigo === 913)) debeGasto('Aguinaldos', '001', Number(l.monto), t.vinculo_id);
      for (const l of t.lineas.filter((x) => x.codigo === 914)) debeGasto('Finiquitos', '004', Number(l.monto), t.vinculo_id);
      for (const l of t.lineas.filter((x) => x.codigo >= 910)) pasivo(String(l.codigo), Number(l.monto), '00');
    } else if (grupo === 'B2') {
      // Carga inicial: ingresos y descuentos conocidos al inicio (sin cuenta corriente/anticipos, que salen de Albor a fin de mes)
      for (const l of ingresos) {
        debeGasto(l.nombre, tipoContable('B2', l.codigo), Number(l.monto), t.vinculo_id);
        pasivo('CTA_CTE', Number(l.monto), t.codigo, 'haber', l.nombre);
      }
      for (const l of t.lineas.filter((x) => x.codigo >= 500 && x.codigo < 900 && x.codigo !== 511)) {
        pasivo('CTA_CTE', Number(l.monto), t.codigo, 'debe', l.nombre);
        pasivo(String(l.codigo), Number(l.monto), t.codigo);
      }
    } else {
      const base = ingresos.filter((l) => l.aguinaldo).reduce((s, l) => s + Number(l.monto), 0);
      const ag = r2(base * prm.PREV_AGUINALDO), ind = r2(base * prm.PREV_INDEMN);
      debeGasto('Aguinaldos', '001', ag, t.vinculo_id);
      debeGasto('Finiquitos', '004', ind, t.vinculo_id);
      pasivo('913', ag, '00');
      pasivo('914', ind, '00');
    }
  }

  // Agrupar líneas iguales (mismo detalle, cuenta, CC, UN, personal y lado)
  const mapa = new Map<string, Linea>();
  for (const l of out) {
    const k = [l.detalle, l.cuenta, l.cc, l.un, l.personal, l.debe ? 'D' : 'H'].join('|');
    const x = mapa.get(k);
    if (x) { x.debe = r2(x.debe + l.debe); x.haber = r2(x.haber + l.haber); } else mapa.set(k, { ...l });
  }
  const lineas = [...mapa.values()].sort((a, b) => (a.haber ? 1 : 0) - (b.haber ? 1 : 0) || a.cuenta.localeCompare(b.cuenta) || a.cc.localeCompare(b.cc));
  const debe = r2(lineas.reduce((s, l) => s + l.debe, 0)), haber = r2(lineas.reduce((s, l) => s + l.haber, 0));

  const fecha = new Date((grupo === 'B2' ? p.fecha_inicio : p.fecha_fin) + 'T12:00:00Z');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Asientos');
  ws.addRow(['Fecha', 'Observaciones', 'Escenario', 'Debe', 'Haber', 'Debe MNF', 'Haber MNF', 'Detalle', 'Cuenta', 'Campaña', 'Centro de Costo', 'Personal', 'Unidad de Negocio']);
  for (const l of lineas) {
    ws.addRow([fecha, 'Planilla Sueldos Mes', '01', l.debe, l.haber, null, null, l.detalle.padEnd(29), Number(l.cuenta) || l.cuenta, p.campana_albor,
      l.cc.padEnd(4), l.personal, l.un.padEnd(4)]);
  }
  ws.getRow(1).font = { bold: true };
  ws.getColumn(1).numFmt = 'dd/mm/yyyy';
  ws.columns.forEach((c) => { c.width = 14; });
  ws.getColumn(8).width = 32;
  const nombre = { B2: 'B2', P1: 'P1', PREV_P1: 'PrevP1', PREV_P2: 'PrevP2' }[grupo];
  return {
    nombre: `Albor ${nombre} ${p.anio}-${String(p.mes).padStart(2, '0')}.xlsx`,
    tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    cuerpo: Buffer.from(await wb.xlsx.writeBuffer()), filas: lineas.length, debe, haber,
  };
}
