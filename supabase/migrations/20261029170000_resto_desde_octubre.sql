-- Migración 16: la regla del resto menor a 1 rige desde octubre 2026.
-- Septiembre ya se cargó a Albor con la cuota normal (Sandra 833,33); el resto de 0,08 se cobra en octubre.
update parametro set vigente_desde = '2026-10-01' where clave = 'PRESTAMO_RESTO_MINIMO' and vigente_desde = '2026-01-01';
