// Genera todas las salidas de un periodo en una carpeta (para comparar con los archivos reales).
import fs from 'fs';
import { archivoBancoUnion, csvOvt, planillaBnb } from '../src/lib/datos/salidas';
import { generarAsientos } from '../src/lib/datos/asientos';
import { listarPeriodos } from '../src/lib/datos/planilla';
import { sql } from '../src/lib/db';

(async () => {
  const [anio, mes, dir] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
  const p = (await listarPeriodos()).find((x) => x.anio === anio && x.mes === mes)!;
  const emps = await sql<{ codigo: string }[]>`select distinct e.codigo from planilla_trabajador pt join empresa e on e.id = pt.empresa_id where pt.periodo_id = ${p.id} and pt.planilla = 'B1'`;
  const archivos = [await planillaBnb(p.id)];
  for (const e of emps) { archivos.push(await archivoBancoUnion(p.id, e.codigo)); archivos.push(await csvOvt(p.id, e.codigo)); }
  for (const g of ['B2', 'P1', 'PREV_P1', 'PREV_P2'] as const) archivos.push(await generarAsientos(p.id, g));
  for (const a of archivos) fs.writeFileSync(`${dir}/${a.nombre}`, a.cuerpo);
  console.log(archivos.map((a) => a.nombre).join('\n'));
  await sql.end();
})();
