import Link from 'next/link';
import { catalogos } from '@/lib/datos/personal';
import { accionNuevo } from '../acciones';

export const dynamic = 'force-dynamic';

export default async function NuevoTrabajador({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { err } = await searchParams;
  const c = await catalogos();
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <>
      <p><Link href="/personal">← Personal</Link></p>
      <h2>Alta de trabajador</h2>
      <p className="sub">Los datos mínimos para que entre a la planilla. El resto (dependientes, Gestora, bonos, tasas) se completa luego en su ficha.
        El código sigue la costumbre de SIDPLAN: inicial del apellido + inicial del nombre + día y mes de nacimiento (ej. MS1111).</p>
      {err && <div className="error">{err}</div>}
      <form action={accionNuevo} className="panel">
        <h3 style={{ marginTop: 0 }}>Datos personales</h3>
        <div className="grilla">
          <label className="campo"><span>Código *</span><input name="codigo" required maxLength={8} style={{ textTransform: 'uppercase' }} /></label>
          <label className="campo"><span>Apellido paterno</span><input name="ap_paterno" /></label>
          <label className="campo"><span>Apellido materno</span><input name="ap_materno" /></label>
          <label className="campo"><span>Nombres *</span><input name="nombres" required /></label>
          <label className="campo"><span>Tipo de documento</span><select name="tipo_documento"><option>CI</option><option>PASAPORTE</option><option>CE</option></select></label>
          <label className="campo"><span>N° de documento *</span><input name="ci" required /></label>
          <label className="campo"><span>Expedido</span><select name="ci_expedido">{['BE', 'SC', 'LP', 'CB', 'CH', 'OR', 'PT', 'TJ', 'PD', ''].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="campo"><span>Fecha de nacimiento</span><input type="date" name="fecha_nacimiento" /></label>
          <label className="campo"><span>Sexo</span><select name="sexo"><option value="M">Masculino</option><option value="F">Femenino</option></select></label>
        </div>
        <h3>Datos laborales</h3>
        <div className="grilla">
          <label className="campo"><span>Empresa *</span><select name="empresa_id" required>{c.empresas.map((e) => <option key={e.id} value={e.id}>{e.codigo} — {e.razon_social}</option>)}</select></label>
          <label className="campo"><span>Fecha de ingreso *</span><input type="date" name="fecha_ingreso" defaultValue={hoy} required /></label>
          <label className="campo"><span>Cargo</span><select name="cargo_id"><option value=""></option>{c.cargos.map((x) => <option key={x.id} value={x.id}>{x.descripcion}</option>)}</select></label>
          <label className="campo"><span>Ocupación</span><input name="ocupacion" /></label>
          <label className="campo"><span>Centro de costo</span><select name="centro_costo_id">{c.centros.map((x) => <option key={x.id} value={x.id}>{x.codigo} — {x.descripcion}</option>)}</select></label>
          <label className="check"><input type="checkbox" name="en_b1" defaultChecked /> Entra en planilla B1 (oficial)</label>
          <label className="campo"><span>Sueldo básico B1 (Bs)</span><input name="sueldo_b1" className="num" /></label>
          <label className="campo"><span>Abono B2 (Bs)</span><input name="abono_b2" className="num" /></label>
          <label className="campo"><span>Pago B1</span><select name="forma_pago"><option value="BANCO_UNION">Banco Unión</option><option value="BNB">BNB</option><option value="EFECTIVO">Efectivo</option></select></label>
          <label className="campo"><span>N° de cuenta</span><input name="nro_cuenta" /></label>
        </div>
        <p><button>Registrar trabajador</button></p>
      </form>
    </>
  );
}
