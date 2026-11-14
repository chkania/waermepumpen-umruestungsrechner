import { describe, expect, it } from 'vitest';
import { savingOf, sensitivity } from '../src/core/sensitivity';
import { runAll } from '../src/core/simulation';
import { defaults, neutral } from './helpers';

/** F27 sensitivity analysis: each assumption lower/higher, saving with a heat pump, sorted by influence. */
describe('F27 Sensitivitätsanalyse', () => {
  it('Basis = Ersparnis des besten Wegs; Varianten ändern nur eine Annahme', () => {
    const i = defaults();
    const run = runAll(i);
    const s = sensitivity(i);
    expect(s.base).toBeCloseTo(run.ref.totalCost - (run.best === 'tax' ? run.tax : run.kfw).totalCost, 6);
    // inputs stay unchanged
    expect(i).toEqual(defaults());
    const jaz = s.items.find((x) => x.id === 'jaz')!;
    expect([jaz.lowValue, jaz.base, jaz.highValue]).toEqual(['2,8', '3,3', '3,8']);
    const v = defaults();
    v.heatPump.jaz = 3.8;
    expect(jaz.high).toBeCloseTo(savingOf(v), 6);
  });

  it('Richtung plausibel: höherer Gaspreis/CO₂-Preis/JAZ → mehr Ersparnis; höhere Investition/Strompreis → weniger', () => {
    const s = sensitivity(defaults());
    const by = (id: string) => s.items.find((x) => x.id === id)!;
    for (const id of ['fuelPrice', 'fuelIncrease', 'jaz', 'co2Price']) expect(by(id).high, id).toBeGreaterThan(by(id).low);
    for (const id of ['investment', 'elecPrice', 'elecIncrease', 'loanRate']) expect(by(id).high, id).toBeLessThan(by(id).low);
  });

  it('sortiert nach Spanne, größte zuerst', () => {
    const spans = sensitivity(defaults()).items.map((x) => Math.abs(x.high - x.low));
    expect(spans).toEqual([...spans].sort((a, b) => b - a));
  });

  it('Heizöl: Preis in €/l; Kreditzinsen nur, wenn ein Kredit nötig ist', () => {
    const oil = defaults();
    oil.oldHeating.fuel = 'oil';
    const oilPrice = sensitivity(oil).items.find((x) => x.id === 'fuelPrice')!;
    expect(oilPrice.base).toMatch(/€\/l$/);
    expect(oilPrice.label).toBe('Heizölpreis heute');
    expect(sensitivity(defaults()).items.find((x) => x.id === 'fuelPrice')!.label).toBe('Gaspreis heute');
    const own = neutral((i) => {
      i.financing.kfwEquity = 1e6;
      i.financing.taxEquity = 1e6;
    });
    expect(sensitivity(own).items.map((x) => x.id)).not.toContain('loanRate');
    expect(sensitivity(defaults()).items.map((x) => x.id)).toContain('loanRate');
  });
});
