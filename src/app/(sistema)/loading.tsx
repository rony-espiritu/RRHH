/** Se muestra al instante al hacer clic en un enlace, mientras el servidor arma la página. */
export default function Cargando() {
  return (
    <div className="cargando-pagina" role="status" aria-live="polite">
      <div className="cargando-barra" />
      <div className="esqueleto t" /><div className="esqueleto s" />
      <div className="esqueleto-fila">{[0, 1, 2, 3].map((i) => <div key={i} className="esqueleto k" />)}</div>
      <div className="esqueleto b" />
      <span className="sub"><span className="giro" /> Cargando…</span>
    </div>
  );
}
