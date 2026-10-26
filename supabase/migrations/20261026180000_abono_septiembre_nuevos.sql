-- Migración 11: abono de septiembre 2026 de AE2304, IS1495, MJ1606 y TJ0212 (solo B2 ese mes) según lo cargado en Albor: 3.300.
-- Desde octubre siguen con el monto de su vínculo nuevo.
update concepto_fijo f set monto = 3300, motivo = 'Septiembre 2026 según carga inicial Albor'
from vinculo v, trabajador t, concepto c
where v.id = f.vinculo_id and t.id = v.trabajador_id and c.id = f.concepto_id
  and t.codigo in ('AE2304', 'IS1495', 'MJ1606', 'TJ0212') and c.planilla = 'B2' and c.codigo = 2
  and v.fecha_ingreso = '2026-09-01' and v.fecha_retiro = '2026-09-30';
