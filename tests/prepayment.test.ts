import { describe, expect, it } from 'vitest';
import { parseMonth } from '../src/core/dates';
import { keyEvents } from '../src/core/events';
import { loanScheduleDetailed, type LoanSpec, type PrepaymentRules } from '../src/core/loan';
import { runAll, simulate } from '../src/core/simulation';
import type { Inputs } from '../src/core/types';
import { neutral } from './helpers';

const KFW: PrepaymentRules = { minAmount: 5000, freeWithinFix: true, fullOnlyAfterFix: true, feeRate: 0.01, feeRateShortRemaining: 0.01, capFeeAtInterest: false };
const BANK: PrepaymentRules = { minAmount: 0, freeWithinFix: false, fullOnlyAfterFix: false, feeRate: 0.01, feeRateShortRemaining: 0.005, capFeeAtInterest: true };

const spec = (over: Partial<LoanSpec> = {}): LoanSpec => ({
  principal: 30000,
  startMonth: 0,
  rate: 0.03,
  termMonths: 240,
  graceMonths: 0,
  fixMonths: 120,
  followUpRate: 0.04,
  rules: KFW,
  ...over,
});
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('F12 Sondertilgungsregeln KfW (Merkblatt 358/359 S. 5)', () => {
  it('innerhalb der Zinsbindung ab 5.000 € kostenfrei', () => {
    const r = loanScheduleDetailed(spec({ extraRepayments: [{ month: 24, amount: 8000 }] }));
    expect(r.extras[0]).toMatchObject({ status: 'applied', applied: 8000, fee: 0, paidOff: false });
    expect(sum(r.payments.map((p) => p.principal))).toBeCloseTo(30000, 6);
    expect(r.payments.length).toBeLessThan(240);
  });

  it('unter 5.000 € abgelehnt', () => {
    const r = loanScheduleDetailed(spec({ extraRepayments: [{ month: 24, amount: 4999 }] }));
    expect(r.extras[0].status).toBe('rejected');
    expect(r.extras[0].reason).toMatch(/Mindestbetrag/);
    expect(r.payments).toHaveLength(240);
  });

  it('nach der Zinsbindung nur vollständige Rückzahlung, dann mit Entschädigung', () => {
    const partial = loanScheduleDetailed(spec({ extraRepayments: [{ month: 130, amount: 8000 }] }));
    expect(partial.extras[0].status).toBe('rejected');
    expect(partial.extras[0].reason).toMatch(/vollständige Rückzahlung/);
    const full = loanScheduleDetailed(spec({ extraRepayments: [{ month: 130, amount: 50000 }] }));
    const x = full.extras[0];
    expect(x.status).toBe('partial'); // more money than the remaining debt (Restschuld)
    expect(x.paidOff).toBe(true);
    expect(x.fee).toBeCloseTo(x.applied * 0.01, 6);
    expect(full.payments).toHaveLength(130);
    expect(full.payments[129].balance).toBe(0);
  });

  it('Restbetrag unter 5.000 € darf vollständig getilgt werden', () => {
    const r = loanScheduleDetailed(spec({ principal: 4000, extraRepayments: [{ month: 2, amount: 6000 }] }));
    expect(r.extras[0].paidOff).toBe(true);
  });

  it('Sondertilgung vor Auszahlung oder nach Tilgungsende abgelehnt', () => {
    const r = loanScheduleDetailed(spec({ startMonth: 10, extraRepayments: [{ month: 10, amount: 6000 }, { month: 400, amount: 6000 }] }));
    expect(r.extras.map((x) => x.status)).toEqual(['rejected', 'rejected']);
  });
});

describe('F12 Sondertilgungsregeln Bankkredit (§ 500 Abs. 2, § 502 BGB)', () => {
  const bank = (over: Partial<LoanSpec> = {}) => spec({ rules: BANK, fixMonths: 0, followUpRate: 0.03, termMonths: 120, ...over });

  it('Teilrückzahlung jederzeit, Entschädigung 1 %', () => {
    const r = loanScheduleDetailed(bank({ extraRepayments: [{ month: 12, amount: 1000 }] }));
    expect(r.extras[0]).toMatchObject({ status: 'applied', applied: 1000 });
    expect(r.extras[0].fee).toBeCloseTo(10, 6);
    expect(r.payments[11].fee).toBeCloseTo(10, 6);
  });

  it('Restlaufzeit ≤ 1 Jahr: 0,5 %, höchstens entgangene Zinsen', () => {
    const r = loanScheduleDetailed(bank({ extraRepayments: [{ month: 110, amount: 2000 }] }));
    const x = r.extras[0];
    // Remaining term 10 months: 0.5 % = 10 €, interest cap 2000 × 3 % × 10/12 = 50 € → 10 €
    expect(x.fee).toBeCloseTo(Math.min(x.applied * 0.005, (x.applied * 0.03 * 10) / 12), 6);
    const tiny = loanScheduleDetailed(bank({ rate: 0.001, followUpRate: 0.001, extraRepayments: [{ month: 118, amount: 2000 }] }));
    const t = tiny.extras[0];
    expect(t.fee).toBeCloseTo((t.applied * 0.001 * 2) / 12, 6); // interest cap applies
  });
});

/** Heat pump scenario with KfW loan (1.5 %) and bank loan (5 %), commissioning (Inbetriebnahme) immediately. */
function wfCase(mut?: (i: Inputs) => void): Inputs {
  return neutral((i) => {
    i.oldHeating.remainingLifeYears = 100;
    i.heatPump.installMonth = '2026-11';
    i.heatPump.extraCost = 6000; // not eligible → bank loan
    i.financing.kfwEquity = 0;
    i.financing.taxEquity = 0;
    i.financing.windfallAmount = 10000;
    i.financing.windfallMonth = '2029-11';
    mut?.(i);
  });
}

describe('F12 Einmalzahlung als Sondertilgung in der Simulation', () => {
  it('automatisch: zuerst höchster Zins (Bank), Rest auf KfW', () => {
    const r = simulate(wfCase((i) => (i.financing.windfallAmount = 12000)), 'kfw');
    expect(r.windfall!.attempts.map((a) => [a.loan, a.status])).toEqual([
      ['Bankkredit', 'partial'],
      ['KfW-Kredit 358', 'applied'],
    ]);
    const bankPaid = r.windfall!.attempts[0].applied;
    expect(r.windfall!.used).toBeCloseTo(12000, 6);
    expect(r.windfall!.attempts[1].applied).toBeCloseTo(12000 - bankPaid, 6);
    expect(r.loans.find((l) => l.name === 'Bankkredit')!.payoffMonth).toBe(parseMonth('2029-11'));
  });

  it('Rest unter 5.000 € kann nicht auf den KfW-Kredit', () => {
    const r = simulate(wfCase(), 'kfw'); // 10,000 €: bank ≈ 5,130 €, rest ≈ 4,870 €
    expect(r.windfall!.attempts[1]).toMatchObject({ loan: 'KfW-Kredit 358', status: 'rejected' });
    expect(r.windfall!.attempts[1].reason).toMatch(/Mindestbetrag/);
    expect(r.windfall!.unused).toBeCloseTo(10000 - r.windfall!.attempts[0].applied, 6);
  });

  it('Ziel KfW: zuerst KfW-Kredit', () => {
    const r = simulate(wfCase((i) => (i.financing.windfallTarget = 'kfw')), 'kfw');
    expect(r.windfall!.attempts[0]).toMatchObject({ loan: 'KfW-Kredit 358', applied: 10000, fee: 0 });
  });

  it('senkt Zinsen; Tilgung + Ablösung = Kreditsumme; Entschädigung als Kosten', () => {
    const without = simulate(wfCase((i) => (i.financing.windfallAmount = 0)), 'kfw');
    const withWf = simulate(wfCase(), 'kfw');
    const interest = (s: typeof without) => sum(s.loans.map((l) => l.totalInterest));
    expect(interest(withWf)).toBeLessThan(interest(without));
    const principal = (s: typeof without) => sum(s.months.map((m) => m.principal));
    expect(principal(withWf)).toBeCloseTo(principal(without), 4);
    const fees = sum(withWf.months.map((m) => m.fees));
    expect(fees).toBeCloseTo(withWf.windfall!.attempts[0].fee, 6);
    expect(fees).toBeGreaterThan(0);
    // without opportunity interest (Opportunitätszins): total costs fall by the interest saved minus the charge
    expect(withWf.nominalCost).toBeCloseTo(without.nominalCost - (interest(without) - interest(withWf)) + fees, 4);
  });

  it('nach Ende der KfW-Zinsbindung: Teiltilgung abgelehnt, Geld geht an die Bank', () => {
    const r = simulate(
      wfCase((i) => {
        i.financing.windfallMonth = '2037-06';
        i.financing.windfallTarget = 'kfw';
        i.heatPump.extraCost = 20000;
      }),
      'kfw',
    );
    expect(r.windfall!.attempts[0]).toMatchObject({ loan: 'KfW-Kredit 358', status: 'rejected' });
    expect(r.windfall!.attempts[1].loan).toBe('Bankkredit');
    expect(r.windfall!.attempts[1].applied).toBeGreaterThan(0);
  });

  it('Steuer-Weg: nur Bankkredit; Überschuss bleibt ungenutzt', () => {
    const r = simulate(wfCase((i) => (i.financing.windfallAmount = 100000)), 'tax');
    expect(r.windfall!.attempts).toHaveLength(1);
    expect(r.windfall!.attempts[0].paidOff).toBe(true);
    expect(r.windfall!.unused).toBeGreaterThan(0);
  });

  it('außerhalb des Zeitraums bzw. ohne Kredit: Hinweis, keine Wirkung', () => {
    const out = simulate(wfCase((i) => (i.financing.windfallMonth = '2050-01')), 'kfw');
    expect(out.windfall!.note).toMatch(/außerhalb/);
    const noLoan = simulate(wfCase((i) => (i.financing.kfwEquity = 1e6)), 'kfw');
    expect(noLoan.windfall!.note).toMatch(/keinen Kredit/);
  });

  it('Zuschuss unter 5.000 € nicht als Sondertilgung möglich', () => {
    const r = simulate(wfCase((i) => (i.heatPump.investment = 10000)), 'kfw'); // Subsidy (Zuschuss) 4,600 €
    expect(r.kfw!.subsidy).toBe(4600);
    expect(r.warnings.join()).toMatch(/Zuschuss nicht als Sondertilgung möglich – Mindestbetrag/);
  });

  it('Ereignisse: Sondertilgung, Tilgungsende, Ablehnung', () => {
    const i = wfCase();
    const { timeline } = keyEvents(i, runAll(i));
    const titles = timeline.map((e) => e.title);
    expect(titles.some((t) => /^Sondertilgung .* auf Bankkredit$/.test(t))).toBe(true);
    expect(titles).toContain('Bankkredit vollständig getilgt');
    const i2 = wfCase((x) => {
      x.financing.windfallMonth = '2037-06';
      x.financing.windfallTarget = 'kfw';
      x.heatPump.extraCost = 0;
    });
    const t2 = keyEvents(i2, runAll(i2)).timeline;
    const rej = t2.find((e) => e.title === 'Sondertilgung auf KfW-Kredit 358 nicht möglich')!;
    expect(rej.level).toBe('warning');
    expect(t2.find((e) => /der Einmalzahlung nicht eingesetzt/.test(e.title))).toBeDefined();
  });
});

describe('F12.6 Tilgungstermin der Sondertilgung', () => {
  const at = (repay: string, mut?: (i: Inputs) => void) =>
    wfCase((i) => {
      i.financing.windfallTarget = 'kfw';
      i.financing.windfallRepayMonth = repay;
      mut?.(i);
    });

  it('leer = Verfügbarkeitsmonat; späterer Termin verschiebt Tilgung und Zinsen', () => {
    const now = simulate(at(''), 'kfw');
    expect(now.windfall!.month).toBe(parseMonth('2029-11'));
    const later = simulate(at('2031-05'), 'kfw');
    expect(later.windfall!.month).toBe(parseMonth('2031-05'));
    expect(later.windfall!.availableMonth).toBe(parseMonth('2029-11'));
    const row = (s: typeof now, m: string) => s.months.find((r) => r.month === parseMonth(m))!;
    expect(row(later, '2031-05').principal).toBeGreaterThan(10000);
    expect(row(later, '2029-11').principal).toBeLessThan(1000);
    // repaying later saves less interest
    expect(later.windfall!.interestSaved).toBeGreaterThan(0);
    expect(later.windfall!.interestSaved).toBeLessThan(now.windfall!.interestSaved);
    const interest = (s: typeof now) => sum(s.loans.map((l) => l.totalInterest));
    const none = simulate(at('', (i) => (i.financing.windfallAmount = 0)), 'kfw');
    expect(now.windfall!.interestSaved).toBeCloseTo(interest(none) - interest(now), 6);
  });

  it('Regeln gelten zum Tilgungsmonat: nach Zinsbindungsende KfW abgelehnt', () => {
    const r = simulate(at('2037-06'), 'kfw');
    expect(r.windfall!.attempts[0]).toMatchObject({ loan: 'KfW-Kredit 358', status: 'rejected' });
  });

  it('Termin vor Verfügbarkeit → Verfügbarkeitsmonat mit Warnung', () => {
    const r = simulate(at('2028-01'), 'kfw');
    expect(r.windfall!.month).toBe(parseMonth('2029-11'));
    expect(r.warnings.join()).toMatch(/vor der Verfügbarkeit/);
  });

  it('Ereignisse: Verfügbarkeit und Sondertilgung mit Zinsersparnis', () => {
    const i = at('2031-05');
    const t = keyEvents(i, runAll(i)).timeline.filter((e) => e.scenario === 'kfw');
    const avail = t.find((e) => /verfügbar$/.test(e.title))!;
    expect(avail.month).toBe(parseMonth('2029-11'));
    const sond = t.find((e) => /^Sondertilgung 10\.000 €/.test(e.title))!;
    expect(sond.month).toBe(parseMonth('2031-05'));
    expect(sond.detail).toMatch(/Zinsen im Betrachtungszeitraum/);
  });
});

describe('F12.8 Zuschuss und Steuererstattungen als Sondertilgung, unabhängig vom KfW-Kredit', () => {
  const bank = (r: ReturnType<typeof runAll>, k: 'kfw' | 'tax') => r[k].loans.find((l) => l.name === 'Bankkredit')!;
  const withBank = (mut?: (i: Inputs) => void) =>
    neutral((i) => {
      i.financing.useKfwLoan = false;
      i.financing.bankRate = 0.07;
      i.financing.kfwEquity = 0;
      i.financing.taxEquity = 0;
      mut?.(i);
    });

  it('ohne KfW-Kredit tilgt der Zuschuss den Bankkredit des KfW-Wegs', () => {
    const on = runAll(withBank());
    const off = runAll(withBank((i) => (i.financing.subsidyAsSpecialRepayment = false)));
    const x = bank(on, 'kfw').extras.find((e) => e.label === 'Zuschuss')!;
    expect(x.status).toBe('applied');
    expect(x.applied).toBeCloseTo(on.kfw.kfw!.subsidy, 6);
    expect(x.fee).toBeGreaterThan(0); // early repayment charge (Vorfälligkeitsentschädigung) of the bank (§ 502 BGB)
    expect(bank(off, 'kfw').extras).toEqual([]);
    expect(bank(on, 'kfw').totalInterest).toBeLessThan(bank(off, 'kfw').totalInterest);
    const ev = keyEvents(withBank(), on).timeline.find((e) => e.title === 'Auszahlung KfW-Zuschuss')!;
    expect(ev.detail).toBe('Wird als Sondertilgung für den Bankkredit verwendet.');
  });

  it('mit KfW-Kredit tilgt der Zuschuss weiterhin den KfW-Kredit', () => {
    const r = runAll(neutral());
    expect(r.kfw.loans[0].name).toMatch(/^KfW-Kredit/);
    expect(r.kfw.loans[0].extras.some((e) => e.label === 'Zuschuss' && e.applied > 0)).toBe(true);
    expect(r.kfw.loans.filter((l) => l.name === 'Bankkredit').every((l) => l.extras.length === 0)).toBe(true);
  });

  it('Steuererstattungen tilgen den Bankkredit des Steuer-Wegs im Erstattungsmonat', () => {
    const on = runAll(withBank());
    const off = runAll(withBank((i) => (i.financing.taxRefundAsSpecialRepayment = false)));
    const extras = bank(on, 'tax').extras.filter((e) => e.label === 'Steuererstattung');
    expect(extras.map((e) => e.month)).toEqual(on.tax.taxRefunds!.map((t) => t.month));
    extras.forEach((e, i) => expect(e.applied).toBeCloseTo(on.tax.taxRefunds![i].amount, 6));
    expect(bank(off, 'tax').extras).toEqual([]);
    expect(bank(on, 'tax').totalInterest).toBeLessThan(bank(off, 'tax').totalInterest);
    expect(bank(on, 'tax').payoffMonth!).toBeLessThan(bank(off, 'tax').payoffMonth!);
    expect(on.tax.totalCost).toBeLessThan(off.tax.totalCost);
    const ev = keyEvents(withBank(), on).timeline.find((e) => e.title === 'Letzte Steuererstattung (§ 35c)')!;
    expect(ev.detail).toContain('Wird als Sondertilgung für den Bankkredit verwendet.');
  });
});
