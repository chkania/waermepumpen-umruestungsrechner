import type { InstallComparison } from '../core/compare';
import { tryParseMonth } from '../core/dates';
import { FUNDING_SOURCE_DATE } from '../core/defaults';
import type { KeyEvents } from '../core/events';
import { rateHouse } from '../core/house';
import { estimateJaz } from '../core/jaz';
import { pvSummary } from '../core/pv';
import type { RunResult } from '../core/simulation';
import type { Inputs } from '../core/types';
import { logoSvg } from '../logo';
import { APP_VERSION } from '../version';
import { getPath, SECTIONS, type Field } from './fields';
import { escapeHtml, fmtEur, fmtMonth, fmtNum, fmtPct } from './format';

/**
 * Printable report (F30): compact summary with inputs, key figures, charts, funding and financing for the
 * conversation with an energy consultant, installer or bank. Pure HTML string – the charts are inserted as images
 * by the app ([data-report-chart]), printing/saving as PDF is done by the browser.
 */

export interface ReportData {
  inputs: Inputs;
  defaults: Inputs;
  run: RunResult;
  cmp: InstallComparison;
  events: KeyEvents;
  today: Date;
  /** Address of the calculator without user data. */
  url: string;
  /** Already rendered cards of the app (funding/tax/financing and tariff comparison). */
  detailsHtml: string;
}

/** Charts included in the report, in this order. */
export const REPORT_CHARTS: [string, string][] = [
  ['cumulative', 'Kumulierte Kosten'],
  ['energy', 'Energie je Monat'],
  ['sensitivity', 'Einflussgrößen: Ersparnis, wenn eine Annahme niedriger oder höher ist'],
];

const SCENARIO = { all: 'beide WP-Wege', ref: 'ohne WP', kfw: 'KfW-Weg', tax: 'Steuer-Weg' } as const;

/** Value of an input field as text for the report. */
export function fieldText(f: Field, inputs: Inputs): string {
  const v = getPath(inputs, f.path);
  const unit = typeof f.unit === 'function' ? f.unit(inputs) : (f.unit ?? '');
  const withUnit = (s: string) => (unit ? `${s} ${unit}` : s);
  switch (f.type) {
    case 'checkbox':
      return v ? 'ja' : 'nein';
    case 'select':
      return f.options?.find(([k]) => k === v)?.[1] ?? String(v);
    case 'month': {
      const m = tryParseMonth(String(v ?? ''));
      return m === null ? '–' : fmtMonth(m);
    }
    case 'percent':
      return withUnit((Number(v) * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 }));
    case 'number':
      // Years (construction, renovation) without thousands separator
      return withUnit(Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2, useGrouping: !(/Year$/.test(f.path) && !unit) }));
    default:
      return String(v ?? '') || '–';
  }
}

/** Inputs per section: all visible fields; in expert sections only values that differ from the defaults. */
function inputsHtml(inputs: Inputs, defaults: Inputs): string {
  const groups = SECTIONS.filter((s) => s.id !== 'scenario').map((s) => {
    const fields = s.fields.filter(
      (f) =>
        f.type !== 'textarea' &&
        (f.show ? f.show(inputs) : true) &&
        (!s.expert || JSON.stringify(getPath(inputs, f.path)) !== JSON.stringify(getPath(defaults, f.path))),
    );
    if (fields.length === 0) return '';
    return `<section class="report-group"><h3>${escapeHtml(s.title)}</h3><dl>${fields
      .map((f) => `<dt>${escapeHtml(f.label)}</dt><dd>${escapeHtml(fieldText(f, inputs))}</dd>`)
      .join('')}</dl></section>`;
  });
  return groups.join('');
}

function keyFiguresHtml(run: RunResult): string {
  const best = run.best === 'tax' ? run.tax : run.kfw;
  const saving = run.ref.totalCost - best.totalCost;
  const be = run.best === 'tax' ? run.breakEvenTax : run.breakEvenKfw;
  const co2 = run.ref.co2Tons - best.co2Tons;
  const t = (x: number) => x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const rows: [string, string, string][] = [
    ['Ohne Wärmepumpe', fmtEur(run.ref.totalCost), 'Gesamtkosten im Zeitraum'],
    ['WP + KfW-Zuschuss', fmtEur(run.kfw.totalCost), `Zuschuss ${fmtEur(run.kfw.kfw?.subsidy ?? 0)}${run.best === 'kfw' ? ' · bester Weg' : ''}`],
    [
      'WP + Steuerbonus',
      run.tax.feasible ? fmtEur(run.tax.totalCost) : 'nicht möglich',
      run.tax.feasible ? `Steuerbonus ${fmtEur(run.tax.tax?.total ?? 0)}${run.best === 'tax' ? ' · bester Weg' : ''}` : (run.tax.tax?.notes[0] ?? ''),
    ],
    [saving >= 0 ? 'Ersparnis mit WP' : 'Mehrkosten mit WP', fmtEur(Math.abs(saving)), `bester Weg: ${run.best === 'tax' ? 'Steuerbonus' : 'KfW'}`],
    ['Amortisation', be === null ? 'nicht im Zeitraum' : fmtMonth(be), 'kumulierte Kosten dauerhaft unter „ohne WP“'],
    [co2 >= 0 ? 'CO₂-Einsparung' : 'CO₂-Mehrausstoß', `${t(Math.abs(co2))} t`, `ohne WP ${t(run.ref.co2Tons)} t, mit WP ${t(best.co2Tons)} t`],
  ];
  return `<table class="report-kpis"><tbody>${rows
    .map(([l, v, s]) => `<tr><th scope="row">${escapeHtml(l)}</th><td class="num"><strong>${escapeHtml(v)}</strong></td><td>${escapeHtml(s)}</td></tr>`)
    .join('')}</tbody></table>`;
}

function houseHtml(inputs: Inputs): string {
  const h = rateHouse(inputs);
  const j = estimateJaz(inputs);
  const d1 = (x: number) => fmtNum(x, 1);
  const parts = [
    `Verbrauchskennwert ${fmtNum(h.kwhPerM2, 0)} kWh/(m²·a), Effizienzklasse ${h.efficiencyClass}`,
    `Heizlast grob ca. ${d1(h.heatLoadKW)} kW`,
    `JAZ-Schätzung ${d1(j.low)}–${d1(j.high)} (Vorlauf ca. ${j.supplyTemp} °C), gerechnet mit ${d1(inputs.heatPump.jaz)}`,
  ];
  if (inputs.heatPump.pvKwp > 0) {
    const p = pvSummary(inputs);
    parts.push(`PV deckt ca. ${fmtPct(p.share)} des Wärmepumpenstroms (Winter ${fmtPct(p.winterShare)}, Sommer ${fmtPct(p.summerShare)})`);
  }
  return `<ul class="report-facts">${parts.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`;
}

function eventsHtml(ev: KeyEvents): string {
  const hints = ev.hints.map((h) => `<li><strong>${escapeHtml(h.title)}</strong>${h.detail ? ` – ${escapeHtml(h.detail)}` : ''}</li>`).join('');
  const timeline = ev.timeline
    .map(
      (e) =>
        `<tr><td>${fmtMonth(e.month)}</td><td>${SCENARIO[e.scenario]}</td><td>${escapeHtml(e.title)}</td><td class="num">${
          e.amount !== undefined ? (e.amount < 0 ? '+' : '−') + fmtEur(Math.abs(e.amount)) + (e.perYear ? '/Jahr' : '') : ''
        }</td></tr>`,
    )
    .join('');
  return `${hints ? `<ul class="report-hints">${hints}</ul>` : ''}${
    timeline ? `<table class="compact report-timeline"><thead><tr><th>Monat</th><th>Szenario</th><th>Ereignis</th><th class="num">Betrag</th></tr></thead><tbody>${timeline}</tbody></table>` : ''
  }`;
}

function bestMonthHtml(cmp: InstallComparison): string {
  const best = cmp.rows[cmp.bestIndex];
  if (!best) return '';
  return `<p class="muted">Günstigster der verglichenen Umrüstzeitpunkte: <strong>${fmtMonth(best.installMonth)}</strong> (siehe „Wann umrüsten?“ im Rechner).</p>`;
}

export function reportHtml(d: ReportData): string {
  const { inputs, run } = d;
  const name = inputs.scenario.name.trim();
  const notes = inputs.scenario.notes.trim();
  const start = run.ref.months[0].month;
  const end = run.ref.months[run.ref.months.length - 1].month;
  const date = d.today.toLocaleDateString('de-DE');
  return `
  <header class="report-head">
    ${logoSvg('report-logo')}
    <div>
      <h1>Wärmepumpen-Umrüstungsrechner – Bericht</h1>
      <p>${name ? `<strong>${escapeHtml(name)}</strong> · ` : ''}Stand ${date} · Version ${APP_VERSION} · Betrachtung ${fmtMonth(start)} – ${fmtMonth(end)}, Inbetriebnahme WP ${fmtMonth(run.kfw.installMonth)}</p>
    </div>
  </header>
  ${notes ? `<section class="report-block"><h2>Bemerkungen</h2><p class="report-notes">${escapeHtml(notes)}</p></section>` : ''}
  <section class="report-block"><h2>Ergebnis</h2>${keyFiguresHtml(run)}
    <p class="muted">Alle Beträge brutto, Gesamtkosten inkl. Opportunitätszins von ${fmtPct(inputs.general.opportunityRate, 1)} p. a.</p>
    ${bestMonthHtml(d.cmp)}</section>
  <section class="report-block"><h2>Haus und Wärmepumpe</h2>${houseHtml(inputs)}</section>
  <section class="report-block report-charts"><h2>Diagramme</h2>${REPORT_CHARTS.map(
    ([id, title]) => `<figure data-report-chart="${id}"><figcaption>${escapeHtml(title)}</figcaption><p class="muted">Diagramm wird beim Drucken eingefügt.</p></figure>`,
  ).join('')}</section>
  <section class="report-block report-details"><h2>Förderung und Finanzierung</h2>${d.detailsHtml}</section>
  <section class="report-block"><h2>Wichtige Ereignisse und Hinweise</h2>${eventsHtml(d.events)}</section>
  <section class="report-block report-inputs"><h2>Eingaben</h2>
    <p class="muted">Alle sichtbaren Eingaben; aus den Experten-Abschnitten nur Werte, die vom Standard abweichen.</p>
    <div class="report-groups">${inputsHtml(inputs, d.defaults)}</div></section>
  <footer class="report-foot">
    <p>Modellrechnung mit Annahmen, ohne Gewähr. Sie ersetzt keine Energieberatung, kein Angebot und keine Heizlastberechnung. Förder- und Preisannahmen geprüft am ${new Date(FUNDING_SOURCE_DATE).toLocaleDateString('de-DE')}.</p>
    <p>Erstellt mit dem Wärmepumpen-Umrüstungsrechner: ${escapeHtml(d.url)}</p>
  </footer>`;
}
