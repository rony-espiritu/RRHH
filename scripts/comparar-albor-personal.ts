// Compara por trabajador las líneas de cuenta corriente (210106000) del B2 inicial: sistema vs Albor.
import ExcelJS from 'exceljs';
import fs from 'fs';
import { listarPeriodos } from '../src/lib/datos/planilla';
import { generarAsientos } from '../src/lib/datos/asientos';
import { sql } from '../src/lib/db';
async function porPersona(buf: ArrayBuffer, cuenta: string) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); const m = new Map<string, number>();
  wb.worksheets[0].eachRow((r, i) => { if (i === 1) return; const v = r.values as unknown[]; if (String(v[9]).trim() !== cuenta) return;
    const k = String(v[12] ?? '').trim(); m.set(k, Math.round(((m.get(k) ?? 0) + Number(v[5] ?? 0) - Number(v[4] ?? 0)) * 100) / 100); });
  return m;
}
(async () => {
  const p = (await listarPeriodos()).find((x) => x.anio === 2026 && x.mes === 9)!;
  const s = await porPersona((await generarAsientos(p.id, 'B2')).cuerpo as unknown as ArrayBuffer, '210106000');
  const a = await porPersona(fs.readFileSync(process.argv[2]) as unknown as ArrayBuffer, '210106000');
  for (const k of [...new Set([...s.keys(), ...a.keys()])].sort()) { const d = Math.round(((s.get(k) ?? 0) - (a.get(k) ?? 0)) * 100) / 100; if (d) console.log(k, s.get(k) ?? 0, a.get(k) ?? 0, d); }
  await sql.end();
})();
