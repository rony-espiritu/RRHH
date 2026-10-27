import 'server-only';
import { sql } from '@/lib/db';

/** Descripción de cada parámetro: cómo se muestra y se edita. pct = se guarda como fracción y se edita en %. */
export const META: Record<string, { grupo: string; nombre: string; tipo: 'pct' | 'bs' | 'num' | 'anios' | 'mes' }> = {
  SMN: { grupo: 'Generales', nombre: 'Salario mínimo nacional', tipo: 'bs' },
  TC_USD: { grupo: 'Generales', nombre: 'Tipo de cambio $us (aporte cooperativa)', tipo: 'num' },
  CAMPANA_MES_INICIO: { grupo: 'Generales', nombre: 'Mes de inicio de la campaña Albor', tipo: 'mes' },
  HE_FACTOR_B1: { grupo: 'Horas extra', nombre: 'Factor hora extra B1 (1 = valor simple, 2 = doble)', tipo: 'num' },
  HE_FACTOR_B2: { grupo: 'Horas extra', nombre: 'Factor hora extra B2', tipo: 'num' },
  GESTORA_LAB: { grupo: 'Aportes laborales', nombre: 'Gestora Pública laboral', tipo: 'pct' },
  GESTORA_LAB_65: { grupo: 'Aportes laborales', nombre: 'Gestora laboral desde la edad reducida', tipo: 'pct' },
  EDAD_GESTORA_REDUCIDA: { grupo: 'Aportes laborales', nombre: 'Edad desde la que aplican las tasas reducidas', tipo: 'anios' },
  SOLIDARIO_LAB: { grupo: 'Aportes laborales', nombre: 'Aporte solidario laboral (más los tramos)', tipo: 'pct' },
  CAJA_PAT: { grupo: 'Aportes patronales', nombre: 'Caja de salud (CORDES)', tipo: 'pct' },
  RIESGO_PAT: { grupo: 'Aportes patronales', nombre: 'Riesgo profesional', tipo: 'pct' },
  RIESGO_PAT_65: { grupo: 'Aportes patronales', nombre: 'Riesgo profesional desde la edad reducida', tipo: 'pct' },
  PROVIV_PAT: { grupo: 'Aportes patronales', nombre: 'Pro Vivienda', tipo: 'pct' },
  SOLIDARIO_PAT: { grupo: 'Aportes patronales', nombre: 'Aporte solidario patronal (SIP)', tipo: 'pct' },
  PREV_AGUINALDO: { grupo: 'Previsiones', nombre: 'Previsión aguinaldo (1/12 = 8,3333 %)', tipo: 'pct' },
  PREV_INDEMN: { grupo: 'Previsiones', nombre: 'Previsión indemnización (1/12 = 8,3333 %)', tipo: 'pct' },
  PRESTAMO_RESTO_MINIMO: { grupo: 'Préstamos', nombre: 'Resto de préstamo que se cobra junto con la última cuota (menor a)', tipo: 'num' },
  RCIVA_TASA: { grupo: 'RC-IVA', nombre: 'Tasa RC-IVA', tipo: 'pct' },
  RCIVA_MIN_SMN: { grupo: 'RC-IVA', nombre: 'Mínimo no imponible (en salarios mínimos)', tipo: 'num' },
  RCIVA_COMPUTO_SMN: { grupo: 'RC-IVA', nombre: 'Cómputo 13% sobre (salarios mínimos)', tipo: 'num' },
};

export type Parametro = { id: number; clave: string; valor: number; vigente_desde: string; nota: string | null };

export async function parametros() {
  const filas = [...await sql<Parametro[]>`select id, clave, valor, vigente_desde::text, nota from parametro order by clave, vigente_desde desc`];
  const hoy = new Date().toISOString().slice(0, 10);
  const claves = [...new Set([...Object.keys(META), ...filas.map((f) => f.clave)])];
  return claves.map((clave) => {
    const hist = filas.filter((f) => f.clave === clave);
    const vigente = hist.find((f) => f.vigente_desde <= hoy) ?? null;
    const programado = hist.find((f) => f.vigente_desde > hoy) ?? null;
    return { clave, meta: META[clave] ?? { grupo: 'Otros', nombre: clave, tipo: 'num' as const }, vigente, programado, historial: hist };
  });
}

async function auditar(tabla: string, id: string, accion: string, antes: unknown, despues: unknown) {
  const j = (x: unknown) => (x == null ? null : sql.json(JSON.parse(JSON.stringify(x))));
  await sql`insert into auditoria (tabla, registro_id, accion, antes, despues) values (${tabla}, ${id}, ${accion}, ${j(antes)}, ${j(despues)})`;
}

/** Nuevo valor de un parámetro desde una fecha. Si ya hay uno con esa fecha, lo reemplaza. */
export async function guardarParametro(clave: string, valor: number, desde: string, nota: string | null) {
  if (!Number.isFinite(valor)) throw new Error('Valor inválido');
  const [antes] = await sql`select valor, nota from parametro where clave = ${clave} and vigente_desde = ${desde}`;
  await sql`insert into parametro (clave, valor, vigente_desde, nota) values (${clave}, ${valor}, ${desde}, ${nota})
            on conflict (clave, vigente_desde) do update set valor = excluded.valor, nota = coalesce(excluded.nota, parametro.nota)`;
  await auditar('parametro', `${clave}@${desde}`, antes ? 'UPDATE' : 'INSERT', antes, { valor, nota });
}

export async function eliminarParametro(id: number) {
  const [p] = await sql<Parametro[]>`select id, clave, valor, vigente_desde::text, nota from parametro where id = ${id}`;
  if (!p) return;
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int n from parametro where clave = ${p.clave}`;
  if (n <= 1) throw new Error('No se puede borrar el único valor del parámetro');
  await sql`delete from parametro where id = ${id}`;
  await auditar('parametro', `${p.clave}@${p.vigente_desde}`, 'DELETE', p, null);
}

// ---------------------------------------------------------------------------
export async function tablas() {
  const antiguedad = [...await sql<{ id: number; anios_desde: number; anios_hasta: number | null; porcentaje: number; vigente_desde: string }[]>`
    select id, anios_desde, anios_hasta, porcentaje, vigente_desde::text from tabla_antiguedad order by vigente_desde desc, anios_desde`];
  const tramos = [...await sql<{ id: number; desde: number; porcentaje: number; vigente_desde: string }[]>`
    select id, desde, porcentaje, vigente_desde::text from tramo_solidario order by vigente_desde desc, desde`];
  return { antiguedad, tramos };
}

export async function guardarAntiguedad(id: number | null, d: { anios_desde: number; anios_hasta: number | null; porcentaje: number; vigente_desde: string }) {
  if (id) await sql`update tabla_antiguedad set anios_desde = ${d.anios_desde}, anios_hasta = ${d.anios_hasta}, porcentaje = ${d.porcentaje}, vigente_desde = ${d.vigente_desde} where id = ${id}`;
  else await sql`insert into tabla_antiguedad (anios_desde, anios_hasta, porcentaje, vigente_desde) values (${d.anios_desde}, ${d.anios_hasta}, ${d.porcentaje}, ${d.vigente_desde})`;
  await auditar('tabla_antiguedad', String(id ?? 'nuevo'), id ? 'UPDATE' : 'INSERT', null, d);
}
export async function eliminarAntiguedad(id: number) { await sql`delete from tabla_antiguedad where id = ${id}`; await auditar('tabla_antiguedad', String(id), 'DELETE', null, null); }

export async function guardarTramo(id: number | null, d: { desde: number; porcentaje: number; vigente_desde: string }) {
  if (id) await sql`update tramo_solidario set desde = ${d.desde}, porcentaje = ${d.porcentaje}, vigente_desde = ${d.vigente_desde} where id = ${id}`;
  else await sql`insert into tramo_solidario (desde, porcentaje, vigente_desde) values (${d.desde}, ${d.porcentaje}, ${d.vigente_desde})`;
  await auditar('tramo_solidario', String(id ?? 'nuevo'), id ? 'UPDATE' : 'INSERT', null, d);
}
export async function eliminarTramo(id: number) { await sql`delete from tramo_solidario where id = ${id}`; await auditar('tramo_solidario', String(id), 'DELETE', null, null); }

// ---------------------------------------------------------------------------
export type ConceptoCfg = { id: number; planilla: string; codigo: number; nombre: string; naturaleza: string; modo: string; cotizable: boolean;
  afecta_rciva: boolean; afecta_aguinaldo: boolean; afecta_indemn: boolean; columna_ovt: string | null; tipo_contable: string | null; activo: boolean; usado: boolean };

export async function conceptos(planilla: string) {
  return [...await sql<ConceptoCfg[]>`
    select c.id, c.planilla::text planilla, c.codigo, c.nombre, c.naturaleza::text naturaleza, c.modo::text modo, c.cotizable, c.afecta_rciva,
           c.afecta_aguinaldo, c.afecta_indemn, c.columna_ovt, c.tipo_contable, c.activo,
           exists (select 1 from concepto_fijo f where f.concepto_id = c.id and f.vigente_hasta is null)
           or exists (select 1 from planilla_linea l where l.concepto_id = c.id) usado
    from concepto c where c.planilla = ${planilla}::tipo_planilla order by c.codigo`];
}

export async function guardarConcepto(id: number, d: { nombre: string; afecta_aguinaldo: boolean; afecta_indemn: boolean; cotizable: boolean; afecta_rciva: boolean; tipo_contable: string | null; activo: boolean }) {
  const [antes] = await sql`select nombre, afecta_aguinaldo, afecta_indemn, cotizable, afecta_rciva, tipo_contable, activo from concepto where id = ${id}`;
  await sql`update concepto set nombre = ${d.nombre}, afecta_aguinaldo = ${d.afecta_aguinaldo}, afecta_indemn = ${d.afecta_indemn}, cotizable = ${d.cotizable},
            afecta_rciva = ${d.afecta_rciva}, tipo_contable = ${d.tipo_contable}, activo = ${d.activo} where id = ${id}`;
  await auditar('concepto', String(id), 'UPDATE', antes, d);
}

// ---------------------------------------------------------------------------
export async function centros() {
  return [...await sql<{ id: number; codigo: string; descripcion: string; albor_cc: string; albor_unidad_negocio: string; activo: boolean; trabajadores: number }[]>`
    select c.id, c.codigo, c.descripcion, c.albor_cc, c.albor_unidad_negocio, c.activo,
           (select count(distinct a.vinculo_id)::int from asignacion_cc a join vinculo v on v.id = a.vinculo_id
             where a.centro_costo_id = c.id and a.vigente_hasta is null and v.fecha_retiro is null) trabajadores
    from centro_costo c order by c.codigo`];
}
export async function guardarCentro(id: number | null, d: { codigo: string; descripcion: string; albor_cc: string; albor_unidad_negocio: string; activo: boolean }) {
  if (id) await sql`update centro_costo set codigo = ${d.codigo}, descripcion = ${d.descripcion}, albor_cc = ${d.albor_cc}, albor_unidad_negocio = ${d.albor_unidad_negocio}, activo = ${d.activo} where id = ${id}`;
  else await sql`insert into centro_costo (codigo, descripcion, albor_cc, albor_unidad_negocio, activo) values (${d.codigo}, ${d.descripcion}, ${d.albor_cc}, ${d.albor_unidad_negocio}, true)`;
  await auditar('centro_costo', String(id ?? d.codigo), id ? 'UPDATE' : 'INSERT', null, d);
}

export async function cuentas() {
  return [...await sql<{ clave: string; grupo: string; cuenta: string; detalle: string }[]>`select clave, grupo, cuenta, detalle from cuenta_albor order by orden, clave`];
}
export async function guardarCuenta(clave: string, cuenta: string, detalle: string) {
  if (!/^\d{6,14}$/.test(cuenta)) throw new Error('La cuenta debe tener solo números (6 a 14 dígitos)');
  await sql`update cuenta_albor set cuenta = ${cuenta}, detalle = ${detalle} where clave = ${clave}`;
  await auditar('cuenta_albor', clave, 'UPDATE', null, { cuenta, detalle });
}

// ---------------------------------------------------------------------------
export async function empresas() {
  return [...await sql<{ id: number; codigo: string; razon_social: string; propietario: string | null; estancia: string | null; tipo: string; nit: string | null;
    nro_empleador_mintrab: string | null; nro_empleador_caja: string | null; banco_pago: string; calcula_rciva: boolean; activo: boolean; trabajadores: number }[]>`
    select e.id, e.codigo, e.razon_social, e.propietario, e.estancia, e.tipo::text, e.nit, e.nro_empleador_mintrab, e.nro_empleador_caja,
           e.banco_pago::text, e.calcula_rciva, e.activo,
           (select count(*)::int from vinculo v where (v.empresa_id = e.id or v.empresa_b2_id = e.id) and v.fecha_retiro is null) trabajadores
    from empresa e order by e.activo desc, e.codigo`];
}
export async function guardarEmpresa(id: number | null, d: Record<string, string | boolean | null>) {
  if (id) {
    await sql`update empresa set razon_social = ${d.razon_social}, propietario = ${d.propietario}, estancia = ${d.estancia}, tipo = ${d.tipo}::tipo_empresa,
              nit = ${d.nit}, nro_empleador_mintrab = ${d.nro_empleador_mintrab}, nro_empleador_caja = ${d.nro_empleador_caja},
              banco_pago = ${d.banco_pago}::forma_pago, calcula_rciva = ${d.calcula_rciva}, activo = ${d.activo} where id = ${id}`;
  } else {
    await sql`insert into empresa (codigo, razon_social, propietario, estancia, tipo, nit, nro_empleador_mintrab, nro_empleador_caja, banco_pago, calcula_rciva)
              values (${String(d.codigo).toUpperCase()}, ${d.razon_social}, ${d.propietario}, ${d.estancia}, ${d.tipo}::tipo_empresa, ${d.nit},
                      ${d.nro_empleador_mintrab}, ${d.nro_empleador_caja}, ${d.banco_pago}::forma_pago, ${d.calcula_rciva})`;
  }
  await auditar('empresa', String(id ?? d.codigo), id ? 'UPDATE' : 'INSERT', null, d);
}
