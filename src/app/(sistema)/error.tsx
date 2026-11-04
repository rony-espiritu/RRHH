'use client';
import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Versión nueva publicada mientras la página estaba abierta: se recarga sola una vez
  const desactualizado = /ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch|server action/i.test(`${error.name} ${error.message}`);
  useEffect(() => {
    if (!desactualizado) return;
    try {
      const ultimo = Number(sessionStorage.getItem('recarga-auto') ?? 0);
      if (Date.now() - ultimo > 60_000) { sessionStorage.setItem('recarga-auto', String(Date.now())); window.location.reload(); }
    } catch { window.location.reload(); }
  }, [desactualizado]);
  return (
    <div className="panel">
      <h2>{desactualizado ? 'Se publicó una versión nueva del sistema' : 'No se pudo cargar esta página'}</h2>
      <p className="sub">{desactualizado ? 'Recargá la página para seguir trabajando.' : 'Normalmente es un problema de conexión con la base de datos.'}</p>
      <div className="fila">
        <button onClick={() => (desactualizado ? window.location.reload() : reset())}>{desactualizado ? 'Recargar' : 'Reintentar'}</button>
        <Link className="btn sec" href="/diagnostico">Ver diagnóstico</Link>
      </div>
    </div>
  );
}
