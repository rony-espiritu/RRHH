-- Migración 19: inicio de sesión con correo y contraseña.
alter table usuario add column if not exists clave_hash text;                       -- scrypt (la contraseña nunca se guarda)
alter table usuario add column if not exists debe_cambiar_clave boolean default false;
alter table usuario add column if not exists intentos_fallidos smallint default 0;
alter table usuario add column if not exists bloqueado_hasta timestamptz;
alter table usuario add column if not exists ultimo_ingreso timestamptz;
alter table usuario add column if not exists creado_en timestamptz default now();
create unique index if not exists usuario_email_min on usuario (lower(email));
alter table usuario enable row level security;
alter table usuario_empresa enable row level security;
