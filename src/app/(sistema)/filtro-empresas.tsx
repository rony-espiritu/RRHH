import Link from 'next/link';

/** Empresa que presenta su planilla aparte: por defecto queda fuera de "Todas sin Baspel". */
export const EMPRESA_APARTE = 'BASP';

/**
 * Empresas elegidas a partir del parámetro ?empresa=A,B,C.
 * Sin parámetro: todas menos Baspel. "*" = todas (con Baspel).
 */
export function elegirEmpresas(todas: string[], param: string | undefined) {
  const grupo = todas.filter((e) => e !== EMPRESA_APARTE);
  const elegidas = param === '*' ? todas : param ? param.split(',').filter((e) => todas.includes(e)) : grupo;
  return { elegidas: elegidas.length ? elegidas : grupo, grupo };
}

/** Botones: Todas sin Baspel · Todas con Baspel · Solo Baspel · y cada empresa para marcar varias. */
export function FiltroEmpresas({ todas, param, href, etiqueta = 'Propietario' }: { todas: string[]; param: string | undefined; href: (empresa: string | undefined) => string; etiqueta?: string }) {
  const { elegidas, grupo } = elegirEmpresas(todas, param);
  const hay = todas.includes(EMPRESA_APARTE);
  const igual = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const alternar = (e: string) => {
    const x = elegidas.includes(e) ? elegidas.filter((y) => y !== e) : [...elegidas, e];
    if (!x.length || igual(x, grupo)) return undefined;
    return igual(x, todas) ? '*' : x.sort().join(',');
  };
  return (
    <div className="fila"><span className="etq">{etiqueta}</span>
      <Link className={`btn ${igual(elegidas, grupo) ? '' : 'sec'}`} href={href(undefined)}>{hay ? 'Todas sin Baspel' : 'Todas'}</Link>
      {hay && <Link className={`btn ${igual(elegidas, todas) ? '' : 'sec'}`} href={href('*')}>Todas con Baspel</Link>}
      {hay && <Link className={`btn ${igual(elegidas, [EMPRESA_APARTE]) ? '' : 'sec'}`} href={href(EMPRESA_APARTE)}>Solo Baspel</Link>}
      <span className="sub">varias:</span>
      {todas.map((e) => <Link key={e} className={`btn ${elegidas.includes(e) ? '' : 'sec'}`} href={href(alternar(e))}>{elegidas.includes(e) ? '✓ ' : ''}{e}</Link>)}
    </div>
  );
}
