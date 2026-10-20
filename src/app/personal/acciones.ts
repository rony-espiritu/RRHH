'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  agregarDependiente, cambiarCentroCosto, cambiarEmpresa, cambiarFijo, cambiarPago, cambiarTasa, crearTrabajador, darDeBaja,
  eliminarDependiente, eliminarVacacion, guardarDatosPersonales, guardarLaboral, guardarSeguridadSocial, registrarVacacion,
} from '@/lib/datos/personal';

const s = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? '').trim(); return v === '' ? null : v; };
const n = (fd: FormData, k: string) => { const v = s(fd, k); return v == null ? null : Number(v.replace(',', '.')); };
const b = (fd: FormData, k: string) => fd.get(k) === 'on' || fd.get(k) === 'true';

async function hecho(codigo: string, tab: string, msg: string) {
  revalidatePath(`/personal/${codigo}`);
  redirect(`/personal/${codigo}?tab=${tab}&msg=${encodeURIComponent(msg)}`);
}
async function conError(codigo: string, tab: string, f: () => Promise<unknown>, ok: string) {
  try { await f(); } catch (e) { redirect(`/personal/${codigo}?tab=${tab}&err=${encodeURIComponent((e as Error).message)}`); }
  await hecho(codigo, tab, ok);
}

export async function accionDatosPersonales(fd: FormData) {
  const codigo = String(fd.get('codigo'));
  const d: Record<string, string | null | boolean> = {};
  for (const k of ['ci', 'ci_expedido', 'ci_complemento', 'tipo_documento', 'ap_paterno', 'ap_materno', 'nombres', 'fecha_nacimiento', 'sexo', 'estado_civil',
    'nacionalidad', 'pais_nacionalidad', 'direccion', 'telefono', 'email', 'grupo_sanguineo', 'contacto_emergencia', 'observaciones']) d[k] = s(fd, k);
  d.discapacidad = b(fd, 'discapacidad'); d.tutor_discapacidad = b(fd, 'tutor_discapacidad');
  await conError(codigo, 'personal', () => guardarDatosPersonales(Number(fd.get('id')), d), 'Datos personales guardados');
}

export async function accionSeguridad(fd: FormData) {
  const codigo = String(fd.get('codigo'));
  await conError(codigo, 'gestora', () => guardarSeguridadSocial(Number(fd.get('id')),
    { nua_cua: s(fd, 'nua_cua'), nro_asegurado: s(fd, 'nro_asegurado'), aporta_gestora: b(fd, 'aporta_gestora'), jubilado: b(fd, 'jubilado') }), 'Datos de Gestora y Caja guardados');
}

export async function accionTasa(fd: FormData) {
  const codigo = String(fd.get('codigo'));
  const pct = n(fd, 'valor');
  await conError(codigo, 'gestora', () => cambiarTasa(Number(fd.get('id')), String(fd.get('clave')), pct == null ? null : pct / 100, String(fd.get('desde')), s(fd, 'motivo')),
    pct == null ? 'Tasa propia quitada' : 'Tasa propia registrada');
}

export async function accionLaboral(fd: FormData) {
  const codigo = String(fd.get('codigo'));
  await conError(codigo, 'laboral', () => guardarLaboral(Number(fd.get('vinculo')), {
    cargo_id: n(fd, 'cargo_id'), ocupacion: s(fd, 'ocupacion'), area_id: n(fd, 'area_id'), modalidad_contrato: n(fd, 'modalidad_contrato'),
    tipo_contrato: n(fd, 'tipo_contrato'), horas_dia: n(fd, 'horas_dia'), en_b1: b(fd, 'en_b1'), en_b2: b(fd, 'en_b2'),
    empresa_b2_id: n(fd, 'empresa_b2_id'), observacion: s(fd, 'observacion'),
  }), 'Datos laborales guardados');
}

export async function accionCentroCosto(fd: FormData) {
  const codigo = String(fd.get('codigo'));
  await conError(codigo, 'laboral', () => cambiarCentroCosto(Number(fd.get('vinculo')), Number(fd.get('centro_costo_id')), String(fd.get('desde'))), 'Centro de costo actualizado');
}

export async function accionCambiarEmpresa(fd: FormData) {
  const codigo = String(fd.get('codigo'));
  await conError(codigo, 'laboral', () => cambiarEmpresa(Number(fd.get('vinculo')), Number(fd.get('empresa_id')), String(fd.get('fecha')), n(fd, 'motivo_retiro'), s(fd, 'tipo_finiquito')),
    'Cambio de empresa registrado: se cerró el vínculo anterior y se abrió uno nuevo');
}

export async function accionBaja(fd: FormData) {
  const codigo = String(fd.get('codigo'));
  await conError(codigo, 'laboral', () => darDeBaja(Number(fd.get('vinculo')), String(fd.get('fecha')), n(fd, 'motivo_retiro'), s(fd, 'tipo_finiquito')), 'Baja registrada');
}

export async function accionFijo(fd: FormData) {
  const codigo = String(fd.get('codigo')), tab = String(fd.get('tab'));
  const quitar = fd.get('quitar') === '1';
  await conError(codigo, tab, () => cambiarFijo(Number(fd.get('vinculo')), Number(fd.get('concepto_id')), String(fd.get('desde')),
    quitar ? null : n(fd, 'cantidad'), quitar ? null : n(fd, 'monto'), s(fd, 'motivo')), quitar ? 'Concepto quitado' : 'Concepto actualizado');
}

export async function accionPago(fd: FormData) {
  const codigo = String(fd.get('codigo'));
  await conError(codigo, 'banco', () => cambiarPago(Number(fd.get('id')), String(fd.get('forma')), s(fd, 'nro_cuenta'), String(fd.get('desde'))), 'Forma de pago actualizada');
}

export async function accionDependiente(fd: FormData) {
  const codigo = String(fd.get('codigo'));
  if (fd.get('eliminar')) return conError(codigo, 'personal', () => eliminarDependiente(Number(fd.get('eliminar'))), 'Dependiente eliminado');
  await conError(codigo, 'personal', () => agregarDependiente(Number(fd.get('id')), { nombre: String(fd.get('nombre')), fecha_nacimiento: s(fd, 'fecha_nacimiento'),
    parentesco: s(fd, 'parentesco'), ci: s(fd, 'ci'), sexo: s(fd, 'sexo') }), 'Dependiente agregado');
}

export async function accionVacacion(fd: FormData) {
  const codigo = String(fd.get('codigo'));
  if (fd.get('eliminar')) return conError(codigo, 'vacaciones', () => eliminarVacacion(Number(fd.get('eliminar'))), 'Movimiento eliminado');
  await conError(codigo, 'vacaciones', () => registrarVacacion(Number(fd.get('vinculo')), s(fd, 'desde'), s(fd, 'hasta'), n(fd, 'dias') ?? 0, String(fd.get('tipo')), s(fd, 'referencia')),
    'Vacación registrada');
}

export async function accionNuevo(fd: FormData) {
  let codigo = '';
  try {
    codigo = await crearTrabajador({
      codigo: String(fd.get('codigo')), ci: String(fd.get('ci')), ci_expedido: s(fd, 'ci_expedido'), tipo_documento: s(fd, 'tipo_documento') ?? 'CI',
      ap_paterno: s(fd, 'ap_paterno'), ap_materno: s(fd, 'ap_materno'), nombres: String(fd.get('nombres')), fecha_nacimiento: s(fd, 'fecha_nacimiento'),
      sexo: s(fd, 'sexo'), empresa_id: Number(fd.get('empresa_id')), fecha_ingreso: String(fd.get('fecha_ingreso')), cargo_id: n(fd, 'cargo_id'),
      ocupacion: s(fd, 'ocupacion'), en_b1: b(fd, 'en_b1'), sueldo_b1: n(fd, 'sueldo_b1'), abono_b2: n(fd, 'abono_b2'),
      centro_costo_id: n(fd, 'centro_costo_id'), forma_pago: String(fd.get('forma_pago')), nro_cuenta: s(fd, 'nro_cuenta'),
    });
  } catch (e) {
    redirect(`/personal/nuevo?err=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath('/personal');
  redirect(`/personal/${codigo}?msg=${encodeURIComponent('Trabajador registrado')}`);
}
