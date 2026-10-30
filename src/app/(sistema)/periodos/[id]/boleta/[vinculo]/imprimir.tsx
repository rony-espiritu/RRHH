'use client';
export default function Imprimir() {
  return <p className="no-print"><button onClick={() => window.print()}>Imprimir / guardar PDF</button></p>;
}
