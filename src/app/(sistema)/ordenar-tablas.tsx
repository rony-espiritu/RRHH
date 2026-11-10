'use client';
import { useEffect } from 'react';

/**
 * Ordenar cualquier tabla del sistema con un clic en el título de la columna (otro clic invierte el orden).
 * Respeta los subtotales y totales: ordena las filas dentro de cada grupo y deja fijas las filas de subtotal/total.
 * Se excluyen las impresiones y las tablas cuyos títulos ya son enlaces (orden hecho en el servidor).
 */
const NUM = /^-?[\d.]+(,\d+)?$/, FECHA = /^(\d{2})\/(\d{2})\/(\d{2,4})$/, ISO = /^\d{4}-\d{2}-\d{2}/;

function valor(td: Element | undefined) {
  const t = (td?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const limpio = t.replace(/^[+−-]?\s*Bs\.?\s*/i, '').replace(/[▲▼]/g, '').trim();
  if (limpio === '' || limpio === '—') return { vacio: true, n: 0, s: '' };
  if (NUM.test(limpio.replace(/\s/g, ''))) return { vacio: false, n: Number(limpio.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')), s: '' };
  const f = limpio.match(FECHA);
  if (f) return { vacio: false, n: Number(`${f[3].length === 2 ? '20' + f[3] : f[3]}${f[2]}${f[1]}`), s: '' };
  if (ISO.test(limpio)) return { vacio: false, n: Number(limpio.slice(0, 10).replace(/-/g, '')), s: '' };
  return { vacio: false, n: NaN, s: limpio };
}

/** Índice real de la columna (sumando colspan de los títulos anteriores). */
function indice(th: HTMLTableCellElement) {
  let i = 0;
  for (let c = th.previousElementSibling; c; c = c.previousElementSibling) i += (c as HTMLTableCellElement).colSpan || 1;
  return i;
}

/** Celda de la fila que ocupa la columna `col` (considerando colspan). */
function celda(tr: HTMLTableRowElement, col: number) {
  let i = 0;
  for (const c of Array.from(tr.cells)) { if (i === col) return c; i += c.colSpan || 1; if (i > col) return undefined; }
  return undefined;
}

const esSeparador = (tr: HTMLTableRowElement) =>
  /\b(total|sub-tot|subtotal|tot|fila-editor|grupo)\b/.test(tr.className) || Array.from(tr.cells).some((c) => c.colSpan > 1 && c.colSpan >= 3);

export default function OrdenarTablas() {
  useEffect(() => {
    const alClic = (e: MouseEvent) => {
      const th = (e.target as HTMLElement).closest?.('th') as HTMLTableCellElement | null;
      if (!th || (e.target as HTMLElement).closest('a, button, input, select, label')) return;
      const tabla = th.closest('table');
      if (!tabla || tabla.closest('.impresion, .no-print-orden') || tabla.classList.contains('no-ordenar') || !th.closest('thead')) return;
      if (th.closest('thead')!.querySelector('a.ordenar')) return;   // ya se ordena en el servidor
      const col = indice(th);
      const desc = th.dataset.orden === 'asc';
      tabla.querySelectorAll('thead th[data-orden]').forEach((x) => delete (x as HTMLElement).dataset.orden);
      th.dataset.orden = desc ? 'desc' : 'asc';
      for (const tbody of Array.from(tabla.tBodies)) {
        const filas = Array.from(tbody.rows);
        // Segmentos de filas de datos entre separadores (subtotales, totales)
        let seg: HTMLTableRowElement[] = [];
        const segmentos: { filas: HTMLTableRowElement[]; antesDe: HTMLTableRowElement | null }[] = [];
        for (const tr of filas) {
          if (esSeparador(tr)) { if (seg.length) segmentos.push({ filas: seg, antesDe: tr }); seg = []; } else seg.push(tr);
        }
        if (seg.length) segmentos.push({ filas: seg, antesDe: null });
        for (const s of segmentos) {
          const ord = s.filas.map((tr, i) => ({ tr, i, v: valor(celda(tr, col)) })).sort((a, b) => {
            if (a.v.vacio !== b.v.vacio) return a.v.vacio ? 1 : -1;          // vacíos siempre al final
            let r = 0;
            if (!Number.isNaN(a.v.n) && !Number.isNaN(b.v.n)) r = a.v.n - b.v.n;
            else r = (Number.isNaN(a.v.n) ? a.v.s : String(a.v.n)).localeCompare(Number.isNaN(b.v.n) ? b.v.s : String(b.v.n), 'es', { numeric: true, sensitivity: 'base' });
            return (desc ? -r : r) || a.i - b.i;
          });
          for (const o of ord) tbody.insertBefore(o.tr, s.antesDe);
        }
      }
    };
    document.addEventListener('click', alClic);
    return () => document.removeEventListener('click', alClic);
  }, []);
  return null;
}
