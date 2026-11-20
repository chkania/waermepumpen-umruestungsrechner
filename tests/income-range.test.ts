import { describe, expect, it } from 'vitest';
import { incomeBonusRate, kfwLoanVariant, kfwSubsidy, type KfwRequest } from '../src/core/funding';
import { DEFAULT_INCOME_RANGE, INCOME_RANGES, incomeRangeLabel, incomeRangeOfAmount, incomeRangeValue } from '../src/core/income-range';
import { runAll } from '../src/core/simulation';
import { defaults, pinned } from './helpers';

const P = () => defaults().funding;

function req(over: Partial<KfwRequest> = {}): KfwRequest {
  return {
    eligibleCost: 32000,
    appMonth: 2026 * 12 + 11,
    fuel: 'oil',
    oldHeatingAge: 22,
    ownerOccupied: true,
    units: 1,
    householdIncome: 60000,
    hasChild: false,
    ...over,
  };
}

/** Exact incomes from the acceptance criteria (F5.4, with and without child). */
const AMOUNTS = [-5000, 0, 1, 30000, 30000.5, 30001, 40000, 40001, 50000, 50001, 60000, 60001, 90000, 90000.5, 90001, 1e9];

describe('F5.4 Einkommensbereiche – Auswahl', () => {
  it('F5.4 die Auswahl enthält genau die sechs Bereiche in dieser Reihenfolge, Standard „über 50.000 bis 60.000 €“', () => {
    expect(INCOME_RANGES.map((r) => [r.code, r.label, r.value])).toEqual([
      ['0-30000', 'bis 30.000 €', 30000],
      ['30001-40000', 'über 30.000 bis 40.000 €', 40000],
      ['40001-50000', 'über 40.000 bis 50.000 €', 50000],
      ['50001-60000', 'über 50.000 bis 60.000 €', 60000],
      ['60001-90000', 'über 60.000 bis 90.000 €', 90000],
      ['90001+', 'über 90.000 €', 100000],
    ]);
    expect(DEFAULT_INCOME_RANGE).toBe('50001-60000');
    expect(defaults().building.incomeRange).toBe(DEFAULT_INCOME_RANGE);
  });

  it('F5.4 Rechenwert und Bezeichnung über den Code; unbekannter Code wird abgewiesen', () => {
    expect(incomeRangeValue('90001+')).toBe(100000);
    expect(incomeRangeLabel('0-30000')).toBe('bis 30.000 €');
    expect(() => incomeRangeValue('foo')).toThrow('Unbekannter Einkommensbereich: foo');
    expect(() => incomeRangeLabel('foo')).toThrow('Unbekannter Einkommensbereich: foo');
  });
});

describe('F9.5 Zuordnung Zahl → Code (Grenzen einschließlich)', () => {
  it.each([
    [-5000, '0-30000'],
    [0, '0-30000'],
    [30000, '0-30000'],
    [30000.5, '30001-40000'],
    [40000, '30001-40000'],
    [40000.5, '40001-50000'],
    [45000, '40001-50000'],
    [50000, '40001-50000'],
    [50000.5, '50001-60000'],
    [60000, '50001-60000'],
    [60000.5, '60001-90000'],
    [90000, '60001-90000'],
    [90000.5, '90001+'],
    [120000, '90001+'],
    [1e9, '90001+'],
  ])('F9.5 Betrag %s → %s', (amount, code) => {
    expect(incomeRangeOfAmount(amount)).toBe(code);
  });
});

describe('F9.5 Vorbedingungen: nicht endliche Beträge und unbekannte Codes', () => {
  it.each([NaN, Infinity, -Infinity])('F9.5 incomeRangeOfAmount(%s) wirft mit dem Wert in der Meldung', (x) => {
    expect(() => incomeRangeOfAmount(x)).toThrow(`Kein endlicher Betrag für einen Einkommensbereich: ${x}`);
  });

  it('F5.4 unbekannter Code nennt den Code in der Fehlermeldung (kein TypeError)', () => {
    expect(() => incomeRangeValue('x')).toThrow(Error);
    expect(() => incomeRangeValue('x')).not.toThrow(TypeError);
    expect(() => incomeRangeLabel('')).toThrow('Unbekannter Einkommensbereich: ');
  });
});

describe('F5.4 Expertengrenzen: Rechnung mit dem Rechenwert des gewählten Bereichs (bewusste Vereinfachung)', () => {
  it('F5.4 geänderte incomeLimit3 (55.000 €): Bereich 50.001–60.000 € nutzt den Rechenwert 60.000 € und erhält keinen Bonus, ein genauer Wert von 55.000 € erhielte 10 %', () => {
    const p = { ...P(), incomeLimit3: 55000 };
    expect(incomeBonusRate(incomeRangeValue('50001-60000'), false, p)).toBe(0);
    expect(incomeBonusRate(55000, false, p)).toBe(p.incomeRate3);
  });

  it('F5.4 geänderte incomeChildShift (5.000 €) mit Kind: Rechenwert 60.000 € gegen Grenze 55.000 € → kein Bonus', () => {
    const p = { ...P(), incomeChildShift: 5000 };
    expect(incomeBonusRate(incomeRangeValue('50001-60000'), true, p)).toBe(0);
    expect(incomeBonusRate(55000, true, p)).toBe(p.incomeRate3);
  });

  it('F5.4 geänderte loan358IncomeLimit (100.000 €) bei 90001+: Variante nach Rechenwert 100.000 € (358), nicht nach „über 90.000 €“', () => {
    const p = { ...P(), loan358IncomeLimit: 100000 };
    expect(kfwLoanVariant(true, 1, incomeRangeValue('90001+'), p)).toBe('358');
    expect(kfwLoanVariant(true, 1, 95000, p)).toBe('358');
  });

  it('F5.4 Simulation (runAll) rechnet mit dem Rechenwert: geänderte Grenze 55.000 € → Zuschuss-Bonus 0 bei Bereich 50.001–60.000 €', () => {
    const i = pinned();
    i.building.ownerOccupied = true;
    i.building.incomeRange = '50001-60000';
    i.funding.incomeLimit3 = 55000;
    const withRangeValue = runAll(i).kfw.kfw?.incomeRate;
    expect(withRangeValue).toBe(0);
  });
});

describe('F5.4 Standard-Förderparameter: Grenzen liegen auf Bereichsgrenzen', () => {
  it('F5.4 incomeLimit1–3, incomeLimit1–3 + incomeChildShift und loan358IncomeLimit sind Obergrenzen eines Bereichs', () => {
    const p = P();
    const uppers = INCOME_RANGES.map((r) => r.upper);
    for (const limit of [p.incomeLimit1, p.incomeLimit2, p.incomeLimit3]) {
      expect(uppers, `Grenze ${limit}`).toContain(limit);
      expect(uppers, `Grenze ${limit} mit Kind`).toContain(limit + p.incomeChildShift);
    }
    expect(uppers).toContain(p.loan358IncomeLimit);
  });
});

describe('F5.4 Rechenwert ergibt dasselbe Ergebnis wie das genaue Einkommen', () => {
  it.each(AMOUNTS.flatMap((x) => [false, true].map((hasChild) => [x, hasChild] as const)))(
    'F5.4 Einkommen %s, Kind %s: Stufe, Höchstsatz und Kreditvariante gleich wie mit dem Rechenwert',
    (amount, hasChild) => {
      const exact = kfwSubsidy(req({ householdIncome: amount, hasChild }), P());
      const range = incomeRangeOfAmount(amount);
      const byRange = kfwSubsidy(req({ householdIncome: incomeRangeValue(range), hasChild }), P());
      expect(byRange.incomeRate).toBe(exact.incomeRate);
      expect(byRange.maxRate).toBe(exact.maxRate);
      expect(byRange.subsidy).toBe(exact.subsidy);
      expect(kfwLoanVariant(true, 1, incomeRangeValue(range), P())).toBe(kfwLoanVariant(true, 1, amount, P()));
    },
  );
});

/** Acceptance tables (F5.4): ownerOccupied, one unit, KfW loan used. "–" = no bonus or no maximum rate to show. */
const TABLE_NO_CHILD: [string, number, number | null, '358' | '359'][] = [
  ['0-30000', 0.4, 0.8, '358'],
  ['30001-40000', 0.3, 0.7, '358'],
  ['40001-50000', 0.1, 0.7, '358'],
  ['50001-60000', 0, 0.7, '358'],
  ['60001-90000', 0, null, '358'],
  ['90001+', 0, null, '359'],
];
const TABLE_CHILD: [string, number, number | null, '358' | '359'][] = [
  ['0-30000', 0.4, 0.8, '358'],
  ['30001-40000', 0.4, 0.8, '358'],
  ['40001-50000', 0.3, 0.7, '358'],
  ['50001-60000', 0.1, 0.7, '358'],
  ['60001-90000', 0, null, '358'],
  ['90001+', 0, null, '359'],
];

describe('F5.4 Tabellen der Akzeptanzkriterien', () => {
  it.each(TABLE_NO_CHILD)('F5.4 ohne Kind, Bereich %s: Bonus %s, Höchstsatz %s, Kredit %s', (code, bonus, max, loan) => {
    const r = kfwSubsidy(req({ householdIncome: incomeRangeValue(code) }), P());
    expect(r.incomeRate).toBe(bonus);
    if (max !== null) expect(r.maxRate).toBe(max);
    expect(kfwLoanVariant(true, 1, incomeRangeValue(code), P())).toBe(loan);
  });

  it.each(TABLE_CHILD)('F5.4 mit Kind, Bereich %s: Bonus %s, Höchstsatz %s, Kredit %s', (code, bonus, max, loan) => {
    const r = kfwSubsidy(req({ householdIncome: incomeRangeValue(code), hasChild: true }), P());
    expect(r.incomeRate).toBe(bonus);
    if (max !== null) expect(r.maxRate).toBe(max);
    expect(kfwLoanVariant(true, 1, incomeRangeValue(code), P())).toBe(loan);
  });
});
