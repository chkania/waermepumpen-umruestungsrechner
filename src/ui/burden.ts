import { monthlyBurden, type BurdenKind, type MonthlyBurden } from '../core/burden';
import type { RunResult } from '../core/simulation';
import { fmtEur, fmtMonth } from './format';

/** Card "Monatliche Belastung" (F36): running payments per month of the three scenarios, compared with today. */

/** Short column heads so the table fits on a phone; the caption names the scenarios in full. */
const NAMES: [BurdenKind, string][] = [
  ['ref', 'Ohne WP'],
  ['kfw', 'WP + KfW'],
  ['tax', 'WP + Steuer'],
];

/** Difference to today: "+12 €" / "−80 €" / "±0 €". */
export function diffText(x: number): string {
  if (Math.round(x) === 0) return '±0 €';
  return `${x > 0 ? '+' : '−'}${fmtEur(Math.abs(x))}`;
}

/** One-off amount from the household's view: expense "−", income "+". */
const oneOffText = (x: number | null) => (x === null ? 'nicht möglich' : Math.round(x) === 0 ? '–' : `${x > 0 ? '−' : '+'}${fmtEur(Math.abs(x))}`);

/** Short month "11/26" – the full range is in the visually hidden text. */
const shortMonth = (abs: number) => `${String((abs % 12) + 1).padStart(2, '0')}/${String(Math.floor(abs / 12) % 100).padStart(2, '0')}`;
const period = (from: number, to: number) =>
  from === to
    ? fmtMonth(from)
    : `<span aria-hidden="true">${shortMonth(from)}–${shortMonth(to)}</span><span class="visually-hidden">${fmtMonth(from)} bis ${fmtMonth(to)}</span>`;

function rowCells(perMonth: Record<BurdenKind, number | null>, today: number): string {
  const values = NAMES.map(([k]) => perMonth[k]).filter((v): v is number => v !== null);
  const min = Math.min(...values);
  return NAMES.map(([k]) => {
    const v = perMonth[k];
    if (v === null) return '<td class="num muted">nicht möglich</td>';
    const best = values.length > 1 && Math.round(v) === Math.round(min);
    return `<td class="num${best ? ' is-best' : ''}"><span class="burden-val">${fmtEur(v)}</span>${best ? '<span class="visually-hidden"> (am niedrigsten)</span>' : ''} <span class="burden-diff">(${diffText(v - today)}<span class="visually-hidden"> gegenüber heute</span>)</span></td>`;
  }).join('');
}

/** "Energie 182 €, Grund- und Zählerkosten 15 €, Wartung 38 €" – parts that are zero are left out. */
export function todayPartsText(b: MonthlyBurden): string {
  const p = b.todayParts;
  return (
    [
      ['Energie', p.energy],
      ['Grund- und Zählerkosten', p.fixed],
      ['Wartung', p.maintenance],
    ] as const
  )
    .filter(([, v]) => Math.round(v) !== 0)
    .map(([l, v]) => `${l} ${fmtEur(v)}`)
    .join(', ');
}

export function burdenHtml(run: RunResult, b: MonthlyBurden = monthlyBurden(run)): string {
  const head = `<tr><th scope="col">Zeitraum</th>${NAMES.map(([, l]) => `<th scope="col" class="num">${l}</th>`).join('')}</tr>`;
  const rows = b.years
    .map((y) => `<tr><td class="burden-period">${period(y.from, y.to)}${y.months < 12 ? ` <span class="muted">(${y.months} Mon.)</span>` : ''}</td>${rowCells(y.perMonth, b.today)}</tr>`)
    .join('');
  const avg = `<tr><td class="burden-period">Durchschnitt</td>${rowCells(b.average, b.today)}</tr>`;
  const oneOffs = b.oneOffs.length
    ? `<details class="burden-oneoffs"><summary>Einmalige Beträge (nicht in den Monatswerten)</summary>
        <div class="table-wrap"><table class="compact">
          <caption class="visually-hidden">Einmalige Beträge je Zeitraum; − = Ausgabe, + = Einnahme</caption>
          <thead>${head}</thead>
          <tbody>${b.oneOffs.map((o) => `<tr><td class="burden-period">${period(o.from, o.to)}</td>${NAMES.map(([k]) => `<td class="num">${oneOffText(o.amount[k])}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
        <p class="muted small">− = Ausgabe, + = Einnahme: Eigenanteil der Investition, Ersatzkessel bzw. Ersatz-Wärmepumpe, Zuschuss, Steuererstattungen, Sondertilgungen samt Vorfälligkeitsentschädigung und die Ablösung einer Restschuld am Ende.</p>
      </details>`
    : '';
  return `<h2>Monatliche Belastung</h2>
    <p class="burden-lead">Heute zahlen Sie für Heizung${run.ref.months.some((m) => m.cookingCost > 0) ? ' und Kochen' : ''} rund <strong>${fmtEur(b.today)} im Monat</strong>: ${todayPartsText(b)} – Durchschnitt der ersten ${b.todayMonths} Monate ohne Wärmepumpe, mit Preissteigerung. So entwickelt sich die monatliche Belastung – je Zeitraum von 12 Monaten gemittelt, damit Winter und Sommer gleich zählen:</p>
    <div class="table-wrap"><table class="compact burden-table">
      <caption class="visually-hidden">Monatliche Belastung je Zeitraum ohne Wärmepumpe, mit Wärmepumpe und KfW-Zuschuss sowie mit Wärmepumpe und Steuerbonus, mit Unterschied zu heute</caption>
      <thead>${head}</thead>
      <tbody>${rows}</tbody>
      <tfoot>${avg}</tfoot>
    </table></div>
    <p class="muted small">Enthalten: Energie, Grund- und Zählerkosten, Wartung und die Kreditrate (Zinsen und Tilgung). Beträge mit Preissteigerung, ohne Opportunitätszins. In Klammern: Unterschied zu heute. Fett = niedrigste Belastung im Zeitraum. „Durchschnitt“ = über den ganzen Betrachtungszeitraum.</p>
    ${oneOffs}`;
}
