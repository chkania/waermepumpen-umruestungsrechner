/**
 * Regeln für außerplanmäßige Tilgungen (Sondertilgungen).
 * - KfW 358/359 (Merkblatt S. 5): innerhalb der ersten Zinsbindung ab 5.000 € jederzeit kostenfrei;
 *   danach nur vollständig und gegen Vorfälligkeitsentschädigung.
 * - Bank-/Verbraucherkredit (§ 500 Abs. 2, § 502 BGB): jederzeit ganz oder teilweise; Vorfälligkeitsentschädigung
 *   höchstens 1 % (Restlaufzeit ≤ 1 Jahr: 0,5 %) des vorzeitig zurückgezahlten Betrags und nicht mehr als die
 *   Sollzinsen bis zum Laufzeitende.
 */
export interface PrepaymentRules {
  /** Mindestbetrag einer Teil-Sondertilgung (0 = keiner). */
  minAmount: number;
  /** Innerhalb der Zinsbindung kostenfrei (KfW). */
  freeWithinFix: boolean;
  /** Nach Ende der Zinsbindung nur vollständige Rückzahlung erlaubt (KfW). */
  fullOnlyAfterFix: boolean;
  /** Entschädigung (Anteil des Betrags), wenn nicht kostenfrei. */
  feeRate: number;
  /** Entschädigung bei Restlaufzeit ≤ 12 Monate (§ 502 BGB: 0,5 %). */
  feeRateShortRemaining: number;
  /** Entschädigung auf die entgangenen Sollzinsen begrenzen (§ 502 Abs. 3 BGB). */
  capFeeAtInterest: boolean;
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
  /** Bezeichnung für Ergebnisse/Hinweise, z. B. „Zuschuss“. */
  label?: string;
}

export interface LoanSpec {
  principal: number;
  /** Auszahlungsmonat (absolut); erste Rate im Folgemonat. */
  startMonth: number;
  /** Sollzins p. a. (nominal, monatliche Verzinsung rate/12). */
  rate: number;
  termMonths: number;
  /** Tilgungsfreie Anlaufmonate (nur Zinsen). */
  graceMonths: number;
  /** Ende der Zinsbindung in Monaten ab Auszahlung; danach followUpRate. 0 = gesamte Laufzeit. */
  fixMonths: number;
  followUpRate: number;
  /** Sondertilgungen (Rate bleibt, Laufzeit verkürzt sich). */
  extraRepayments?: ExtraRepayment[];
  rules?: PrepaymentRules;
}

export interface LoanPayment {
  month: number;
  interest: number;
  principal: number;
  /** Davon Sondertilgung. */
  extra: number;
  /** Vorfälligkeitsentschädigung in diesem Monat. */
  fee: number;
  balance: number;
}

export type ExtraStatus = 'applied' | 'partial' | 'rejected';

export interface ExtraResult {
  month: number;
  label?: string;
  requested: number;
  /** Tatsächlich getilgter Betrag. */
  applied: number;
  fee: number;
  status: ExtraStatus;
  /** Begründung bei Ablehnung/Kürzung. */
  reason?: string;
  /** Kredit war damit vollständig getilgt. */
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

/** Anzahl Monate, bis die Restschuld bei gleicher Rate getilgt ist (aufgerundet). */
export function remainingMonths(balance: number, monthlyRate: number, payment: number): number {
  if (payment <= 0) return Infinity;
  if (monthlyRate === 0) return Math.ceil(balance / payment - 1e-9);
  const x = 1 - (balance * monthlyRate) / payment;
  if (x <= 0) return Infinity;
  return Math.ceil(-Math.log(x) / Math.log(1 + monthlyRate) - 1e-9);
}

const eur = (x: number) => `${Math.round(x).toLocaleString('de-DE')} €`;

/** Erzeugt den Tilgungsplan eines Annuitätendarlehens inkl. geprüfter Sondertilgungen. */
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
  let k = 0; // Index der nächsten Sondertilgung
  // Sondertilgungen vor der ersten Rate sind nicht möglich
  while (k < extras.length && extras[k].month <= spec.startMonth) {
    extraResults.push(reject(extras[k], 'Vor der Kreditauszahlung bzw. im Auszahlungsmonat nicht möglich.'));
    k++;
  }

  for (let i = 1; i <= spec.termMonths && balance > 1e-9; i++) {
    const month = spec.startMonth + i;
    const withinFix = i <= fix;
    const annualRate = withinFix ? spec.rate : spec.followUpRate;
    const q = annualRate / 12;
    // Annuität neu bestimmen bei Tilgungsbeginn und bei Zinswechsel.
    // Beim Zinswechsel wird auf die tatsächlich verbleibende Laufzeit gerechnet (nach Sondertilgungen kürzer).
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
      const r = applyRules(e, balance, withinFix, lastMonth - month, annualRate, rules);
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
  if (!(withinFix && rules.freeWithinFix)) {
    const rate = remainingMonths <= 12 ? rules.feeRateShortRemaining : rules.feeRate;
    fee = applied * rate;
    if (rules.capFeeAtInterest) fee = Math.min(fee, (applied * annualRate * Math.max(0, remainingMonths)) / 12);
  }
  return {
    month: e.month,
    label: e.label,
    requested: e.amount,
    applied,
    fee,
    status: applied < e.amount - 0.005 ? 'partial' : 'applied',
    reason: applied < e.amount - 0.005 ? `Nur die Restschuld von ${eur(applied)} konnte getilgt werden.` : undefined,
    paidOff: full,
  };
}

/** Tilgungsplan ohne Detailinformationen zu Sondertilgungen. */
export function loanSchedule(spec: LoanSpec): LoanPayment[] {
  return loanScheduleDetailed(spec).payments;
}
