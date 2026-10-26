// Recalcula septiembre y compara los asientos Albor del sistema con los que se subieron (carpeta "Subir a albor").
import ExcelJS from 'exceljs';
import { calcularPlanilla, listarPeriodos } from '../src/lib/datos/planilla';
import { generarAsientos, type GrupoAsiento } from '../src/lib/datos/asientos';
import { sql } from '../src/lib/db';
const DIR = process.argv[2];
const ARCH: Record<GrupoAsiento, string> = { P1: 'P1sep.xlsx', PREV_P1: 'septPrevP1.xlsx', PREV_P2: 'sepPrevP2.xlsx', B2: 'B2sep.xlsx' };
async function filas(buf: Buffer | ArrayBuffer) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as ArrayBuffer);
  const out: { cuenta: string; cc: string; un: string; det: string; debe: number; haber: number }[] = [];
  wb.worksheets[0].eachRow((r, i) => {
    if (i === 1) return; const v = r.values as unknown[];
    const n = (x: unknown) => Number((x as { result?: number })?.result ?? x ?? 0);
    if (!v[9]) return;
    out.push({ cuenta: String(v[9]).trim(), cc: String(v[11] ?? '').trim(), un: String(v[13] ?? '').trim(), det: String(v[8] ?? '').trim(), debe: n(v[4]), haber: n(v[5]) });
  });
  return out;
}
(async () => {
  const p = (await listarPeriodos()).find((x) => x.anio === 2026 && x.mes === 9)!;
  for (const pl of ['B1', 'B2'] as const) await calcularPlanilla(p.id, pl);
  for (const g of Object.keys(ARCH) as GrupoAsiento[]) {
    const sis = await filas((await generarAsientos(p.id, g)).cuerpo);
    const alb = await filas(await import('fs').then((fs) => fs.readFileSync(`${DIR}/${ARCH[g]}`)));
    const agg = (xs: typeof sis) => { const m = new Map<string, number>(); for (const x of xs) { const k = `${x.cuenta}|${x.cc}|${x.un}`; m.set(k, Math.round(((m.get(k) ?? 0) + x.debe - x.haber) * 100) / 100); } return m; };
    const a = agg(sis), b = agg(alb);
    const tot = (xs: typeof sis) => [xs.reduce((s, x) => s + x.debe, 0).toFixed(2), xs.reduce((s, x) => s + x.haber, 0).toFixed(2)];
    console.log(`\n== ${g}: sistema debe/haber ${tot(sis)} · Albor ${tot(alb)}`);
    for (const k of new Set([...a.keys(), ...b.keys()])) {
      const d = Math.round(((a.get(k) ?? 0) - (b.get(k) ?? 0)) * 100) / 100;
      if (Math.abs(d) > 0.009) console.log(`  ${k.padEnd(28)} sistema ${String(a.get(k) ?? 0).padStart(11)}  Albor ${String(b.get(k) ?? 0).padStart(11)}  dif ${d}`);
    }
  }
  await sql.end();
})();
