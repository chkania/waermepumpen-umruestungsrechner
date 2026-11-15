import { MAX_VARIANTS, type VariantResult } from '../core/variants';
import { getPath, SECTIONS } from './fields';
import { escapeHtml, fmtEur, fmtMonth, fmtNum } from './format';
import { fieldText } from './report';

/** Variant comparison (F31): key figures side by side and the inputs that differ. Pure HTML strings. */

const t1 = (x: number) => x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Key figures per variant; the highest saving is marked. */
export function variantsTableHtml(rs: VariantResult[]): string {
  const top = Math.max(...rs.map((r) => r.saving));
  const rows: [string, (r: VariantResult) => string][] = [
    ['Ohne Wärmepumpe', (r) => fmtEur(r.run.ref.totalCost)],
    ['WP + KfW-Zuschuss', (r) => fmtEur(r.run.kfw.totalCost)],
    ['WP + Steuerbonus', (r) => (r.run.tax.feasible ? fmtEur(r.run.tax.totalCost) : 'nicht möglich')],
    ['Bester Weg', (r) => (r.best === 'tax' ? 'Steuerbonus' : 'KfW-Zuschuss')],
    ['Ersparnis mit WP', (r) => `${r.saving < 0 ? '−' : ''}${fmtEur(Math.abs(r.saving))}${r.saving === top && rs.length > 1 ? ' ★' : ''}`],
    ['Amortisation', (r) => (r.breakEven === null ? 'nicht im Zeitraum' : fmtMonth(r.breakEven))],
    ['CO₂-Einsparung', (r) => `${t1(r.co2Saved)} t`],
    ['Inbetriebnahme WP', (r) => fmtMonth(r.run.kfw.installMonth)],
    ['Investition WP', (r) => fmtEur(r.inputs.heatPump.investment)],
    ['Zuschuss bzw. Steuerbonus', (r) => fmtEur(r.best === 'tax' ? (r.run.tax.tax?.total ?? 0) : (r.run.kfw.kfw?.subsidy ?? 0))],
    ['Jahresarbeitszahl', (r) => fmtNum(r.inputs.heatPump.jaz, 1)],
    ['Betrachtung', (r) => `${fmtMonth(r.run.ref.months[0].month)} – ${fmtMonth(r.run.ref.months[r.run.ref.months.length - 1].month)}`],
  ];
  return `<div class="table-wrap"><table class="compact variants-table"><caption class="visually-hidden">Kennzahlen der Varianten nebeneinander</caption>
    <thead><tr><th scope="col">Kennzahl</th>${rs.map((r) => `<th scope="col" class="num">${escapeHtml(r.name)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map(([label, f]) => `<tr><th scope="row">${label}</th>${rs.map((r) => `<td class="num">${escapeHtml(f(r))}</td>`).join('')}</tr>`)
      .join('')}</tbody></table></div>
    ${rs.length > 1 ? '<p class="muted small">★ höchste Ersparnis. Jede Variante wird mit ihrer eigenen Referenz „ohne Wärmepumpe“ verglichen – unterscheiden sich z. B. Verbrauch oder Zeitraum, ist auch die Referenz eine andere.</p>' : ''}`;
}

export interface VariantDiff {
  section: string;
  label: string;
  values: string[];
}

/**
 * Inputs whose values differ between the variants (all sections incl. expert sections; without name and notes).
 * Fields hidden in the form of every variant are skipped; where only some variants show a field, the others get "–".
 */
export function variantDiffs(rs: VariantResult[]): VariantDiff[] {
  const out: VariantDiff[] = [];
  for (const s of SECTIONS) {
    for (const f of s.fields) {
      if (f.path === 'scenario.name' || f.type === 'textarea') continue;
      // Fields that do not apply to a variant (e.g. the heating oil price with a gas boiler) are left out there
      const shown = rs.map((r) => (f.show ? f.show(r.inputs) : true));
      if (!shown.some(Boolean)) continue;
      const raw = rs.map((r, i) => (shown[i] ? JSON.stringify(getPath(r.inputs, f.path)) : null));
      if (raw.every((v) => v === raw[0])) continue;
      out.push({ section: s.title, label: f.label, values: rs.map((r, i) => (shown[i] ? fieldText(f, r.inputs) : '–')) });
    }
  }
  return out;
}

export function variantDiffsHtml(rs: VariantResult[]): string {
  const diffs = variantDiffs(rs);
  if (diffs.length === 0) return '<p class="muted">Die Varianten haben dieselben Eingaben.</p>';
  return `<div class="table-wrap"><table class="compact variants-table"><caption class="visually-hidden">Eingaben, die sich zwischen den Varianten unterscheiden</caption>
    <thead><tr><th scope="col">Eingabe</th>${rs.map((r) => `<th scope="col" class="num">${escapeHtml(r.name)}</th>`).join('')}</tr></thead>
    <tbody>${diffs
      .map(
        (d) =>
          `<tr><th scope="row">${escapeHtml(d.label)} <small class="muted">${escapeHtml(d.section)}</small></th>${d.values.map((v) => `<td class="num">${escapeHtml(v)}</td>`).join('')}</tr>`,
      )
      .join('')}</tbody></table></div>`;
}

/** Years and cumulative costs (best way and reference) per variant – data for the chart and its table. */
export function variantCurves(rs: VariantResult[]): { years: number[]; series: { name: string; best: (number | null)[]; ref: (number | null)[] }[] } {
  const years = [...new Set(rs.flatMap((r) => r.run.ref.years.map((y) => y.year)))].sort((a, b) => a - b);
  const series = rs.map((r) => {
    const s = r.best === 'tax' ? r.run.tax : r.run.kfw;
    const at = (list: { year: number; cumulative: number }[]) => years.map((y) => list.find((x) => x.year === y)?.cumulative ?? null);
    return { name: r.name, best: at(s.years), ref: at(r.run.ref.years) };
  });
  return { years, series };
}

export function variantCurvesTableHtml(rs: VariantResult[]): string {
  const { years, series } = variantCurves(rs);
  const v = (x: number | null) => (x === null ? '–' : fmtEur(x));
  return `<table class="compact"><caption>Kumulierte Kosten je Jahr: bester Weg mit Wärmepumpe und ohne Wärmepumpe je Variante</caption>
    <thead><tr><th scope="col">Jahr</th>${series.map((s) => `<th scope="col" class="num">${escapeHtml(s.name)} – mit WP</th><th scope="col" class="num">${escapeHtml(s.name)} – ohne WP</th>`).join('')}</tr></thead>
    <tbody>${years.map((y, i) => `<tr><th scope="row">${y}</th>${series.map((s) => `<td class="num">${v(s.best[i])}</td><td class="num">${v(s.ref[i])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

export const VARIANTS_LIMIT_TEXT = `Höchstens ${MAX_VARIANTS} Varianten – entfernen Sie zuerst eine.`;
