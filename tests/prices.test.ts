import { describe, expect, it } from 'vitest';
import { annualHeatDemand, createPriceModel, fuelKWh, interpolate, parsePath, stepValue } from '../src/core/prices';
import { parseMonth as M } from '../src/core/dates';
import { pinned as defaults } from './helpers';

describe('F2.3 CO2-Preispfad', () => {
  it('parst Stützstellen, sortiert und ignoriert Müll', () => {
    expect(parsePath('2030:110, 2026:55; foo, 2028:80,5')).toEqual([
      { year: 2026, value: 55 },
      { year: 2028, value: 80 },
      { year: 2030, value: 110 },
    ]);
    expect(parsePath('2028:80.5')).toEqual([{ year: 2028, value: 80.5 }]);
  });

  it('interpoliert linear und ist außerhalb konstant', () => {
    const p = parsePath('2026:50, 2030:90');
    expect(interpolate(p, 2020)).toBe(50);
    expect(interpolate(p, 2028)).toBe(70);
    expect(interpolate(p, 2040)).toBe(90);
    expect(interpolate([], 2028)).toBe(0);
  });
});

describe('F2.7 Bio-Treppe (Treppenfunktion)', () => {
  it('liefert 0 vor der ersten Stufe und hält Stufen', () => {
    const p = parsePath('2029:10, 2030:15, 2035:30, 2040:60');
    expect(stepValue(p, 2028)).toBe(0);
    expect(stepValue(p, 2029)).toBe(10);
    expect(stepValue(p, 2034)).toBe(15);
    expect(stepValue(p, 2045)).toBe(60);
  });

  it('Aufschlag = Anteil × Aufpreis, abschaltbar', () => {
    const i = defaults();
    expect(createPriceModel(i).bioSurchargeCt(2030)).toBeCloseTo(0.15 * 4);
    i.prices.bioEnabled = false;
    expect(createPriceModel(i).bioSurchargeCt(2030)).toBe(0);
  });
});

describe('F2.1/F2.2 Gaspreis', () => {
  it('Startjahr entspricht dem eingegebenen Gesamtpreis', () => {
    const i = defaults();
    expect(createPriceModel(i).fuelCt('gas', M('2026-11'))).toBeCloseTo(11.5, 10);
    expect(createPriceModel(i).fuelCt('gas', M('2026-12'))).toBeCloseTo(11.5 + (11.5 - createPriceModel(i).co2SurchargeCt('gas', 2026)) * (1.03 ** (1 / 12) - 1), 10);
  });

  it('CO2-Aufschlag = Preis × Faktor /10 × (1+MwSt)', () => {
    const i = defaults();
    const pm = createPriceModel(i);
    expect(pm.co2SurchargeCt('gas', 2026)).toBeCloseTo((55 * 0.201) / 10 * 1.19, 10);
    expect(pm.co2SurchargeCt('oil', 2027)).toBeCloseTo((65 * 0.266) / 10 * 1.19, 10);
  });

  it('Basis wächst stetig ab Startmonat, CO2 nach Pfad je Kalenderjahr', () => {
    const i = defaults(); // Start 2026-11
    const pm = createPriceModel(i);
    const co2_26 = pm.co2SurchargeCt('gas', 2026);
    const base = 11.5 - co2_26;
    // January 2027: only 2 months of increase, but already the 2027 CO2 price
    expect(pm.fuelCt('gas', M('2027-01'))).toBeCloseTo(base * 1.03 ** (2 / 12) + pm.co2SurchargeCt('gas', 2027), 10);
    // 12 months after start: full annual increase
    expect(pm.fuelCt('gas', M('2027-11'))).toBeCloseTo(base * 1.03 + pm.co2SurchargeCt('gas', 2027), 10);
  });

  it('Grundpreis steigt mit Gaspreisrate', () => {
    const i = defaults();
    expect(createPriceModel(i).gasBaseFee(M('2028-11'))).toBeCloseTo(180 * 1.03 ** 2, 10);
    expect(createPriceModel(i).gasBaseFee(M('2026-11'))).toBe(180);
  });
});

describe('F2.4 Heizöl', () => {
  it('€/Liter → ct/kWh mit 10 kWh/l', () => {
    const i = defaults();
    i.oldHeating.fuel = 'oil';
    i.prices.oilPriceEur = 1.0;
    expect(createPriceModel(i).fuelCt('oil', M('2026-11'))).toBeCloseTo(10, 10);
    i.oldHeating.consumption = 2000;
    expect(fuelKWh(i)).toBe(20000);
    expect(annualHeatDemand(i)).toBe(18000);
  });
});

describe('F2.5 Strompreis', () => {
  it('WP-Tarif oder Haushaltsstrom, mit Steigerung', () => {
    const i = defaults();
    expect(createPriceModel(i).elecCt(M('2027-11'))).toBeCloseTo(26 * 1.02, 10);
    expect(createPriceModel(i).elecCt(M('2027-05'))).toBeCloseTo(26 * 1.02 ** 0.5, 10);
    i.heatPump.separateTariff = false;
    expect(createPriceModel(i).elecCt(M('2026-11'))).toBe(34);
  });
});
