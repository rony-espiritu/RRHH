// Firma de la cookie de sesión (HMAC-SHA256). Funciona en el middleware (Edge) y en el servidor (Node), con Web Crypto.
// La clave se deriva de DATABASE_URL (secreta), así no hace falta otra variable de entorno.
export const COOKIE = 'rrhh_sesion';
export const DURACION_H = 12;
export type Sesion = { u: string; r: string; exp: number };

const enc = new TextEncoder();
const b64url = (b: ArrayBuffer | Uint8Array) => {
  let s = ''; for (const x of new Uint8Array(b)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const desdeB64url = (s: string) => {
  const t = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(t, (c) => c.charCodeAt(0));
};
async function llave() {
  const base = await crypto.subtle.digest('SHA-256', enc.encode((process.env.DATABASE_URL ?? 'desarrollo-local') + '|rrhh-sesion'));
  return crypto.subtle.importKey('raw', base, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function firmar(s: Sesion) {
  const datos = b64url(enc.encode(JSON.stringify(s)));
  const firma = b64url(await crypto.subtle.sign('HMAC', await llave(), enc.encode(datos)));
  return `${datos}.${firma}`;
}
export async function verificar(valor: string | undefined | null): Promise<Sesion | null> {
  if (!valor || !valor.includes('.')) return null;
  const [datos, firma] = valor.split('.');
  try {
    const ok = await crypto.subtle.verify('HMAC', await llave(), desdeB64url(firma), enc.encode(datos));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(desdeB64url(datos))) as Sesion;
    return s.exp > Date.now() ? s : null;
  } catch { return null; }
}
