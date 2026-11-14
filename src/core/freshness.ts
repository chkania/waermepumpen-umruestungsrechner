import { FUNDING_SOURCE_DATE } from './defaults';

/**
 * Age of the stored assumptions (F22). After STALE_AFTER_MONTHS the calculator shows a notice that
 * funding conditions and prices may be outdated; it disappears once FUNDING_SOURCE_DATE is updated
 * during the quarterly review (workflow "Annahmen prüfen").
 */
export const STALE_AFTER_MONTHS = 6;

/** Full months between the last review (YYYY-MM-DD) and `today`. */
export function assumptionsAgeMonths(today: Date, lastReview: string = FUNDING_SOURCE_DATE): number {
  const [y, m, d] = lastReview.split('-').map(Number);
  let months = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m);
  if (today.getDate() < d) months--;
  return Math.max(0, months);
}

export function assumptionsStale(today: Date, lastReview: string = FUNDING_SOURCE_DATE): boolean {
  return assumptionsAgeMonths(today, lastReview) >= STALE_AFTER_MONTHS;
}
