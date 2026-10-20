import { describe, expect, it } from 'vitest';
import datos from './septiembre-2026.json';
import { calcularB1, calcularB2, calcularRciva } from '../calculo';
import { PARAMETROS_2026 as P } from '../parametros-2026';

const periodo = datos.periodo;

describe('B1 septiembre 2026 contra SIDPLAN', () => {
  for (const f of datos.b1) {
    it(`${f.codigo} ${f.nombre.trim()}`, () => {
      const r = calcularB1(
        { codigo: f.codigo, fechaNacimiento: f.fechaNacimiento, fechaIngreso: f.fechaIngreso, sueldo: f.sueldo, bonoNivel: f.bonoNivel, tasas: f.tasas },
        { dias: f.novedades.dias, heHoras: f.novedades.heHoras, descuentos: f.novedades.descuentos, facturasF110: (f.novedades as { facturasF110?: number }).facturasF110, saldoRcivaAnterior: (f.novedades as { saldoRcivaAnterior?: number }).saldoRcivaAnterior },
        P, periodo,
      );
      expect(r.basico).toBeCloseTo(f.esperado.basico, 2);
      expect(r.antiguedad).toBeCloseTo(f.esperado.antiguedad, 2);
      expect(r.horasExtra).toBeCloseTo(f.esperado.horasExtra, 2);
      expect(r.gestora).toBeCloseTo(f.esperado.gestora, 2);
      expect(r.solidario).toBeCloseTo(f.esperado.solidario, 2);
      expect(r.rciva.retenido).toBeCloseTo(f.esperado.rciva, 2);
    });
  }
});

describe('B2 septiembre 2026 contra SIDPLAN', () => {
  for (const f of datos.b2) {
    it(`${f.codigo} ${f.nombre.trim()}`, () => {
      const r = calcularB2({ codigo: f.codigo, abonoMensual: f.abonoMensual }, f.novedades, P, periodo);
      expect(r.abono).toBeCloseTo(f.esperado.abono, 2);
      expect(r.horasExtra).toBeCloseTo(f.esperado.horasExtra, 2);
      expect(r.aporteCoop).toBeCloseTo(f.esperado.aporteCoop, 2);
      expect(r.saldo).toBeCloseTo(f.esperado.saldo, 2);
    });
  }
});

describe('RC-IVA contra planilla impositiva Baspel sep-2026', () => {
  for (const f of datos.rciva) {
    it(f.codigo, () => {
      const r = calcularRciva(f.neto, f.facturasF110, f.saldoAnterior, P, periodo);
      for (const [k, v] of Object.entries(f.esperado)) expect(r[k as keyof typeof r]).toBeCloseTo(v as number, 2);
    });
  }
});

describe('Aportes patronales (boleta Roca Temo Durval, Capiguara)', () => {
  it('total ganado 3.388', () => {
    const r = calcularB1({ codigo: 'RD0907', fechaNacimiento: '1970-07-09', fechaIngreso: '2025-01-21', sueldo: 3300, bonoNivel: 88 }, {}, P, periodo);
    expect(r.totalGanado).toBe(3388);
    expect(r.liquido).toBe(2957.39);
    expect(r.patronal).toEqual({ caja: 338.8, riesgo: 57.93, proVivienda: 67.76, solidario: 118.58, total: 583.07 });
    expect(r.provisiones.aguinaldo).toBe(282.22);
  });
});
