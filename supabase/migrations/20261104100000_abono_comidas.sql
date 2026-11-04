-- Migración 24: concepto B2 "Abono comidas" (ingreso que suma al total ganado B2; no genera asiento porque ya viene registrado en Albor).
insert into concepto (codigo, planilla, nombre, naturaleza, modo, tipo_contable, orden, activo)
select 26, 'B2', 'Abono comidas', 'INGRESO', 'MANUAL', '000', 100, true
where not exists (select 1 from concepto where planilla = 'B2' and codigo = 26);
