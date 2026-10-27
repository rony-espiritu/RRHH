-- Migración 13: en septiembre 2026 los descuentos B1 por saldo de cuenta corriente ahora salen del archivo de saldos de Albor.
-- Se quitan los que venían de SIDPLAN (para no descontarlos dos veces) y quedan como anticipos B1 manuales solo los que no son de cuenta corriente.
delete from novedad n using concepto c, periodo p, vinculo v, trabajador t
where c.id = n.concepto_id and p.id = n.periodo_id and v.id = n.vinculo_id and t.id = v.trabajador_id
  and p.anio = 2026 and p.mes = 9 and p.tipo = 'MENSUAL' and c.planilla = 'B1' and c.codigo = 511 and n.origen = 'SISTEMA'
  and t.codigo not in ('BA2905', 'BY0912', 'CK2102', 'FE2805');
update novedad n set origen = 'MANUAL', nota = 'Anticipo B1 (SIDPLAN sep-2026)'
from concepto c, periodo p
where c.id = n.concepto_id and p.id = n.periodo_id and p.anio = 2026 and p.mes = 9 and p.tipo = 'MENSUAL'
  and c.planilla = 'B1' and c.codigo = 511 and n.origen = 'SISTEMA';
