import csv, glob, io, json, subprocess, sys, datetime
D = "/mnt/user-data/uploads/ERP RRHH/ministerio de trabajo/"
ARCH = {'1Capiguara.csv':'CAP','2Chichiguambo.csv':'CHI','3Dolores.csv':'DOL','4Espiritu.csv':'ESP','5Motacusal.csv':'MOT','6TAROPAL.csv':'TAR',
        '7LA BAJURA.csv':'TRAN','Baspel Ministerio de trabajo-mensual.csv':'BASP','8Capiguara_BBR.csv':'CAPBBR','9Dolores_EEA.csv':'DOLEEA','OVTDJ-T02 (2).csv':'?'}
def leer(p):
    b = open(p,'rb').read()
    try: t = b.decode('utf-8-sig')
    except UnicodeDecodeError: t = b.decode('latin-1')
    return list(csv.reader(io.StringIO(t), delimiter='|'))
def fecha(s):
    s=s.strip()
    if not s: return None
    d,m,y = s.split('/'); return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
def q(sql):
    r = subprocess.run(['psql','-h','localhost','-p','5544','-U','postgres','-Atc',f"select coalesce(json_agg(x),'[]') from ({sql}) x"],capture_output=True,text=True,check=True)
    return json.loads(r.stdout)
T = {r['ci']: r for r in q("select t.*, t.fecha_nacimiento::text fn from trabajador t")}
V = q("""select v.id, v.trabajador_id, e.codigo emp, v.fecha_ingreso::text fi, v.fecha_retiro::text fr, v.ocupacion, v.modalidad_contrato, v.tipo_contrato, v.horas_dia, v.en_b1
         from vinculo v join empresa e on e.id=v.empresa_id""")
out=[]
for f,emp in ARCH.items():
    rows = leer(D+f); h=rows[0]
    for r in rows[1:]:
        if len(r)<25: continue
        x = dict(zip(['nro','tdoc','ci','exp','nac','ap','am','nom','pais','sexo','jub','afp','disc','tutor','ing','ret','mot','caja','afpq','nua','suc','clas','cargo','modal','tcont','dias','horas'], r))
        ci = x['ci'].strip(); t = T.get(ci)
        if not t: out.append(dict(archivo=f, ci=ci, problema='CI no está en la base', nombre=f"{x['ap']} {x['am']} {x['nom']}")); continue
        ovt = dict(ci_expedido=(x['exp'].strip() or None), fecha_nacimiento=fecha(x['nac']), ap_paterno=x['ap'].strip() or None, ap_materno=x['am'].strip() or None,
                   nombres=x['nom'].strip(), pais_nacionalidad=x['pais'].strip(), sexo=x['sexo'].strip(), tipo_documento={'CI':'CI','PASAPORTE':'PASAPORTE'}.get(x['tdoc'].strip(),x['tdoc'].strip()),
                   jubilado=x['jub']=='1', aporta_gestora=x['afp']=='1', discapacidad=x['disc']=='1', tutor_discapacidad=x['tutor']=='1', nua_cua=x['nua'].strip() or None)
        cur = dict(ci_expedido=t['ci_expedido'], fecha_nacimiento=t['fn'], ap_paterno=t['ap_paterno'], ap_materno=t['ap_materno'], nombres=t['nombres'],
                   pais_nacionalidad=t['pais_nacionalidad'], sexo=t['sexo'], tipo_documento=t['tipo_documento'], jubilado=t['jubilado'], aporta_gestora=t['aporta_gestora'],
                   discapacidad=t['discapacidad'], tutor_discapacidad=t['tutor_discapacidad'], nua_cua=t['nua_cua'])
        ing = fecha(x['ing'])
        vs = [v for v in V if v['trabajador_id']==t['id'] and v['fi']==ing] or [v for v in V if v['trabajador_id']==t['id'] and v['fr'] is None]
        v = vs[0] if vs else None
        lab_ovt = dict(ocupacion=x['cargo'].strip(), modalidad_contrato=int(x['modal']), tipo_contrato=int(x['tcont']), horas_dia=int(x['horas']), fecha_ingreso=ing, fecha_retiro=fecha(x['ret']))
        lab_cur = dict(ocupacion=v and v['ocupacion'], modalidad_contrato=v and v['modalidad_contrato'], tipo_contrato=v and v['tipo_contrato'], horas_dia=v and v['horas_dia'], fecha_ingreso=v and v['fi'], fecha_retiro=v and v['fr'])
        dif = {k:(cur[k],ovt[k]) for k in ovt if (cur[k] or None)!=(ovt[k] or None) and not (k in('ap_paterno','ap_materno','nombres') and (cur[k] or '').upper()==(ovt[k] or '').upper())}
        difl = {k:(lab_cur[k],lab_ovt[k]) for k in lab_ovt if (lab_cur[k] or None)!=(lab_ovt[k] or None)}
        if dif or difl: out.append(dict(archivo=f, emp=emp, codigo=t['codigo'], tid=t['id'], vid=v and v['id'], vemp=v and v['emp'], personal=dif, laboral=difl))
json.dump(out, open('/tmp/claude-0/diff_ovt.json','w'), ensure_ascii=False, indent=1, default=str)
for o in out: print(json.dumps(o, ensure_ascii=False, default=str))
