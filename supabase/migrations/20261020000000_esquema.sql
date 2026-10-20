-- =====================================================================
-- ERP RRHH Estancias Espíritu — Esquema de base de datos (PostgreSQL)
-- Versión 0.2 — 20/10/2026 (aprobación separada B1/B2, tasas por trabajador, campaña jul-jun)
-- Multiempresa, dos planillas (B1 oficial / B2 cuenta corriente),
-- historial por periodo y trazabilidad completa.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
create type tipo_planilla      as enum ('B1','B2');
create type tipo_empresa       as enum ('OFICIAL','SOLO_B2');           -- EESP = SOLO_B2
create type forma_pago         as enum ('BANCO_UNION','BNB','EFECTIVO');
create type naturaleza_concepto as enum ('INGRESO','DESCUENTO','APORTE_PATRONAL','PROVISION','INFORMATIVO');
create type modo_calculo       as enum (
  'DIAS_SUELDO',        -- sueldo × días/30 (básico B1, abono B2)
  'MONTO_FIJO',         -- monto fijo mensual (bono nivel, puestero…)
  'MONTO_FIJO_PRORRATA',-- monto fijo × días/30
  'HORAS_FACTOR',       -- (base/30/8) × horas × factor (horas extra)
  'PORC_BASE',          -- % sobre una base (Gestora, solidario, Caja…)
  'ANTIGUEDAD',         -- 3 SMN × % tabla × días/30
  'RCIVA',              -- cálculo impositivo con saldos
  'SOLIDARIO_PROG',     -- aporte nacional solidario por tramos
  'IMPORTADO',          -- viene del Excel de Albor (anticipos, préstamos)
  'MANUAL');            -- monto digitado en novedades
create type estado_periodo     as enum ('ABIERTO','NOVEDADES','CALCULADO','EN_REVISION','APROBADO','CERRADO','ANULADO');
create type tipo_periodo       as enum ('MENSUAL','AGUINALDO','RETROACTIVO','FINIQUITO','PRIMA');
create type rol_usuario        as enum ('ADMIN','RRHH','GERENCIA','CONSULTA','TRABAJADOR');
create type origen_novedad     as enum ('MANUAL','ALBOR','SISTEMA','RELOJ');

-- ---------------------------------------------------------------------
-- 2. ORGANIZACIÓN (multiempresa)
-- ---------------------------------------------------------------------
create table empresa (
  id                 serial primary key,
  codigo             varchar(8)  not null unique,       -- CAP, CHI, DOL, ESP, MOT, TAR, TRAN, BASP, EESP, CAPBBR…
  razon_social       varchar(120) not null,             -- "MIREILLE ANGELA PETIT BAUER - Capiguara"
  propietario        varchar(120),
  estancia           varchar(60),                       -- Capiguara, Espíritu…
  tipo               tipo_empresa not null default 'OFICIAL',
  nit                varchar(20),
  nro_empleador_mintrab varchar(30),                    -- 2225195019-01
  nro_empleador_caja varchar(30),                       -- 080-0 12-331
  caja_salud         varchar(40) default 'CORDES',
  direccion          varchar(150),
  telefonos          varchar(60),
  rep_legal_nombre   varchar(120),
  rep_legal_ci       varchar(20),
  banco_pago         forma_pago default 'BANCO_UNION',
  calcula_rciva      boolean default false,
  vigente_desde      date not null default current_date,
  vigente_hasta      date,                               -- cierre al cambiar de propietario
  empresa_anterior_id int references empresa(id),        -- p.ej. CAPBBR sucede a CAP
  activo             boolean default true
);

create table centro_costo (
  id                 serial primary key,
  codigo             varchar(10) not null unique,        -- PRODPESP
  descripcion        varchar(80) not null,
  albor_cc           varchar(6) not null,                -- 01, 02, 03, 80, 81
  albor_unidad_negocio varchar(6) not null,              -- 02, 11, 80, 81, 50
  activo             boolean default true
);

create table area     (id serial primary key, codigo varchar(6) unique, descripcion varchar(60));
create table cargo    (id serial primary key, codigo varchar(8) unique, descripcion varchar(80) not null,
                       clasificacion_ovt smallint);        -- columna "Clasificación laboral" OVT
create table nivel_salarial (id serial primary key, codigo smallint unique, descripcion varchar(60), monto numeric(12,2));

-- ---------------------------------------------------------------------
-- 3. PARÁMETROS VERSIONADOS (nunca se sobreescriben: se agrega vigencia)
-- ---------------------------------------------------------------------
create table parametro (
  id            serial primary key,
  clave         varchar(40) not null,                    -- SMN, GESTORA_LAB, SOLIDARIO_LAB, CAJA_PAT, RIESGO_PAT, PROVIV_PAT,
                                                         -- SOLIDARIO_PAT, PREV_AGUINALDO, PREV_INDEMN, RCIVA_TASA, RCIVA_MIN_SMN
  valor         numeric(14,6) not null,
  vigente_desde date not null,
  nota          text,
  unique (clave, vigente_desde)
);

create table tabla_antiguedad (
  id serial primary key, anios_desde smallint not null, anios_hasta smallint, porcentaje numeric(5,2) not null,
  vigente_desde date not null default '2000-01-01'
);

create table tramo_solidario (                           -- aporte nacional solidario laboral progresivo
  id serial primary key, desde numeric(12,2) not null, porcentaje numeric(5,2) not null, vigente_desde date not null
);

-- ---------------------------------------------------------------------
-- 4. CONCEPTOS Y CONTABILIDAD
-- ---------------------------------------------------------------------
create table concepto (
  id              serial primary key,
  codigo          smallint not null,                     -- se respetan códigos SIDPLAN (002, 008, 024, 513…)
  planilla        tipo_planilla not null,
  nombre          varchar(60) not null,
  naturaleza      naturaleza_concepto not null,
  modo            modo_calculo not null,
  factor          numeric(10,4) default 1,               -- factor HE, % fijo, etc.
  parametro_clave varchar(40),                            -- si el % sale de la tabla parametro
  base_conceptos  smallint[],                             -- conceptos que forman la base (p.ej. HE sobre 002+008)
  cotizable       boolean default false,                  -- suma a total ganado para Gestora/Caja
  afecta_rciva    boolean default false,
  afecta_aguinaldo boolean default false,
  afecta_indemn   boolean default false,
  prorratea_dias  boolean default false,
  columna_ovt     varchar(40),                            -- 'Haber Básico','Bono de antigüedad','Monto horas extra','Otros bonos y pagos'…
  columna_boleta  varchar(30),
  tipo_contable   char(3),                                -- 001 remun, 002 extra, 003 cargas, 004 finiq, 006 bonos, 007 otros
  orden           smallint default 100,
  activo          boolean default true,
  unique (planilla, codigo)
);

create table regla_contable (                             -- matriz editable concepto × unidad de negocio → cuenta Albor
  id               serial primary key,
  concepto_id      int references concepto(id),           -- null = regla general por tipo_contable
  tipo_contable    char(3),
  albor_unidad_negocio varchar(6),                        -- null = cualquiera
  cuenta_debe      varchar(14),
  cuenta_haber     varchar(14),
  cc_haber         varchar(6) default '150',
  un_haber         varchar(6) default 'PAT',
  prioridad        smallint default 100
);

-- ---------------------------------------------------------------------
-- 5. PERSONAL
-- ---------------------------------------------------------------------
create table trabajador (
  id                serial primary key,
  codigo            varchar(8) not null unique,           -- MS1111 (un solo código en B1, B2 y Baspel)
  ci                varchar(15) not null unique,
  ci_expedido       varchar(3),
  ci_complemento    varchar(5),
  ap_paterno        varchar(40),
  ap_materno        varchar(40),
  nombres           varchar(60) not null,
  fecha_nacimiento  date,
  sexo              char(1) check (sexo in ('M','F')),
  estado_civil      char(1),
  nacionalidad      varchar(30) default 'Boliviana',
  direccion         varchar(150),
  telefono          varchar(20),
  email             varchar(80),
  nua_cua           varchar(15),                          -- opcional (no todos aportan)
  nro_asegurado     varchar(20),
  jubilado          boolean default false,
  aporta_gestora    boolean default true,
  discapacidad      boolean default false,
  tutor_discapacidad boolean default false,
  grupo_sanguineo   varchar(3),
  contacto_emergencia varchar(100),
  fecha_ingreso_grupo date,                               -- primer ingreso a cualquier empresa del grupo (historial real)
  foto_url          text,
  activo            boolean default true,
  creado_en         timestamptz default now()
);

create table trabajador_pago (                            -- forma de pago versionada
  id            serial primary key,
  trabajador_id int not null references trabajador(id),
  planilla      tipo_planilla not null default 'B1',
  forma         forma_pago not null,
  nro_cuenta    varchar(20),
  vigente_desde date not null,
  vigente_hasta date
);

-- Relación laboral con UNA empresa. Cambiar de empresa = cerrar vínculo y abrir otro.
create table vinculo (
  id               serial primary key,
  trabajador_id    int not null references trabajador(id),
  empresa_id       int not null references empresa(id),          -- empresa B1 (oficial). B2 la hereda.
  empresa_b2_id    int references empresa(id),                    -- solo si difiere (EESP para quienes no están en B1)
  en_b1            boolean not null default true,
  en_b2            boolean not null default true,
  fecha_ingreso    date not null,                                  -- base de antigüedad legal
  fecha_retiro     date,
  motivo_retiro    smallint,                                       -- código OVT
  tipo_finiquito   varchar(8),                                     -- FINI1, FINI2, FINI3, QUIN, RETIRO, VOLUNT
  cargo_id         int references cargo(id),
  ocupacion        varchar(60),                                    -- "Vaquero" (texto en planilla/OVT)
  area_id          int references area(id),
  nivel_id         int references nivel_salarial(id),
  modalidad_contrato smallint default 2,                           -- códigos OVT
  tipo_contrato    smallint default 1,
  horas_dia        smallint default 8,
  observacion      text
);
create index on vinculo (trabajador_id) where fecha_retiro is null;

create table asignacion_cc (                              -- distribución a centros de costo, versionada por campaña
  id            serial primary key,
  vinculo_id    int not null references vinculo(id),
  centro_costo_id int not null references centro_costo(id),
  planilla      tipo_planilla,                            -- null = aplica a B1 y B2
  porcentaje    numeric(5,2) not null default 100,
  albor_cc      varchar(6),                               -- si se indica, reemplaza el CC Albor del centro de costo
  albor_unidad_negocio varchar(6),                        -- idem unidad de negocio (p.ej. reparto de Pardo en 4 destinos)
  vigente_desde date not null,                            -- normalmente 1 de julio (inicio de campaña)
  vigente_hasta date
);

create table tasa_trabajador (                            -- excepción de una tasa para un trabajador (p.ej. solidario fijo, Gestora >65)
  id            serial primary key,
  trabajador_id int not null references trabajador(id),
  parametro_clave varchar(40) not null,                   -- SOLIDARIO_LAB, GESTORA_LAB…
  valor         numeric(14,6) not null,
  vigente_desde date not null,
  vigente_hasta date,
  motivo        varchar(120)
);

create table concepto_fijo (                              -- sueldo B1, bono nivel, abono B2, puestero, aporte coop…
  id            serial primary key,
  vinculo_id    int not null references vinculo(id),
  concepto_id   int not null references concepto(id),
  cantidad      numeric(12,2),                            -- días (30) u horas
  monto         numeric(12,2),
  vigente_desde date not null,
  vigente_hasta date,
  motivo        varchar(100)                              -- "Incremento salarial 2026", "Cambio de nivel"
);

create table dependiente (
  id serial primary key, trabajador_id int references trabajador(id),
  nombre varchar(100), fecha_nacimiento date, parentesco char(1), ci varchar(15)
);

create table tipo_documento (codigo varchar(4) primary key, descripcion varchar(60));
create table documento (
  id serial primary key, trabajador_id int references trabajador(id), tipo varchar(4) references tipo_documento(codigo),
  descripcion varchar(120), fecha date, vence date, archivo_url text, subido_por uuid, subido_en timestamptz default now()
);

create table vacacion_mov (                               -- kardex de vacaciones
  id serial primary key, vinculo_id int references vinculo(id),
  fecha_desde date, fecha_hasta date, dias numeric(5,2) not null,   -- + devengado / − gozado o pagado
  tipo varchar(12) not null,                              -- DEVENGADO, GOZADO, PAGADO, AJUSTE, SALDO_INICIAL
  referencia varchar(120)
);

-- ---------------------------------------------------------------------
-- 6. PERIODOS Y NOVEDADES
-- ---------------------------------------------------------------------
create table periodo (
  id            serial primary key,
  anio          smallint not null,
  mes           smallint not null check (mes between 1 and 12),
  tipo          tipo_periodo not null default 'MENSUAL',
  estado_b1     estado_periodo not null default 'ABIERTO',   -- B1 y B2 se aprueban por separado
  estado_b2     estado_periodo not null default 'ABIERTO',
  fecha_inicio  date not null,
  fecha_fin     date not null,
  fecha_pago_b1 date,
  fecha_pago_b2 date,
  campana_albor varchar(5),                               -- '26/27': julio a junio (parametro CAMPANA_MES_INICIO = 7)
  ufv_inicio    numeric(10,5),
  ufv_fin       numeric(10,5),
  tc_usd        numeric(8,4),
  creado_por    uuid, creado_en timestamptz default now(),
  unique (anio, mes, tipo)
);

create table novedad (                                    -- todo lo variable del mes
  id            bigserial primary key,
  periodo_id    int not null references periodo(id),
  vinculo_id    int not null references vinculo(id),
  concepto_id   int not null references concepto(id),
  cantidad      numeric(12,2),                            -- horas extra, días falta…
  monto         numeric(12,2),
  origen        origen_novedad not null default 'MANUAL',
  importacion_id int,
  nota          varchar(150),
  creado_por    uuid, creado_en timestamptz default now()
);
create index on novedad (periodo_id, vinculo_id);

create table importacion (                                -- Excel de Albor (anticipos/préstamos), F-110, etc.
  id            serial primary key,
  periodo_id    int references periodo(id),
  tipo          varchar(20) not null,                     -- ALBOR_CTA_CTE, ALBOR_ANTICIPOS, F110
  archivo_nombre varchar(150), archivo_url text,
  filas_ok      int, filas_error int, log jsonb,
  creado_por    uuid, creado_en timestamptz default now()
);

create table rciva_declaracion (                          -- Form. 110 presentado por el dependiente
  id serial primary key, periodo_id int references periodo(id), trabajador_id int references trabajador(id),
  monto_facturas numeric(12,2) not null, fecha_presentacion date
);

-- ---------------------------------------------------------------------
-- 7. RESULTADOS DEL CÁLCULO (inmutables al cerrar)
-- ---------------------------------------------------------------------
create table planilla_trabajador (
  id              bigserial primary key,
  periodo_id      int not null references periodo(id),
  planilla        tipo_planilla not null,
  vinculo_id      int not null references vinculo(id),
  empresa_id      int not null references empresa(id),     -- foto al momento del cálculo
  centro_costo_id int references centro_costo(id),
  cargo_texto     varchar(60),
  dias_pagados    numeric(5,2),
  horas_dia       smallint,
  total_ganado    numeric(12,2),
  total_cotizable numeric(12,2),
  total_descuentos numeric(12,2),
  liquido         numeric(12,2),
  forma_pago      forma_pago,
  nro_cuenta      varchar(20),
  es_alta         boolean default false,
  es_baja         boolean default false,
  calculado_en    timestamptz default now(),
  unique (periodo_id, planilla, vinculo_id)
);

create table planilla_linea (
  id              bigserial primary key,
  planilla_trabajador_id bigint not null references planilla_trabajador(id) on delete cascade,
  concepto_id     int not null references concepto(id),
  cantidad        numeric(12,2),
  base            numeric(12,2),
  tasa            numeric(10,6),
  monto           numeric(12,2) not null,
  detalle         jsonb                                   -- traza del cálculo (fórmula, parámetros usados)
);

create table rciva_saldo (                                -- saldo a favor del dependiente, arrastre mensual
  id serial primary key, trabajador_id int references trabajador(id), periodo_id int references periodo(id),
  saldo_anterior numeric(12,2), actualizacion numeric(12,2), credito_mes numeric(12,2),
  impuesto_mes numeric(12,2), retenido numeric(12,2), saldo_siguiente numeric(12,2)
);

create table asiento_albor (                              -- líneas listas para exportar a Albor
  id bigserial primary key, periodo_id int references periodo(id), planilla tipo_planilla, grupo varchar(10), -- P1, B2, PREV
  fecha date, observaciones varchar(60), escenario varchar(2) default '01',
  debe numeric(14,2) default 0, haber numeric(14,2) default 0,
  detalle varchar(60), cuenta varchar(14), campana varchar(5), centro_costo varchar(6),
  personal varchar(8) default '00', unidad_negocio varchar(6)
);

-- ---------------------------------------------------------------------
-- 8. USUARIOS, APROBACIONES Y AUDITORÍA
-- ---------------------------------------------------------------------
create table usuario (
  id            uuid primary key default gen_random_uuid(),
  email         varchar(120) unique not null,
  nombre        varchar(100),
  rol           rol_usuario not null,
  trabajador_id int references trabajador(id),            -- para el portal del trabajador
  activo        boolean default true
);
create table usuario_empresa (usuario_id uuid references usuario(id), empresa_id int references empresa(id),
                              primary key (usuario_id, empresa_id));

create table aprobacion (
  id serial primary key, periodo_id int references periodo(id), planilla tipo_planilla not null, usuario_id uuid references usuario(id),
  accion varchar(20) not null,                             -- CALCULAR, ENVIAR_REVISION, APROBAR, OBSERVAR, CERRAR, REABRIR
  comentario text, fecha timestamptz default now()
);

create table auditoria (
  id bigserial primary key, tabla varchar(40), registro_id text, accion varchar(10),
  antes jsonb, despues jsonb, usuario_id uuid, fecha timestamptz default now()
);

-- Regla de oro: un periodo CERRADO no admite cambios en novedad / planilla_*.
create or replace function bloquear_periodo_cerrado() returns trigger language plpgsql as $$
declare est estado_periodo; pl tipo_planilla;
begin
  if tg_table_name = 'novedad' then
    select c.planilla into pl from concepto c
     where c.id = (case when tg_op = 'DELETE' then old.concepto_id else new.concepto_id end);
  elsif tg_op = 'DELETE' then pl := old.planilla;
  else pl := new.planilla;
  end if;
  select case when pl = 'B1' then estado_b1 else estado_b2 end into est
    from periodo where id = (case when tg_op = 'DELETE' then old.periodo_id else new.periodo_id end);
  if est in ('APROBADO','CERRADO') then
    raise exception 'El periodo está %, no se puede modificar', est;
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_novedad_bloqueo before insert or update or delete on novedad
  for each row execute function bloquear_periodo_cerrado();
create trigger trg_planilla_bloqueo before insert or update or delete on planilla_trabajador
  for each row execute function bloquear_periodo_cerrado();

-- ---------------------------------------------------------------------
-- 9. DATOS SEMILLA (parámetros vigentes a sep-2026)
-- ---------------------------------------------------------------------
insert into parametro (clave, valor, vigente_desde, nota) values
 ('SMN',            3300,   '2026-01-01','Salario mínimo nacional'),
 ('GESTORA_LAB',    0.1221, '2026-01-01','10% vejez + 1.71% riesgo común + 0.5% comisión'),
 ('SOLIDARIO_LAB',  0.005,  '2026-01-01','Aporte solidario laboral'),
 ('CAJA_PAT',       0.10,   '2026-01-01','Caja CORDES patronal'),
 ('RIESGO_PAT',     0.0171, '2026-01-01','Riesgo profesional'),
 ('PROVIV_PAT',     0.02,   '2026-01-01','Pro Vivienda'),
 ('SOLIDARIO_PAT',  0.035,  '2026-01-01','Aporte solidario patronal'),
 ('PREV_AGUINALDO', 0.0833,'2026-01-01','Provisión aguinaldo'),
 ('PREV_INDEMN',    0.0833,'2026-01-01','Previsión indemnización'),
 ('RCIVA_TASA',     0.13,   '2026-01-01','RC-IVA'),
 ('RCIVA_MIN_SMN',  2,      '2026-01-01','Mínimo no imponible = 2 SMN'),
 ('GESTORA_LAB_65', 0.105,  '2026-01-01','Gestora laboral para 65 años o más (sin riesgo común)'),
 ('EDAD_GESTORA_REDUCIDA', 65, '2026-01-01','Edad desde la que aplica GESTORA_LAB_65'),
 ('HE_FACTOR_B1',   1,      '2026-01-01','Factor de hora extra B1 (práctica actual: valor simple)'),
 ('CAMPANA_MES_INICIO', 7,  '2026-01-01','La campaña Albor va de julio a junio');

insert into tramo_solidario (desde, porcentaje, vigente_desde) values
 (13000, 1, '2026-01-01'), (25000, 5, '2026-01-01'), (35000, 10, '2026-01-01');

insert into tabla_antiguedad (anios_desde, anios_hasta, porcentaje) values
 (2,4,5),(5,7,11),(8,10,18),(11,14,26),(15,19,34),(20,24,42),(25,null,50);

insert into tipo_documento values ('CI','Carnet de Identidad'),('CM','Certificado de Matrimonio'),
 ('CN','Certificado de Nacimiento'),('CS','Carnet de Salud CORDES'),('VA','Formulario de Vacación'),
 ('CT','Contrato de trabajo'),('FQ','Finiquito');

-- ---------------------------------------------------------------------
-- 10. SEGURIDAD (Supabase): RLS activo en todas las tablas.
-- Sin políticas = nadie accede con la clave pública; la app usa el servidor.
-- Las políticas por rol (RRHH, Gerencia, trabajador) se agregan con las pantallas.
-- ---------------------------------------------------------------------
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;
