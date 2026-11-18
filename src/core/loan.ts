/**
 * Rules for unscheduled repayments (special repayments (Sondertilgung)).
 * - KfW 358/359 (fact sheet (Merkblatt) p. 5): free of charge at any time from 5,000 € within the first fixed-rate period (Zinsbindung);
 *   afterwards only in full and against an early repayment charge (Vorfälligkeitsentschädigung).
 * - Bank/consumer loan (§ 500 (2), § 502 BGB): in full or in part at any time; early repayment charge
 *   at most 1 % (remaining term ≤ 1 year: 0.5 %) of the amount repaid early and no more than the
 *   contractual interest (Sollzinsen) until the end of the term.
 */
export interface PrepaymentRules {
  /** Minimum amount of a partial special repayment (Sondertilgung) (0 = none). */
  minAmount: number;
  /** Free of charge within the fixed-rate period (Zinsbindung) (KfW). */
  freeWithinFix: boolean;
  /** After the fixed-rate period (Zinsbindung) only full repayment is allowed (KfW). */
  fullOnlyAfterFix: boolean;
  /** Charge (share of the amount) if not free of charge. */
  feeRate: number;
  /** Charge for a remaining term ≤ 12 months (§ 502 BGB: 0.5 %). */
  feeRateShortRemaining: number;
  /** Cap the charge at the interest forgone (entgangene Sollzinsen) (§ 502 (3) BGB). */
  capFeeAtInterest: boolean;
  /**
   * Free special repayment allowance (kostenfreies Sondertilgungsrecht) per calendar year (€, 0 = none): up to this sum
   * per year, special repayments cost no charge; only the part above it does (F12.9).
   */
  freePerYear?: number;
}

export const NO_RULES: PrepaymentRules = {
  minAmount: 0,
  freeWithinFix: true,
  fullOnlyAfterFix: false,
  feeRate: 0,
  feeRateShortRemaining: 0,
  capFeeAtInterest: false,
};

export interface ExtraRepayment {
  month: number;
  amount: number;
  /** Label for results/notices, e.g. "Zuschuss". */
  label?: string;
}

export interface LoanSpec {
  principal: number;
  /** Payout month (Auszahlungsmonat, absolute); first instalment (Rate) in the following month. */
  startMonth: number;
  /** Nominal interest rate (Sollzins) p. a. (monthly compounding rate/12). */
  rate: number;
  termMonths: number;
  /** Repayment-free initial months (tilgungsfreie Anlaufzeit) (interest only). */
  graceMonths: number;
  /** End of the fixed-rate period (Zinsbindung) in months after payout (Auszahlung); followUpRate afterwards. 0 = entire term. */
  fixMonths: number;
  followUpRate: number;
  /** Special repayments (Sondertilgung) (instalment (Rate) stays, term gets shorter). */
  extraRepayments?: ExtraRepayment[];
  rules?: PrepaymentRules;
}

export interface LoanPayment {
  month: number;
  interest: number;
  principal: number;
  /** Of which special repayment (Sondertilgung). */
  extra: number;
  /** Early repayment charge (Vorfälligkeitsentschädigung) in this month. */
  fee: number;
  balance: number;
}

export type ExtraStatus = 'applied' | 'partial' | 'rejected';

export interface ExtraResult {
  month: number;
  label?: string;
  requested: number;
  /** Amount actually repaid. */
  applied: number;
  /** Of which free of charge within the yearly allowance (kostenfreies Sondertilgungsrecht). */
  freeAmount?: number;
  fee: number;
  status: ExtraStatus;
  /** Reason for rejection/reduction. */
  reason?: string;
  /** The loan was fully repaid by this. */
  paidOff: boolean;
}

export interface LoanResult {
  payments: LoanPayment[];
  extras: ExtraResult[];
}

export function annuity(balance: number, monthlyRate: number, months: number): number {
  if (months <= 0) return balance;
  if (monthlyRate === 0) return balance / months;
  return (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

/** Number of months until the remaining debt (Restschuld) is repaid at the same instalment (Rate) (rounded up). */
export function remainingMonths(balance: number, monthlyRate: number, payment: number): number {
  if (payment <= 0) return Infinity;
  if (monthlyRate === 0) return Math.ceil(balance / payment - 1e-9);
  const x = 1 - (balance * monthlyRate) / payment;
  if (x <= 0) return Infinity;
  return Math.ceil(-Math.log(x) / Math.log(1 + monthlyRate) - 1e-9);
}

const eur = (x: number) => `${Math.round(x).toLocaleString('de-DE')} €`;

/** Generates the repayment schedule of an annuity loan (Annuitätendarlehen) incl. validated special repayments (Sondertilgung). */
export function loanScheduleDetailed(spec: LoanSpec): LoanResult {
  const payments: LoanPayment[] = [];
  const extraResults: ExtraResult[] = [];
  const rules = spec.rules ?? NO_RULES;
  const extras = [...(spec.extraRepayments ?? [])].filter((e) => e.amount > 0).sort((a, b) => a.month - b.month);
  if (spec.principal <= 0 || spec.termMonths <= 0) {
    for (const e of extras) extraResults.push(reject(e, 'Kein Kredit vorhanden.'));
    return { payments, extras: extraResults };
  }
  const grace = Math.min(Math.max(0, spec.graceMonths), spec.termMonths - 1);
  const fix = spec.fixMonths > 0 ? Math.min(spec.fixMonths, spec.termMonths) : spec.termMonths;
  const lastMonth = spec.startMonth + spec.termMonths;

  let balance = spec.principal;
  let payment = 0;
  let prevRate = spec.rate;
  let k = 0; // Index of the next special repayment (Sondertilgung)
  /** Free allowance already used per calendar year. */
  const usedFree = new Map<number, number>();
  // Special repayments (Sondertilgung) before the first instalment (Rate) are not possible
  while (k < extras.length && extras[k].month <= spec.startMonth) {
    extraResults.push(reject(extras[k], 'Vor der Kreditauszahlung bzw. im Auszahlungsmonat nicht möglich.'));
    k++;
  }

  for (let i = 1; i <= spec.termMonths && balance > 1e-9; i++) {
    const month = spec.startMonth + i;
    const withinFix = i <= fix;
    const annualRate = withinFix ? spec.rate : spec.followUpRate;
    const q = annualRate / 12;
    // Recalculate the annuity when repayment starts and when the interest rate changes.
    // On an interest rate change, use the actual remaining term (shorter after special repayments (Sondertilgung)).
    if (i === grace + 1) {
      payment = annuity(balance, q, spec.termMonths - i + 1);
    } else if (i === fix + 1 && i > grace + 1) {
      const remaining = Math.min(spec.termMonths - i + 1, remainingMonths(balance, prevRate / 12, payment));
      payment = annuity(balance, q, remaining);
    }
    prevRate = annualRate;
    const interest = balance * q;
    let principal = 0;
    if (i > grace) {
      principal = i === spec.termMonths ? balance : Math.min(balance, payment - interest);
    }
    balance -= principal;

    let extra = 0;
    let fee = 0;
    while (k < extras.length && extras[k].month === month) {
      const e = extras[k++];
      if (balance <= 1e-9) {
        extraResults.push(reject(e, 'Kredit ist bereits getilgt.'));
        continue;
      }
      const year = Math.floor(month / 12);
      const freeLeft = Math.max(0, (rules.freePerYear ?? 0) - (usedFree.get(year) ?? 0));
      const r = applyRules(e, balance, withinFix, lastMonth - month, annualRate, rules, freeLeft);
      if (r.freeAmount) usedFree.set(year, (usedFree.get(year) ?? 0) + r.freeAmount);
      extraResults.push(r);
      extra += r.applied;
      fee += r.fee;
      balance -= r.applied;
    }
    if (balance < 0.005) balance = 0;
    payments.push({ month, interest, principal: principal + extra, extra, fee, balance });
  }
  while (k < extras.length) extraResults.push(reject(extras[k++], 'Kredit ist zu diesem Zeitpunkt bereits getilgt.'));
  return { payments, extras: extraResults };
}

function reject(e: ExtraRepayment, reason: string): ExtraResult {
  return { month: e.month, label: e.label, requested: e.amount, applied: 0, fee: 0, status: 'rejected', reason, paidOff: false };
}

function applyRules(
  e: ExtraRepayment,
  balance: number,
  withinFix: boolean,
  remainingMonths: number,
  annualRate: number,
  rules: PrepaymentRules,
  freeLeft = 0,
): ExtraResult {
  const full = e.amount >= balance - 0.005;
  if (!full) {
    if (!withinFix && rules.fullOnlyAfterFix) {
      return reject(e, `Nach Ende der ersten Zinsbindung ist nur eine vollständige Rückzahlung möglich (Restschuld ${eur(balance)}).`);
    }
    if (e.amount < rules.minAmount) {
      return reject(e, `Mindestbetrag für Sondertilgungen ${eur(rules.minAmount)} unterschritten.`);
    }
  }
  const applied = Math.min(e.amount, balance);
  let fee = 0;
  let freeAmount = 0;
  if (!(withinFix && rules.freeWithinFix)) {
    // Only the part above the yearly free allowance (kostenfreies Sondertilgungsrecht) costs a charge (F12.9)
    freeAmount = Math.min(applied, freeLeft);
    const charged = applied - freeAmount;
    const rate = remainingMonths <= 12 ? rules.feeRateShortRemaining : rules.feeRate;
    fee = charged * rate;
    if (rules.capFeeAtInterest) fee = Math.min(fee, (charged * annualRate * Math.max(0, remainingMonths)) / 12);
  }
  return {
    month: e.month,
    label: e.label,
    requested: e.amount,
    applied,
    ...(freeAmount > 0 ? { freeAmount } : {}),
    fee,
    status: applied < e.amount - 0.005 ? 'partial' : 'applied',
    reason: applied < e.amount - 0.005 ? `Nur die Restschuld von ${eur(applied)} konnte getilgt werden.` : undefined,
    paidOff: full,
  };
}

/** Repayment schedule without details on special repayments (Sondertilgung). */
export function loanSchedule(spec: LoanSpec): LoanPayment[] {
  return loanScheduleDetailed(spec).payments;
}
