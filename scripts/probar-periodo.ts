// Prueba integral contra la base local: abre octubre 2026, calcula B1 y B2 y muestra controles.
import { abrirPeriodo, calcularPlanilla, resumenPorEmpresa, detallePlanilla, listarPeriodos } from '../src/lib/datos/planilla';
import { sql } from '../src/lib/db';

(async () => {
  const ps = await listarPeriodos();
  let id = ps.find((p) => p.anio === 2026 && p.mes === 10)?.id;
  if (!id) id = await abrirPeriodo(2026, 10, 3.3514, 3.3663);
  for (const pl of ['B1', 'B2'] as const) {
    const r = await calcularPlanilla(id, pl);
    console.log(pl, r.calculados, 'calculados;', r.avisos.length, 'avisos', r.avisos.slice(0, 3));
  }
  console.table((await resumenPorEmpresa(id)).map((r) => ({ ...r, razon_social: r.razon_social.slice(0, 25) })));
  const b1 = await detallePlanilla(id, 'B1');
  for (const c of ['RD0907', 'MS1111', 'OA0607', 'RR1512']) {
    const x = b1.find((y) => y.codigo === c)!;
    console.log(c, x.nombre, 'TG', x.total_ganado, 'liq', x.liquido, x.lineas.map((l) => `${l.codigo}:${l.monto}`).join(' '));
  }
  const b2 = await detallePlanilla(id, 'B2');
  for (const c of ['TF0212', 'RR1512', 'PA0105']) { const x = b2.find((y) => y.codigo === c)!; console.log('B2', c, x.total_ganado, x.total_descuentos, x.liquido); }
  console.log(await sql`select * from rciva_saldo where periodo_id = ${id}`);
  await sql.end();
})();
