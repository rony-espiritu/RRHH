'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/** Elegir el trabajador a cuyo nombre se carga la solicitud: navega al instante, sin recargar la página. */
export default function SelectorTrabajador({ trabs, actual, e }: { trabs: { id: number; codigo: string; nombre: string }[]; actual?: string; e: string }) {
  const router = useRouter();
  const [cargando, iniciar] = useTransition();
  return (
    <div className="panel fila">
      <b>Cargar una solicitud a nombre de:</b>
      <select value={actual ?? ''} style={{ minWidth: 280 }} disabled={cargando}
        onChange={(ev) => iniciar(() => router.push(ev.target.value ? `/vacaciones?e=${e}&t=${ev.target.value}` : `/vacaciones?e=${e}`))}>
        <option value="">Elegir trabajador…</option>
        {trabs.map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.codigo})</option>)}
      </select>
      {cargando && <span className="sub" style={{ margin: 0 }}>Cargando…</span>}
    </div>
  );
}
