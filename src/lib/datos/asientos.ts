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

/** Cuentas Albor configurables (tabla cuenta_albor, pantalla Configuración). */
export async function cuentasAlbor() {
  const filas = await sql<{ clave: string; grupo: string; cuenta: string; detalle: string }[]>`select clave, grupo, cuenta, detalle from cuenta_albor`;
  const m = new Map(filas.map((f) => [f.clave, f]));
  /** Cuenta de gasto: prefijo según unidad de negocio (o comercialización) + sufijo según tipo contable del concepto. */
  const gasto = (un: string, cc: string, tipo: string) => {
    // Una unidad de negocio con cuenta completa (p. ej. UN 50) manda; luego comercialización (COMEC…); luego el prefijo de la UN.
    const porUn = m.get(`GASTO_UN_${un}`);
    const g = (porUn && porUn.cuenta.length > 6 ? porUn : undefined) ?? (cc.startsWith('COMEC') ? m.get('GASTO_COMEC') : undefined) ?? porUn ?? m.get('GASTO_OTRA');
    if (!g) return 'DEFINIR';
    return g.cuenta.length > 6 ? g.cuenta : g.cuenta + tipo;
  };
  const pasivo = (clave: string) => m.get(clave) ?? { cuenta: 'DEFINIR', detalle: `Concepto ${clave}` };
  return { gasto, pasivo };
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

/** Por defecto excluye a Baspel (tiene su propia contabilidad); con soloEmpresa = 'BASP' genera solo Baspel. */
export async function generarAsientos(periodoId: number, grupo: GrupoAsiento, soloEmpresa?: string) {
  const [p] = await sql<{ anio: number; mes: number; fecha_inicio: string; fecha_fin: string; campana_albor: string }[]>`
    select anio, mes, fecha_inicio::text, fecha_fin::text, campana_albor from periodo where id = ${periodoId}`;
  const planilla = grupo === 'B2' || grupo === 'PREV_P2' ? 'B2' : 'B1';
  const prm = await cargarParametros(p.fecha_fin);
  const reparto = await repartos(periodoId);
  const cta = await cuentasAlbor();
  const trab = await sql<{ id: number; vinculo_id: number; codigo: string; liquido: number; fecha_ingreso: string; lineas: { codigo: number; nombre: string; monto: number; aguinaldo: boolean; indemn: boolean; tipo: string | null }[] }[]>`
    select pt.id, pt.vinculo_id, t.codigo, pt.liquido, v.fecha_ingreso::text,
           coalesce((select json_agg(json_build_object('codigo', l.codigo, 'nombre', c.nombre, 'monto', l.monto, 'aguinaldo', c.afecta_aguinaldo, 'indemn', c.afecta_indemn, 'tipo', c.tipo_contable))
                     from planilla_linea l join concepto c on c.id = l.concepto_id where l.planilla_trabajador_id = pt.id), '[]') lineas
    from planilla_trabajador pt join vinculo v on v.id = pt.vinculo_id join trabajador t on t.id = v.trabajador_id
    join empresa e on e.id = pt.empresa_id
    where pt.periodo_id = ${periodoId} and pt.planilla = ${planilla}::tipo_planilla
      and ${soloEmpresa ? sql`e.codigo = ${soloEmpresa}` : sql`e.codigo <> 'BASP'`}
    order by t.codigo`;

  const out: Linea[] = [];
  const debeGasto = (detalle: string, tipo: string, monto: number, vinculo: number) => {
    const partes = reparto(vinculo, planilla);
    distribuir(monto, partes).forEach((m, i) => {
      if (m) out.push({ detalle, cuenta: cta.gasto(partes[i].un, partes[i].cc, tipo), cc: partes[i].albor_cc, un: partes[i].un, personal: '00', debe: m, haber: 0 });
    });
  };
  const pasivo = (clave: string, monto: number, personal: string, lado: 'debe' | 'haber' = 'haber', detalle?: string) => {
    const c = cta.pasivo(clave);
    if (monto) out.push({ detalle: detalle ?? c.detalle, cuenta: c.cuenta, cc: '150', un: 'PAT', personal, debe: lado === 'debe' ? monto : 0, haber: lado === 'haber' ? monto : 0 });
  };

  for (const t of trab) {
    const ingresos = t.lineas.filter((l) => l.codigo < 500);
    if (grupo === 'P1') {
      for (const l of ingresos) debeGasto(l.nombre, l.tipo ?? '001', Number(l.monto), t.vinculo_id);
      for (const l of t.lineas.filter((x) => x.codigo >= 500 && x.codigo < 900)) pasivo(String(l.codigo), Number(l.monto), t.codigo);
      pasivo('LIQUIDO', Number(t.liquido), t.codigo);
    } else if (grupo === 'PREV_P1') {
      const cargas = t.lineas.filter((l) => [910, 911, 912].includes(l.codigo)).reduce((s, l) => s + Number(l.monto), 0);
      debeGasto('Cargas Sociales', '003', r2(cargas), t.vinculo_id);
      for (const l of t.lineas.filter((x) => x.codigo === 913)) debeGasto('Aguinaldos', '001', Number(l.monto), t.vinculo_id);
      for (const l of t.lineas.filter((x) => x.codigo === 914)) debeGasto('Finiquitos', '004', Number(l.monto), t.vinculo_id);
      for (const l of t.lineas.filter((x) => x.codigo >= 910)) pasivo(String(l.codigo), Number(l.monto), '00');
    } else if (grupo === 'B2') {
      // Carga inicial (día 1): solo quienes ya trabajaban el 1° (los que entran después se ajustan a fin de mes).
      if (t.fecha_ingreso > p.fecha_inicio) continue;
      for (const l of ingresos) {
        const monto = Number(l.monto);
        debeGasto(l.nombre, l.tipo ?? '001', monto, t.vinculo_id);
        pasivo('CTA_CTE', monto, t.codigo, 'haber', l.nombre);
      }
      for (const l of t.lineas.filter((x) => x.codigo >= 500 && x.codigo < 900 && x.codigo !== 511)) {
        pasivo('CTA_CTE', Number(l.monto), t.codigo, 'debe', l.nombre);
        pasivo(String(l.codigo), Number(l.monto), t.codigo);
      }
    } else {
      const base = ingresos.filter((l) => l.aguinaldo).reduce((s, l) => s + Number(l.monto), 0);
      const baseInd = ingresos.filter((l) => l.indemn).reduce((s, l) => s + Number(l.monto), 0);
      const ag = r2(base * prm.PREV_AGUINALDO), ind = r2(baseInd * prm.PREV_INDEMN);
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
    nombre: `Albor ${nombre}${soloEmpresa ? ' ' + soloEmpresa : ''} ${p.anio}-${String(p.mes).padStart(2, '0')}.xlsx`,
    tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    cuerpo: Buffer.from(await wb.xlsx.writeBuffer()), filas: lineas.length, debe, haber,
  };
}
