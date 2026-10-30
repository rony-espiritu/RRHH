'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Indicador global: al enviar cualquier formulario (calcular, guardar, importar…) muestra "Procesando…"
 * con un ícono girando y bloquea el botón presionado hasta que la página se actualiza.
 */
export default function Procesando() {
  const [texto, setTexto] = useState<string | null>(null);
  const ruta = usePathname(), params = useSearchParams();
  const limpiar = () => {
    setTexto(null);
    document.body.classList.remove('procesando');
    document.querySelectorAll('.cargando').forEach((b) => { b.classList.remove('cargando'); b.removeAttribute('aria-busy'); });
  };

  useEffect(() => {
    const alEnviar = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      // ya hay un proceso en curso: no se envía de nuevo (evita doble clic)
      if (document.body.classList.contains('procesando')) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      const boton = (e.submitter as HTMLButtonElement | null) ?? form.querySelector('button');
      const nombre = boton?.textContent?.trim() || 'Procesando';
      setTexto(nombre);
      if (boton) { boton.classList.add('cargando'); boton.setAttribute('aria-busy', 'true'); }
      document.body.classList.add('procesando');
      // Si el servidor responde con la misma dirección, se detecta el cambio de contenido de la página
      const main = document.querySelector('main');
      if (main) {
        const obs = new MutationObserver(() => { obs.disconnect(); limpiar(); });
        setTimeout(() => obs.observe(main, { childList: true, subtree: true, characterData: true }), 50);
        setTimeout(() => obs.disconnect(), 120000);
      }
    };
    document.addEventListener('submit', alEnviar, true);
    return () => {
      document.removeEventListener('submit', alEnviar, true);
      // al salir del sistema (p. ej. a la página de ingreso) no debe quedar nada bloqueado
      document.body.classList.remove('procesando');
      document.querySelectorAll('.cargando').forEach((b) => { b.classList.remove('cargando'); b.removeAttribute('aria-busy'); });
    };
  }, []);

  // Al cambiar de página (respuesta del servidor) se quita el indicador
  useEffect(() => { limpiar(); }, [ruta, params]);

  // Seguridad: si algo falla sin navegar, se libera a los 2 minutos
  useEffect(() => {
    if (!texto) return;
    const t = setTimeout(() => { setTexto(null); document.body.classList.remove('procesando'); }, 120000);
    return () => clearTimeout(t);
  }, [texto]);

  if (!texto) return null;
  return (
    <div className="procesando-aviso" role="status" aria-live="polite">
      <span className="giro" /> {texto}… <small>un momento, por favor</small>
    </div>
  );
}
