'use server';
import { exigir } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { aplicarImportacion, aplicarSaldos, leerExcel, obtenerImportacion, recalcularB2, registrarImportacion } from '@/lib/datos/importacion';
import { generarCooperativaPeriodo } from '@/lib/datos/cooperativa';
import { obtenerPeriodo, abrirPeriodo, calcularPlanilla, cambiarEstado, guardarNovedad, type Planilla } from '@/lib/datos/planilla';

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').replace(',', '.').trim();
  return s === '' ? null : Number(s);
};

export async function accionAbrir(fd: FormData) {
  await exigir('editar');
  const id = await abrirPeriodo(Number(fd.get('anio')), Number(fd.get('mes')), num(fd.get('ufv_inicio')) ?? undefined, num(fd.get('ufv_fin')) ?? undefined);
  // Al abrir el periodo se cargan solos las cuotas e intereses de préstamos y los aportes de ahorro
  let msg = 'Periodo abierto';
  try {
    const r = await generarCooperativaPeriodo(id);
    msg += `|Préstamos: ${r.cuotas} cuotas · Ahorros: ${r.aportes} aportes` + (r.avisos.length ? '|' + r.avisos.join('|') : '');
  } catch (e) { msg += '|No se generaron préstamos y ahorros: ' + (e as Error).message; }
  redirect(`/periodos/${id}?msg=${encodeURIComponent(msg)}`);
}

export async function accionCalcular(fd: FormData) {
  await exigir('editar');
  const id = Number(fd.get('periodo')), pl = String(fd.get('planilla')) as Planilla;
  let msg = '';
  try {
    const r: { calculados: number; avisos: string[]; saldos?: boolean; b1?: string } =
      pl === 'B2' ? await recalcularB2(id, (x) => calcularPlanilla(id, x)) : await calcularPlanilla(id, pl);
    msg = `${pl}: ${r.calculados} calculados` + (r.saldos ? ' · anticipos ajustados a los saldos de Albor importados' + (r.b1 ? ` · ${r.b1}` : '') : '')
      + (r.avisos.length ? ` · ${r.avisos.length} avisos` : '');
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
  REABRIR: ['CALCULADO', 'Reabierto para corregir: modifique lo necesario, recalcule y vuelva a enviar a Gerencia'],
};

export async function accionEstado(fd: FormData) {
  const yo = await exigir(({ ENVIAR_REVISION: 'enviar', REABRIR: 'reabrir' } as Record<string, 'enviar' | 'reabrir'>)[String(fd.get('accion'))] ?? 'aprobar');
  const id = Number(fd.get('periodo')), pl = String(fd.get('planilla')) as Planilla, accion = String(fd.get('accion'));
  const [estado, texto] = SIGUIENTE[accion];
  if (accion === 'REABRIR' && !String(fd.get('comentario') ?? '').trim()) {
    redirect(`/periodos/${id}?msg=${encodeURIComponent('ERROR|Para reabrir indique el motivo')}`);
  }
  await cambiarEstado(id, pl, estado, accion, String(fd.get('comentario') ?? '') || undefined, yo.id);
  revalidatePath(`/periodos/${id}`);
  redirect(`/periodos/${id}?msg=${encodeURIComponent(`${pl}: ${texto}`)}`);
}

/** Guarda la grilla de novedades: campos "n|<vinculo>|<planilla>|<codigo>|<cantidad|monto>". */
export async function accionNovedades(fd: FormData) {
  await exigir('editar');
  const id = Number(fd.get('periodo')), pl = String(fd.get('planilla'));
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith('n|')) continue;
    const [, vinculo, planilla, codigo, campo] = k.split('|');
    const valor = num(v);
    if (String(fd.get('o' + k.slice(1))) === String(v)) continue; // sin cambios
    await guardarNovedad(id, Number(vinculo), planilla as Planilla, Number(codigo), campo === 'cantidad' ? { cantidad: valor } : { monto: valor });
  }
  revalidatePath(`/periodos/${id}`);
  const volver = String(fd.get('volver') ?? '') || `pl=${pl}`;
  redirect(`/periodos/${id}/novedades?${volver}&msg=${encodeURIComponent('Novedades guardadas')}`);
}

// ---------------------------------------------------------------------------
// Importación del Excel de Albor
// ---------------------------------------------------------------------------

export async function accionSubirAlbor(fd: FormData) {
  await exigir('editar');
  const id = Number(fd.get('periodo'));
  const f = fd.get('archivo') as File | null;
  if (!f || !f.size) redirect(`/periodos/${id}/importar?msg=${encodeURIComponent('Seleccione un archivo Excel')}`);
  const hojas = await leerExcel(await f!.arrayBuffer());
  const imp = await registrarImportacion(id, f!.name, hojas);
  redirect(`/periodos/${id}/importar?imp=${imp}`);
}

export async function accionAplicarAlbor(fd: FormData) {
  await exigir('editar');
  const id = Number(fd.get('periodo')), imp = Number(fd.get('imp')), hoja = String(fd.get('hoja'));
  const mapeo: Record<number, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith('col_')) mapeo[Number(k.slice(4))] = String(v);
  const r = await aplicarImportacion(imp, hoja, mapeo);
  revalidatePath(`/periodos/${id}`);
  const msg = `Importadas ${r.novedades} novedades de Albor` + (r.corregidos.length ? `|Reconocidos por nombre (corregir código en Albor): ${r.corregidos.join(', ')}` : '')
    + (r.noEncontrados.length ? `|Códigos no encontrados en el periodo: ${r.noEncontrados.join(', ')}` : '');
  redirect(`/periodos/${id}?msg=${encodeURIComponent(msg)}`);
}

/** Saldos de cuenta corriente de Albor → anticipos B2 + descuento en B1, y recalcula ambas planillas. */
export async function accionAplicarSaldos(fd: FormData) {
  await exigir('editar');
  const id = Number(fd.get('periodo')), impId = Number(fd.get('imp')), hoja = String(fd.get('hoja'));
  let msg: string;
  try {
    const imp = await obtenerImportacion(impId);
    const saldos = imp?.log.hojas.find((h) => h.nombre === hoja)?.cubo;
    if (!saldos) throw new Error('El archivo no tiene saldos de cuenta corriente');
    const r = await aplicarSaldos(id, impId, saldos);
    const avisos: string[] = [];
    for (const pl of ['B2', 'B1'] as const) {
      try { const c = await calcularPlanilla(id, pl); avisos.push(`${pl} recalculada (${c.calculados})`); }
      catch (e) { avisos.push(`${pl} no se recalculó: ${(e as Error).message}`); }
    }
    msg = `Saldos de Albor aplicados: ${r.anticipos} anticipos B2 y ${r.descuentosB1} descuentos en B1|` + avisos.join('|')
      + (r.sobrantes.length ? `|Con saldo en Albor pero sin B2 en este periodo: ${r.sobrantes.map((x) => `${x.codigo} ${x.saldo}`).join(', ')}` : '');
  } catch (e) { msg = 'ERROR|' + (e as Error).message; }
  revalidatePath(`/periodos/${id}`);
  redirect(`/periodos/${id}?msg=${encodeURIComponent(msg)}`);
}

export async function accionCooperativa(fd: FormData) {
  await exigir('editar');
  const id = Number(fd.get('periodo'));
  let msg: string;
  try {
    const r = await generarCooperativaPeriodo(id);
    msg = `Préstamos y ahorros generados: ${r.cuotas} cuotas de préstamos, ${r.aportes} aportes de ahorro` + (r.terminados ? ` · ${r.terminados} préstamos terminan este mes` : '');
    try {
      const per = await obtenerPeriodo(id);
      if (per?.estado_b2 === 'CALCULADO') {
        await recalcularB2(id, (x) => calcularPlanilla(id, x));
        msg += ' · B2 recalculada';
      } else msg += '|Calcule la B2 para que se descuenten.';
    } catch (e) { msg += '|No se recalculó la B2: ' + (e as Error).message; }
    if (r.avisos.length) msg += '|' + r.avisos.join('|');
  } catch (e) { msg = 'ERROR|' + (e as Error).message; }
  revalidatePath(`/periodos/${id}`);
  redirect(`/periodos/${id}?msg=${encodeURIComponent(msg)}`);
}
