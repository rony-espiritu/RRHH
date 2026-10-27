-- Migración 12: corrige la confusión entre los dos Tomicha (migración 7).
-- TF0212 = Tomicha Villamor Francisco (Eventuales Fijos desde 10/09/2026).
-- TJ0212 = Tomicha Najaya Francisco Javier: el CI declarado al Ministerio (Dolores EEA) es 13960396.
update trabajador set ci = '14341230', ci_expedido = 'BE', ap_materno = 'Villamor', nombres = 'Francisco', fecha_nacimiento = '1969-12-02'
where codigo = 'TF0212';
update trabajador set ci = '13960396' where codigo = 'TJ0212';
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'TJ0212' and v.fecha_retiro is null;
