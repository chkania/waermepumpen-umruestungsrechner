/** Helpers for absolute month indices (year*12 + month-1). */

export function parseMonth(s: string): number {
  const m = /^(\d{4})-(\d{1,2})$/.exec(String(s).trim());
  if (!m) throw new Error(`Ungültiger Monat: "${s}" (erwartet JJJJ-MM)`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error(`Ungültiger Monat: "${s}"`);
  return year * 12 + (month - 1);
}

export function tryParseMonth(s: string | undefined | null): number | null {
  if (!s) return null;
  try {
    return parseMonth(s);
  } catch {
    return null;
  }
}

export function formatMonth(abs: number): string {
  const y = Math.floor(abs / 12);
  const m = abs - y * 12 + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function formatMonthDe(abs: number): string {
  const y = Math.floor(abs / 12);
  const m = abs - y * 12 + 1;
  return `${String(m).padStart(2, '0')}/${y}`;
}

export function yearOf(abs: number): number {
  return Math.floor(abs / 12);
}

/** Calendar month 1–12. */
export function monthOf(abs: number): number {
  return abs - Math.floor(abs / 12) * 12 + 1;
}

export function monthFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Number of half-yearly degression steps in effect up to and including `abs`,
 * when the first step applies in month `start`.
 */
export function halfYearSteps(abs: number, start: number): number {
  if (abs < start) return 0;
  return Math.floor((abs - start) / 6) + 1;
}
