"""Genera supabase/seed.sql (carga inicial) a partir de:
  - datos/migracion-sidplan.xlsx  (personal activo extraído de SIDPLAN y corregido por RRHH)
  - datos/catalogos.json          (conceptos B1/B2 y centros de costo con su equivalencia en Albor)

Uso:  python3 scripts/generar_seed.py
"""
import json
from pathlib import Path
import openpyxl

RAIZ = Path(__file__).resolve().parent.parent
XLSX = RAIZ / 'datos' / 'migracion-sidplan.xlsx'
CAT = json.loads((RAIZ / 'datos' / 'catalogos.json').read_text(encoding='utf-8'))
SALIDA = RAIZ / 'supabase' / 'seed.sql'

# La Tranca y La Bajura son un solo empleador (mismo NIT): todo va a TRAN.
ALIAS_EMPRESA = {'ZLBA': 'TRAN'}
# Datos de empleador que no están en SIDPLAN (de las planillas impresas).
EXTRA_EMPRESA = {
    'BASP': dict(razon='BASPEL LTDA', propietario='BASPEL Ltda.', estancia='Santa Cruz', nit='298220024',
                 mintrab='298220024-07', caja='030-0 14-271', banco='BNB', rciva=True),
    'EESP': dict(razon='ESPIRITU EVENTUALES FIJOS', propietario='Ana Maria Bauer Reinecke', estancia='Espíritu', tipo='SOLO_B2'),
}
TASAS_PROPIAS = {'MS1111': [('SOLIDARIO_LAB', 0.009333, 'Tasa fija heredada de SIDPLAN (0,9333%)')]}
FORMA = {'Banco Unión': 'BANCO_UNION', 'BNB': 'BNB', 'EFECTIVO': 'EFECTIVO'}


def q(v):
    if v is None or v == '':
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return repr(round(v, 6))
    return "'" + str(v).replace("'", "''").strip() + "'"


def hoja(wb, nombre):
    ws = wb[nombre]
    filas = list(ws.iter_rows(values_only=True))
    cab = filas[0]
    return [dict(zip(cab, f)) for f in filas[1:] if any(c is not None for c in f)]


def emp(cod):
    cod = (cod or '').strip()
    return ALIAS_EMPRESA.get(cod, cod)


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    personal = hoja(wb, 'Personal activo')
    empresas = hoja(wb, 'Empresas')
    sql = ['-- Carga inicial generada por scripts/generar_seed.py — no editar a mano', 'begin;', '']

    # ---- Empresas
    sql.append('-- Empresas')
    vistos = set()
    for e in empresas:
        cod = emp(e['Código'])
        if cod in vistos:
            continue
        vistos.add(cod)
        x = EXTRA_EMPRESA.get(cod, {})
        nombre = x.get('razon') or e['Nombre']
        prop, _, est = (e['Nombre'] or '').partition(' - ')
        if cod == 'TRAN':
            nombre, est = 'HANS PETER ELSNER SCHIFFER - La Tranca - La Bajura', 'La Tranca - La Bajura'
        sigla = (e.get('Sigla Caja') or '').strip()
        sql.append(
            'insert into empresa (codigo, razon_social, propietario, estancia, tipo, nit, nro_empleador_mintrab, '
            'nro_empleador_caja, direccion, telefonos, rep_legal_nombre, rep_legal_ci, banco_pago, calcula_rciva) values ('
            + ', '.join([q(cod), q(nombre), q(x.get('propietario') or prop.title()), q(x.get('estancia') or est),
                         q(x.get('tipo', 'OFICIAL')) + '::tipo_empresa', q(x.get('nit') or e['NIT']),
                         q(x.get('mintrab') or e['N° empleador']), q(x.get('caja') or (f'080-0 {sigla}' if sigla else None)),
                         q('AVENIDA ALEMANA CALLE SAO No 2365'), q('3444440 - 3444441'),
                         q('HANS PETER ELSNER SCHIFFER'), q('2284094'),
                         q(x.get('banco', 'BANCO_UNION')) + '::forma_pago', q(x.get('rciva', False))]) + ');')
    for cod, x in EXTRA_EMPRESA.items():
        if cod not in vistos:
            sql.append(f"insert into empresa (codigo, razon_social, propietario, estancia, tipo, banco_pago) values "
                       f"({q(cod)}, {q(x['razon'])}, {q(x['propietario'])}, {q(x['estancia'])}, {q(x.get('tipo','OFICIAL'))}::tipo_empresa, 'EFECTIVO');")
            vistos.add(cod)

    # ---- Centros de costo
    sql += ['', '-- Centros de costo (equivalencia SIDPLAN → Albor deducida de los asientos de sep-2026)']
    for c in CAT['centros_costo']:
        sql.append(f"insert into centro_costo (codigo, descripcion, albor_cc, albor_unidad_negocio) values "
                   f"({q(c['codigo'])}, {q(c['descripcion'])}, {q(c['albor_cc'])}, {q(c['albor_un'])});")

    # ---- Cargos (desde el personal)
    sql += ['', '-- Cargos']
    cargos = sorted({(p['Cargo'] or '').strip() for p in personal if p['Cargo']})
    for i, c in enumerate(cargos, 1):
        sql.append(f"insert into cargo (codigo, descripcion) values ({q('C%03d' % i)}, {q(c)});")
    for a in sorted({(p['Área'] or '').strip() for p in personal if p['Área']}):
        sql.append(f"insert into area (codigo, descripcion) values ({q(a)}, {q(a)});")
    for n in hoja(wb, 'Niveles'):
        sql.append(f"insert into nivel_salarial (codigo, descripcion, monto) values ({q(n['Nivel'])}, {q(n['Descripción'])}, {q(n['Básico'])});")

    # ---- Conceptos
    sql += ['', '-- Conceptos (códigos de SIDPLAN)']
    for pl in ('B1', 'B2'):
        for c in CAT[pl]:
            sql.append(
                'insert into concepto (codigo, planilla, nombre, naturaleza, modo, factor, cotizable, afecta_rciva, afecta_aguinaldo, tipo_contable) values ('
                + ', '.join([q(c['codigo']), q(pl) + '::tipo_planilla', q(c['nombre']), q(c['naturaleza']) + '::naturaleza_concepto',
                             q(c['modo']) + '::modo_calculo', q(c['factor']), q(c['cotizable']), q(c['afecta_rciva']),
                             q(c['afecta_aguinaldo']), q(c['tipo_contable'])]) + ');')

    # ---- Personal
    sql += ['', '-- Personal activo, vínculo vigente, fijos, forma de pago y centro de costo']
    desde = '2026-10-01'
    for p in personal:
        cod = p['Código']
        b1 = 'B1' in p['Bases'] or 'BASPEL' in p['Bases']
        emp_v = emp(p['Empresa oficial']) if b1 else emp(p['Empresa B2'])
        emp_b2 = emp(p['Empresa B2'])
        sql.append(
            'insert into trabajador (codigo, ci, ci_expedido, ap_paterno, ap_materno, nombres, fecha_nacimiento, sexo, estado_civil, '
            'nacionalidad, nua_cua, nro_asegurado, fecha_ingreso_grupo) values ('
            + ', '.join([q(cod), q(p['CI']), q(p['Exp.']), q(p['Ap. paterno']), q(p['Ap. materno']), q(p['Nombres']),
                         q(p['F. nacimiento']), q(p['Sexo']), q(p['Est. civil']), q(p['Nacionalidad']), q(p['NUA/CUA']),
                         q(p['N° asegurado Caja']), q(p['F. ingreso'])]) + ');')
        sql.append(
            'insert into vinculo (trabajador_id, empresa_id, empresa_b2_id, en_b1, en_b2, fecha_ingreso, cargo_id, ocupacion, area_id) values ('
            f"(select id from trabajador where codigo={q(cod)}), (select id from empresa where codigo={q(emp_v)}), "
            + (f"(select id from empresa where codigo={q(emp_b2)})" if emp_b2 and emp_b2 != emp_v else 'null')
            + f", {q(b1)}, true, {q(p['F. ingreso'])}, (select id from cargo where descripcion={q(p['Cargo'])}), "
            f"{q(p['Ocupación (planilla)'])}, (select id from area where codigo={q(p['Área'])}));")
        v = f"(select v.id from vinculo v join trabajador t on t.id=v.trabajador_id where t.codigo={q(cod)} and v.fecha_retiro is null)"

        def fijo(pl, conc, cant, monto, motivo='Carga inicial SIDPLAN'):
            sql.append('insert into concepto_fijo (vinculo_id, concepto_id, cantidad, monto, vigente_desde, motivo) values ('
                       f"{v}, (select id from concepto where planilla='{pl}' and codigo={conc}), {q(cant)}, {q(monto)}, '{desde}', {q(motivo)});")

        if b1 and p['Sueldo básico B1']:
            fijo('B1', 2, 30, p['Sueldo básico B1'])
            if p['Bono nivel / otros bonos B1']:
                fijo('B1', 24, None, p['Bono nivel / otros bonos B1'])
        if p['Monto base B2 (Abono)']:
            fijo('B2', 2, 30, p['Monto base B2 (Abono)'])
        for col, conc in [('Gratificación puestero B2', 11), ('Bono apoyo alimentación B2', 12), ('Bono carne B2', 13),
                          ('Bono carne SCZ B2', 14), ('Bono rendimiento B2', 25)]:
            if p.get(col):
                fijo('B2', conc, None, p[col])
        if p.get('Aporte cooperativa (desc.) B2'):
            fijo('B2', 521, p['Aporte cooperativa (desc.) B2'], None, 'Aporte cooperativa en $us')
        forma = FORMA.get(p['Banco'] or 'EFECTIVO', 'EFECTIVO')
        sql.append(f"insert into trabajador_pago (trabajador_id, planilla, forma, nro_cuenta, vigente_desde) values "
                   f"((select id from trabajador where codigo={q(cod)}), 'B1', '{forma}', {q(p['N° cuenta'])}, '{desde}');")
        dist = [x for x in CAT.get('distribuciones', []) if x['codigo'] == cod]
        if p['Centro de costo']:
            sql.append(f"insert into asignacion_cc (vinculo_id, centro_costo_id, planilla, porcentaje, vigente_desde) values "
                       f"({v}, (select id from centro_costo where codigo={q(p['Centro de costo'])}), "
                       + ("'B1'" if dist else 'null') + f", 100, '{desde}');")
        for x in dist:  # reparto por campaña (parametrizable)
            for r in x['reparto']:
                sql.append(f"insert into asignacion_cc (vinculo_id, centro_costo_id, planilla, porcentaje, albor_cc, albor_unidad_negocio, vigente_desde) values "
                           f"({v}, (select id from centro_costo where codigo={q(x['centro'])}), '{x['planilla']}', {r['porcentaje']}, "
                           f"{q(r['albor_cc'])}, {q(r['albor_un'])}, '{x['vigente_desde']}');")
        for clave, valor, motivo in TASAS_PROPIAS.get(cod, []):
            sql.append(f"insert into tasa_trabajador (trabajador_id, parametro_clave, valor, vigente_desde, motivo) values "
                       f"((select id from trabajador where codigo={q(cod)}), {q(clave)}, {valor}, '2026-01-01', {q(motivo)});")

    # ---- Dependientes
    sql += ['', '-- Dependientes']
    for dpd in hoja(wb, 'Dependientes'):
        sql.append(f"insert into dependiente (trabajador_id, nombre, fecha_nacimiento, parentesco) select id, {q(dpd['Dependiente'])}, "
                   f"{q(dpd['F. nacimiento'])}, {q(dpd['Parentesco'])} from trabajador where codigo={q(dpd['Código'])};")

    sql += ['', '-- Empresas antiguas de SIDPLAN sin personal: quedan inactivas',
            'update empresa e set activo = false where not exists (select 1 from vinculo v where v.empresa_id = e.id or v.empresa_b2_id = e.id);',
            '', 'commit;', '']
    SALIDA.write_text('\n'.join(sql), encoding='utf-8')
    print(f'{SALIDA}: {len(personal)} trabajadores, {len(vistos)} empresas')


if __name__ == '__main__':
    main()
