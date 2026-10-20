'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { aplicarImportacion, leerExcel, registrarImportacion } from '@/lib/datos/importacion';
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

// ---------------------------------------------------------------------------
// Importación del Excel de Albor
// ---------------------------------------------------------------------------

export async function accionSubirAlbor(fd: FormData) {
  const id = Number(fd.get('periodo'));
  const f = fd.get('archivo') as File | null;
  if (!f || !f.size) redirect(`/periodos/${id}/importar?msg=${encodeURIComponent('Seleccione un archivo Excel')}`);
  const hojas = leerExcel(await f!.arrayBuffer());
  const imp = await registrarImportacion(id, f!.name, hojas);
  redirect(`/periodos/${id}/importar?imp=${imp}`);
}

export async function accionAplicarAlbor(fd: FormData) {
  const id = Number(fd.get('periodo')), imp = Number(fd.get('imp')), hoja = String(fd.get('hoja'));
  const mapeo: Record<number, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith('col_')) mapeo[Number(k.slice(4))] = String(v);
  const r = await aplicarImportacion(imp, hoja, mapeo);
  revalidatePath(`/periodos/${id}`);
  const msg = `Importadas ${r.novedades} novedades de Albor` + (r.noEncontrados.length ? `|Códigos no encontrados en el periodo: ${r.noEncontrados.join(', ')}` : '');
  redirect(`/periodos/${id}?msg=${encodeURIComponent(msg)}`);
}
