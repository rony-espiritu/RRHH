-- Migración 26: saldo de vacaciones al 04/11/2026 según "2026_1104_Detalle_vacaciones_GGEE.xlsx" (hojas GGEE y Baspel).
-- Para cada trabajador agrega un AJUSTE con fecha 04/11/2026 = saldo del Excel − saldo del sistema a esa fecha.
-- Las vacaciones registradas después del 04/11/2026 se siguen descontando. Se puede volver a correr: reemplaza el ajuste anterior.
delete from vacacion_mov where referencia = 'Ajuste a saldo Detalle vacaciones 04/11/2026';

with objetivo(codigo, saldo) as (values
  ('AL1106', 6),
  ('AW1610', 9),
  ('BR0501', 11.5),
  ('BI1111', 7),
  ('CF1701', 11),
  ('CK2102', 0),
  ('CR2704', 14),
  ('DH2112', 11),
  ('GJ0405', 15),
  ('IV0912', 48.5),
  ('IJ0609', 15),
  ('IJ1510', 20),
  ('LF0312', 0),
  ('LW2407', 0),
  ('MR1808', 9),
  ('MH1002', 0),
  ('ML1405', 0),
  ('ME0507', 4),
  ('MR1902', 13.5),
  ('MR1312', 12),
  ('MO1504', 14),
  ('MA1805', 10),
  ('MF1005', 14),
  ('MG2204', 9.5),
  ('MS3004', 0),
  ('NE1107', 17),
  ('TF0212', 0),
  ('ND1809', 8.5),
  ('OA0607', 0),
  ('PD2303', 0),
  ('RA0902', 11),
  ('RF2404', 10),
  ('RJ1607', 5),
  ('RO0910', 0),
  ('RH1103', 14),
  ('RJ1706', 0),
  ('RO0602', 0),
  ('RD0907', 9),
  ('SR2401', 14),
  ('SE1504', 3),
  ('TA2407', 0),
  ('VP2208', 0),
  ('YV0902', 0),
  ('YI1402', 14),
  ('YR1103', 0),
  ('PA0105', 2.5),
  ('BA2905', 31.5),
  ('FE2805', 17.5),
  ('CL2104', 52),
  ('TD0110', 12),
  ('RR1512', 6.5),
  ('FR2906', 14.5),
  ('MS1111', 57.5),
  ('BY0912', 20.5)
), base as (
  select v.id vinculo_id, o.saldo, coalesce(v.fecha_base_vacaciones, v.fecha_ingreso) fb
  from objetivo o join trabajador t on t.codigo = o.codigo
  join vinculo v on v.trabajador_id = t.id and v.fecha_retiro is null
), calc as (
  select b.vinculo_id, b.saldo,
         -- derecho: por cada año cumplido 15 días (1 a 4), 20 (5 a 9) y 30 (10 o más), igual que el sistema
         coalesce((select sum(case when k < 5 then 15 when k < 10 then 20 else 30 end)
                   from generate_series(1, extract(year from age(date '2026-11-04', b.fb))::int) k), 0)
         + coalesce((select sum(m.dias) from vacacion_mov m where m.vinculo_id = b.vinculo_id and m.tipo <> 'DEVENGADO'
                     and coalesce(m.fecha_desde, date '2026-11-04') <= date '2026-11-04'), 0) actual
  from base b
)
insert into vacacion_mov (vinculo_id, fecha_desde, fecha_hasta, dias, tipo, referencia)
select vinculo_id, date '2026-11-04', date '2026-11-04', saldo - actual, 'AJUSTE', 'Ajuste a saldo Detalle vacaciones 04/11/2026'
from calc where saldo - actual <> 0;
