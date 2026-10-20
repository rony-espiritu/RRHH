import 'server-only';
import { sql } from '@/lib/db';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export interface Trabajador {
  id: number; codigo: string; ci: string; ci_expedido: string | null; ci_complemento: string | null; tipo_documento: string;
  ap_paterno: string | null; ap_materno: string | null; nombres: string; fecha_nacimiento: string | null; sexo: string | null;
  estado_civil: string | null; nacionalidad: string | null; pais_nacionalidad: string; direccion: string | null; telefono: string | null;
  email: string | null; nua_cua: string | null; nro_asegurado: string | null; jubilado: boolean; aporta_gestora: boolean;
  discapacidad: boolean; tutor_discapacidad: boolean; grupo_sanguineo: string | null; contacto_emergencia: string | null;
  fecha_ingreso_grupo: string | null; observaciones: string | null; activo: boolean;
}
export interface Vinculo {
  id: number; empresa_id: number; empresa: string; empresa_nombre: string; empresa_b2_id: number | null; empresa_b2: string | null;
  en_b1: boolean; en_b2: boolean; fecha_ingreso: string; fecha_retiro: string | null; motivo_retiro: number | null; tipo_finiquito: string | null;
  cargo_id: number | null; cargo: string | null; ocupacion: string | null; area_id: number | null; area: string | null;
  modalidad_contrato: number | null; tipo_contrato: number | null; horas_dia: number | null; observacion: string | null;
}
export interface Fijo { id: number; concepto_id: number; codigo: number; planilla: 'B1' | 'B2'; nombre: string; modo: string; cantidad: number | null; monto: number | null; vigente_desde: string; vigente_hasta: string | null; motivo: string | null }
export interface Asignacion { id: number; centro_costo_id: number; centro: string; descripcion: string; planilla: string | null; porcentaje: number; albor_cc: string; albor_un: string; vigente_desde: string; vigente_hasta: string | null }
export interface Pago { id: number; planilla: string; forma: string; nro_cuenta: string | null; vigente_desde: string; vigente_hasta: string | null }
export interface Tasa { id: number; parametro_clave: string; valor: number; vigente_desde: string; vigente_hasta: string | null; motivo: string | null }
export interface Dependiente { id: number; nombre: string; fecha_nacimiento: string | null; parentesco: string | null; ci: string | null; sexo: string | null }
export interface MovVacacion { id: number; vinculo_id: number; fecha_desde: string | null; fecha_hasta: string | null; dias: number; tipo: string; referencia: string | null }
export interface BoletaRef { periodo_id: number; anio: number; mes: number; planilla: 'B1' | 'B2'; vinculo_id: number; empresa: string; total_ganado: number; total_descuentos: number; liquido: number; estado: string }

const hoy = () => new Date().toISOString().slice(0, 10);
const diaAntes = (iso: string) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

async function auditar(tabla: string, id: number | string, accion: string, antes: unknown, despues: unknown) {
  await sql`insert into auditoria (tabla, registro_id, accion, antes, despues)
            values (${tabla}, ${String(id)}, ${accion}, ${antes == null ? null : sql.json(JSON.parse(JSON.stringify(antes)))}, ${despues == null ? null : sql.json(JSON.parse(JSON.stringify(despues)))})`;
}

// ---------------------------------------------------------------------------
// Lectura de la ficha
// ---------------------------------------------------------------------------
export async function obtenerFicha(codigo: string) {
  const [t] = await sql<Trabajador[]>`select *, fecha_nacimiento::text, fecha_ingreso_grupo::text from trabajador where codigo = ${codigo}`;
  if (!t) return null;
  const vinculos = [...await sql<Vinculo[]>`
    select v.*, v.fecha_ingreso::text, v.fecha_retiro::text, e.codigo empresa, e.razon_social empresa_nombre, e2.codigo empresa_b2,
           c.descripcion cargo, a.descripcion area
    from vinculo v join empresa e on e.id = v.empresa_id left join empresa e2 on e2.id = v.empresa_b2_id
    left join cargo c on c.id = v.cargo_id left join area a on a.id = v.area_id
    where v.trabajador_id = ${t.id} order by v.fecha_ingreso desc`];
  const vigente = vinculos.find((v) => !v.fecha_retiro) ?? vinculos[0] ?? null;
  const ids = vinculos.map((v) => v.id);
  const fijos = ids.length ? [...await sql<Fijo[]>`
    select f.id, f.concepto_id, c.codigo, c.planilla::text planilla, c.nombre, c.modo::text modo, f.cantidad, f.monto,
           f.vigente_desde::text, f.vigente_hasta::text, f.motivo
    from concepto_fijo f join concepto c on c.id = f.concepto_id where f.vinculo_id = ${vigente!.id}
    order by c.planilla, c.codigo, f.vigente_desde desc`] : [];
  const asignaciones = vigente ? [...await sql<Asignacion[]>`
    select a.id, a.centro_costo_id, c.codigo centro, c.descripcion, a.planilla::text planilla, a.porcentaje,
           coalesce(a.albor_cc, c.albor_cc) albor_cc, coalesce(a.albor_unidad_negocio, c.albor_unidad_negocio) albor_un,
           a.vigente_desde::text, a.vigente_hasta::text
    from asignacion_cc a join centro_costo c on c.id = a.centro_costo_id where a.vinculo_id = ${vigente.id}
    order by a.vigente_hasta nulls first, a.vigente_desde desc, a.porcentaje desc`] : [];
  const pagos = [...await sql<Pago[]>`select id, planilla::text planilla, forma::text forma, nro_cuenta, vigente_desde::text, vigente_hasta::text
                                       from trabajador_pago where trabajador_id = ${t.id} order by vigente_hasta nulls first, vigente_desde desc`];
  const tasas = [...await sql<Tasa[]>`select id, parametro_clave, valor, vigente_desde::text, vigente_hasta::text, motivo
                                       from tasa_trabajador where trabajador_id = ${t.id} order by vigente_hasta nulls first, vigente_desde desc`];
  const dependientes = [...await sql<Dependiente[]>`select id, nombre, fecha_nacimiento::text, parentesco, ci, sexo from dependiente where trabajador_id = ${t.id} order by fecha_nacimiento`];
  const vacaciones = ids.length ? [...await sql<MovVacacion[]>`select id, vinculo_id, fecha_desde::text, fecha_hasta::text, dias, tipo, referencia
                                       from vacacion_mov where vinculo_id in ${sql(ids)} order by fecha_desde desc nulls last`] : [];
  const boletas = ids.length ? [...await sql<BoletaRef[]>`
    select p.id periodo_id, p.anio, p.mes, pt.planilla::text planilla, pt.vinculo_id, e.codigo empresa, pt.total_ganado, pt.total_descuentos, pt.liquido,
           (case when pt.planilla = 'B1' then p.estado_b1 else p.estado_b2 end)::text estado
    from planilla_trabajador pt join periodo p on p.id = pt.periodo_id join empresa e on e.id = pt.empresa_id
    where pt.vinculo_id in ${sql(ids)} order by p.anio desc, p.mes desc, pt.planilla`] : [];
  return { t, vinculos, vigente, fijos, asignaciones, pagos, tasas, dependientes, vacaciones, boletas };
}
export type Ficha = NonNullable<Awaited<ReturnType<typeof obtenerFicha>>>;

export async function catalogos() {
  const empresas = [...await sql<{ id: number; codigo: string; razon_social: string; tipo: string }[]>`select id, codigo, razon_social, tipo::text from empresa where activo order by codigo`];
  const cargos = [...await sql<{ id: number; descripcion: string }[]>`select id, descripcion from cargo order by descripcion`];
  const areas = [...await sql<{ id: number; codigo: string; descripcion: string }[]>`select id, codigo, descripcion from area order by codigo`];
  const centros = [...await sql<{ id: number; codigo: string; descripcion: string; albor_cc: string; albor_unidad_negocio: string }[]>`select id, codigo, descripcion, albor_cc, albor_unidad_negocio from centro_costo where activo order by codigo`];
  const conceptos = [...await sql<{ id: number; codigo: number; planilla: 'B1' | 'B2'; nombre: string; modo: string; naturaleza: string }[]>`
    select id, codigo, planilla::text planilla, nombre, modo::text modo, naturaleza::text naturaleza from concepto
    where activo and naturaleza in ('INGRESO', 'DESCUENTO') and modo in ('DIAS_SUELDO', 'MANUAL', 'MONTO_FIJO', 'MONTO_FIJO_PRORRATA') order by planilla, codigo`];
  return { empresas, cargos, areas, centros, conceptos };
}

// ---------------------------------------------------------------------------
// Vacaciones: derecho por año cumplido (LGT): 1–4 años 15 días, 5–9 años 20, 10+ años 30
// ---------------------------------------------------------------------------
export function derechoVacaciones(fechaIngreso: string, corte = hoy()) {
  const i = new Date(fechaIngreso + 'T12:00:00Z'), c = new Date(corte + 'T12:00:00Z');
  let anios = c.getUTCFullYear() - i.getUTCFullYear();
  if (c.getUTCMonth() < i.getUTCMonth() || (c.getUTCMonth() === i.getUTCMonth() && c.getUTCDate() < i.getUTCDate())) anios--;
  const gestiones: { anio: number; desde: string; dias: number }[] = [];
  for (let k = 1; k <= anios; k++) {
    const d = new Date(i); d.setUTCFullYear(i.getUTCFullYear() + k);
    gestiones.push({ anio: k, desde: d.toISOString().slice(0, 10), dias: k < 5 ? 15 : k < 10 ? 20 : 30 });
  }
  return { anios, gestiones, total: gestiones.reduce((s, g) => s + g.dias, 0) };
}

export function saldoVacaciones(f: Ficha) {
  if (!f.vigente) return { derecho: 0, tomados: 0, ajustes: 0, saldo: 0, anios: 0, gestiones: [] as ReturnType<typeof derechoVacaciones>['gestiones'] };
  const d = derechoVacaciones(f.vigente.fecha_ingreso);
  const movs = f.vacaciones.filter((m) => m.vinculo_id === f.vigente!.id);
  const tomados = -movs.filter((m) => m.tipo === 'GOZADO' || m.tipo === 'PAGADO').reduce((s, m) => s + Number(m.dias), 0);
  const ajustes = movs.filter((m) => m.tipo === 'AJUSTE' || m.tipo === 'SALDO_INICIAL').reduce((s, m) => s + Number(m.dias), 0);
  return { derecho: d.total, tomados, ajustes, saldo: d.total + ajustes - tomados, anios: d.anios, gestiones: d.gestiones };
}

// ---------------------------------------------------------------------------
// Cambios
// ---------------------------------------------------------------------------
const nul = (v: FormDataEntryValue | string | null | undefined) => { const s = String(v ?? '').trim(); return s === '' ? null : s; };

export async function guardarDatosPersonales(id: number, d: Record<string, string | null | boolean>) {
  const campos = ['ci', 'ci_expedido', 'ci_complemento', 'tipo_documento', 'ap_paterno', 'ap_materno', 'nombres', 'fecha_nacimiento', 'sexo', 'estado_civil',
    'nacionalidad', 'pais_nacionalidad', 'direccion', 'telefono', 'email', 'grupo_sanguineo', 'contacto_emergencia', 'discapacidad', 'tutor_discapacidad', 'observaciones'] as const;
  const [antes] = await sql`select * from trabajador where id = ${id}`;
  const valores = Object.fromEntries(campos.filter((c) => c in d).map((c) => [c, typeof d[c] === 'boolean' ? d[c] : nul(d[c] as string)]));
  if (!valores.nombres || !valores.ci) throw new Error('Nombres y número de documento son obligatorios');
  await sql`update trabajador set ${sql(valores)} where id = ${id}`;
  await auditar('trabajador', id, 'UPDATE', antes, valores);
}

export async function guardarSeguridadSocial(id: number, d: { nua_cua: string | null; nro_asegurado: string | null; aporta_gestora: boolean; jubilado: boolean }) {
  const [antes] = await sql`select nua_cua, nro_asegurado, aporta_gestora, jubilado from trabajador where id = ${id}`;
  await sql`update trabajador set nua_cua = ${nul(d.nua_cua)}, nro_asegurado = ${nul(d.nro_asegurado)}, aporta_gestora = ${d.aporta_gestora}, jubilado = ${d.jubilado} where id = ${id}`;
  await auditar('trabajador', id, 'UPDATE', antes, d);
}

export async function guardarLaboral(vinculoId: number, d: Record<string, string | number | boolean | null>) {
  const campos = ['cargo_id', 'ocupacion', 'area_id', 'modalidad_contrato', 'tipo_contrato', 'horas_dia', 'en_b1', 'en_b2', 'empresa_b2_id', 'observacion'] as const;
  const [antes] = await sql`select * from vinculo where id = ${vinculoId}`;
  const valores = Object.fromEntries(campos.filter((c) => c in d).map((c) => [c, d[c] === '' ? null : d[c]]));
  await sql`update vinculo set ${sql(valores)}, actualizado_en = now() where id = ${vinculoId}`;
  await auditar('vinculo', vinculoId, 'UPDATE', antes, valores);
}

/** Cambia (o quita) un concepto fijo desde una fecha: cierra el vigente el día anterior y crea el nuevo. */
export async function cambiarFijo(vinculoId: number, conceptoId: number, desde: string, cantidad: number | null, monto: number | null, motivo: string | null) {
  await sql.begin(async (tx) => {
    const vig = await tx<{ id: number; vigente_desde: string }[]>`select id, vigente_desde::text from concepto_fijo
      where vinculo_id = ${vinculoId} and concepto_id = ${conceptoId} and vigente_hasta is null`;
    for (const f of vig) {
      if (f.vigente_desde >= desde) await tx`delete from concepto_fijo where id = ${f.id}`; // corrección del mismo periodo
      else await tx`update concepto_fijo set vigente_hasta = ${diaAntes(desde)} where id = ${f.id}`;
    }
    if (cantidad != null || monto != null) {
      await tx`insert into concepto_fijo (vinculo_id, concepto_id, cantidad, monto, vigente_desde, motivo)
               values (${vinculoId}, ${conceptoId}, ${cantidad}, ${monto}, ${desde}, ${motivo})`;
    }
  });
  await auditar('concepto_fijo', `${vinculoId}/${conceptoId}`, 'CAMBIO', null, { desde, cantidad, monto, motivo });
}

export async function cambiarCentroCosto(vinculoId: number, centroId: number, desde: string) {
  await sql.begin(async (tx) => {
    await tx`delete from asignacion_cc where vinculo_id = ${vinculoId} and vigente_hasta is null and vigente_desde >= ${desde} and planilla is null`;
    await tx`update asignacion_cc set vigente_hasta = ${diaAntes(desde)} where vinculo_id = ${vinculoId} and vigente_hasta is null and planilla is null`;
    await tx`insert into asignacion_cc (vinculo_id, centro_costo_id, porcentaje, vigente_desde) values (${vinculoId}, ${centroId}, 100, ${desde})`;
  });
  await auditar('asignacion_cc', vinculoId, 'CAMBIO', null, { centroId, desde });
}

export async function cambiarPago(trabajadorId: number, forma: string, cuenta: string | null, desde: string) {
  await sql.begin(async (tx) => {
    await tx`delete from trabajador_pago where trabajador_id = ${trabajadorId} and planilla = 'B1' and vigente_hasta is null and vigente_desde >= ${desde}`;
    await tx`update trabajador_pago set vigente_hasta = ${diaAntes(desde)} where trabajador_id = ${trabajadorId} and planilla = 'B1' and vigente_hasta is null`;
    await tx`insert into trabajador_pago (trabajador_id, planilla, forma, nro_cuenta, vigente_desde) values (${trabajadorId}, 'B1', ${forma}::forma_pago, ${nul(cuenta)}, ${desde})`;
  });
  await auditar('trabajador_pago', trabajadorId, 'CAMBIO', null, { forma, cuenta, desde });
}

export async function cambiarTasa(trabajadorId: number, clave: string, valor: number | null, desde: string, motivo: string | null) {
  await sql.begin(async (tx) => {
    await tx`update tasa_trabajador set vigente_hasta = ${diaAntes(desde)} where trabajador_id = ${trabajadorId} and parametro_clave = ${clave} and vigente_hasta is null`;
    if (valor != null) await tx`insert into tasa_trabajador (trabajador_id, parametro_clave, valor, vigente_desde, motivo) values (${trabajadorId}, ${clave}, ${valor}, ${desde}, ${motivo})`;
  });
  await auditar('tasa_trabajador', trabajadorId, 'CAMBIO', null, { clave, valor, desde, motivo });
}

export async function agregarDependiente(trabajadorId: number, d: { nombre: string; fecha_nacimiento: string | null; parentesco: string | null; ci: string | null; sexo: string | null }) {
  await sql`insert into dependiente (trabajador_id, nombre, fecha_nacimiento, parentesco, ci, sexo)
            values (${trabajadorId}, ${d.nombre}, ${nul(d.fecha_nacimiento)}, ${nul(d.parentesco)}, ${nul(d.ci)}, ${nul(d.sexo)})`;
}
export async function eliminarDependiente(id: number) { await sql`delete from dependiente where id = ${id}`; }

export async function registrarVacacion(vinculoId: number, desde: string | null, hasta: string | null, dias: number, tipo: string, ref: string | null) {
  const signo = tipo === 'GOZADO' || tipo === 'PAGADO' ? -Math.abs(dias) : dias;
  await sql`insert into vacacion_mov (vinculo_id, fecha_desde, fecha_hasta, dias, tipo, referencia) values (${vinculoId}, ${nul(desde)}, ${nul(hasta)}, ${signo}, ${tipo}, ${nul(ref)})`;
}
export async function eliminarVacacion(id: number) { await sql`delete from vacacion_mov where id = ${id}`; }

/**
 * Cambio de empresa (rotación o nuevo propietario): cierra el vínculo el día anterior (retiro, motivo y finiquito)
 * y abre uno nuevo en la empresa destino, copiando cargo, ocupación, montos fijos y centro de costo vigentes.
 */
export async function cambiarEmpresa(vinculoId: number, empresaId: number, fecha: string, motivoRetiro: number | null, tipoFiniquito: string | null) {
  return sql.begin(async (tx) => {
    const [v] = await tx<Vinculo[]>`select *, fecha_ingreso::text from vinculo where id = ${vinculoId}`;
    if (fecha <= v.fecha_ingreso) throw new Error('La fecha del cambio debe ser posterior al ingreso');
    await tx`update vinculo set fecha_retiro = ${diaAntes(fecha)}, motivo_retiro = ${motivoRetiro}, tipo_finiquito = ${tipoFiniquito} where id = ${vinculoId}`;
    const [n] = await tx<{ id: number }[]>`
      insert into vinculo (trabajador_id, empresa_id, empresa_b2_id, en_b1, en_b2, fecha_ingreso, cargo_id, ocupacion, area_id, nivel_id, modalidad_contrato, tipo_contrato, horas_dia, observacion)
      select trabajador_id, ${empresaId}, empresa_b2_id, en_b1, en_b2, ${fecha}, cargo_id, ocupacion, area_id, nivel_id, modalidad_contrato, tipo_contrato, horas_dia,
             ${'Viene del vínculo ' + vinculoId} from vinculo where id = ${vinculoId} returning id`;
    await tx`insert into concepto_fijo (vinculo_id, concepto_id, cantidad, monto, vigente_desde, motivo)
             select ${n.id}, concepto_id, cantidad, monto, ${fecha}, 'Copiado al cambiar de empresa' from concepto_fijo
             where vinculo_id = ${vinculoId} and (vigente_hasta is null or vigente_hasta >= ${fecha})`;
    await tx`update concepto_fijo set vigente_hasta = ${diaAntes(fecha)} where vinculo_id = ${vinculoId} and vigente_hasta is null`;
    await tx`insert into asignacion_cc (vinculo_id, centro_costo_id, planilla, porcentaje, albor_cc, albor_unidad_negocio, vigente_desde)
             select ${n.id}, centro_costo_id, planilla, porcentaje, albor_cc, albor_unidad_negocio, ${fecha} from asignacion_cc
             where vinculo_id = ${vinculoId} and (vigente_hasta is null or vigente_hasta >= ${fecha})`;
    await tx`update asignacion_cc set vigente_hasta = ${diaAntes(fecha)} where vinculo_id = ${vinculoId} and vigente_hasta is null`;
    await tx`insert into auditoria (tabla, registro_id, accion, despues) values ('vinculo', ${String(vinculoId)}, 'CAMBIO_EMPRESA', ${tx.json({ nuevo: n.id, empresaId, fecha, motivoRetiro, tipoFiniquito })})`;
    return n.id;
  });
}

export async function darDeBaja(vinculoId: number, fecha: string, motivo: number | null, tipoFiniquito: string | null) {
  await sql.begin(async (tx) => {
    await tx`update vinculo set fecha_retiro = ${fecha}, motivo_retiro = ${motivo}, tipo_finiquito = ${tipoFiniquito} where id = ${vinculoId}`;
    await tx`update concepto_fijo set vigente_hasta = ${fecha} where vinculo_id = ${vinculoId} and vigente_hasta is null`;
    await tx`update asignacion_cc set vigente_hasta = ${fecha} where vinculo_id = ${vinculoId} and vigente_hasta is null`;
    await tx`insert into auditoria (tabla, registro_id, accion, despues) values ('vinculo', ${String(vinculoId)}, 'BAJA', ${tx.json({ fecha, motivo, tipoFiniquito })})`;
  });
}

/** Alta de un trabajador nuevo con su primer vínculo. Devuelve el código. */
export async function crearTrabajador(d: {
  codigo: string; ci: string; ci_expedido: string | null; tipo_documento: string; ap_paterno: string | null; ap_materno: string | null; nombres: string;
  fecha_nacimiento: string | null; sexo: string | null; empresa_id: number; fecha_ingreso: string; cargo_id: number | null; ocupacion: string | null;
  en_b1: boolean; sueldo_b1: number | null; abono_b2: number | null; centro_costo_id: number | null; forma_pago: string; nro_cuenta: string | null;
}) {
  return sql.begin(async (tx) => {
    const [t] = await tx<{ id: number }[]>`
      insert into trabajador (codigo, ci, ci_expedido, tipo_documento, ap_paterno, ap_materno, nombres, fecha_nacimiento, sexo, fecha_ingreso_grupo)
      values (${d.codigo.toUpperCase()}, ${d.ci}, ${d.ci_expedido}, ${d.tipo_documento}, ${d.ap_paterno}, ${d.ap_materno}, ${d.nombres}, ${d.fecha_nacimiento}, ${d.sexo}, ${d.fecha_ingreso})
      returning id`;
    const [v] = await tx<{ id: number }[]>`
      insert into vinculo (trabajador_id, empresa_id, en_b1, en_b2, fecha_ingreso, cargo_id, ocupacion)
      values (${t.id}, ${d.empresa_id}, ${d.en_b1}, true, ${d.fecha_ingreso}, ${d.cargo_id}, ${d.ocupacion}) returning id`;
    if (d.en_b1 && d.sueldo_b1) await tx`insert into concepto_fijo (vinculo_id, concepto_id, cantidad, monto, vigente_desde, motivo)
      select ${v.id}, id, 30, ${d.sueldo_b1}, ${d.fecha_ingreso}, 'Alta' from concepto where planilla = 'B1' and codigo = 2`;
    if (d.abono_b2) await tx`insert into concepto_fijo (vinculo_id, concepto_id, cantidad, monto, vigente_desde, motivo)
      select ${v.id}, id, 30, ${d.abono_b2}, ${d.fecha_ingreso}, 'Alta' from concepto where planilla = 'B2' and codigo = 2`;
    if (d.centro_costo_id) await tx`insert into asignacion_cc (vinculo_id, centro_costo_id, porcentaje, vigente_desde) values (${v.id}, ${d.centro_costo_id}, 100, ${d.fecha_ingreso})`;
    await tx`insert into trabajador_pago (trabajador_id, planilla, forma, nro_cuenta, vigente_desde) values (${t.id}, 'B1', ${d.forma_pago}::forma_pago, ${d.nro_cuenta}, ${d.fecha_ingreso})`;
    await tx`insert into auditoria (tabla, registro_id, accion, despues) values ('trabajador', ${String(t.id)}, 'ALTA', ${tx.json(JSON.parse(JSON.stringify(d)))})`;
    return d.codigo.toUpperCase();
  });
}

/** Código sugerido según la costumbre de SIDPLAN: iniciales (apellido + nombre) + día y mes de nacimiento. */
export function sugerirCodigo(apPaterno: string, nombres: string, fechaNac: string | null) {
  const ini = (apPaterno.trim()[0] ?? 'X') + (nombres.trim()[0] ?? 'X');
  const dm = fechaNac ? fechaNac.slice(8, 10) + fechaNac.slice(5, 7) : '0000';
  return (ini + dm).toUpperCase();
}
