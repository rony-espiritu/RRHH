// Calcula septiembre 2026 en el sistema y lo compara con lo que pagó SIDPLAN (fixture de pruebas).
import { calcularPlanilla, detallePlanilla, listarPeriodos } from '../src/lib/datos/planilla';
import { sql } from '../src/lib/db';
import fx from '../src/lib/motor/__tests__/septiembre-2026.json';
import fs from 'fs';

(async () => {
  const p = (await listarPeriodos()).find((x) => x.anio === 2026 && x.mes === 9)!;
  for (const pl of ['B1', 'B2'] as const) { const r = await calcularPlanilla(p.id, pl); console.log(pl, r.calculados, r.avisos); }
  const res: Record<string, unknown>[] = [];
  const b1 = await detallePlanilla(p.id, 'B1'), b2 = await detallePlanilla(p.id, 'B2');
  const sid = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as Record<string, { b1?: number; b2?: number }>;
  let ok1 = 0, ok2 = 0;
  for (const f of b1) { const e = sid[f.codigo]?.b1; const d = e == null ? null : Math.round((f.liquido - e) * 100) / 100; if (d === 0) ok1++; else res.push({ pl: 'B1', codigo: f.codigo, nombre: f.nombre, sistema: f.liquido, sidplan: e, dif: d }); }
  for (const f of b2) { const e = sid[f.codigo]?.b2; const d = e == null ? null : Math.round((f.liquido - e) * 100) / 100; if (d === 0) ok2++; else res.push({ pl: 'B2', codigo: f.codigo, nombre: f.nombre, sistema: f.liquido, sidplan: e, dif: d }); }
  console.log(`B1: ${ok1}/${b1.length} iguales · B2: ${ok2}/${b2.length} iguales`);
  console.table(res);
  console.log('periodo', p.id, fx.periodo.mes);
  await sql.end();
})();
