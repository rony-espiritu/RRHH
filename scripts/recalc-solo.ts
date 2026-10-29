import { recalcularB2 } from '../src/lib/datos/importacion';
import { calcularPlanilla } from '../src/lib/datos/planilla';
import { sql } from '../src/lib/db';
(async () => { const id = Number(process.argv[2]); console.log(await recalcularB2(id, (x) => calcularPlanilla(id, x))); await sql.end(); })();
