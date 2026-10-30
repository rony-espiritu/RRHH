'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  META, eliminarAntiguedad, eliminarParametro, eliminarTramo, guardarAntiguedad, guardarCentro, guardarConcepto, guardarLugar, guardarCuenta, guardarEmpresa,
  guardarParametro, guardarTramo,
} from '@/lib/datos/configuracion';

const s = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? '').trim(); return v === '' ? null : v; };
const n = (fd: FormData, k: string) => { const v = s(fd, k); return v == null ? null : Number(v.replace(/\s/g, '').replace(',', '.')); };
const b = (fd: FormData, k: string) => fd.get(k) === 'on';

async function correr(tab: string, f: () => Promise<unknown>, ok: string) {
  try { await f(); } catch (e) { redirect(`/configuracion?tab=${tab}&err=${encodeURIComponent((e as Error).message)}`); }
  revalidatePath('/configuracion');
  redirect(`/configuracion?tab=${tab}&msg=${encodeURIComponent(ok)}`);
}

export async function accionParametro(fd: FormData) {
  if (fd.get('eliminar')) return correr('parametros', () => eliminarParametro(Number(fd.get('eliminar'))), 'Valor eliminado');
  const clave = String(fd.get('clave'));
  const v = n(fd, 'valor');
  const valor = v == null ? NaN : META[clave]?.tipo === 'pct' ? v / 100 : v;
  await correr('parametros', () => guardarParametro(clave, Number(valor.toFixed(6)), String(fd.get('desde')), s(fd, 'nota')), `${clave} actualizado`);
}

export async function accionAntiguedad(fd: FormData) {
  if (fd.get('eliminar')) return correr('tablas', () => eliminarAntiguedad(Number(fd.get('eliminar'))), 'Fila eliminada');
  await correr('tablas', () => guardarAntiguedad(n(fd, 'id'), { anios_desde: n(fd, 'anios_desde') ?? 0, anios_hasta: n(fd, 'anios_hasta'), porcentaje: n(fd, 'porcentaje') ?? 0,
    vigente_desde: String(fd.get('vigente_desde')) }), 'Tabla de antigüedad guardada');
}

export async function accionTramo(fd: FormData) {
  if (fd.get('eliminar')) return correr('tablas', () => eliminarTramo(Number(fd.get('eliminar'))), 'Tramo eliminado');
  await correr('tablas', () => guardarTramo(n(fd, 'id'), { desde: n(fd, 'desde') ?? 0, porcentaje: n(fd, 'porcentaje') ?? 0, vigente_desde: String(fd.get('vigente_desde')) }),
    'Tramo guardado');
}

export async function accionConcepto(fd: FormData) {
  const tab = String(fd.get('tab'));
  await correr(tab, () => guardarConcepto(Number(fd.get('id')), { nombre: String(fd.get('nombre')), afecta_aguinaldo: b(fd, 'afecta_aguinaldo'), afecta_indemn: b(fd, 'afecta_indemn'),
    cotizable: b(fd, 'cotizable'), afecta_rciva: b(fd, 'afecta_rciva'), tipo_contable: s(fd, 'tipo_contable'), activo: b(fd, 'activo') }), `Concepto ${fd.get('codigo')} guardado`);
}

export async function accionCentro(fd: FormData) {
  await correr('centros', () => guardarCentro(n(fd, 'id'), { codigo: String(fd.get('codigo')).toUpperCase(), descripcion: String(fd.get('descripcion')),
    albor_cc: String(fd.get('albor_cc')), albor_unidad_negocio: String(fd.get('albor_unidad_negocio')), activo: fd.get('id') ? b(fd, 'activo') : true,
    lugar_id: n(fd, 'lugar_id'), rubro: s(fd, 'rubro') }), 'Centro de costo guardado');
}

export async function accionLugar(fd: FormData) {
  await correr('centros', () => guardarLugar(n(fd, 'id'), { codigo: String(fd.get('codigo')).toUpperCase(), nombre: String(fd.get('nombre')), orden: n(fd, 'orden') ?? 1 }),
    'Lugar guardado');
}

export async function accionCuenta(fd: FormData) {
  await correr('cuentas', () => guardarCuenta(String(fd.get('clave')), String(fd.get('cuenta')).trim(), String(fd.get('detalle'))), 'Cuenta guardada');
}

export async function accionEmpresa(fd: FormData) {
  const d: Record<string, string | boolean | null> = {};
  for (const k of ['codigo', 'razon_social', 'propietario', 'estancia', 'tipo', 'nit', 'nro_empleador_mintrab', 'nro_empleador_caja', 'banco_pago']) d[k] = s(fd, k);
  d.calcula_rciva = b(fd, 'calcula_rciva'); d.activo = fd.get('id') ? b(fd, 'activo') : true;
  await correr('empresas', () => guardarEmpresa(n(fd, 'id'), d), 'Empresa guardada');
}
