import ExcelJS from 'exceljs';
import fs from 'fs';
import { listarPeriodos } from '../src/lib/datos/planilla';
import { generarAsientos, type GrupoAsiento } from '../src/lib/datos/asientos';
import { sql } from '../src/lib/db';
async function agg(buf: ArrayBuffer) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); const m = new Map<string, number>();
  wb.worksheets[0].eachRow((r, i) => { if (i === 1) return; const v = r.values as unknown[]; const c = String(v[9] ?? '').trim(); if (!c || c.startsWith('2')) return;
    const k = `${String(v[8]).trim().padEnd(30)} ${c} cc${String(v[11]).trim()} un${String(v[13]).trim()}`; m.set(k, Math.round(((m.get(k) ?? 0) + Number(v[4] ?? 0) - Number(v[5] ?? 0)) * 100) / 100); });
  return m;
}
(async () => {
  const p = (await listarPeriodos()).find((x) => x.anio === 2026 && x.mes === 9)!;
  const s = await agg((await generarAsientos(p.id, process.argv[3] as GrupoAsiento)).cuerpo as unknown as ArrayBuffer);
  const a = await agg(fs.readFileSync(process.argv[2]) as unknown as ArrayBuffer);
  for (const k of [...new Set([...s.keys(), ...a.keys()])].sort()) { const d = Math.round(((s.get(k) ?? 0) - (a.get(k) ?? 0)) * 100) / 100; if (Math.abs(d) > 0.5) console.log(k, '| sis', s.get(k) ?? 0, '| albor', a.get(k) ?? 0); }
  await sql.end();
})();
