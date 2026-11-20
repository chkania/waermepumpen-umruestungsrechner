/**
 * Household income ranges (Einkommensbereiche, F5.4). Instead of an exact taxable household income (zu versteuerndes
 * Haushaltseinkommen) the owner picks one of six ranges. The ranges follow the income limits of the KfW funding
 * (income bonus, guideline (Richtlinie) no. 8.4.5; loan 358, no. 8.1 and 8.5.2 a).
 *
 * Each range has a fixed code (stored in the data), a label in the wording of the guideline and a calculation value
 * (Rechenwert). The calculation runs with the calculation value. With the standard funding parameters every income in
 * a range falls into the same income-bonus step (with and without child) and the same loan variant, so the result
 * equals the one for the exact income.
 */

export interface IncomeRange {
  /** Stored code, e.g. "40001-50000". */
  code: string;
  /** Label in the wording of guideline (Richtlinie) no. 8.4.5, e.g. "über 40.000 bis 50.000 €". */
  label: string;
  /** Inclusive upper bound (Obergrenze) in € used to assign an older exact amount (≤, as in incomeBonusRate). */
  upper: number;
  /** Calculation value (Rechenwert) in €: the upper bound of the range; "over 90,000 €" counts as 100,000 €. */
  value: number;
}

export const INCOME_RANGES: readonly IncomeRange[] = [
  { code: '0-30000', label: 'bis 30.000 €', upper: 30000, value: 30000 },
  { code: '30001-40000', label: 'über 30.000 bis 40.000 €', upper: 40000, value: 40000 },
  { code: '40001-50000', label: 'über 40.000 bis 50.000 €', upper: 50000, value: 50000 },
  { code: '50001-60000', label: 'über 50.000 bis 60.000 €', upper: 60000, value: 60000 },
  { code: '60001-90000', label: 'über 60.000 bis 90.000 €', upper: 90000, value: 90000 },
  { code: '90001+', label: 'über 90.000 €', upper: Infinity, value: 100000 },
];

/** Standard range (over 50,000 to 60,000 €); it matches the former standard of 60,000 € (F5.4). */
export const DEFAULT_INCOME_RANGE = '50001-60000';

/** Range entry for a code. Throws an Error naming the code if it is unknown (precondition: a code validated by SELECT_VALUES, F9.5). */
function rangeByCode(code: string): IncomeRange {
  const range = INCOME_RANGES.find((r) => r.code === code);
  if (!range) throw new Error(`Unbekannter Einkommensbereich: ${code}`);
  return range;
}

/**
 * Calculation value (Rechenwert) of a range code. Precondition: `code` is one of INCOME_RANGES;
 * an unknown code throws an Error that names the code.
 */
export function incomeRangeValue(code: string): number {
  return rangeByCode(code).value;
}

/**
 * Label of a range code (for hints and the calculation). Precondition: `code` is one of INCOME_RANGES;
 * an unknown code throws an Error that names the code.
 */
export function incomeRangeLabel(code: string): string {
  return rangeByCode(code).label;
}

/**
 * Assigns an exact amount (e.g. from an older data set, F9.5) to the range that contains it.
 * Upper bounds are inclusive; the last range has no upper bound, so every finite amount is assigned.
 * Precondition: `amount` is finite. NaN, Infinity and −Infinity throw an Error that names the value
 * (the migration checks finiteness before calling this function).
 */
export function incomeRangeOfAmount(amount: number): string {
  if (!Number.isFinite(amount)) throw new Error(`Kein endlicher Betrag für einen Einkommensbereich: ${amount}`);
  return INCOME_RANGES.find((r) => amount <= r.upper)!.code;
}
