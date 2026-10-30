'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Menú lateral: resalta la sección actual. */
export default function Menu({ items }: { items: { href: string; texto: string }[] }) {
  const ruta = usePathname();
  return (
    <ul>
      {items.map((m) => (
        <li key={m.href}><Link href={m.href} className={(m.href === '/' ? ruta === '/' : ruta.startsWith(m.href)) ? 'activo' : ''}>{m.texto}</Link></li>
      ))}
    </ul>
  );
}
