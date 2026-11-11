/**
 * Regressions-Snapshot des Default-Szenarios (N3).
 * Schlägt dieser Test nach einer Änderung fehl, ist entweder ein Fehler entstanden
 * oder die Rechenlogik wurde bewusst geändert. Im zweiten Fall: `npm test -- -u`
 * und die Änderung in docs/ANFORDERUNGEN.md (Änderungsprotokoll) begründen.
 */
import { describe, expect, it } from 'vitest';
import { compareInstallTimes } from '../src/core/compare';
import { formatMonth } from '../src/core/dates';
import { runAll } from '../src/core/simulation';
import { defaults } from './helpers';

const r2 = (x: number) => Math.round(x * 100) / 100;

describe('Regression: Default-Szenario', () => {
  it('Kennzahlen', () => {
    const r = runAll(defaults());
    expect({
      ref: r2(r.ref.totalCost),
      kfw: r2(r.kfw.totalCost),
      tax: r2(r.tax.totalCost),
      refNominal: r2(r.ref.nominalCost),
      kfwNominal: r2(r.kfw.nominalCost),
      taxNominal: r2(r.tax.nominalCost),
      subsidy: r.kfw.kfw?.subsidy,
      taxBonus: r.tax.tax?.total,
      breakEvenKfw: r.breakEvenKfw && formatMonth(r.breakEvenKfw),
      breakEvenTax: r.breakEvenTax && formatMonth(r.breakEvenTax),
      best: r.best,
      loans: [...r.kfw.loans, ...r.tax.loans].map((l) => [l.name, r2(l.principal), r2(l.totalInterest)]),
    }).toMatchSnapshot();
  });

  it('Jahreswerte', () => {
    const r = runAll(defaults());
    const pick = (s: typeof r.ref) => s.years.map((y) => [y.year, r2(y.total), r2(y.cumulative)]);
    expect({ ref: pick(r.ref), kfw: pick(r.kfw), tax: pick(r.tax) }).toMatchSnapshot();
  });

  it('Installationszeitpunkte', () => {
    const c = compareInstallTimes(defaults());
    expect(
      c.rows.map((x) => [formatMonth(x.installMonth), x.best, r2(x.kfwTotal), r2(x.taxTotal), x.kfwSubsidy]),
    ).toMatchSnapshot();
  });

  it('Ölheizung mit niedrigem Einkommen und Kind', () => {
    const i = defaults();
    i.oldHeating.fuel = 'oil';
    i.oldHeating.consumption = 2200;
    i.building.householdIncome = 45000;
    i.building.hasChild = true;
    const r = runAll(i);
    expect([r2(r.ref.totalCost), r2(r.kfw.totalCost), r.kfw.kfw?.subsidy, r.best]).toMatchSnapshot();
  });
});
