-- Migración 14: módulo de Cooperativa y préstamos (préstamos con amortización e interés automáticos y cuentas de ahorro).
create table if not exists prestamo_tipo (
  codigo varchar(2) primary key, nombre varchar(40) not null, concepto_amort smallint not null, concepto_int smallint not null, es_cooperativa boolean default false
);
insert into prestamo_tipo values
 ('CO', 'Cooperativa', 506, 507, true), ('DE', 'Atención dental', 508, 509, false), ('MO', 'Compra motorizado', 508, 509, false),
 ('PI', 'Préstamos internos', 508, 509, false), ('SA', 'Saldo deudor gestión anterior', 508, 509, false)
on conflict (codigo) do nothing;

create table if not exists prestamo (
  id             serial primary key,
  trabajador_id  int not null references trabajador(id),
  tipo           varchar(2) not null references prestamo_tipo(codigo),
  descripcion    varchar(60),
  fecha          date not null,
  moneda         varchar(3) not null default 'BS' check (moneda in ('BS', 'USD')),
  capital        numeric(14,2) not null check (capital > 0),
  cuota          numeric(14,2) not null check (cuota > 0),        -- amortización de capital por periodo
  tasa_mensual   numeric(8,4) not null default 0,                  -- % mensual
  tipo_interes   char(1) not null default 'S',                     -- S = sobre saldo, P = sobre capital original
  planilla       tipo_planilla not null default 'B2',
  estado         varchar(10) not null default 'ACTIVO' check (estado in ('ACTIVO', 'PAGADO', 'ANULADO')),
  nota           text,
  creado_en      timestamptz default now()
);
create table if not exists prestamo_pago (
  id           bigserial primary key,
  prestamo_id  int not null references prestamo(id) on delete cascade,
  periodo_id   int references periodo(id),
  fecha        date not null,
  capital      numeric(14,2) not null,                             -- en la moneda del préstamo
  interes      numeric(14,2) not null default 0,
  tipo         varchar(10) not null check (tipo in ('PLANILLA', 'EXTERNO', 'MIGRACION')),
  nota         text
);
create index if not exists prestamo_pago_prestamo on prestamo_pago (prestamo_id);
create table if not exists ahorro_mov (
  id             bigserial primary key,
  trabajador_id  int not null references trabajador(id),
  fecha          date not null,
  tipo           varchar(16) not null check (tipo in ('SALDO_INICIAL', 'APORTE_PLANILLA', 'DEPOSITO', 'RETIRO', 'INTERES', 'AJUSTE')),
  monto          numeric(14,2) not null,                           -- Bs; los retiros en negativo
  periodo_id     int references periodo(id),
  nota           text,
  creado_en      timestamptz default now()
);
create index if not exists ahorro_mov_trab on ahorro_mov (trabajador_id);
alter table prestamo_tipo enable row level security;
alter table prestamo enable row level security;
alter table prestamo_pago enable row level security;
alter table ahorro_mov enable row level security;

-- Préstamos vigentes al 1° de septiembre 2026, desde SIDPLAN (base B2). Lo pagado hasta agosto queda como un pago de migración.
do $$
declare pid int;
begin
if exists (select 1 from prestamo) then return; end if;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2022-12-31', 'BS', 28275.0, 565.5, 0.0, 'S', 'Migrado de SIDPLAN (44 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'MR1902' returning id into pid;
insert into prestamo_pago (prestamo_id, fecha, capital, tipo, nota) values (pid, '2026-08-31', 24882.0, 'MIGRACION', 'Pagado hasta agosto 2026 (SIDPLAN)');
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'CO', 'Cooperativa', '2024-03-18', 'USD', 4310.34, 119.73, 0.5, 'S', 'Migrado de SIDPLAN (29 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'PA0105' returning id into pid;
insert into prestamo_pago (prestamo_id, fecha, capital, tipo, nota) values (pid, '2026-08-31', 3472.17, 'MIGRACION', 'Pagado hasta agosto 2026 (SIDPLAN)');
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'CO', 'Cooperativa', '2024-09-01', 'BS', 20000.0, 833.33, 0.3, 'S', 'Migrado de SIDPLAN (23 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'MS1111' returning id into pid;
insert into prestamo_pago (prestamo_id, fecha, capital, tipo, nota) values (pid, '2026-08-31', 19166.59, 'MIGRACION', 'Pagado hasta agosto 2026 (SIDPLAN)');
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'CO', 'Cooperativa', '2024-10-15', 'BS', 17000.0, 708.33, 0.3, 'S', 'Migrado de SIDPLAN (22 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'BY0912' returning id into pid;
insert into prestamo_pago (prestamo_id, fecha, capital, tipo, nota) values (pid, '2026-08-31', 15583.26, 'MIGRACION', 'Pagado hasta agosto 2026 (SIDPLAN)');
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'CO', 'Cooperativa', '2025-01-30', 'BS', 31680.0, 1056.0, 0.5, 'S', 'Migrado de SIDPLAN (19 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'TD0110' returning id into pid;
insert into prestamo_pago (prestamo_id, fecha, capital, tipo, nota) values (pid, '2026-08-31', 20064.0, 'MIGRACION', 'Pagado hasta agosto 2026 (SIDPLAN)');
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2025-01-15', 'BS', 79224.03, 1320.4, 0.0, 'S', 'Migrado de SIDPLAN (19 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'OA0607' returning id into pid;
insert into prestamo_pago (prestamo_id, fecha, capital, tipo, nota) values (pid, '2026-08-31', 25087.6, 'MIGRACION', 'Pagado hasta agosto 2026 (SIDPLAN)');
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2025-01-15', 'BS', 79224.03, 1320.4, 0.0, 'S', 'Migrado de SIDPLAN (19 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'RJ1706' returning id into pid;
insert into prestamo_pago (prestamo_id, fecha, capital, tipo, nota) values (pid, '2026-08-31', 25087.6, 'MIGRACION', 'Pagado hasta agosto 2026 (SIDPLAN)');
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2025-02-25', 'BS', 11608.59, 322.46, 0.0, 'S', 'Migrado de SIDPLAN (18 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'BI1111' returning id into pid;
insert into prestamo_pago (prestamo_id, fecha, capital, tipo, nota) values (pid, '2026-08-31', 5804.28, 'MIGRACION', 'Pagado hasta agosto 2026 (SIDPLAN)');
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2025-02-25', 'BS', 11608.59, 322.46, 0.0, 'S', 'Migrado de SIDPLAN (18 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'RH1103' returning id into pid;
insert into prestamo_pago (prestamo_id, fecha, capital, tipo, nota) values (pid, '2026-08-31', 5804.28, 'MIGRACION', 'Pagado hasta agosto 2026 (SIDPLAN)');
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2025-02-25', 'BS', 11608.59, 322.46, 0.0, 'S', 'Migrado de SIDPLAN (18 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'RA0902' returning id into pid;
insert into prestamo_pago (prestamo_id, fecha, capital, tipo, nota) values (pid, '2026-08-31', 5804.28, 'MIGRACION', 'Pagado hasta agosto 2026 (SIDPLAN)');
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2025-02-25', 'BS', 11608.59, 322.46, 0.0, 'S', 'Migrado de SIDPLAN (18 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'NE1107' returning id into pid;
insert into prestamo_pago (prestamo_id, fecha, capital, tipo, nota) values (pid, '2026-08-31', 5804.28, 'MIGRACION', 'Pagado hasta agosto 2026 (SIDPLAN)');
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2025-06-30', 'BS', 47099.78, 1308.33, 0.0, 'S', 'Migrado de SIDPLAN (14 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'IV0912' returning id into pid;
insert into prestamo_pago (prestamo_id, fecha, capital, tipo, nota) values (pid, '2026-08-31', 18316.62, 'MIGRACION', 'Pagado hasta agosto 2026 (SIDPLAN)');
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'PI', 'Prestamos Internos', '2025-10-30', 'BS', 8750.0, 729.17, 0.0, 'P', 'Migrado de SIDPLAN (10 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'RD0907' returning id into pid;
insert into prestamo_pago (prestamo_id, fecha, capital, tipo, nota) values (pid, '2026-08-31', 7291.7, 'MIGRACION', 'Pagado hasta agosto 2026 (SIDPLAN)');
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'CO', 'Cooperativa', '2025-12-01', 'BS', 10000.0, 833.33, 0.5, 'S', 'Migrado de SIDPLAN (8 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'FR2906' returning id into pid;
insert into prestamo_pago (prestamo_id, fecha, capital, tipo, nota) values (pid, '2026-08-31', 6666.64, 'MIGRACION', 'Pagado hasta agosto 2026 (SIDPLAN)');
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'CK2102' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'ME0507' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'MR1312' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'MF1005' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'MG2204' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'P', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'RF2404' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'RO0910' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'RO0602' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'TA2407' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'YV0902' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'YR1103' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'P', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'RH1103' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'IJ1510' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'AL1106' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'AW1610' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'VP2208' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 14057.6, 292.87, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'ML1405' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 18743.46, 390.49, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'CF1701' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 18743.46, 390.49, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'MH1002' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 18743.46, 390.49, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'SE1504' returning id into pid;
insert into prestamo (trabajador_id, tipo, descripcion, fecha, moneda, capital, cuota, tasa_mensual, tipo_interes, nota)
  select id, 'MO', 'Compra Motorizado', '2026-08-22', 'BS', 101362.5, 1407.81, 0.0, 'S', 'Migrado de SIDPLAN (0 cuotas pagadas hasta agosto 2026)'
  from trabajador where codigo = 'GJ0405' returning id into pid;
end $$;

-- Depósitos de ahorro fuera de planilla de septiembre 2026 (mayor de Albor, cuenta 21010200401)
insert into ahorro_mov (trabajador_id, fecha, tipo, monto, nota)
select t.id, x.fecha::date, 'DEPOSITO', x.monto, x.nota
from (values ('IV0912', '2026-09-15', 500, 'Albor 26-COB-439 aporte cooperativa sept/26'),
             ('BA2905', '2026-09-30', 200, 'Albor 26-COB-541 aporte cooperativa sept/26')) x(codigo, fecha, monto, nota)
join trabajador t on t.codigo = x.codigo
where not exists (select 1 from ahorro_mov m where m.trabajador_id = t.id and m.tipo = 'DEPOSITO' and m.fecha = x.fecha::date);
