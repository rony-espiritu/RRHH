-- Migración 23: faltas desde octubre 2026 se cargan en DÍAS (el sistema descuenta sueldo ÷ 30 × días en Bs).
-- Corrige las faltas que se cargaron hoy en la columna en Bs (p.ej. 0,5 o 1): se pasan a días.
update novedad n set cantidad = n.monto, monto = null
from concepto c, periodo p
where c.id = n.concepto_id and c.codigo = 520 and p.id = n.periodo_id and p.fecha_inicio >= '2026-10-01'
  and n.origen = 'MANUAL' and n.cantidad is null and n.monto is not null and n.monto <= 30;
