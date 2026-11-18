import { monthlyBurden } from '../core/burden';
import type { InstallComparison } from '../core/compare';
import { COST_PART_LABELS, type CostPart } from '../core/compare';
import { FUNDING_SOURCE_DATE } from '../core/defaults';
import { DEFAULTS_AS_OF } from '../core/default-history';
import type { KeyEvents } from '../core/events';
import { rateHouse } from '../core/house';
import { estimateJaz } from '../core/jaz';
import { pvSummary } from '../core/pv';
import type { Sensitivity } from '../core/sensitivity';
import { exportFileName, exportJson } from '../core/serialize';
import type { RunResult } from '../core/simulation';
import { DEFAULT_SOURCES, OFFICIAL_REFS, SOURCE_KIND_LABEL } from '../core/sources';
import { tariffComparison } from '../core/tariff';
import type { Inputs, ScenarioResult } from '../core/types';
import { APP_VERSION } from '../version';
import { diffText, todayPartsText } from './burden';
import { derivationHtml, derivationLink, monthsCsv } from './derivation';
import { getPath, SECTIONS, type Field } from './fields';
import { fmtEur, fmtMonth, fmtNum, fmtPct } from './format';
import { fieldText, reportLink } from './report';

/**
 * Export for an AI agent (KI-Export, F35): one Markdown file with everything an agent needs to review the
 * calculation – instructions, results, the full derivation (Rechenweg, F32), every input with its default,
 * meaning, origin and official references, the inputs as JSON and the monthly values.
 * Nothing is calculated a second time: results come from the app's last run and the derivation page builder.
 * Loaded on demand (dynamic import), so the calculator bundle does not grow.
 */

export interface AgentExportData {
  inputs: Inputs;
  defaults: Inputs;
  run: RunResult;
  cmp: InstallComparison;
  events: KeyEvents;
  sens: Sensitivity;
  today: Date;
  /** Address of the calculator without user data. */
  url: string;
  /** Base address for links with inputs (short domain, F9.2); default: url. */
  shareUrl?: string;
}

const SCENARIO_NAMES: Record<ScenarioResult['kind'], string> = { ref: 'Ohne Wärmepumpe', kfw: 'WP + KfW-Zuschuss', tax: 'WP + Steuerbonus' };
const EVENT_SCENARIO = { all: 'beide WP-Wege', ref: 'ohne WP', kfw: 'KfW-Weg', tax: 'Steuer-Weg' } as const;
const EVENT_LEVEL = { info: 'Info', important: 'Wichtig', warning: 'Achtung' } as const;

/** File name: as the JSON export, with "-ki.md" instead of ".json". */
export function agentFileName(inputs: Inputs, now: Date): string {
  return exportFileName(inputs, now).replace(/\.json$/, '-ki.md');
}

// ---------- Markdown helpers ----------

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();
/** Table cell: one line, backslashes and pipes escaped. */
const cell = (s: string) => {
  const normalized = oneLine(s);
  const escaped = normalized.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
  return escaped || ' ';
};

export function mdTable(head: string[], rows: string[][]): string {
  return [`| ${head.map(cell).join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
}

/** Longest run of backticks in the text + 1 (at least 3), so a fenced block cannot be closed by its content. */
function fence(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((m) => m.length));
  return '`'.repeat(Math.max(3, longest + 1));
}
const codeBlock = (lang: string, text: string) => {
  const f = fence(text);
  return `${f}${lang}\n${text.replace(/\n$/, '')}\n${f}`;
};

const signed = (x: number) => (Math.abs(x) < 0.005 ? '0 €' : `${x < 0 ? '−' : ''}${fmtEur(Math.abs(x))}`);
const isoDate = (d: Date) => d.toLocaleDateString('sv-SE');
const deDate = (iso: string) => iso.split('-').reverse().join('.');

// ---------- HTML of the derivation page → Markdown ----------

const ELEMENT = 1;
const TEXT = 3;

/** Hidden rows, decorative anchors and buttons outside tables (copy link, CSV download) are left out. */
function skipped(el: Element): boolean {
  return el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true' || (el.tagName === 'BUTTON' && !el.closest('table'));
}

function inline(n: Node): string {
  if (n.nodeType === TEXT) return (n.textContent ?? '').replace(/\s+/g, ' ');
  if (n.nodeType !== ELEMENT) return '';
  const el = n as Element;
  if (skipped(el)) return '';
  const inner = [...el.childNodes].map(inline).join('');
  switch (el.tagName) {
    case 'STRONG':
    case 'B':
      return inner.trim() ? `**${inner.trim()}**` : '';
    case 'EM':
    case 'I':
      return inner.trim() ? `*${inner.trim()}*` : '';
    case 'A': {
      const href = el.getAttribute('href') ?? '';
      return /^https?:\/\//.test(href) ? `[${inner.trim()}](${href})` : inner;
    }
    default:
      return inner;
  }
}

function tableMd(table: Element): string {
  const caption = table.querySelector('caption');
  const rows = [...table.querySelectorAll('tr')]
    .filter((tr) => !tr.closest('[hidden]'))
    .map((tr) => [...tr.children].filter((c) => c.tagName === 'TH' || c.tagName === 'TD').map((c) => inline(c)));
  if (rows.length === 0) return '';
  const hasHead = table.querySelector('thead tr') !== null;
  const [head, ...body] = hasHead ? rows : [rows[0].map(() => ''), ...rows];
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array<string>(width - r.length).fill('')];
  const md = mdTable(pad(head), body.map(pad));
  return caption ? `**${oneLine(inline(caption))}**\n\n${md}` : md;
}

function blocksMd(parent: Element, shift: number, out: string[]): void {
  for (const n of parent.childNodes) {
    if (n.nodeType === TEXT) {
      const t = oneLine(n.textContent ?? '');
      if (t) out.push(t);
      continue;
    }
    if (n.nodeType !== ELEMENT) continue;
    const el = n as Element;
    if (skipped(el)) continue;
    const tag = el.tagName;
    if (/^H[1-6]$/.test(tag)) out.push(`${'#'.repeat(Math.min(6, Number(tag[1]) + shift))} ${oneLine(inline(el))}`);
    else if (tag === 'P') {
      const t = oneLine(inline(el));
      if (t) out.push(t);
    } else if (tag === 'UL' || tag === 'OL') {
      const items = [...el.children].filter((c) => c.tagName === 'LI').map((li, i) => `${tag === 'OL' ? `${i + 1}.` : '-'} ${oneLine(inline(li))}`);
      if (items.length) out.push(items.join('\n'));
    } else if (tag === 'TABLE') {
      const t = tableMd(el);
      if (t) out.push(t);
    } else if (tag === 'DETAILS') {
      const summary = el.querySelector(':scope > summary');
      if (summary) out.push(`${'#'.repeat(Math.min(6, 3 + shift))} ${oneLine(inline(summary))}`);
      const rest = el.cloneNode(true) as Element;
      rest.querySelector(':scope > summary')?.remove();
      blocksMd(rest, shift, out);
    } else if (tag === 'SUMMARY') continue;
    else blocksMd(el, shift, out);
  }
}

/** Converts the HTML of the derivation page to Markdown; headings are shifted by `shift` levels. */
export function htmlToMarkdown(html: string, shift = 0): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const root = document.createElement('div');
  root.appendChild(tpl.content);
  const out: string[] = [];
  blocksMd(root, shift, out);
  return out.join('\n\n');
}

/** Texts of the derivation page that refer to its controls. */
const PAGE_ONLY: [RegExp, string][] = [
  [/ Jahreszahl anklicken für die Monate\./g, ''],
  [/; mit einem Klick auf die Jahreszahl klappen die Monate auf\./g, '.'],
  [/Die Monatswerte lassen sich als CSV-Datei laden, z\. B\. zum Nachrechnen in einer Tabellenkalkulation\./g, 'Die Monatswerte stehen im Anhang dieses Dokuments.'],
];

function derivationMd(inputs: Inputs): string {
  const { html } = derivationHtml(inputs, 'storage');
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  tpl.content.querySelector('h1')?.remove();
  tpl.content.querySelector('.doc-intro')?.remove();
  const div = document.createElement('div');
  div.appendChild(tpl.content);
  let md = htmlToMarkdown(div.innerHTML, 1);
  for (const [re, by] of PAGE_ONLY) md = md.replace(re, by);
  return md;
}

// ---------- Sections ----------

function headerMd(d: AgentExportData): string {
  const { inputs, run } = d;
  const name = inputs.scenario.name.trim();
  const start = run.ref.months[0].month;
  const end = run.ref.months[run.ref.months.length - 1].month;
  const lines = [
    `- Szenario: ${name ? `„${oneLine(name)}“` : '(ohne Bezeichnung)'}`,
    `- Erstellt: ${deDate(isoDate(d.today))} mit Version ${APP_VERSION} des Rechners`,
    `- Betrachtung: ${fmtMonth(start)} – ${fmtMonth(end)} (${fmtNum(inputs.general.horizonYears)} Jahre), Inbetriebnahme der Wärmepumpe ${fmtMonth(run.kfw.installMonth)}`,
    `- Standardwerte: Stand ${deDate(DEFAULTS_AS_OF)}; Förder- und Preisannahmen geprüft am ${deDate(FUNDING_SOURCE_DATE)}`,
    `- Rechner: ${d.url}`,
    `- Rechner mit diesen Eingaben öffnen (ohne Bemerkungen): ${reportLink(d)}`,
    `- Rechenweg mit diesen Eingaben: ${derivationLink(new URL('rechenweg.html', d.url).toString(), d.defaults, inputs)}`,
  ];
  return `# Wärmepumpen-Investitionsrechner – Export für die Auswertung mit einem KI-Assistenten

${lines.join('\n')}`;
}

const AGENT_NOTES = `## Hinweise für den KI-Assistenten

Dieses Dokument wurde vom Wärmepumpen-Investitionsrechner erzeugt. Es beschreibt eine Modellrechnung für den Umstieg eines Wohnhauses von einer Gas- oder Ölheizung auf eine Wärmepumpe in Deutschland. Die Person, die es Ihnen gibt, möchte die Berechnung mit Ihrer Hilfe verstehen, prüfen und verbessern. Bitte antworten Sie in der Sprache der Person und siezen Sie sie, wenn sie Deutsch schreibt.

**Aufbau**
1. Ergebnis, Eckdaten zu Haus und Wärmepumpe, monatliche Belastung im Vergleich zu heute, Ereignisse und Hinweise des Rechners.
2. Vergleich der Umrüstzeitpunkte, Einflussgrößen (Sensitivität) und gegebenenfalls Stromtarifvergleich.
3. Rechenweg: alle Zwischenwerte mit eingesetzten Zahlen und Jahrestabellen je Szenario.
4. Eingaben: jedes Feld mit aktuellem Wert, Standardwert, Bedeutung, Herkunft des Standardwerts und amtlichen Fundstellen.
5. Eingaben als JSON (zum Ändern und Wiedereinlesen) und im Anhang die Monatswerte als CSV.

**Konventionen**
- Drei Szenarien: „Ohne Wärmepumpe“ (Referenz, mit Ersatzkessel am Lebensende der Altanlage), „WP + KfW-Zuschuss“ (Förderung KfW 458, ggf. Ergänzungskredit 358/359) und „WP + Steuerbonus“ (§ 35c EStG). Zuschuss und Steuerbonus schließen sich für dieselbe Maßnahme aus; der günstigere ist der „beste Weg“.
- Monatliche Simulation über den Betrachtungszeitraum. Gesamtkosten = Summe aller Zahlungen, verzinst mit dem Opportunitätszins (Rendite, die das Geld anderswo erzielt hätte). „Summe ohne Verzinsung“ ist die einfache Summe.
- Beträge brutto in Euro. Positiv = Ausgabe, negativ = Einnahme (Zuschuss, Steuerbonus, Kreditauszahlung, Restwert).
- Prozentwerte sind im JSON Anteile (0,3 = 30 %), in den Tabellen Prozent. Monate im JSON als JJJJ-MM, im Text als MM/JJJJ.
- Amortisation = erster Monat, ab dem die kumulierten Kosten mit Wärmepumpe bis zum Ende nie mehr über denen ohne liegen.
- Kredite sind Annuitätendarlehen. Eine Sondertilgung (Zuschuss, Steuererstattungen, Einmalzahlung – je nach Eingaben) lässt die Monatsrate gleich und verkürzt die Laufzeit; die Rate wird nicht gesenkt. Kosten der Sondertilgung: Regeln der KfW bzw. Vorfälligkeitsentschädigung der Bank, ggf. mit kostenfreiem Kontingent je Kalenderjahr.
- Monatliche Belastung = laufende Zahlungen (Energie, Grund- und Zählerkosten, Wartung, Kreditrate) je 12-Monats-Zeitraum ab dem Start, ohne Opportunitätszins; einmalige Beträge stehen getrennt.

**Grenzen des Modells**
- Preise, Preissteigerungen, CO₂-Preise und Förderbedingungen sind Annahmen mit Stand des angegebenen Prüfdatums. Förderprogramme können sich ändern.
- Die Rechnung ersetzt keine Heizlastberechnung, keine Energieberatung, kein Angebot und keine Steuerberatung. Weisen Sie bei steuerlichen oder rechtlichen Fragen auf eine fachkundige Prüfung hin.
- Werte, die als „Standard“ gekennzeichnet sind, hat die Person nicht selbst eingegeben. Vor allem Verbrauch, Investition, Jahresarbeitszahl (JAZ), Haushaltseinkommen und Steuerschuld sollten eigene Werte sein.

**Vorschläge für die Auswertung**
- Plausibilität prüfen: Passen Verbrauch, Wohnfläche, Baujahr, Investition und JAZ zueinander (siehe Eckdaten und JAZ-Schätzung)? Welche wichtigen Werte stehen noch auf dem Standard?
- Förderung prüfen: Sind die Voraussetzungen für Grundförderung, Klimageschwindigkeitsbonus, Einkommensbonus und Steuerbonus erfüllt? Welche Fristen und Termine sind wichtig?
- Einflussgrößen erklären: Welche Annahmen verändern das Ergebnis am stärksten, und wie sicher sind sie?
- Monatliche Belastung einordnen: Wie verändert sich die Belastung gegenüber heute, wann sinkt sie (z. B. nach Kreditende), und welche einmaligen Beträge muss die Person vorher aufbringen?
- Varianten vorschlagen: z. B. anderer Umrüstzeitpunkt, andere Finanzierung, PV, Wärmepumpentarif. Rechnen Sie Varianten nicht selbst nach, sondern geben Sie die geänderten Werte an (Feldname und Wert oder ein geändertes JSON). Die Person kann das JSON als \`.json\`-Datei speichern und im Rechner mit „Import“ laden; dann rechnet der Rechner genau.
- Unstimmigkeiten oder vermutete Fehler im Rechenmodell bitte konkret benennen (Abschnitt, Wert, erwarteter Wert).

**Datenschutz:** Das Dokument enthält persönliche Angaben (z. B. Haushaltseinkommen, Einkommensteuer, Angaben zu Haus und Heizung, Bemerkungen).`;

function keyFiguresMd(run: RunResult): string {
  const best = run.best === 'tax' ? run.tax : run.kfw;
  const saving = run.ref.totalCost - best.totalCost;
  const co2 = run.ref.co2Tons - best.co2Tons;
  const all = [run.ref, run.kfw, run.tax];
  const ok = (s: ScenarioResult) => s.feasible || s.kind === 'ref';
  const rows: [string, (s: ScenarioResult) => string][] = [
    ['Gesamtkosten (mit Opportunitätszins)', (s) => (ok(s) ? signed(s.totalCost) : 'nicht möglich')],
    ['Summe aller Zahlungen ohne Verzinsung', (s) => (ok(s) ? signed(s.nominalCost) : '–')],
    ['CO₂ im Zeitraum', (s) => `${fmtNum(s.co2Tons, 1)} t`],
    ['Inbetriebnahme WP', (s) => (s.kind === 'ref' ? '–' : fmtMonth(s.installMonth))],
    ['KfW-Zuschuss bzw. Steuerbonus', (s) => (s.kind === 'kfw' ? fmtEur(s.kfw?.subsidy ?? 0) : s.kind === 'tax' ? (s.feasible ? fmtEur(s.tax?.total ?? 0) : 'nicht möglich') : '–')],
    ['Amortisation', (s) => (s.kind === 'ref' ? '–' : fmtMonth(s.kind === 'kfw' ? run.breakEvenKfw : run.breakEvenTax))],
  ];
  const table = mdTable(['Kennzahl', ...all.map((s) => SCENARIO_NAMES[s.kind])], rows.map(([l, f]) => [l, ...all.map(f)]));
  const taxNote = !run.tax.feasible && run.tax.tax?.notes[0] ? `\n- Steuerbonus nicht möglich: ${run.tax.tax.notes[0]}` : '';
  return `## Ergebnis

${table}

- Bester Weg mit Wärmepumpe: ${run.best === 'tax' ? 'Steuerbonus' : 'KfW-Zuschuss'}
- ${saving >= 0 ? 'Ersparnis' : 'Mehrkosten'} mit Wärmepumpe gegenüber „ohne Wärmepumpe“: ${fmtEur(Math.abs(saving))}
- ${co2 >= 0 ? 'CO₂-Einsparung' : 'CO₂-Mehrausstoß'}: ${fmtNum(Math.abs(co2), 1)} t${taxNote}`;
}

function houseMd(inputs: Inputs): string {
  const h = rateHouse(inputs);
  const j = estimateJaz(inputs);
  const d1 = (x: number) => fmtNum(x, 1);
  const parts = [
    `Verbrauchskennwert ${fmtNum(h.kwhPerM2, 0)} kWh/(m²·a), Effizienzklasse ${h.efficiencyClass}`,
    `Heizlast grob ca. ${d1(h.heatLoadKW)} kW`,
    `JAZ-Schätzung des Rechners ${d1(j.low)}–${d1(j.high)} (Vorlauftemperatur ca. ${j.supplyTemp} °C), gerechnet mit JAZ ${d1(inputs.heatPump.jaz)}`,
  ];
  if (inputs.heatPump.pvKwp > 0) {
    const p = pvSummary(inputs);
    parts.push(`PV deckt ca. ${fmtPct(p.share)} des Wärmepumpenstroms (Winter ${fmtPct(p.winterShare)}, Sommer ${fmtPct(p.summerShare)})`);
  }
  return `## Haus und Wärmepumpe

${parts.map((p) => `- ${p}`).join('\n')}`;
}

/** Monthly burden (F36) in the same form as the card in the calculator. */
function burdenMd(run: RunResult): string {
  const b = monthlyBurden(run);
  const kinds = ['ref', 'kfw', 'tax'] as const;
  const head = ['Zeitraum', ...kinds.map((k) => SCENARIO_NAMES[k])];
  const period = (from: number, to: number) => (from === to ? fmtMonth(from) : `${fmtMonth(from)} – ${fmtMonth(to)}`);
  const cellOf = (v: number | null) => (v === null ? 'nicht möglich' : `${fmtEur(v)} (${diffText(v - b.today)})`);
  const rows = [
    ...b.years.map((y) => [`${period(y.from, y.to)}${y.months < 12 ? ` (${y.months} Monate)` : ''}`, ...kinds.map((k) => cellOf(y.perMonth[k]))]),
    ['Durchschnitt im Zeitraum', ...kinds.map((k) => cellOf(b.average[k]))],
  ];
  // one-off amounts from the household's view: expense "−", income "+"
  const oneOff = (x: number | null) => (x === null ? 'nicht möglich' : Math.round(x) === 0 ? '–' : `${x > 0 ? '−' : '+'}${fmtEur(Math.abs(x))}`);
  const oneOffs = b.oneOffs.length
    ? `\n\n### Einmalige Beträge (nicht in den Monatswerten)\n\n− = Ausgabe, + = Einnahme: Eigenanteil der Investition, Ersatzkessel bzw. Ersatz-Wärmepumpe, Zuschuss, Steuererstattungen, Sondertilgungen samt Vorfälligkeitsentschädigung und die Ablösung einer Restschuld am Ende.\n\n${mdTable(
        head,
        b.oneOffs.map((o) => [period(o.from, o.to), ...kinds.map((k) => oneOff(o.amount[k]))]),
      )}`
    : '';
  return `## Monatliche Belastung

Heute (Durchschnitt der ersten ${b.todayMonths} Monate ohne Wärmepumpe, mit Preissteigerung): ${fmtEur(b.today)} im Monat – ${todayPartsText(b)}. Je Zeitraum von 12 Monaten ab dem Start die durchschnittliche Belastung pro Monat, in Klammern der Unterschied zu heute. Enthalten: Energie, Grund- und Zählerkosten, Wartung und Kreditrate (Zinsen und Tilgung); nominal mit Preissteigerung, ohne Opportunitätszins.

${mdTable(head, rows)}${oneOffs}`;
}

function eventsMd(ev: KeyEvents): string {
  const hints = ev.hints.map((h) => `- **${EVENT_LEVEL[h.level]}: ${oneLine(h.title)}**${h.detail ? ` – ${oneLine(h.detail)}` : ''}`);
  const amount = (a?: number, perYear?: boolean) => (a === undefined ? '' : `${a < 0 ? '+' : '−'}${fmtEur(Math.abs(a))}${perYear ? '/Jahr' : ''}`);
  const timeline = ev.timeline.length
    ? mdTable(
        ['Monat', 'Szenario', 'Art', 'Ereignis', 'Betrag (+ Einnahme, − Ausgabe)'],
        ev.timeline.map((e) => [fmtMonth(e.month), EVENT_SCENARIO[e.scenario], EVENT_LEVEL[e.level], `${e.title}${e.detail ? ` – ${e.detail}` : ''}`, amount(e.amount, e.perYear)]),
      )
    : '';
  return `## Wichtige Ereignisse und Hinweise des Rechners

${hints.length ? `### Hinweise\n\n${hints.join('\n')}` : 'Keine Hinweise.'}${timeline ? `\n\n### Zeitleiste\n\n${timeline}` : ''}`;
}

function compareMd(cmp: InstallComparison): string {
  if (cmp.rows.length === 0) return '';
  const parts = Object.keys(COST_PART_LABELS) as CostPart[];
  const rows = cmp.rows.map((r, i) => [
    `${fmtMonth(r.installMonth)}${i === cmp.bestIndex ? ' ★' : ''}`,
    r.best === 'tax' ? 'Steuerbonus' : 'KfW',
    signed(r.bestTotal),
    signed(r.savingVsRef),
    signed(r.extraVsFirst),
    signed(r.kfwTotal),
    r.taxFeasible ? signed(r.taxTotal) : 'nicht möglich',
    fmtEur(r.kfwSubsidy),
    fmtPct(r.kfwRate),
    fmtPct(r.kgbRate),
    fmtEur(r.capTotal),
    r.taxFeasible ? fmtEur(r.taxBonus) : '–',
    fmtEur(r.boilerCost),
    ...parts.map((p) => signed(r.parts[p])),
    r.warnings.join(' · '),
  ]);
  return `## Zeitpunkt der Umrüstung

Jede Zeile ist eine vollständige Rechnung mit diesem Monat der Inbetriebnahme (alle übrigen Eingaben gleich). ★ = günstigster Zeitpunkt. Gesamtkosten ohne Wärmepumpe: ${signed(cmp.refTotal)}. „Mehrkosten ggü. erstem Zeitpunkt“ positiv = Warten kostet Geld.

${mdTable(
  [
    'Inbetriebnahme',
    'Bester Weg',
    'Gesamtkosten bester Weg',
    'Ersparnis ggü. ohne WP',
    'Mehrkosten ggü. erstem Zeitpunkt',
    'Gesamtkosten KfW',
    'Gesamtkosten Steuer',
    'KfW-Zuschuss',
    'Fördersatz KfW',
    'davon Klimageschwindigkeitsbonus',
    'Höchstbetrag förderfähige Kosten',
    'Steuerbonus',
    'Ersatzkessel vorher',
    ...parts.map((p) => `Anteil: ${COST_PART_LABELS[p]}`),
    'Hinweise',
  ],
  rows,
)}`;
}

function sensitivityMd(sens: Sensitivity): string {
  if (sens.items.length === 0) return '';
  return `## Einflussgrößen (Sensitivität)

Jede Annahme wird einzeln niedriger und höher angesetzt, alle anderen bleiben gleich. Angegeben ist die Ersparnis mit Wärmepumpe (bester Weg) gegenüber „ohne Wärmepumpe“; im Basisfall ${signed(sens.base)}. Sortiert nach Einfluss.

${mdTable(
  ['Annahme', 'Basiswert', 'Niedriger', 'Ersparnis niedriger', 'Höher', 'Ersparnis höher', 'Spanne'],
  sens.items.map((s) => [s.label, s.base, s.lowValue, signed(s.low), s.highValue, signed(s.high), fmtEur(Math.abs(s.high - s.low))]),
)}`;
}

function tariffMd(inputs: Inputs): string {
  const t = tariffComparison(inputs);
  if (!t) return '';
  const lines = [
    `Gewählt: ${t.selected === 'with' ? 'mit' : 'ohne'} Wärmepumpentarif; günstiger: ${t.cheaper === 'with' ? 'mit' : 'ohne'} Wärmepumpentarif (Ersparnis mit Tarif ${signed(t.saving)}, ab Inbetriebnahme bis Ende, ohne Verzinsung).`,
    `Einmalkosten zweiter Zähler: ${fmtEur(t.setupCost)}${t.setupSubsidy ? `, davon Zuschuss ${fmtEur(t.setupSubsidy)}` : ''}; ${t.setupPaybackYears === 0 ? 'keine Umbaukosten' : `Amortisation des Umbaus: ${t.setupPaybackYears === null ? 'nie' : `${fmtNum(t.setupPaybackYears, 1)} Jahre`}`}.`,
    `Wärmepumpentarif lohnt sich bei laufenden Kosten ab einem Netzbezug von ${t.breakEvenKWh === null ? '– (nie)' : `${fmtNum(t.breakEvenKWh)} kWh/Jahr`}.`,
  ];
  return `## Stromtarifvergleich (Wärmepumpe)

${lines.map((l) => `- ${l}`).join('\n')}

${mdTable(
  ['Jahr', 'Netzbezug WP', 'Stromkosten mit WP-Tarif', 'Stromkosten ohne WP-Tarif'],
  t.years.map((y) => [String(y.year), `${fmtNum(y.gridKWh)} kWh`, fmtEur(y.withTariff), fmtEur(y.withoutTariff)]),
)}`;
}

/** Raw value as stored in the JSON (for the agent's reference to the JSON block). */
const rawValue = (v: unknown) => (typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v ?? null));

function fieldMd(f: Field, inputs: Inputs, defaults: Inputs): string {
  const value = getPath(inputs, f.path);
  const def = getPath(defaults, f.path);
  const changed = JSON.stringify(value) !== JSON.stringify(def);
  const shown = f.show ? f.show(inputs) : true;
  if (f.type === 'textarea') {
    const text = String(value ?? '').trim();
    return `- **${f.label}** (\`${f.path}\`): ${text ? `\n\n${codeBlock('text', text)}` : '(leer)'}`;
  }
  const status = [changed ? 'eigener Wert' : 'Standard', shown ? '' : 'im Formular ausgeblendet, wirkt bei den aktuellen Eingaben nicht'].filter(Boolean).join(', ');
  const lines = [`- **${f.label}** (\`${f.path}\` = \`${rawValue(value)}\`): ${fieldText(f, inputs)} – ${status}`];
  if (changed && !f.noSource) lines.push(`  - Standardwert: ${fieldText(f, defaults)} (\`${rawValue(def)}\`)`);
  if (f.help) lines.push(`  - Bedeutung: ${oneLine(f.help)}`);
  const note = f.note?.(inputs);
  if (note) lines.push(`  - Rechner zeigt dazu: ${oneLine(note)}`);
  const src = DEFAULT_SOURCES[f.path];
  if (src) lines.push(`  - Herkunft des Standardwerts (${SOURCE_KIND_LABEL[src.kind]}): ${oneLine(src.text)}${src.url ? ` Quelle: ${src.url}` : ''}${src.asOf ? ` (Stand ${src.asOf})` : ''}`);
  const refs = OFFICIAL_REFS[f.path];
  if (refs?.length) lines.push(`  - Fundstellen: ${refs.map((r) => `${r.label} (${r.url})`).join('; ')}`);
  return lines.join('\n');
}

/** Leaf paths of an object (arrays count as one value). */
function leafPaths(o: unknown, prefix = ''): string[] {
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return prefix ? [prefix] : [];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k));
}

function inputsMd(inputs: Inputs, defaults: Inputs): string {
  const sections = SECTIONS.map((s) => {
    const note = s.note ? `\n\n${oneLine(s.note)}` : '';
    return `### ${s.title}${s.expert ? ' (Experten-Einstellungen)' : ''}${note}\n\n${s.fields.map((f) => fieldMd(f, inputs, defaults)).join('\n')}`;
  });
  const docs = inputs.scenario.documents;
  const docsMd = docs.length ? `\n\n**Unterlagen und Links** (\`scenario.documents\`, werden vom Rechner nicht geladen):\n\n${docs.map((d) => `- ${d.title ? `${oneLine(d.title)}: ` : ''}${d.url}`).join('\n')}` : '';
  const covered = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.path)));
  const other = leafPaths(defaults).filter((p) => p !== 'version' && p !== 'scenario.documents' && !covered.has(p));
  const otherMd = other.length
    ? `\n\n### Weitere Werte ohne Formularfeld\n\n${mdTable(
        ['Pfad', 'Wert', 'Standard'],
        other.map((p) => [`\`${p}\``, `\`${rawValue(getPath(inputs, p))}\``, `\`${rawValue(getPath(defaults, p))}\``]),
      )}`
    : '';
  const changed = SECTIONS.flatMap((s) => s.fields).filter((f) => f.type !== 'textarea' && JSON.stringify(getPath(inputs, f.path)) !== JSON.stringify(getPath(defaults, f.path)));
  return `## Eingaben

Alle Felder des Rechners in der Reihenfolge des Formulars. Je Feld: Bezeichnung, Pfad und Wert im JSON, angezeigter Wert, ob es ein eigener Wert oder der Standard ist, Bedeutung, Herkunft des Standardwerts und amtliche Fundstellen. ${changed.length === 1 ? '1 Feld weicht' : `${changed.length} Felder weichen`} vom Standard ab.${docsMd}

${sections.join('\n\n')}${otherMd}`;
}

function jsonMd(inputs: Inputs): string {
  return `## Eingaben als JSON

Dieselben Eingaben wie oben im Format der Export-Datei des Rechners. Gespeichert als \`.json\`-Datei, lässt sich das JSON im Rechner mit „Import“ laden – auch nach Änderungen. Fehlende Felder erhalten den Standardwert, ungültige Werte werden begrenzt und gemeldet.

${codeBlock('json', exportJson(inputs))}`;
}

function monthsMd(run: RunResult): string {
  const blocks = [run.ref, run.kfw, run.tax].map((s) => `### ${SCENARIO_NAMES[s.kind]}\n\n${codeBlock('csv', monthsCsv(s).replace(/^﻿/, '').replace(/\r\n/g, '\n'))}`);
  return `## Anhang: Monatswerte

Je Szenario alle Monate des Betrachtungszeitraums. Trennzeichen Semikolon, Dezimalkomma; Beträge in Euro (positiv = Ausgabe, negativ = Einnahme), „Kumuliert“ mit Opportunitätszins.

${blocks.join('\n\n')}`;
}

/** The complete Markdown document. */
export function agentMarkdown(d: AgentExportData): string {
  const parts = [
    headerMd(d),
    AGENT_NOTES,
    keyFiguresMd(d.run),
    houseMd(d.inputs),
    burdenMd(d.run),
    eventsMd(d.events),
    compareMd(d.cmp),
    sensitivityMd(d.sens),
    tariffMd(d.inputs),
    `## Rechenweg\n\nAlle Werte aus derselben Rechnung wie oben, mit eingesetzten Zahlen.\n\n${derivationMd(d.inputs)}`,
    inputsMd(d.inputs, d.defaults),
    jsonMd(d.inputs),
    monthsMd(d.run),
    `---\n\nModellrechnung mit Annahmen, ohne Gewähr. Sie ersetzt keine Energieberatung, kein Angebot, keine Heizlastberechnung und keine Steuerberatung. Erstellt mit dem Wärmepumpen-Investitionsrechner: ${d.url}`,
  ];
  return parts.filter(Boolean).join('\n\n') + '\n';
}
