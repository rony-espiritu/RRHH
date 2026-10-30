import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, verificar } from './lib/sesion-firma';

// Todo el sistema requiere sesión iniciada, salvo la página de ingreso.
const PUBLICAS = ['/login'];

export async function middleware(req: NextRequest) {
  const ruta = req.nextUrl.pathname;
  const headers = new Headers(req.headers);
  headers.set('x-ruta', ruta);
  if (PUBLICAS.some((p) => ruta === p || ruta.startsWith(p + '/'))) return NextResponse.next({ request: { headers } });
  const s = await verificar(req.cookies.get(COOKIE)?.value);
  if (!s) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = ruta === '/' ? '' : `?volver=${encodeURIComponent(ruta + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'] };
