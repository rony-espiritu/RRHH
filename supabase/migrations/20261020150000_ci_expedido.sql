-- Migración 3: lugar de expedición del CI tomado de las declaraciones OVT
update trabajador set ci_expedido = 'BE' where ci = '12743829' and coalesce(ci_expedido, '') = '';
update trabajador set ci_expedido = 'BE' where ci = '10820030' and coalesce(ci_expedido, '') = '';
update trabajador set ci_expedido = 'BE' where ci = '10820060' and coalesce(ci_expedido, '') = '';
update trabajador set ci_expedido = 'BE' where ci = '7610986' and coalesce(ci_expedido, '') = '';
update trabajador set ci_expedido = 'BE' where ci = '10820056' and coalesce(ci_expedido, '') = '';
update trabajador set ci_expedido = 'BE' where ci = '10854993' and coalesce(ci_expedido, '') = '';
update trabajador set ci_expedido = 'BE' where ci = '10804867' and coalesce(ci_expedido, '') = '';
update trabajador set ci_expedido = 'SC' where ci = '6395540' and coalesce(ci_expedido, '') = '';
update trabajador set ci_expedido = 'PD' where ci = '5707058' and coalesce(ci_expedido, '') = '';
