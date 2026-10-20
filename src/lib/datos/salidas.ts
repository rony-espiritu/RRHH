import 'server-only';
import ExcelJS from 'exceljs';
import { sql } from '@/lib/db';
import { nombreMes } from './planilla';

interface FilaSalida {
  codigo: string; ci: string; ci_expedido: string | null; ap_paterno: string | null; ap_materno: string | null; nombres: string;
  fecha_nacimiento: string | null; sexo: string | null; nua_cua: string | null; jubilado: boolean; aporta_gestora: boolean;
  discapacidad: boolean; tutor_discapacidad: boolean; fecha_ingreso: string; fecha_retiro: string | null; motivo_retiro: number | null;
  ocupacion: string | null; cargo: string | null; clasificacion_ovt: number | null; modalidad_contrato: number | null; tipo_contrato: number | null;
  empresa: string; empresa_tipo: string; dias: number; horas_dia: number; total_ganado: number; liquido: number;
  forma_pago: string; nro_cuenta: string | null; lineas: { codigo: number; cantidad: number | null; monto: number }[];
}

async function filas(periodoId: number, planilla: 'B1' | 'B2', empresa?: string): Promise<FilaSalida[]> {
  return [...await sql<FilaSalida[]>`
    select t.codigo, t.ci, t.ci_expedido, t.ap_paterno, t.ap_materno, t.nombres, t.fecha_nacimiento::text, t.sexo, t.nua_cua,
           t.jubilado, t.aporta_gestora, t.discapacidad, t.tutor_discapacidad,
           v.fecha_ingreso::text, v.fecha_retiro::text, v.motivo_retiro, v.ocupacion, c.descripcion cargo, c.clasificacion_ovt,
           v.modalidad_contrato, v.tipo_contrato, e.codigo empresa, e.tipo::text empresa_tipo,
           pt.dias_pagados dias, pt.horas_dia, pt.total_ganado, pt.liquido, pt.forma_pago::text forma_pago, pt.nro_cuenta,
           coalesce((select json_agg(json_build_object('codigo', l.codigo, 'cantidad', l.cantidad, 'monto', l.monto))
                     from planilla_linea l where l.planilla_trabajador_id = pt.id), '[]') lineas
    from planilla_trabajador pt join vinculo v on v.id = pt.vinculo_id join trabajador t on t.id = v.trabajador_id
    join empresa e on e.id = pt.empresa_id left join cargo c on c.id = v.cargo_id
    where pt.periodo_id = ${periodoId} and pt.planilla = ${planilla}::tipo_planilla ${empresa ? sql`and e.codigo = ${empresa}` : sql``}
    order by t.ap_paterno, t.ap_materno, t.nombres`];
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Arma un .xlsx de una hoja: primera fila en negrita, columnas con ancho según el contenido. */
async function libro(nombreHoja: string, datos: (string | number)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(nombreHoja);
  datos.forEach((f) => ws.addRow(f));
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c, i) => { c.width = Math.min(45, Math.max(10, ...datos.map((f) => String(f[i] ?? '').length + 2))); });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const monto = (f: FilaSalida, ...cods: number[]) => f.lineas.filter((l) => cods.includes(l.codigo)).reduce((s, l) => s + Number(l.monto), 0);
const cant = (f: FilaSalida, cod: number) => f.lineas.filter((l) => l.codigo === cod).reduce((s, l) => s + Number(l.cantidad ?? 0), 0);
const n2 = (x: number) => String(Math.round(x * 100) / 100);
const fechaOvt = (iso: string | null) => (iso ? `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}/${iso.slice(0, 4)}` : '');
const nombreBanco = (f: FilaSalida) => [f.ap_paterno, f.ap_materno, f.nombres].filter(Boolean).join(', ');

/** TXT Banco Unión: cuenta|monto (12 caracteres, 2 decimales)|nombre — un archivo por empresa. */
export async function archivoBancoUnion(periodoId: number, empresa: string) {
  const fs = (await filas(periodoId, 'B1', empresa)).filter((f) => f.forma_pago === 'BANCO_UNION' && f.nro_cuenta && f.liquido > 0);
  const txt = fs.map((f) => `${f.nro_cuenta}|${f.liquido.toFixed(2).padStart(12, '0')}|${nombreBanco(f).padEnd(45).slice(0, 45)}`).join('\r\n') + '\r\n';
  return { nombre: `bco-${empresa}.txt`, tipo: 'text/plain; charset=utf-8', cuerpo: Buffer.from(txt, 'utf8'), filas: fs.length };
}

/** Planilla de referencia BNB (se carga a mano en la web del banco). */
export async function planillaBnb(periodoId: number) {
  const [p] = await sql<{ anio: number; mes: number }[]>`select anio, mes from periodo where id = ${periodoId}`;
  const fs = (await filas(periodoId, 'B1')).filter((f) => f.forma_pago === 'BNB');
  const mes = nombreMes(p.mes)[0].toUpperCase() + nombreMes(p.mes).slice(1);
  const datos = [['Periodo de abono (Año)', 'Periodo de abono (Mes)', 'Monto', 'Número De cuenta', 'Tipo Documento', 'Número Documento', 'Nombre Beneficiario'],
    ...fs.map((f) => [String(p.anio), mes, f.liquido.toFixed(2), f.nro_cuenta ?? '', 'Carnet De Identidad', f.ci, [f.ap_paterno, f.ap_materno, f.nombres].filter(Boolean).join(' ').toUpperCase()])];
  datos.push(['', 'TOTAL', fs.reduce((s, f) => s + f.liquido, 0).toFixed(2), '', '', '', '']);
  return { nombre: `Planilla banco BNB ${p.anio}-${String(p.mes).padStart(2, '0')}.xlsx`, tipo: XLSX_MIME,
    cuerpo: await libro('Hoja', datos), filas: fs.length };
}

/** Lista de pagos en efectivo (B1 sin cuenta o todo B2), para firma. */
export async function listaEfectivo(periodoId: number, planilla: 'B1' | 'B2') {
  const fs = (await filas(periodoId, planilla)).filter((f) => planilla === 'B2' || f.forma_pago === 'EFECTIVO');
  const datos = [['Empresa', 'Código', 'Nombre', 'CI', planilla === 'B1' ? 'Líquido pagable' : 'Saldo cuenta corriente', 'Firma'],
    ...fs.map((f) => [f.empresa, f.codigo, nombreBanco(f), f.ci, f.liquido, '']),
    ['', '', 'TOTAL', '', fs.reduce((s, f) => s + f.liquido, 0), '']];
  return { nombre: `Pago efectivo ${planilla}.xlsx`, tipo: XLSX_MIME, cuerpo: await libro('Efectivo', datos), filas: fs.length };
}

const OVT_COLUMNAS = ['Nro', 'Tipo de documento de identidad', 'Número de documento de identidad', 'Lugar de expedición', 'Fecha de nacimiento',
  'Apellido Paterno', 'Apellido Materno', 'Nombres', 'País de nacionalidad', 'Sexo', 'Jubilado', '¿Aporta a la AFP?', '¿Persona con discapacidad?',
  'Tutor de persona con discapacidad', 'Fecha de ingreso', 'Fecha de retiro', 'Motivo retiro', 'Caja de salud', 'AFP a la que aporta', 'NUA/CUA',
  'Sucursal o ubicación adicional', 'Clasificación laboral', 'Cargo', 'Modalidad de contrato', 'Tipo contrato', 'Días pagados', 'Horas pagadas',
  'Haber Básico', 'Bono de antigüedad', 'Horas extra', 'Monto horas extra', 'Horas recargo nocturno', 'Monto horas extra nocturnas',
  'Horas extra dominicales', 'Monto horas extra dominicales', 'Domingos trabajados', 'Monto domingo trabajado', 'Nro. dominicales',
  'Salario dominical', 'Bono producción', 'Subsidio frontera', 'Otros bonos y pagos', 'RC-IVA', 'Aporte Caja Salud', 'Aporte AFP', 'Otros descuentos'];

/** CSV para la OVT del Ministerio de Trabajo (planilla mensual), separador "|", UTF-8 con BOM. */
export async function csvOvt(periodoId: number, empresa: string) {
  const fs = await filas(periodoId, 'B1', empresa);
  const lineas = fs.map((f, i) => {
    const v: Record<string, string> = {
      'Nro': String(i + 1), 'Tipo de documento de identidad': 'CI', 'Número de documento de identidad': f.ci,
      'Lugar de expedición': f.ci_expedido ?? '', 'Fecha de nacimiento': fechaOvt(f.fecha_nacimiento),
      'Apellido Paterno': f.ap_paterno ?? '', 'Apellido Materno': f.ap_materno ?? '', 'Nombres': f.nombres, 'País de nacionalidad': 'BOLIVIA',
      'Sexo': f.sexo ?? '', 'Jubilado': f.jubilado ? '1' : '0', '¿Aporta a la AFP?': f.aporta_gestora ? '1' : '0',
      '¿Persona con discapacidad?': f.discapacidad ? '1' : '0', 'Tutor de persona con discapacidad': f.tutor_discapacidad ? '1' : '0',
      'Fecha de ingreso': fechaOvt(f.fecha_ingreso), 'Fecha de retiro': fechaOvt(f.fecha_retiro), 'Motivo retiro': f.motivo_retiro ? String(f.motivo_retiro) : '',
      'Caja de salud': '6', 'AFP a la que aporta': '3', 'NUA/CUA': f.nua_cua ?? '', 'Sucursal o ubicación adicional': '1',
      'Clasificación laboral': String(f.clasificacion_ovt ?? (f.empresa === 'BASP' ? 4 : 6)), 'Cargo': f.ocupacion ?? f.cargo ?? '',
      'Modalidad de contrato': String(f.modalidad_contrato ?? 2), 'Tipo contrato': String(f.tipo_contrato ?? 1),
      'Días pagados': String(f.dias), 'Horas pagadas': String(f.horas_dia ?? 8), 'Haber Básico': n2(monto(f, 2)),
      'Bono de antigüedad': n2(monto(f, 8)), 'Horas extra': n2(cant(f, 4)), 'Monto horas extra': n2(monto(f, 4)),
      'Nro. dominicales': '0', 'Salario dominical': '0', 'Bono producción': '0',
      'Otros bonos y pagos': n2(f.lineas.filter((l) => l.codigo < 500 && ![2, 4, 8].includes(l.codigo)).reduce((s, l) => s + Number(l.monto), 0)),
      'RC-IVA': n2(monto(f, 501)), 'Aporte Caja Salud': n2(monto(f, 910)), 'Aporte AFP': n2(monto(f, 513, 517)), 'Otros descuentos': n2(monto(f, 525)),
    };
    return OVT_COLUMNAS.map((c) => v[c] ?? '').join('|');
  });
  const txt = '﻿' + [OVT_COLUMNAS.join('|'), ...lineas].join('\r\n') + '\r\n';
  return { nombre: `OVT ${empresa}.csv`, tipo: 'text/csv; charset=utf-8', cuerpo: Buffer.from(txt, 'utf8'), filas: fs.length };
}
