import { NextResponse, type NextRequest } from 'next/server';

// Protección provisional con usuario y contraseña (Basic Auth) hasta integrar el login de Supabase.
// Se activa solo si APP_USUARIO y APP_CLAVE están definidas.
export function middleware(req: NextRequest) {
  const u = process.env.APP_USUARIO, c = process.env.APP_CLAVE;
  if (!u || !c) return NextResponse.next();
  const h = req.headers.get('authorization') ?? '';
  if (h.startsWith('Basic ')) {
    const [uu, cc] = atob(h.slice(6)).split(':');
    if (uu === u && cc === c) return NextResponse.next();
  }
  return new NextResponse('Acceso restringido', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="RRHH Espiritu"' } });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
