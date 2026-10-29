import { calcularPlanilla } from '../src/lib/datos/planilla';
import { sql } from '../src/lib/db';
(async () => { console.log(await calcularPlanilla(Number(process.argv[2]), process.argv[3] as 'B1' | 'B2')); await sql.end(); })();
