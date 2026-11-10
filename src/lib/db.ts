import 'server-only';
import postgres from 'postgres';

// Conexión directa a PostgreSQL (Supabase: cadena del "Transaction pooler", puerto 6543).
// Solo se usa en el servidor; el navegador nunca ve DATABASE_URL.
//
// En Vercel la función se "congela" entre pedidos: sus temporizadores no corren y, mientras tanto, Supabase
// cierra las conexiones ociosas. Al despertar, una consulta escrita en esa conexión muerta quedaba esperando
// para siempre (la página tardaba 5 minutos y fallaba). Por eso, si pasó un rato sin usar la base, se descarta
// el cliente y se abre uno nuevo antes de consultar.
const url = process.env.DATABASE_URL ?? (process.env.NODE_ENV === 'production' ? '' : 'postgres://postgres@localhost:5544/postgres');
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const OCIOSO_MS = 15_000;

function nuevoCliente() {
  return postgres(url || 'postgres://falta-DATABASE_URL@invalido/none', {
    prepare: false,
    max: 5,
    connect_timeout: 10,
    idle_timeout: 10,
    max_lifetime: 60 * 10,
    connection: { application_name: 'rrhh-vercel' },   // para identificar las conexiones del sistema en Supabase
    ssl: local ? false : 'require',
    types: { numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) } },
  });
}

const g = globalThis as unknown as { __db?: { cliente: postgres.Sql; ultimo: number } };

function cliente(): postgres.Sql {
  const ahora = Date.now();
  if (!g.__db) g.__db = { cliente: nuevoCliente(), ultimo: ahora };
  else if (!local && ahora - g.__db.ultimo > OCIOSO_MS) {
    const viejo = g.__db.cliente;
    g.__db = { cliente: nuevoCliente(), ultimo: ahora };
    viejo.end({ timeout: 60 }).catch(() => {});   // las conexiones viejas se cierran en segundo plano
  }
  g.__db.ultimo = ahora;
  return g.__db.cliente;
}

/** Cliente de base de datos: se usa igual que el de postgres (sql`...`, sql.begin, sql.json…). */
export const sql = new Proxy(function () {} as unknown as postgres.Sql, {
  apply: (_t, _this, args) => (cliente() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => {
    const c = cliente() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});

/** Descripción de la conexión sin la contraseña (para diagnóstico). */
export function conexionSinClave() {
  if (!process.env.DATABASE_URL) return 'DATABASE_URL no está definida en este despliegue';
  try {
    const u = new URL(process.env.DATABASE_URL);
    return `${u.protocol}//${u.username}:•••••@${u.hostname}:${u.port}${u.pathname}`;
  } catch {
    return 'DATABASE_URL tiene un formato inválido (¿quedaron corchetes o espacios?)';
  }
}
