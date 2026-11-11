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
  /** Sondertilgungen (werden auf die Restschuld begrenzt; Rate bleibt, Laufzeit verkürzt sich). */
  extraRepayments?: { month: number; amount: number }[];
}

export interface LoanPayment {
  month: number;
  interest: number;
  principal: number;
  /** Davon Sondertilgung. */
  extra: number;
  balance: number;
}

export function annuity(balance: number, monthlyRate: number, months: number): number {
  if (months <= 0) return balance;
  if (monthlyRate === 0) return balance / months;
  return (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

/** Erzeugt den Tilgungsplan eines Annuitätendarlehens. */
export function loanSchedule(spec: LoanSpec): LoanPayment[] {
  const out: LoanPayment[] = [];
  if (spec.principal <= 0 || spec.termMonths <= 0) return out;
  const grace = Math.min(Math.max(0, spec.graceMonths), spec.termMonths - 1);
  const fix = spec.fixMonths > 0 ? spec.fixMonths : spec.termMonths;
  const extras = new Map<number, number>();
  for (const e of spec.extraRepayments ?? []) extras.set(e.month, (extras.get(e.month) ?? 0) + e.amount);

  let balance = spec.principal;
  let payment = 0;
  for (let i = 1; i <= spec.termMonths && balance > 1e-9; i++) {
    const month = spec.startMonth + i;
    const annualRate = i <= fix ? spec.rate : spec.followUpRate;
    const q = annualRate / 12;
    // Annuität neu bestimmen bei Tilgungsbeginn und bei Zinswechsel
    if (i === grace + 1 || (i === fix + 1 && i > grace + 1)) {
      payment = annuity(balance, q, spec.termMonths - i + 1);
    }
    const interest = balance * q;
    let principal = 0;
    if (i > grace) {
      principal = i === spec.termMonths ? balance : Math.min(balance, payment - interest);
    }
    balance -= principal;
    let extra = 0;
    const ex = extras.get(month);
    if (ex && balance > 0) {
      extra = Math.min(ex, balance);
      balance -= extra;
    }
    out.push({ month, interest, principal: principal + extra, extra, balance });
  }
  return out;
}
