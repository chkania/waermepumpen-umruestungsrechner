import type { RunResult } from './simulation';
import type { ScenarioResult } from './types';

/**
 * Monthly burden (monatliche Belastung, F36): what each scenario costs per month while it runs, compared with today.
 * Running payments only – energy, standing charges (Grund-/Zählerkosten), maintenance (Wartung) and the regular loan
 * instalment (Kreditrate: interest + scheduled repayment). One-off amounts would distort single months and are listed
 * separately: investment (own share after the loan payout), replacement boiler (Ersatzkessel), subsidy (Zuschuss),
 * tax refunds (Steuererstattung), special repayments (Sondertilgung) incl. early repayment charges and the payoff of a
 * remaining debt (Restschuld) at the end. The residual value (Restwert) is no payment and is left out.
 * Nominal amounts (with price increases, without opportunity interest (Opportunitätszins)), from the same run as all results.
 */

export type BurdenKind = 'ref' | 'kfw' | 'tax';

/** A 12-month period from the start month (the last one may be shorter). */
export interface BurdenYear {
  /** First and last month of the period (absolute months). */
  from: number;
  to: number;
  /** Number of months in the period. */
  months: number;
  /** Average running payments per month (€); null if the scenario is not feasible. */
  perMonth: Record<BurdenKind, number | null>;
}

export interface OneOffYear {
  from: number;
  to: number;
  /** Sum of the one-off amounts in the year (€, positive = expense, negative = income); null if not feasible. */
  amount: Record<BurdenKind, number | null>;
}

export interface MonthlyBurden {
  /** Average running payments per month today: first (up to) 12 months without heat pump (€). */
  today: number;
  /** Number of months the value "today" is based on. */
  todayMonths: number;
  /** Split of "today" per month: energy, standing charges (Grund-/Zählerkosten), maintenance (Wartung) (€). */
  todayParts: { energy: number; fixed: number; maintenance: number };
  years: BurdenYear[];
  /** Only years with one-off amounts in at least one scenario. */
  oneOffs: OneOffYear[];
  /** Average running payments per month over the whole period. */
  average: Record<BurdenKind, number | null>;
}

const KINDS: BurdenKind[] = ['ref', 'kfw', 'tax'];

/** Running payments per month of a scenario (special repayments and the final payoff removed from the repayment). */
export function runningPayments(s: ScenarioResult): number[] {
  const start = s.months[0].month;
  const extra = new Array<number>(s.months.length).fill(0);
  for (const loan of s.loans) {
    for (const x of loan.extras) {
      const i = x.month - start;
      if (i >= 0 && i < extra.length) extra[i] += x.applied;
    }
    extra[extra.length - 1] += loan.balanceAtEnd;
  }
  return s.months.map((m, i) => m.energy + m.fixed + m.maintenance + m.interest + m.principal - extra[i]);
}

export function monthlyBurden(run: RunResult): MonthlyBurden {
  const ok = (k: BurdenKind) => k === 'ref' || run[k].feasible;
  const running = Object.fromEntries(KINDS.map((k) => [k, runningPayments(run[k])])) as Record<BurdenKind, number[]>;
  const months = run.ref.months;
  const n = Math.min(12, months.length);
  const today = running.ref.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const avgOf = (k: 'energy' | 'fixed' | 'maintenance') => months.slice(0, n).reduce((a, m) => a + m[k], 0) / n;
  const todayParts = { energy: avgOf('energy'), fixed: avgOf('fixed'), maintenance: avgOf('maintenance') };

  const years: BurdenYear[] = [];
  const oneOffs: OneOffYear[] = [];
  // 12-month periods from the start month: a calendar year cut off at the start would contain only winter months
  for (let i = 0; i < months.length; i += 12) {
    const j = Math.min(i + 12, months.length);
    const count = j - i;
    const sum = (f: (idx: number) => number) => {
      let t = 0;
      for (let x = i; x < j; x++) t += f(x);
      return t;
    };
    const perMonth = {} as Record<BurdenKind, number | null>;
    const amount = {} as Record<BurdenKind, number | null>;
    for (const k of KINDS) {
      const s = run[k];
      perMonth[k] = ok(k) ? sum((x) => running[k][x]) / count : null;
      amount[k] = ok(k) ? sum((x) => s.months[x].total - s.months[x].residual - running[k][x]) : null;
    }
    const from = months[i].month;
    const to = months[j - 1].month;
    years.push({ from, to, months: count, perMonth });
    if (KINDS.some((k) => Math.abs(amount[k] ?? 0) >= 0.5)) oneOffs.push({ from, to, amount });
  }
  const average = Object.fromEntries(
    KINDS.map((k) => [k, ok(k) ? running[k].reduce((a, b) => a + b, 0) / running[k].length : null]),
  ) as Record<BurdenKind, number | null>;
  return { today, todayMonths: n, todayParts, years, oneOffs, average };
}
