-- Migración 7: datos maestros corregidos según lo declarado al Ministerio de Trabajo (OVT septiembre 2026,
-- y octubre para los nuevos empleadores Capiguara BBR / Dolores EEA). Se puede correr más de una vez.
-- 1) Datos personales
update trabajador set fecha_nacimiento = '1989-05-18' where codigo = 'MA1805';
update trabajador set fecha_nacimiento = '1997-02-09' where codigo = 'RA0902';
update trabajador set fecha_nacimiento = '1970-08-22' where codigo = 'VP2208';
update trabajador set nombres = 'Darwin Giovanni' where codigo = 'PD2303';
update trabajador set ci_expedido = 'LP' where codigo in ('BA2905', 'MS1111');
update trabajador set ci = '13960396', ap_materno = 'Najaya', nombres = 'Francisco Javier', fecha_nacimiento = '1995-12-02' where codigo = 'TF0212';
-- 2) Cargo declarado (ocupación) en el vínculo
update vinculo v set ocupacion = 'Ayudante Infanteria' from trabajador t where t.id = v.trabajador_id and t.codigo = 'AE2304' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- AE2304
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'AW1610' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- AW1610
update vinculo v set ocupacion = 'Profesor Titular' from trabajador t where t.id = v.trabajador_id and t.codigo = 'BA1211' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- BA1211
update vinculo v set ocupacion = 'ENCARGADO DE LOGÍSTICA Y ADQUISICIONES' from trabajador t where t.id = v.trabajador_id and t.codigo = 'BA2905' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- BA2905
update vinculo v set ocupacion = 'Auxiliar Administrativo' from trabajador t where t.id = v.trabajador_id and t.codigo = 'BI1111' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- BI1111
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'BR0501' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- BR0501
update vinculo v set ocupacion = 'AUXILIAR ADMINISTRATIVO' from trabajador t where t.id = v.trabajador_id and t.codigo = 'BY0912' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- BY0912
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'CF1701' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- CF1701
update vinculo v set ocupacion = 'Ayudante Taller' from trabajador t where t.id = v.trabajador_id and t.codigo = 'CK2102' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- CK2102
update vinculo v set ocupacion = 'JEFE DE ASISTENCIA TECNICA' from trabajador t where t.id = v.trabajador_id and t.codigo = 'CL2104' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- CL2104
update vinculo v set ocupacion = 'SECRETARIA' from trabajador t where t.id = v.trabajador_id and t.codigo = 'FE2805' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- FE2805
update vinculo v set ocupacion = 'ASISTENTE DE CONTABLE' from trabajador t where t.id = v.trabajador_id and t.codigo = 'FR2906' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- FR2906
update vinculo v set ocupacion = 'Empleado' from trabajador t where t.id = v.trabajador_id and t.codigo = 'GJ0405' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- GJ0405
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'IJ0609' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- IJ0609
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'IJ1510' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- IJ1510
update vinculo v set ocupacion = 'Ayudante Taller' from trabajador t where t.id = v.trabajador_id and t.codigo = 'IS1495' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- IS1495
update vinculo v set ocupacion = 'Encargado Administracion' from trabajador t where t.id = v.trabajador_id and t.codigo = 'IV0912' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- IV0912
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'LF0312' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- LF0312
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'LW2407' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- LW2407
update vinculo v set ocupacion = 'Ayudante Pastos' from trabajador t where t.id = v.trabajador_id and t.codigo = 'MA1805' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- MA1805
update vinculo v set ocupacion = 'Chofer y/o Tractorista' from trabajador t where t.id = v.trabajador_id and t.codigo = 'ME0507' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- ME0507
update vinculo v set ocupacion = 'Chofer y/o Tractorista' from trabajador t where t.id = v.trabajador_id and t.codigo = 'MF1005' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- MF1005
update vinculo v set ocupacion = 'Chofer y/o Tractorista' from trabajador t where t.id = v.trabajador_id and t.codigo = 'MG2204' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- MG2204
update vinculo v set ocupacion = 'Ayudante infanteria' from trabajador t where t.id = v.trabajador_id and t.codigo = 'MJ1606' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- MJ1606
update vinculo v set ocupacion = 'Auxiliar Administrativo' from trabajador t where t.id = v.trabajador_id and t.codigo = 'ML1405' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- ML1405
update vinculo v set ocupacion = 'Albañil' from trabajador t where t.id = v.trabajador_id and t.codigo = 'MO1504' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- MO1504
update vinculo v set ocupacion = 'Chofer y/o Tractorista' from trabajador t where t.id = v.trabajador_id and t.codigo = 'MR1312' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- MR1312
update vinculo v set ocupacion = 'Auxiliar Administrativo' from trabajador t where t.id = v.trabajador_id and t.codigo = 'MR1808' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- MR1808
update vinculo v set ocupacion = 'Administrador' from trabajador t where t.id = v.trabajador_id and t.codigo = 'MR1902' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- MR1902
update vinculo v set ocupacion = 'JEFE CONTABILIDAD' from trabajador t where t.id = v.trabajador_id and t.codigo = 'MS1111' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- MS1111
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'MS3004' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- MS3004
update vinculo v set ocupacion = 'Encargado Taller' from trabajador t where t.id = v.trabajador_id and t.codigo = 'ND1809' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- ND1809
update vinculo v set ocupacion = 'Encargado Estructuras Ganaderas' from trabajador t where t.id = v.trabajador_id and t.codigo = 'OA0607' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- OA0607
update vinculo v set ocupacion = 'COMERCIALIZACION' from trabajador t where t.id = v.trabajador_id and t.codigo = 'PA0105' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- PA0105
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'PD2303' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- PD2303
update vinculo v set ocupacion = 'Ayudante Infanteria' from trabajador t where t.id = v.trabajador_id and t.codigo = 'RA0902' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- RA0902
update vinculo v set ocupacion = 'Chofer y/o Tractorista' from trabajador t where t.id = v.trabajador_id and t.codigo = 'RF2404' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- RF2404
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'RJ1607' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- RJ1607
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'RO0910' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- RO0910
update vinculo v set ocupacion = 'ENCARGADO DE RECURSOS HUMANOS' from trabajador t where t.id = v.trabajador_id and t.codigo = 'RR1512' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- RR1512
update vinculo v set ocupacion = 'Ayudante Ganaderia' from trabajador t where t.id = v.trabajador_id and t.codigo = 'TA2407' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- TA2407
update vinculo v set ocupacion = 'ASISTENTE' from trabajador t where t.id = v.trabajador_id and t.codigo = 'TD0110' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- TD0110
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'TF0212' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- TF0212
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'VP2208' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- VP2208
update vinculo v set ocupacion = 'Vaquero' from trabajador t where t.id = v.trabajador_id and t.codigo = 'YI1402' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- YI1402
update vinculo v set ocupacion = 'Ayudante de Albañil' from trabajador t where t.id = v.trabajador_id and t.codigo = 'YR1103' and v.id = (select max(x.id) from vinculo x where x.trabajador_id = t.id and x.fecha_retiro is null);  -- YR1103
-- 3) Modalidad y tipo de contrato (Baspel)
update vinculo v set modalidad_contrato = 1 from trabajador t where t.id = v.trabajador_id and v.fecha_retiro is null and t.codigo in ('BA2905', 'MS1111', 'RR1512', 'CL2104', 'FE2805');
update vinculo v set tipo_contrato = 2 from trabajador t where t.id = v.trabajador_id and v.fecha_retiro is null and t.codigo = 'FE2805';
-- 4) Fecha de ingreso
update vinculo v set fecha_ingreso = '2023-05-21' from trabajador t where t.id = v.trabajador_id and v.fecha_retiro is null and t.codigo in ('FR2906', 'PA0105') and v.fecha_ingreso = '2023-05-22';
update trabajador set fecha_ingreso_grupo = '2023-05-21' where codigo in ('FR2906', 'PA0105') and fecha_ingreso_grupo = '2023-05-22';
update asignacion_cc a set vigente_desde = '2023-05-21' from vinculo v join trabajador t on t.id = v.trabajador_id where a.vinculo_id = v.id and t.codigo in ('FR2906', 'PA0105') and a.vigente_desde = '2023-05-22';
-- 5) NUA según OVT (confirmado por RRHH): el 41382471 es de PA0105; VP2208 queda sin NUA hasta obtener el suyo.
update trabajador set nua_cua = null where codigo = 'VP2208' and nua_cua = '41382471';
update trabajador set nua_cua = '41382471' where codigo = 'PA0105';
update trabajador set nua_cua = '39809237' where codigo = 'SR2401';
