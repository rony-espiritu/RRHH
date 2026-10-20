'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { abrirPeriodo, calcularPlanilla, cambiarEstado, guardarNovedad, type Planilla } from '@/lib/datos/planilla';

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').replace(',', '.').trim();
  return s === '' ? null : Number(s);
};

export async function accionAbrir(fd: FormData) {
  const id = await abrirPeriodo(Number(fd.get('anio')), Number(fd.get('mes')), num(fd.get('ufv_inicio')) ?? undefined, num(fd.get('ufv_fin')) ?? undefined);
  redirect(`/periodos/${id}`);
}

export async function accionCalcular(fd: FormData) {
  const id = Number(fd.get('periodo')), pl = String(fd.get('planilla')) as Planilla;
  let msg = '';
  try {
    const r = await calcularPlanilla(id, pl);
    msg = `${pl}: ${r.calculados} calculados` + (r.avisos.length ? ` · ${r.avisos.length} avisos` : '');
    if (r.avisos.length) msg += '|' + r.avisos.join('|');
  } catch (e) { msg = 'ERROR|' + (e as Error).message; }
  revalidatePath(`/periodos/${id}`);
  redirect(`/periodos/${id}?msg=${encodeURIComponent(msg)}`);
}

const SIGUIENTE: Record<string, [string, string]> = {
  ENVIAR_REVISION: ['EN_REVISION', 'Enviado a revisión de Gerencia'],
  APROBAR: ['APROBADO', 'Aprobado'],
  OBSERVAR: ['NOVEDADES', 'Observado: vuelve a novedades'],
  CERRAR: ['CERRADO', 'Cerrado'],
};

export async function accionEstado(fd: FormData) {
  const id = Number(fd.get('periodo')), pl = String(fd.get('planilla')) as Planilla, accion = String(fd.get('accion'));
  const [estado, texto] = SIGUIENTE[accion];
  await cambiarEstado(id, pl, estado, accion, String(fd.get('comentario') ?? '') || undefined);
  revalidatePath(`/periodos/${id}`);
  redirect(`/periodos/${id}?msg=${encodeURIComponent(`${pl}: ${texto}`)}`);
}

/** Guarda la grilla de novedades: campos "n|<vinculo>|<planilla>|<codigo>|<cantidad|monto>". */
export async function accionNovedades(fd: FormData) {
  const id = Number(fd.get('periodo')), pl = String(fd.get('planilla'));
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith('n|')) continue;
    const [, vinculo, planilla, codigo, campo] = k.split('|');
    const valor = num(v);
    if (String(fd.get('o' + k.slice(1))) === String(v)) continue; // sin cambios
    await guardarNovedad(id, Number(vinculo), planilla as Planilla, Number(codigo), campo === 'cantidad' ? { cantidad: valor } : { monto: valor });
  }
  revalidatePath(`/periodos/${id}`);
  redirect(`/periodos/${id}/novedades?pl=${pl}&msg=${encodeURIComponent('Novedades guardadas')}`);
}
