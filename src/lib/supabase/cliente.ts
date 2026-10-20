import { createBrowserClient } from '@supabase/ssr';

/** Cliente de Supabase para el navegador (lee las claves públicas de .env.local). */
export const crearClienteNavegador = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
