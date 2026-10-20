import { NextResponse, type NextRequest } from 'next/server';
import { archivoBancoUnion, csvOvt, listaEfectivo, planillaBnb } from '@/lib/datos/salidas';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const q = req.nextUrl.searchParams;
  const tipo = q.get('tipo'), empresa = q.get('empresa') ?? '';
  const archivo =
    tipo === 'union' ? await archivoBancoUnion(id, empresa)
    : tipo === 'ovt' ? await csvOvt(id, empresa)
    : tipo === 'bnb' ? await planillaBnb(id)
    : tipo === 'efectivo' ? await listaEfectivo(id, q.get('pl') === 'B2' ? 'B2' : 'B1')
    : null;
  if (!archivo) return new NextResponse('Tipo de archivo no válido', { status: 400 });
  return new NextResponse(new Uint8Array(archivo.cuerpo), {
    headers: { 'Content-Type': archivo.tipo, 'Content-Disposition': `attachment; filename="${encodeURIComponent(archivo.nombre)}"` },
  });
}
