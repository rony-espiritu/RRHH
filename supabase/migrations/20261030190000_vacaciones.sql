-- Migración 20: solicitudes de vacación (desde el celular del trabajador o cargadas por RRHH) y acceso del trabajador.
create table if not exists vacacion_solicitud (
  id              serial primary key,
  trabajador_id   int not null references trabajador(id),
  vinculo_id      int not null references vinculo(id),
  fecha_solicitud date not null default current_date,
  desde           date not null,
  hasta           date not null,
  retorno         date,
  dias            numeric(5,2) not null check (dias > 0),
  saldo_antes     numeric(6,2),                        -- días pendientes al momento de solicitar
  observaciones   text,
  estado          varchar(10) not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'ANULADA')),
  creado_por      uuid references usuario(id),
  creado_en       timestamptz default now(),
  revisado_por    uuid references usuario(id),
  revisado_en     timestamptz,
  motivo_rechazo  text,
  vacacion_mov_id int references vacacion_mov(id) on delete set null,   -- el descuento en el kardex al aprobar
  check (hasta >= desde)
);
create index if not exists vacacion_solicitud_estado on vacacion_solicitud (estado);
create index if not exists vacacion_solicitud_trab on vacacion_solicitud (trabajador_id);
alter table vacacion_solicitud enable row level security;

-- Un trabajador = un usuario como máximo
create unique index if not exists usuario_trabajador on usuario (trabajador_id) where trabajador_id is not null;

