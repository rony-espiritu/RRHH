-- Migración 2: parámetros que usa el motor y saldos RC-IVA de arranque (septiembre 2026, de la planilla impositiva Baspel)
insert into parametro (clave, valor, vigente_desde, nota) values
 ('RCIVA_COMPUTO_SMN', 1, '2026-01-01', '13% de cómputo sobre 1 SMN, como la planilla impositiva actual'),
 ('HE_FACTOR_B2',      1, '2026-01-01', 'Factor de hora extra B2: abono / 240 × horas × factor'),
 ('TC_USD',         6.96, '2026-01-01', 'Tipo de cambio para conceptos en dólares (aporte cooperativa)')
on conflict (clave, vigente_desde) do nothing;

-- Periodo de septiembre 2026 como cierre de SIDPLAN (solo guarda saldos de arranque)
insert into periodo (anio, mes, tipo, estado_b1, estado_b2, fecha_inicio, fecha_fin, campana_albor, ufv_inicio, ufv_fin, tc_usd)
values (2026, 9, 'MENSUAL', 'CERRADO', 'CERRADO', '2026-09-01', '2026-09-30', '26/27', 3.3377, 3.3514, 6.96)
on conflict (anio, mes, tipo) do nothing;

insert into rciva_saldo (trabajador_id, periodo_id, saldo_anterior, actualizacion, credito_mes, impuesto_mes, retenido, saldo_siguiente)
select t.id, p.id, s.ant, s.act, s.cred, s.imp, 0, s.sig
from (values ('MS1111', 71339.34, 292.82, 2151.95, 1068.24, 72715.87),
             ('RR1512',  3130.47,  12.85,    0.00,    0.00,  3143.32)) s(cod, ant, act, cred, imp, sig)
join trabajador t on t.codigo = s.cod
join periodo p on p.anio = 2026 and p.mes = 9 and p.tipo = 'MENSUAL';

alter table planilla_linea add column if not exists codigo smallint;  -- copia del código para reportes rápidos
