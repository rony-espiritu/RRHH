-- Migración 17: limpia cuotas de préstamos duplicadas en septiembre 2026 y evita que se repitan.
begin;
-- 1) Septiembre: se borran todas las cuotas e intereses de préstamos que no sean manuales (SIDPLAN, Albor o generadas);
--    se vuelven a generar con el botón "Volver a generar" (paso 1 de B2).
delete from novedad n using concepto c, periodo p
where c.id = n.concepto_id and p.id = n.periodo_id and p.anio = 2026 and p.mes = 9 and p.tipo = 'MENSUAL'
  and c.codigo in (506, 507, 508, 509) and n.origen in ('SISTEMA', 'ALBOR');
-- 2) Pagos de planilla y aportes de ahorro duplicados (deja uno por préstamo/trabajador y periodo)
delete from prestamo_pago a using prestamo_pago b
where a.tipo = 'PLANILLA' and b.tipo = 'PLANILLA' and a.prestamo_id = b.prestamo_id and a.periodo_id = b.periodo_id and a.id > b.id;
delete from ahorro_mov a using ahorro_mov b
where a.tipo = 'APORTE_PLANILLA' and b.tipo = 'APORTE_PLANILLA' and a.trabajador_id = b.trabajador_id and a.periodo_id = b.periodo_id and a.id > b.id;
create unique index if not exists prestamo_pago_unico_planilla on prestamo_pago (prestamo_id, periodo_id) where tipo = 'PLANILLA';
create unique index if not exists ahorro_mov_unico_aporte on ahorro_mov (trabajador_id, periodo_id) where tipo = 'APORTE_PLANILLA';
-- 3) Saldos iniciales de ahorro: se recalculan para que el saldo al 30/09 siga igual al de Albor (el monto está en la nota)
update ahorro_mov s set monto = round(substring(s.nota from '\(([-0-9.]+)\)$')::numeric
       - coalesce((select sum(m.monto) from ahorro_mov m where m.trabajador_id = s.trabajador_id and m.id <> s.id and m.fecha <= '2026-09-30'), 0), 2)
where s.tipo = 'SALDO_INICIAL' and s.nota like 'Saldo inicial para cuadrar con Albor al 2026-09-30 (%)';
commit;
