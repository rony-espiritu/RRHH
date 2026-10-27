'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  cambiarAporte, cargarSaldosIniciales, crearPrestamo, editarPrestamo, eliminarMovAhorro, eliminarPago, movimientoAhorro, pagoExterno,
} from '@/lib/datos/cooperativa';
import { leerExcel } from '@/lib/datos/importacion';

const s = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? '').trim(); return v === '' ? null : v; };
const n = (fd: FormData, k: string) => { const v = s(fd, k); return v == null ? null : Number(v.replace(/\s/g, '').replace(',', '.')); };

async function correr(destino: string, f: () => Promise<unknown>, ok: string) {
  let err = '';
  try { await f(); } catch (e) { err = (e as Error).message; }
  revalidatePath('/cooperativa');
  const sep = destino.includes('?') ? '&' : '?';
  redirect(`${destino}${sep}${err ? 'err=' + encodeURIComponent(err) : 'msg=' + encodeURIComponent(ok)}`);
}

export async function accionNuevoPrestamo(fd: FormData) {
  let id = 0, err = '';
  try {
    id = await crearPrestamo({ codigo: String(fd.get('codigo')), tipo: String(fd.get('tipo')), descripcion: s(fd, 'descripcion'), fecha: String(fd.get('fecha')),
      moneda: String(fd.get('moneda')), capital: n(fd, 'capital') ?? 0, cuota: n(fd, 'cuota') ?? 0, tasa_mensual: n(fd, 'tasa') ?? 0,
      tipo_interes: String(fd.get('tipo_interes') ?? 'S'), nota: s(fd, 'nota') });
  } catch (e) { err = (e as Error).message; }
  revalidatePath('/cooperativa');
  redirect(err ? `/cooperativa?tab=nuevo&err=${encodeURIComponent(err)}` : `/cooperativa/prestamo/${id}?msg=${encodeURIComponent('Préstamo registrado. Se descontará desde el próximo periodo que se genere.')}`);
}

export async function accionEditarPrestamo(fd: FormData) {
  const id = Number(fd.get('id'));
  await correr(`/cooperativa/prestamo/${id}`, () => editarPrestamo(id, { cuota: n(fd, 'cuota') ?? 0, tasa_mensual: n(fd, 'tasa') ?? 0,
    tipo_interes: String(fd.get('tipo_interes')), estado: String(fd.get('estado')), descripcion: s(fd, 'descripcion'), nota: s(fd, 'nota') }), 'Préstamo actualizado');
}

export async function accionPagoExterno(fd: FormData) {
  const id = Number(fd.get('id'));
  if (fd.get('eliminar')) return correr(`/cooperativa/prestamo/${id}`, () => eliminarPago(Number(fd.get('eliminar'))), 'Pago eliminado');
  await correr(`/cooperativa/prestamo/${id}`, () => pagoExterno(id, String(fd.get('fecha')), n(fd, 'capital') ?? 0, n(fd, 'interes') ?? 0, s(fd, 'nota')), 'Pago registrado');
}

export async function accionMovAhorro(fd: FormData) {
  const destino = `/cooperativa?tab=ahorros&t=${encodeURIComponent(String(fd.get('codigo') ?? ''))}`;
  if (fd.get('eliminar')) return correr(destino, () => eliminarMovAhorro(Number(fd.get('eliminar'))), 'Movimiento eliminado');
  await correr(destino, () => movimientoAhorro(String(fd.get('codigo')), String(fd.get('fecha')), String(fd.get('tipo')), n(fd, 'monto') ?? 0, s(fd, 'nota')), 'Movimiento registrado');
}

export async function accionAporte(fd: FormData) {
  await correr('/cooperativa?tab=ahorros', () => cambiarAporte(Number(fd.get('vinculo')), n(fd, 'usd'), String(fd.get('desde'))), `Aporte de ${fd.get('codigo')} actualizado`);
}

export async function accionSaldosAhorro(fd: FormData) {
  const f = fd.get('archivo') as File | null;
  let msg = '', err = '';
  try {
    if (!f || !f.size) throw new Error('Seleccione el Excel de Albor');
    const cubo = (await leerExcel(await f.arrayBuffer())).find((h) => h.cubo)?.cubo;
    if (!cubo) throw new Error('No se reconoció el archivo: debe ser el cubo de Albor con "Codigo Personal" y "Saldo"');
    const r = await cargarSaldosIniciales(cubo, String(fd.get('fecha')));
    msg = `Saldos iniciales cargados: ${r.cargados}` + (r.faltan.length ? ` · sin trabajador en el sistema: ${r.faltan.join(', ')}` : '');
  } catch (e) { err = (e as Error).message; }
  revalidatePath('/cooperativa');
  redirect(`/cooperativa?tab=ahorros&${err ? 'err=' + encodeURIComponent(err) : 'msg=' + encodeURIComponent(msg)}`);
}
