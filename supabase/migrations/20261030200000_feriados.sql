-- Migración 21: feriados (no cuentan como día de vacación) y medio día en las solicitudes.
create table if not exists feriado (
  fecha       date not null,
  descripcion varchar(80) not null,
  lugares     varchar(20),                 -- null = todo el país; si no, códigos de lugar físico separados por coma (A,B,C)
  primary key (fecha, descripcion)
);
alter table feriado enable row level security;

insert into feriado (fecha, descripcion, lugares) values
  ('2026-01-01', 'Año Nuevo', null),
  ('2026-01-22', 'Día del Estado Plurinacional', null),
  ('2026-02-16', 'Carnaval', null),
  ('2026-02-17', 'Carnaval', null),
  ('2026-04-03', 'Viernes Santo', null),
  ('2026-05-01', 'Día del Trabajo', null),
  ('2026-06-04', 'Corpus Christi', null),
  ('2026-06-21', 'Año Nuevo Andino Amazónico', null),
  ('2026-08-06', 'Día de la Patria', null),
  ('2026-09-24', 'Aniversario de Santa Cruz', 'A'),
  ('2026-11-02', 'Todos Santos', null),
  ('2026-11-18', 'Aniversario del Beni', 'B,C'),
  ('2026-12-25', 'Navidad', null),
  ('2027-01-01', 'Año Nuevo', null),
  ('2027-01-22', 'Día del Estado Plurinacional', null),
  ('2027-02-08', 'Carnaval', null),
  ('2027-02-09', 'Carnaval', null),
  ('2027-03-26', 'Viernes Santo', null),
  ('2027-05-01', 'Día del Trabajo', null),
  ('2027-05-27', 'Corpus Christi', null),
  ('2027-06-21', 'Año Nuevo Andino Amazónico', null),
  ('2027-08-06', 'Día de la Patria', null),
  ('2027-09-24', 'Aniversario de Santa Cruz', 'A'),
  ('2027-11-02', 'Todos Santos', null),
  ('2027-11-18', 'Aniversario del Beni', 'B,C'),
  ('2027-12-25', 'Navidad', null)
on conflict do nothing;

-- Medio día: empieza a la tarde (el primer día cuenta 0,5) / termina a mediodía (el último día cuenta 0,5)
alter table vacacion_solicitud add column if not exists medio_inicio boolean not null default false;
alter table vacacion_solicitud add column if not exists medio_fin boolean not null default false;
