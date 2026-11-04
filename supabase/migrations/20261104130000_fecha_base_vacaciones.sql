-- Migración 25: fecha exclusiva para calcular las vacaciones (si no se carga, se usa la fecha de ingreso del vínculo).
alter table vinculo add column if not exists fecha_base_vacaciones date;

-- Limpieza: referencias ilegibles que venían de SIDPLAN (╠╠╠…)
update vacacion_mov set referencia = null where referencia ~ '^╠+$';
