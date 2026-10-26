-- Migración 8: reglas confirmadas al comparar septiembre 2026.
-- Mayores de 65 años: Gestora laboral 10,5%, SIP patronal 3,5% y ya no se paga el 1,71% de riesgo profesional.
insert into parametro (clave, valor, vigente_desde, nota) values
 ('RIESGO_PAT_65', 0, '2026-01-01', 'Riesgo profesional patronal para mayores de 65 años (no aplica)')
on conflict (clave, vigente_desde) do nothing;
