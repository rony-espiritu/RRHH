import 'server-only';
import postgres from 'postgres';

// Conexión directa a PostgreSQL (Supabase: usar la cadena del "Transaction pooler", puerto 6543).
// Solo se usa en el servidor; el navegador nunca ve DATABASE_URL.
const g = globalThis as unknown as { __sql?: postgres.Sql };

export const sql: postgres.Sql =
  g.__sql ??
  (g.__sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5544/postgres', {
    prepare: false,
    max: 5,
    types: { numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) } },
  }));
