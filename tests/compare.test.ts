import { describe, expect, it } from 'vitest';
import { compareInstallTimes } from '../src/core/compare';
import { formatMonth } from '../src/core/dates';
import { defaults } from './helpers';

describe('F7 Vergleich der Installationszeitpunkte', () => {
  it('erzeugt count Zeitpunkte im Abstand stepMonths ab Startmonat', () => {
    const c = compareInstallTimes(defaults());
    expect(c.rows.map((r) => formatMonth(r.installMonth))).toEqual([
      '2026-11', '2027-05', '2027-11', '2028-05', '2028-11', '2029-05', '2029-11', '2030-05', '2030-11',
    ]);
    expect(c.rows[0].extraVsFirst).toBe(0);
  });

  it('Zuschuss sinkt durch Degression bei späterem Antrag', () => {
    const c = compareInstallTimes(defaults());
    const subs = c.rows.map((r) => r.kfwSubsidy);
    for (let k = 1; k < subs.length; k++) expect(subs[k]).toBeLessThanOrEqual(subs[k - 1]);
    expect(subs[0]).toBe(12880);
    expect(subs[subs.length - 1]).toBeLessThan(subs[0]);
  });

  it('Steuerbonus nur bis Ende 2029', () => {
    const c = compareInstallTimes(defaults());
    expect(c.rows.map((r) => r.taxFeasible)).toEqual([true, true, true, true, true, true, true, false, false]);
  });

  it('Ersparnis gegenüber Referenz ist konsistent', () => {
    const c = compareInstallTimes(defaults());
    for (const r of c.rows) expect(r.savingVsRef).toBeCloseTo(c.refTotal - r.bestTotal, 6);
    expect(c.rows[c.bestIndex].bestTotal).toBe(Math.min(...c.rows.map((r) => r.bestTotal)));
  });

  it('Zeitpunkte jenseits des Zeitraums werden weggelassen', () => {
    const i = defaults();
    i.general.horizonYears = 2;
    i.compare.stepMonths = 12;
    i.compare.count = 5;
    expect(compareInstallTimes(i).rows).toHaveLength(2);
  });
});
