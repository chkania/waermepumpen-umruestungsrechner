/**
 * Writes the checklist for the periodic review of the assumptions (F22) as Markdown.
 *   node scripts/assumptions-checklist.ts [out-dir]   → <out-dir>/title.txt and <out-dir>/body.md
 * Runs with plain Node (type stripping); used by .github/workflows/annahmen-pruefen.yml.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SOURCES, OFFICIAL_REFS, SOURCE_KIND_LABEL } from '../src/core/sources.ts';
import { SECTIONS } from '../src/ui/fields.ts';
import { buildChecklist } from './assumptions-lib.ts';

const out = process.argv[2] ?? 'review';
// defaults.ts has extensionless runtime imports (bundler style), so read the date from its text
const defaultsTs = readFileSync(new URL('../src/core/defaults.ts', import.meta.url), 'utf8');
const FUNDING_SOURCE_DATE = /FUNDING_SOURCE_DATE = '(\d{4}-\d{2}-\d{2})'/.exec(defaultsTs)?.[1];
if (!FUNDING_SOURCE_DATE) throw new Error('FUNDING_SOURCE_DATE nicht in src/core/defaults.ts gefunden.');
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
const { title, body, count } = buildChecklist({
  sections: SECTIONS,
  sources: DEFAULT_SOURCES,
  refs: OFFICIAL_REFS,
  kindLabels: SOURCE_KIND_LABEL,
  lastReview: FUNDING_SOURCE_DATE,
  today,
});
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'title.txt'), title);
writeFileSync(join(out, 'body.md'), body);
console.log(`${title}: ${count} Werte zu prüfen → ${out}/`);
