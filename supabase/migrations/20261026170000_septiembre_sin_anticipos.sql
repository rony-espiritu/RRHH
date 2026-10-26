-- Migración 10: simulación del proceso B2 de septiembre 2026 desde el inicio del mes.
-- Se quitan los anticipos (cuenta corriente, 511) que venían de SIDPLAN: se volverán a cargar importando el detalle de Albor.
-- Quedan las horas extra, faltas y cuotas de préstamos, que ya se conocen al inicio del mes.
delete from novedad n using concepto c, periodo p
where c.id = n.concepto_id and p.id = n.periodo_id and p.anio = 2026 and p.mes = 9 and p.tipo = 'MENSUAL'
  and c.planilla = 'B2' and c.codigo = 511 and n.origen = 'SISTEMA';
update periodo set estado_b2 = 'NOVEDADES' where anio = 2026 and mes = 9 and tipo = 'MENSUAL' and estado_b2 in ('CALCULADO', 'EN_REVISION');
