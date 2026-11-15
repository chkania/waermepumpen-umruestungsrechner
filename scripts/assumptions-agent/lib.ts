/**
 * Automated pre-check of the assumptions (F22.3) – logic without network and API, tested in
 * tests/assumptions-agent.test.ts.
 *
 * Which values are checked comes from the same place as the quarterly review issue (F22.1): every form field whose
 * default has a time-sensitive origin (official source, law, market data) and a source URL in src/core/sources.ts.
 * The tool only reports – changes are made by hand in defaults.ts/sources.ts as described in the review issue.
 */
import type { DefaultSource, SourceKind } from '../../src/core/sources';
import { REVIEW_KINDS } from '../assumptions-lib';

export interface FieldLike {
  path: string;
  label: string;
  type: string;
  unit?: string | ((inputs: never) => string);
}

export interface SectionLike {
  title: string;
  fields: readonly FieldLike[];
}

/** One default value to check against its source. */
export interface CheckItem {
  path: string;
  label: string;
  section: string;
  /** Default value as shown in the calculator, e.g. "30 %" or "12.2 ct/kWh". */
  value: string;
  kind: SourceKind;
  /** Description of the origin from sources.ts (what the value is based on). */
  sourceText: string;
  asOf?: string;
  url: string;
}

/** All items that share one source URL – one download and one model request per group. */
export interface SourceGroup {
  url: string;
  items: CheckItem[];
}

export type Verdict = 'bestaetigt' | 'abweichung' | 'unklar';

/** Answer of the model for one item (validated by parseAnswer). */
export interface ItemFinding {
  path: string;
  verdict: Verdict;
  /** Value as stated in the source, in the source's wording; empty if not found. */
  sourceValue: string;
  /** Verbatim passage of the source that supports the verdict; empty if not found. */
  quote: string;
  note: string;
}

export interface CheckedItem extends CheckItem {
  finding: ItemFinding;
  /** The quote occurs in the downloaded text (only checkable for HTML/text sources). */
  quoteVerified: boolean | null;
}

export interface FailedGroup {
  url: string;
  items: CheckItem[];
  error: string;
}

const getPath = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);

/** Formats a default value like the form does (percent fields hold a share, e.g. 0.3 → "30 %"). */
export function formatValue(field: FieldLike, value: unknown, inputs: unknown): string {
  const unit = typeof field.unit === 'function' ? (field.unit as (i: unknown) => string)(inputs) : field.unit;
  const num = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 4 });
  let text: string;
  if (field.type === 'percent' && typeof value === 'number') text = `${num(value * 100)} ${unit || '%'}`;
  else if (typeof value === 'number') text = num(value);
  else if (typeof value === 'boolean') text = value ? 'ja' : 'nein';
  else text = String(value);
  return unit && field.type !== 'percent' ? `${text} ${unit}` : text;
}

/** Items to check, in the order of the form; optional filter by path prefix (e.g. "funding."). */
export function collectItems(
  sections: readonly SectionLike[],
  sources: Record<string, DefaultSource>,
  defaults: unknown,
  only?: string,
): CheckItem[] {
  const items: CheckItem[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    for (const field of section.fields) {
      const src = sources[field.path];
      if (!src?.url || !REVIEW_KINDS.includes(src.kind) || seen.has(field.path)) continue;
      if (only && !field.path.startsWith(only)) continue;
      seen.add(field.path);
      items.push({
        path: field.path,
        label: field.label,
        section: section.title,
        value: formatValue(field, getPath(defaults, field.path), defaults),
        kind: src.kind,
        sourceText: src.text,
        asOf: src.asOf,
        url: src.url,
      });
    }
  }
  return items;
}

export function groupBySource(items: readonly CheckItem[]): SourceGroup[] {
  const groups = new Map<string, CheckItem[]>();
  for (const item of items) groups.set(item.url, [...(groups.get(item.url) ?? []), item]);
  return [...groups].map(([url, list]) => ({ url, items: list }));
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '' };

/** Readable text of an HTML page: without scripts, styles and tags; entities decoded, whitespace collapsed. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)\s*>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t\r\f\v  ]+/g, ' ')
    .replace(/ ?\n[ \n]*/g, '\n')
    .trim();
}

/** Comparable form for the quote check: lower case, uniform whitespace, quotes and dashes. */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[„“”‚‘’«»"']/g, '')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

/** Does the quote occur in the source text? Guards against answers that are not backed by the source. */
export function quoteInText(quote: string, text: string): boolean {
  const q = normalize(quote);
  return q.length >= 8 && normalize(text).includes(q);
}

/** System prompt: stable for every request (prompt caching). */
export const SYSTEM_PROMPT = [
  'Du prüfst Standardwerte eines Wirtschaftlichkeitsrechners für Wärmepumpen (Förderung, Steuer, Energiepreise) gegen eine Quelle.',
  'Beurteile jeden Wert ausschließlich anhand der mitgeschickten Quelle, nicht anhand deines Vorwissens.',
  '- "bestaetigt": Die Quelle nennt denselben Wert (Rundung und andere Schreibweise sind in Ordnung).',
  '- "abweichung": Die Quelle nennt für genau diese Größe einen anderen Wert oder eine andere Frist.',
  '- "unklar": Die Quelle nennt die Größe nicht, nicht eindeutig oder nur für einen anderen Fall.',
  'Gib bei "bestaetigt" und "abweichung" in "quote" eine wörtliche, zusammenhängende Textstelle der Quelle an (höchstens 300 Zeichen), sonst einen leeren Text.',
  'Marktpreise (z. B. Durchschnittspreise) schwanken: Eine Abweichung liegt erst vor, wenn die Quelle einen neueren Stand mit spürbar anderem Wert nennt; erkläre das in "note".',
  'Antworte auf Deutsch, knapp und sachlich.',
].join('\n');

/** Task text for one source: the values to check. The source itself is sent as a separate content block. */
export function buildTask(group: SourceGroup): string {
  const lines = group.items.map(
    (it) =>
      `- path: ${it.path}\n  Bezeichnung: ${it.label} (Bereich „${it.section}“)\n  Standardwert im Rechner: ${it.value}\n  Herkunft laut Rechner${it.asOf ? ` (Stand ${it.asOf})` : ''}: ${it.sourceText}`,
  );
  return `Quelle: ${group.url}\n\nPrüfe diese Standardwerte gegen die Quelle oben. Gib für jeden path genau ein Ergebnis zurück.\n\n${lines.join('\n')}`;
}

/** JSON schema of the answer (structured outputs). */
export const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'verdict', 'sourceValue', 'quote', 'note'],
        properties: {
          path: { type: 'string' },
          verdict: { type: 'string', enum: ['bestaetigt', 'abweichung', 'unklar'] },
          sourceValue: { type: 'string' },
          quote: { type: 'string' },
          note: { type: 'string' },
        },
      },
    },
  },
} as const;

const VERDICTS: readonly Verdict[] = ['bestaetigt', 'abweichung', 'unklar'];

/**
 * Validates the model answer for one group. Unknown paths are ignored; items without an answer count as "unklar"
 * so that nothing silently drops out of the report.
 */
export function parseAnswer(json: string, group: SourceGroup): ItemFinding[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Antwort ist kein gültiges JSON');
  }
  const results = (data as { results?: unknown })?.results;
  if (!Array.isArray(results)) throw new Error('Antwort enthält keine Liste "results"');
  const byPath = new Map<string, ItemFinding>();
  for (const r of results as Record<string, unknown>[]) {
    const path = String(r?.path ?? '');
    if (!group.items.some((it) => it.path === path) || byPath.has(path)) continue;
    const verdict = VERDICTS.includes(r.verdict as Verdict) ? (r.verdict as Verdict) : 'unklar';
    byPath.set(path, { path, verdict, sourceValue: String(r.sourceValue ?? ''), quote: String(r.quote ?? ''), note: String(r.note ?? '') });
  }
  return group.items.map(
    (it) => byPath.get(it.path) ?? { path: it.path, verdict: 'unklar', sourceValue: '', quote: '', note: 'Keine Antwort zu diesem Wert.' },
  );
}

/** Combines finding and quote check; a "bestaetigt"/"abweichung" whose quote is not in the source becomes "unklar". */
export function checkFindings(group: SourceGroup, findings: ItemFinding[], sourceText: string | null): CheckedItem[] {
  return group.items.map((item, i) => {
    const finding = findings[i];
    const quoteVerified = sourceText === null || finding.verdict === 'unklar' ? null : quoteInText(finding.quote, sourceText);
    const adjusted: ItemFinding =
      quoteVerified === false
        ? { ...finding, verdict: 'unklar', note: `Zitat nicht in der Quelle gefunden (ursprünglich „${finding.verdict}“). ${finding.note}`.trim() }
        : finding;
    return { ...item, finding: adjusted, quoteVerified };
  });
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || '–';

/** Markdown report: deviations first, then unclear, failed sources and confirmed values. */
export function buildReport(input: {
  date: string;
  model: string;
  lastReview: string;
  checked: readonly CheckedItem[];
  failed: readonly FailedGroup[];
}): string {
  const { checked, failed } = input;
  const by = (v: Verdict) => checked.filter((c) => c.finding.verdict === v);
  const dev = by('abweichung');
  const unclear = by('unklar');
  const ok = by('bestaetigt');
  const failedCount = failed.reduce((n, g) => n + g.items.length, 0);
  const out: string[] = [
    `# Prüfung der Annahmen – ${input.date}`,
    '',
    `Automatische Vorprüfung mit \`${input.model}\` gegen die Quellen aus \`src/core/sources.ts\` (letzte manuelle Prüfung: ${input.lastReview}).`,
    'Der Bericht ändert nichts. Abweichungen bitte an der Quelle nachprüfen und wie im Issue „Annahmen prüfen“ beschrieben in `defaults.ts`/`sources.ts` übernehmen.',
    '',
    `**${dev.length}** Abweichung(en) · **${unclear.length}** unklar · **${failedCount}** nicht abrufbar · **${ok.length}** bestätigt`,
  ];
  const table = (rows: readonly CheckedItem[]) => [
    '',
    '| Wert | Rechner | Quelle | Beleg / Hinweis |',
    '|---|---|---|---|',
    ...rows.map(
      (c) =>
        `| **${cell(c.label)}** (\`${c.path}\`) | ${cell(c.value)} | ${cell(c.finding.sourceValue)} | ${c.finding.quote ? `„${cell(c.finding.quote)}“ ` : ''}${cell(c.finding.note)} [Quelle](${c.url}) |`,
    ),
  ];
  if (dev.length) out.push('', '## Abweichungen', ...table(dev));
  if (unclear.length) out.push('', '## Unklar (bitte von Hand prüfen)', ...table(unclear));
  if (failed.length) {
    out.push('', '## Quelle nicht abrufbar');
    for (const g of failed) out.push(`- [${g.url}](${g.url}): ${cell(g.error)} – ${g.items.map((i) => i.label).join(', ')}`);
  }
  if (ok.length) out.push('', '## Bestätigt', ...table(ok));
  return out.join('\n') + '\n';
}
