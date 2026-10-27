import { generarCooperativaPeriodo } from '../src/lib/datos/cooperativa';
import { sql } from '../src/lib/db';
(async () => { console.log(await generarCooperativaPeriodo(Number(process.argv[2]))); await sql.end(); })();
