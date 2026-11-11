import { describe, expect, it } from 'vitest';
import { annuity, loanSchedule, type LoanSpec } from '../src/core/loan';

const base = (over: Partial<LoanSpec> = {}): LoanSpec => ({
  principal: 100000,
  startMonth: 0,
  rate: 0.03,
  termMonths: 240,
  graceMonths: 0,
  fixMonths: 0,
  followUpRate: 0.03,
  ...over,
});

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('F6 Annuitätendarlehen', () => {
  it('Annuität 100.000 €, 3 %, 20 Jahre ≈ 554,60 €/Monat', () => {
    expect(annuity(100000, 0.03 / 12, 240)).toBeCloseTo(554.6, 1);
    expect(annuity(1200, 0, 12)).toBe(100);
  });

  it('tilgt vollständig in der Laufzeit, erste Rate im Folgemonat', () => {
    const s = loanSchedule(base());
    expect(s).toHaveLength(240);
    expect(s[0].month).toBe(1);
    expect(sum(s.map((p) => p.principal))).toBeCloseTo(100000, 6);
    expect(s[239].balance).toBeCloseTo(0, 6);
    expect(s[0].interest + s[0].principal).toBeCloseTo(554.6, 1);
  });

  it('tilgungsfreie Anlaufzeit: nur Zinsen', () => {
    const s = loanSchedule(base({ graceMonths: 12 }));
    expect(s[11].principal).toBe(0);
    expect(s[11].interest).toBeCloseTo(250, 6);
    expect(s[12].principal).toBeGreaterThan(0);
    expect(sum(s.map((p) => p.principal))).toBeCloseTo(100000, 6);
  });

  it('Sondertilgung verkürzt die Laufzeit bei gleicher Rate', () => {
    const plain = loanSchedule(base());
    const s = loanSchedule(base({ extraRepayments: [{ month: 3, amount: 20000 }] }));
    expect(s[2].extra).toBe(20000);
    expect(s.length).toBeLessThan(240);
    expect(s[10].interest + s[10].principal).toBeCloseTo(plain[10].interest + plain[10].principal, 6);
    expect(sum(s.map((p) => p.principal))).toBeCloseTo(100000, 6);
  });

  it('Sondertilgung wird auf Restschuld begrenzt', () => {
    const s = loanSchedule(base({ principal: 5000, extraRepayments: [{ month: 2, amount: 99999 }] }));
    expect(s).toHaveLength(2);
    expect(sum(s.map((p) => p.principal))).toBeCloseTo(5000, 6);
  });

  it('Anschlusszins nach Zinsbindung', () => {
    const s = loanSchedule(base({ fixMonths: 120, followUpRate: 0.06 }));
    const balance120 = s[119].balance;
    expect(s[120].interest).toBeCloseTo((balance120 * 0.06) / 12, 6);
    expect(s).toHaveLength(240);
    expect(s[239].balance).toBeCloseTo(0, 6);
  });

  it('kein Kredit bei Betrag 0', () => {
    expect(loanSchedule(base({ principal: 0 }))).toEqual([]);
  });
});
