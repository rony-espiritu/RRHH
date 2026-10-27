-- Migración 15: el resto de un préstamo menor a 1 (Bs o $us) se cobra junto con la última cuota.
insert into parametro (clave, valor, vigente_desde, nota) values
 ('PRESTAMO_RESTO_MINIMO', 1, '2026-01-01', 'Si después de la cuota queda menos que esto, se cobra todo en esa cuota')
on conflict (clave, vigente_desde) do nothing;
