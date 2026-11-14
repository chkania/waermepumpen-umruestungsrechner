import { describe, expect, it } from 'vitest';
import { createPvModel, HOUSEHOLD_MONTH_SHARE, PV_MONTH_SHARE, pvCovered, pvSummary, SIMULTANEITY } from '../src/core/pv';
import type { Inputs } from '../src/core/types';
import { defaults } from './helpers';

/** F28 PV system in a monthly model. */
const withPv = (kwp: number, battery = 0, mut?: (i: Inputs) => void) => {
  const i = defaults();
  i.heatPump.pvKwp = kwp;
  i.heatPump.batteryKwh = battery;
  mut?.(i);
  return i;
};

describe('F28 PV-Anlage im Monatsmodell', () => {
  it('Monatsanteile summieren sich zu 1; Dezember liefert ein Sechstel vom Juni', () => {
    const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
    expect(sum(PV_MONTH_SHARE)).toBeCloseTo(1, 12);
    expect(sum(HOUSEHOLD_MONTH_SHARE)).toBeCloseTo(1, 12);
    expect(PV_MONTH_SHARE[11] / PV_MONTH_SHARE[5]).toBeCloseTo(2 / 13, 9);
  });

  it('Deckung: Gleichzeitigkeit ohne Speicher, Speicher begrenzt durch Überschuss, Restverbrauch und Kapazität', () => {
    expect(pvCovered(1000, 300, 0, 30)).toBeCloseTo(SIMULTANEITY * 300, 9);
    expect(pvCovered(1000, 300, 10, 30)).toBeCloseTo(300, 9); // remaining 150 < capacity 270 and surplus 765
    expect(pvCovered(1000, 300, 2, 30)).toBeCloseTo(150 + 2 * 0.9 * 30, 9);
    expect(pvCovered(100, 1000, 10, 30)).toBeCloseTo(50 + 50 * 0.9, 9); // winter: little surplus
    expect(pvCovered(0, 500, 10, 30)).toBe(0);
  });

  it('ohne PV kein PV-Strom; Haushalt nutzt PV zuerst, die Wärmepumpe bekommt den Rest', () => {
    expect(pvSummary(defaults()).annualHpFromPv).toBe(0);
    const pv = createPvModel(withPv(8));
    // January: household alone already uses the little PV direct share – heat pump gets only part
    const jan = pv.forHeatPump(0, 900);
    expect(jan).toBeLessThan(0.1 * 900);
    expect(pv.forHeatPump(6, 100)).toBeLessThanOrEqual(100);
  });

  it('Winter deutlich weniger als Sommer; Speicher und größere Anlage erhöhen den Anteil', () => {
    const a = pvSummary(withPv(8));
    expect(a.winterShare).toBeLessThan(0.1);
    expect(a.summerShare).toBeGreaterThan(0.4);
    expect(a.share).toBeGreaterThan(0.1);
    expect(a.share).toBeLessThan(0.3);
    const b = pvSummary(withPv(8, 10));
    const c = pvSummary(withPv(15, 10));
    expect(b.share).toBeGreaterThan(a.share);
    expect(c.share).toBeGreaterThan(b.share);
    // more household consumption leaves less PV for the heat pump
    expect(pvSummary(withPv(8, 0, (i) => (i.heatPump.householdKwh = 6000))).share).toBeLessThan(a.share);
  });

  it('Jahressumme der Simulation entspricht dem typischen Jahr', () => {
    const s = pvSummary(withPv(8, 5));
    expect(s.months).toHaveLength(12);
    expect(s.annualHpFromPv).toBeCloseTo(s.months.reduce((x, m) => x + m.hpFromPv, 0), 9);
  });
});
