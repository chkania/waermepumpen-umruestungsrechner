import { describe, expect, it } from 'vitest';
import { compareInstallTimes, explainBest, heatShareBetween } from '../src/core/compare';
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

describe('F7.3 Begründung des günstigsten Zeitpunkts', () => {
  it('Kostenarten ergeben die Gesamtkosten', () => {
    const c = compareInstallTimes(defaults());
    for (const r of c.rows) {
      const sum = Object.values(r.parts).reduce((s, x) => s + x, 0);
      expect(sum).toBeCloseTo(r.bestTotal, 4);
    }
  });

  it('vergleicht mit dem vorherigen und dem nächsten Zeitpunkt; Teile ergeben die Differenz', () => {
    const inp = defaults();
    const c = compareInstallTimes(inp);
    const ex = explainBest(c, inp)!;
    expect(ex.month).toBe(c.rows[c.bestIndex].installMonth);
    const neighbours = [c.bestIndex - 1, c.bestIndex + 1].filter((k) => k >= 0 && k < c.rows.length);
    expect(ex.comparisons.map((x) => x.other)).toEqual(neighbours.map((k) => c.rows[k].installMonth));
    for (const x of ex.comparisons) {
      expect(x.diff).toBeGreaterThanOrEqual(0);
      expect(Object.values(x.parts).reduce((s, v) => s + v, 0)).toBeCloseTo(x.diff, 4);
      if (x.mainReason) expect(x.parts[x.mainReason]).toBe(Math.max(...Object.values(x.parts)));
      expect(x.facts[0]).toMatch(/Jahresheizbedarfs/);
    }
  });

  it('nennt gesunkenen Zuschuss und entfallenden Steuerbonus', () => {
    const inp = defaults();
    inp.compare.stepMonths = 12;
    inp.compare.count = 5;
    const c = compareInstallTimes(inp);
    c.bestIndex = 0; // Force comparison with 11/2027
    const ex = explainBest(c, inp)!;
    expect(ex.comparisons).toHaveLength(1);
    expect(ex.comparisons[0].direction).toBe('later');
    expect(ex.comparisons[0].facts.some((f) => f.startsWith('KfW-Zuschuss dort'))).toBe(true);
    c.bestIndex = 2; // 11/2028 vs. 11/2029 (tax bonus (Steuerbonus) possible until 12/2029) and 11/2027
    const ex2 = explainBest(c, inp)!;
    c.bestIndex = 3; // 11/2029 vs. 11/2030: tax bonus (Steuerbonus) no longer possible there
    const ex3 = explainBest(c, inp)!;
    expect(ex2.comparisons).toHaveLength(2);
    expect(ex3.comparisons[1].facts.some((f) => f.includes('Steuerbonus nicht mehr möglich'))).toBe(true);
  });

  it('Heizbedarf zwischen zwei Zeitpunkten folgt dem Monatsprofil', () => {
    expect(heatShareBetween(2026 * 12 + 10, 2027 * 12 + 10)).toBeCloseTo(1, 3);
    expect(heatShareBetween(2027 * 12 + 4, 2027 * 12 + 9)).toBeLessThan(0.11);
    expect(heatShareBetween(2026 * 12 + 10, 2027 * 12 + 4)).toBeGreaterThan(0.75);
  });

  it('keine Begründung bei nur einem Zeitpunkt', () => {
    const inp = defaults();
    inp.compare.count = 1;
    expect(explainBest(compareInstallTimes(inp), inp)).toBeNull();
  });
});
