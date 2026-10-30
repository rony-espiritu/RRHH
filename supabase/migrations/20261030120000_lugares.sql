-- Migración 18: lugar físico de trabajo (agrupa centros de costo) para la distribución de pagos.
create table if not exists lugar (
  id      serial primary key,
  codigo  varchar(4) not null unique,      -- A, B, C… (orden del resumen)
  nombre  varchar(40) not null,
  orden   smallint default 1
);
alter table lugar enable row level security;
insert into lugar (codigo, nombre, orden) values ('A', 'Santa Cruz', 1), ('B', 'San Borja', 2), ('C', 'Espíritu', 3) on conflict (codigo) do nothing;

alter table centro_costo add column if not exists lugar_id int references lugar(id);
alter table centro_costo add column if not exists rubro varchar(40);   -- fila del resumen de distribución (p. ej. "Espíritu Producción")

update centro_costo c set lugar_id = l.id, rubro = coalesce(c.rubro, x.rubro)
from (values
  ('ADMCONLP', 'A', 'Santa Cruz'), ('SERGANSC', 'A', 'Santa Cruz'), ('ADMCONSC', 'A', 'Santa Cruz'), ('SERBASSC', 'A', 'Santa Cruz'),
  ('ADMCONLB', 'B', 'La Bajura'), ('ESTRULBJ', 'B', 'La Bajura'), ('PRODULBJ', 'B', 'La Bajura'), ('COMECLBJ', 'B', 'La Bajura'), ('COMERBJA', 'B', 'La Bajura'),
  ('ADMCONSP', 'B', 'San Pablo'), ('PRODPSUR', 'B', 'Surenda'), ('PRODASUR', 'B', 'Surenda'),
  ('PRODAESP', 'C', 'Espíritu Administración'), ('ESTRUESP', 'C', 'Espíritu Estructura'), ('PRODPESP', 'C', 'Espíritu Producción'),
  ('COMERESP', 'C', 'Espíritu Producción'), ('PRODUDOL', 'C', 'Dolores')
) x(cc, lugar, rubro)
join lugar l on l.codigo = x.lugar
where c.codigo = x.cc and c.lugar_id is null;
