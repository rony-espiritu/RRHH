import 'server-only';
import nodemailer from 'nodemailer';

/**
 * Envío de correos por SMTP (p.ej. Google Workspace con una "contraseña de aplicación").
 * Variables en Vercel: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y opcional SMTP_FROM.
 */
export const correoConfigurado = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export async function enviarCorreo(d: { para: string; asunto: string; html: string; texto: string }) {
  if (!correoConfigurado()) throw new Error('El envío de correos no está configurado (faltan las variables SMTP en Vercel)');
  const puerto = Number(process.env.SMTP_PORT ?? 465);
  const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: puerto, secure: puerto === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await t.sendMail({ from: process.env.SMTP_FROM || `RRHH Estancias Espíritu <${process.env.SMTP_USER}>`, to: d.para, subject: d.asunto, html: d.html, text: d.texto });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Correo con la contraseña temporal. */
export function correoBienvenida(d: { nombre: string; usuario: string; clave: string; url: string; nuevo: boolean }) {
  const titulo = d.nuevo ? 'Tu acceso al sistema de RRHH' : 'Tu contraseña del sistema de RRHH fue restablecida';
  const texto = `Hola ${d.nombre}:\n\n${d.nuevo ? 'Se creó tu usuario en el sistema de RRHH de Estancias Espíritu.' : 'Se restableció tu contraseña del sistema de RRHH.'}\n\n`
    + `Ingresá en: ${d.url}\nUsuario: ${d.usuario}\nContraseña temporal: ${d.clave}\n\nAl ingresar, el sistema te pedirá cambiarla por una propia.\n\nRRHH · Grupo Ganadero Estancias Espíritu`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#3d1c0b">
    <div style="background:#683013;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-weight:bold">RRHH · Estancias Espíritu</div>
    <div style="border:1px solid #e9d9c8;border-top:0;padding:18px;border-radius:0 0 8px 8px">
      <p>Hola <b>${esc(d.nombre)}</b>:</p>
      <p>${d.nuevo ? 'Se creó tu usuario en el sistema de RRHH de Estancias Espíritu.' : 'Se restableció tu contraseña del sistema de RRHH.'}</p>
      <table style="background:#fbf4ec;border-left:4px solid #E9A45E;padding:10px 14px;margin:12px 0">
        <tr><td style="padding:3px 10px 3px 0">Usuario</td><td><b>${esc(d.usuario)}</b></td></tr>
        <tr><td style="padding:3px 10px 3px 0">Contraseña temporal</td><td><b style="font-family:monospace;font-size:16px">${esc(d.clave)}</b></td></tr>
      </table>
      <p><a href="${esc(d.url)}" style="display:inline-block;background:#683013;color:#fff;padding:9px 16px;border-radius:6px;text-decoration:none">Ingresar al sistema</a></p>
      <p style="color:#7f6a58;font-size:13px">Al ingresar, el sistema te pedirá cambiarla por una contraseña propia. Si no esperabas este correo, avisá a RRHH.</p>
    </div></div>`;
  return { asunto: titulo, html, texto };
}
