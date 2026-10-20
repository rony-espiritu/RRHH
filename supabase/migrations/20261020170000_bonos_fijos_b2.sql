-- Migración 4: bonos fijos de B2 (montos de septiembre 2026 en SIDPLAN), vigentes desde octubre.
-- Solo agrega el bono si el trabajador no lo tiene ya como fijo.
insert into concepto_fijo (vinculo_id, concepto_id, monto, vigente_desde, motivo)
select v.id, c.id, x.monto, '2026-10-01', 'Bono fijo B2 tomado de septiembre 2026 (SIDPLAN)'
from (values
  ('BR0501', 11, 140.0),
  ('BY0912', 12, 120.0),
  ('BY0912', 14, 1080.0),
  ('CR2704', 11, 140.0),
  ('IJ0609', 11, 140.0),
  ('ML1405', 12, 50.0),
  ('ML1405', 13, 675.0),
  ('MS1111', 25, 2500.0),
  ('PD2303', 11, 140.0),
  ('RD0907', 11, 140.0),
  ('RO0602', 11, 140.0),
  ('RR1512', 25, 600.0),
  ('TD0110', 12, 110.0),
  ('RR1512', 12, 95.0),
  ('MS1111', 12, 65.0),
  ('MR1808', 12, 96.0),
  ('FR2906', 12, 217.0),
  ('FE2805', 12, 44.0),
  ('BA2905', 12, 35.0),
  ('BI1111', 12, 50.0),
  ('PA0105', 12, 585.0),
  ('RH1103', 12, 190.0),
  ('RA0902', 12, 20.0),
  ('VP2208', 12, 190.0),
  ('SR2401', 12, 82.0),
  ('RJ1607', 12, 153.0),
  ('NE1107', 12, 44.0),
  ('AW1610', 12, 131.0),
  ('AL1106', 12, 80.0),
  ('CL2104', 12, 248.0),
  ('GJ0405', 12, 130.0),
  ('MR1808', 13, 675.0),
  ('BI1111', 13, 675.0),
  ('RH1103', 13, 675.0),
  ('RA0902', 13, 675.0),
  ('VP2208', 13, 675.0),
  ('SR2401', 13, 675.0),
  ('RJ1607', 13, 675.0),
  ('NE1107', 13, 675.0),
  ('GJ0405', 13, 675.0),
  ('AW1610', 13, 675.0),
  ('AL1106', 13, 675.0),
  ('TD0110', 14, 1080.0),
  ('RR1512', 14, 1080.0),
  ('MS1111', 14, 1080.0),
  ('FR2906', 14, 1080.0),
  ('FE2805', 14, 1080.0),
  ('BA2905', 14, 1080.0),
  ('PA0105', 14, 1080.0),
  ('CL2104', 14, 1080.0)
) as x(codigo, conc, monto)
join trabajador t on t.codigo = x.codigo
join vinculo v on v.trabajador_id = t.id and v.fecha_retiro is null
join concepto c on c.planilla = 'B2' and c.codigo = x.conc
where not exists (select 1 from concepto_fijo f where f.vinculo_id = v.id and f.concepto_id = c.id and f.vigente_hasta is null);

-- El abono B2 es base de aguinaldo e indemnización (previsiones B2), como en SIDPLAN.
update concepto set afecta_aguinaldo = true where planilla = 'B2' and codigo = 2;
