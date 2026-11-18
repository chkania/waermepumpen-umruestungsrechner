import { describe, expect, it } from 'vitest';
import { monthlyBurden, runningPayments } from '../src/core/burden';
import { runAll } from '../src/core/simulation';
import type { Inputs } from '../src/core/types';
import { burdenHtml, diffText, todayPartsText } from '../src/ui/burden';
import { defaults, pinned } from './helpers';

/** F36 monthly burden (monatliche Belastung). */
const burden = (mut?: (i: Inputs) => void) => {
  const i = pinned();
  mut?.(i);
  const run = runAll(i);
  return { run, b: monthlyBurden(run) };
};

describe('F36 Monatliche Belastung', () => {
  it('heute = Durchschnitt der ersten 12 Monate ohne Wärmepumpe; Zeiträume à 12 Monate ab Start', () => {
    const { run, b } = burden();
    const first = runningPayments(run.ref).slice(0, 12);
    expect(b.today).toBeCloseTo(first.reduce((a, x) => a + x, 0) / 12, 6);
    expect(b.years[0].perMonth.ref).toBeCloseTo(b.today, 6);
    expect(b.years[0].from).toBe(run.ref.months[0].month);
    expect(b.years.every((y) => y.months === 12)).toBe(true); // 20 years = 240 months
    expect(b.years).toHaveLength(20);
  });

  it('heute ist aufgeteilt in Energie, Grund- und Zählerkosten und Wartung', () => {
    const { run, b } = burden();
    const p = b.todayParts;
    expect(p.energy + p.fixed + p.maintenance).toBeCloseTo(b.today, 6); // no loan without heat pump
    expect(p.maintenance).toBeCloseTo(run.ref.months.slice(0, 12).reduce((a, m) => a + m.maintenance, 0) / 12, 6);
    expect(todayPartsText(b)).toMatch(/^Energie \d+\u00a0€, Grund- und Zählerkosten \d+\u00a0€, Wartung \d+\u00a0€$/);
    expect(burdenHtml(run, b)).toContain(todayPartsText(b));
  });

  it('laufende Zahlungen + einmalige Beträge + Restwert ergeben die Summe ohne Verzinsung', () => {
    const { run, b } = burden();
    for (const k of ['ref', 'kfw', 'tax'] as const) {
      const s = run[k];
      const running = b.years.reduce((a, y) => a + y.perMonth[k]! * y.months, 0);
      const oneOff = b.oneOffs.reduce((a, o) => a + o.amount[k]!, 0);
      const residual = s.months.reduce((a, m) => a + m.residual, 0);
      expect(running + oneOff + residual, k).toBeCloseTo(s.nominalCost, 4);
    }
  });

  it('Kreditrate ist enthalten, Zuschuss-Sondertilgung und Ablösung der Restschuld nicht', () => {
    const { run, b } = burden();
    const kfw = run.kfw;
    const loan = kfw.loans[0];
    expect(loan.extras.some((x) => x.applied > 0)).toBe(true); // subsidy as special repayment (Sondertilgung)
    const running = runningPayments(kfw);
    const sm = loan.extras[0].month - kfw.months[0].month;
    // the month of the special repayment is not higher than its neighbours by the repaid amount
    expect(running[sm]).toBeLessThan(running[sm - 1] + 100);
    // with a remaining debt at the end, the payoff is a one-off amount of the last period
    if (loan.balanceAtEnd > 0) expect(b.oneOffs.at(-1)!.amount.kfw).toBeGreaterThanOrEqual(loan.balanceAtEnd - 0.01);
    // instalment: after the repayment-free period the burden contains interest + repayment
    const m = kfw.months.findIndex((x) => x.principal > 0 && x.month > loan.extras[0].month);
    expect(running[m]).toBeCloseTo(kfw.months[m].energy + kfw.months[m].fixed + kfw.months[m].maintenance + kfw.months[m].interest + kfw.months[m].principal, 6);
  });

  it('Einmalzahlung als Sondertilgung erscheint bei den einmaligen Beträgen', () => {
    const { run, b } = burden((i) => {
      i.financing.windfallAmount = 8000;
      i.financing.windfallMonth = '2030-01';
    });
    const w = run.tax.windfall!;
    expect(w.used).toBeGreaterThan(0);
    const without = burden().b;
    const at = (x: typeof b) => x.oneOffs.find((o) => o.from <= w.month && w.month <= o.to)?.amount.tax ?? 0;
    // special repayment (Sondertilgung) + early repayment charge (Vorfälligkeitsentschädigung) on top of the other one-offs of the period
    expect(at(b) - at(without)).toBeCloseTo(w.used + w.fees, 4);
  });

  it('nicht mögliches Szenario: null statt Betrag', () => {
    const { b } = burden((i) => (i.heatPump.installMonth = '2031-01')); // after the § 35c deadline
    expect(b.years[0].perMonth.tax).toBeNull();
    expect(b.average.tax).toBeNull();
  });

  it('Karte: Tabelle mit drei Szenarien, Unterschied zu heute, niedrigster Wert markiert', () => {
    const run = runAll(defaults());
    const html = burdenHtml(run);
    expect(html).toContain('<h2>Monatliche Belastung</h2>');
    expect(html).toContain('Ohne WP</th>');
    expect(html).toContain('WP + Steuer</th>');
    expect(html).toContain('gegenüber heute');
    expect(html).toContain('>Durchschnitt<');
    expect(html).toContain('Einmalige Beträge (nicht in den Monatswerten)');
    expect(html.match(/<tbody>[\s\S]*?<\/tbody>/)![0].match(/<tr>/g)).toHaveLength(20);
    expect(html).toContain('class="num is-best"');
    expect(diffText(12.4)).toBe('+12 €');
    expect(diffText(-80)).toBe('−80 €');
    expect(diffText(0.3)).toBe('±0 €');
  });
});
