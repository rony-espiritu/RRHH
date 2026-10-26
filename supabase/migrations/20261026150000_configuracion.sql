-- Migración 9: configuración editable — cuentas Albor en tabla y tipo contable por concepto.
create table if not exists cuenta_albor (
  clave    varchar(20) primary key,     -- GASTO_UN_02, GASTO_COMEC, LIQUIDO, 517, 913…
  grupo    varchar(10) not null,        -- GASTO (prefijo de 6 dígitos + sufijo del concepto) o PASIVO (cuenta completa)
  cuenta   varchar(14) not null,
  detalle  varchar(60) not null,
  orden    smallint default 100
);
alter table cuenta_albor enable row level security;
insert into cuenta_albor (clave, grupo, cuenta, detalle, orden) values
 ('GASTO_UN_02',  'GASTO',  '510101',    'Gasto Unidad de negocio 02 (producción)', 1),
 ('GASTO_UN_11',  'GASTO',  '510101',    'Gasto Unidad de negocio 11', 2),
 ('GASTO_UN_80',  'GASTO',  '530201',    'Gasto Unidad de negocio 80 (estructura)', 3),
 ('GASTO_UN_81',  'GASTO',  '530101',    'Gasto Unidad de negocio 81 (administración)', 4),
 ('GASTO_UN_50',  'GASTO',  '520407000', 'Gasto Unidad de negocio 50 (cuenta completa, sin sufijo)', 5),
 ('GASTO_COMEC',  'GASTO',  '520101',    'Gasto centros de comercialización (COMEC…)', 6),
 ('GASTO_OTRA',   'GASTO',  '530201',    'Gasto otra unidad de negocio', 7),
 ('LIQUIDO',      'PASIVO', '210106001', 'Liquido Pagable', 20),
 ('CTA_CTE',      'PASIVO', '210106000', 'Cuenta corriente personal', 21),
 ('511',          'PASIVO', '210106000', 'Anticipos', 22),
 ('517',          'PASIVO', '210107004', 'Gestora Publica', 23),
 ('513',          'PASIVO', '210107004', 'Gestora Publica', 24),
 ('525',          'PASIVO', '210107004', 'Fondo Solidario', 25),
 ('508',          'PASIVO', '110305005', 'Amortización Préstamo Interno', 26),
 ('521',          'PASIVO', '21010200401', 'Aporte Cooperativa', 27),
 ('506',          'PASIVO', '21010200402', 'Amortización Préstamo Coop.', 28),
 ('507',          'PASIVO', '21010200403', 'Interés Préstamo Coop.', 29),
 ('910',          'PASIVO', '210107001', 'Caja Nal.Salud, CORDES Ap.Pat', 30),
 ('911',          'PASIVO', '210107002', 'Pro Vivienda, Aporte Patronal', 31),
 ('912',          'PASIVO', '210107003', 'S.I.P. Aporte Patronal', 32),
 ('913',          'PASIVO', '210106002', 'Prev.Aguinaldo', 33),
 ('914',          'PASIVO', '220101001', 'Prev.Indeminizacion', 34)
on conflict (clave) do nothing;

-- Sufijo contable de los ingresos tal como se sube hoy a Albor (001 remuneraciones, 002 horas extra, 006 premios y bonos).
update concepto set tipo_contable = case when codigo = 4 then '002' else '001' end where planilla = 'B1' and naturaleza = 'INGRESO';
update concepto set tipo_contable = case when codigo = 7 then '002' when codigo in (11, 14, 25) then '006' else '001' end where planilla = 'B2' and naturaleza = 'INGRESO';

-- Notas de los parámetros (se muestran en Configuración)
update parametro set nota = 'Riesgo profesional patronal para 65 años o más (0 = no aplica)' where clave = 'RIESGO_PAT_65';
-- La previsión de indemnización B2 usa su propia marca (misma base que aguinaldo: el abono).
update concepto set afecta_indemn = true where planilla = 'B2' and codigo = 2;
