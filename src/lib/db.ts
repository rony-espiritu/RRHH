import 'server-only';
import postgres from 'postgres';

// Conexión directa a PostgreSQL (Supabase: cadena del "Transaction pooler", puerto 6543).
// Solo se usa en el servidor; el navegador nunca ve DATABASE_URL.
const g = globalThis as unknown as { __sql?: postgres.Sql };

const url = process.env.DATABASE_URL ?? (process.env.NODE_ENV === 'production' ? '' : 'postgres://postgres@localhost:5544/postgres');
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

export const sql: postgres.Sql =
  g.__sql ??
  (g.__sql = postgres(url || 'postgres://falta-DATABASE_URL@invalido/none', {
    prepare: false,
    max: 3,
    connect_timeout: 10,
    ssl: local ? false : 'require',
    types: { numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) } },
  }));

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
