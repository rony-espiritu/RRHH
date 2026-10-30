'use client';
import Link from 'next/link';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel">
      <h2>No se pudo cargar esta página</h2>
      <p className="sub">Normalmente es un problema de conexión con la base de datos.</p>
      <div className="fila"><button onClick={reset}>Reintentar</button><Link className="btn sec" href="/diagnostico">Ver diagnóstico</Link></div>
    </div>
  );
}
