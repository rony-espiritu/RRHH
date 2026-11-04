'use client';
import { useEffect } from 'react';

/**
 * Error que rompe toda la página. El caso más común: el navegador tenía abierta una versión anterior del sistema
 * y, después de publicar una nueva, pide archivos que ya no existen. Se recarga sola una vez; si no, ofrece recargar.
 */
export default function ErrorGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const desactualizado = /ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch|server action/i.test(`${error.name} ${error.message}`);
  useEffect(() => {
    if (!desactualizado) return;
    try {
      const ultimo = Number(sessionStorage.getItem('recarga-auto') ?? 0);
      if (Date.now() - ultimo > 60_000) { sessionStorage.setItem('recarga-auto', String(Date.now())); window.location.reload(); }
    } catch { window.location.reload(); }
  }, [desactualizado]);
  return (
    <html lang="es"><body style={{ fontFamily: 'system-ui, sans-serif', background: '#f7f3ee', color: '#3d1c0b', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0 }}>
      <div style={{ maxWidth: 440, padding: 24, textAlign: 'center' }}>
        <h2 style={{ color: '#683013' }}>{desactualizado ? 'Se publicó una versión nueva del sistema' : 'Algo salió mal'}</h2>
        <p>{desactualizado ? 'Recargá la página para seguir trabajando.' : 'Probá de nuevo. Si vuelve a pasar, avisá a RRHH con una captura.'}</p>
        <p style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={() => window.location.reload()} style={{ background: '#683013', color: '#fff', border: 0, borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>Recargar</button>
          {!desactualizado && <button onClick={() => reset()} style={{ border: '1px solid #683013', background: '#fff', color: '#683013', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>Reintentar</button>}
        </p>
        {error.digest && <small style={{ color: '#8a7a6e' }}>Código: {error.digest}</small>}
      </div>
    </body></html>
  );
}
