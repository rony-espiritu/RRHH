'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Indicador global: al enviar cualquier formulario (calcular, guardar, importar…) muestra "Procesando…"
 * con un ícono girando y bloquea el botón presionado hasta que la página se actualiza.
 */
export default function Procesando() {
  const [texto, setTexto] = useState<string | null>(null);
  const [navegando, setNavegando] = useState(false);
  const ruta = usePathname(), params = useSearchParams();
  const limpiar = () => {
    setTexto(null);
    setNavegando(false);
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
    // Al volver con el botón "Atrás" el navegador puede restaurar la página con el indicador puesto: se limpia
    const alMostrar = (e: PageTransitionEvent) => { if (e.persisted) limpiar(); };
    // Clic en un enlace interno: barra de carga arriba hasta que llega la página nueva
    const alClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest?.('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
      setNavegando(true);
    };
    document.addEventListener('submit', alEnviar, true);
    document.addEventListener('click', alClic, true);
    window.addEventListener('pageshow', alMostrar);
    return () => {
      document.removeEventListener('submit', alEnviar, true);
      document.removeEventListener('click', alClic, true);
      window.removeEventListener('pageshow', alMostrar);
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

  // Seguridad: la barra de navegación se quita sola a los 20 s
  useEffect(() => {
    if (!navegando) return;
    const t = setTimeout(() => setNavegando(false), 20000);
    return () => clearTimeout(t);
  }, [navegando]);

  if (!texto) return navegando ? <div className="cargando-barra" role="progressbar" aria-label="Cargando" /> : null;
  return (
    <>{navegando && <div className="cargando-barra" />}<div className="procesando-aviso" role="status" aria-live="polite">
      <span className="giro" /> {texto}… <small>un momento, por favor</small>
    </div></>
  );
}
