import type { Solicitud } from '@/lib/datos/vacaciones';

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** 30-oct-26, como en el formulario manual */
export const corta = (s: string | null) => (s ? `${Number(s.slice(8, 10))}-${MES[Number(s.slice(5, 7)) - 1]}-${s.slice(2, 4)}` : '');
export const larga = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
export const num = (n: number | null) => (n == null ? '' : Number(n).toLocaleString('es-BO', { maximumFractionDigits: 1 }));

export function EstadoChip({ e }: { e: string }) {
  return <span className={`chip vac-${e}`}>{e === 'PENDIENTE' ? 'Pendiente' : e === 'APROBADA' ? 'Aprobada' : e === 'RECHAZADA' ? 'Rechazada' : 'Anulada'}</span>;
}

/** Formulario FO-IT-GAC-05-01 "Solicitud de vacación", igual al manual, listo para imprimir y firmar. */
export function FormularioVacacion({ s }: { s: Solicitud }) {
  const sobrantes = s.saldo_antes == null ? null : s.saldo_antes - s.dias;
  return (
    <div className="fvac">
      <table className="fvac-cab"><tbody><tr>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <td rowSpan={2} className="fvac-logo"><img src="/logo.png" alt="" /><span>Estancias<br />Espíritu</span></td>
        <td className="fvac-t1">FORMULARIO</td>
        <td className="fvac-cod">Código: <b>FO-IT-GAC-05-01</b><br />Revisión: 0</td>
      </tr><tr>
        <td className="fvac-t2">SOLICITUD DE VACACIÓN</td>
        <td className="fvac-cod">N° <b>{s.id}</b><br />Página: 1 de 1</td>
      </tr></tbody></table>
      <div className="fvac-cuerpo">
        <div className="fvac-fila"><label>Nombre:</label><span className="fvac-dato ancho">{s.nombre}</span><label>Fecha de Solicitud:</label><span className="fvac-dato">{corta(s.fecha_solicitud)}</span></div>
        <div className="fvac-fila"><label>Cargo:</label><span className="fvac-dato ancho">{s.cargo ?? ''}</span><label>Área:</label><span className="fvac-dato">{s.area ?? s.empresa}</span></div>
        <div className="fvac-fila"><label>Del:</label><span className="fvac-dato">{corta(s.desde)}</span><label>Al:</label><span className="fvac-dato">{corta(s.hasta)}</span>
          <label>Retorna:</label><span className="fvac-dato">{corta(s.retorno)}</span><label>Días Pendientes:</label><span className="fvac-dato num">{num(s.saldo_antes)}</span></div>
        <div className="fvac-fila"><label>Total días por Tomar:</label><span className="fvac-dato num">{num(s.dias)}</span><span className="fvac-esp" />
          <label>Días Sobrantes:</label><span className={`fvac-dato num${sobrantes != null && sobrantes < 0 ? ' neg' : ''}`}>{num(sobrantes)}</span></div>
        <div className="fvac-obs"><label>Observaciones:</label><div>{s.observaciones}{sobrantes != null && sobrantes < 0 && <div><i>Vacación adelantada ({num(-sobrantes)} día(s) de la siguiente gestión).</i></div>}
          {s.estado === 'APROBADA' && <div className="fvac-sello">Aprobada en el sistema por {s.revisado_por_nombre} el {s.revisado_en}</div>}
          {s.estado === 'RECHAZADA' && <div className="fvac-sello rech">Rechazada: {s.motivo_rechazo}</div>}
          {s.estado === 'ANULADA' && <div className="fvac-sello rech">ANULADA</div>}</div></div>
        <div className="fvac-firmas"><div>Solicitante</div><div>Vo Bo Recursos Humanos</div><div>Aprobación Jefe Inmediato</div></div>
      </div>
    </div>
  );
}
