import { formatMonthDe } from '../core/dates';

const eur0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num = (d: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: d, minimumFractionDigits: d });

export const fmtEur = (x: number) => eur0.format(Math.round(x) === 0 ? 0 : x);
export const fmtNum = (x: number, digits = 0) => num(digits).format(x);
export const fmtPct = (x: number, digits = 0) => `${num(digits).format(x * 100)} %`;
export const fmtMonth = (abs: number | null) => (abs === null ? '–' : formatMonthDe(abs));

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Escaped `href` value for an external link. Only http(s) is allowed; anything else becomes "#".
 * Source URLs are constants today, but this keeps the N6 rule "escape all dynamic text" intact if they are ever loaded from data.
 */
export function safeHref(url: string): string {
  try {
    const protocol = new URL(url).protocol;
    if (protocol !== 'https:' && protocol !== 'http:') return '#';
  } catch {
    return '#';
  }
  return escapeHtml(url);
}

/** Duration in months as "x J. y M." */
export function fmtDuration(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} Mon.`;
  return m === 0 ? `${y} J.` : `${y} J. ${m} Mon.`;
}
