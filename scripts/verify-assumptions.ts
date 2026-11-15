/**
 * Pre-check of the assumptions against their sources with Claude (F22.3) – report only, changes nothing.
 *
 *   npm run verify:assumptions                      check all time-sensitive defaults, report to reports/
 *   npm run verify:assumptions -- --list            only list what would be checked (no API calls, no cost)
 *   npm run verify:assumptions -- --only funding.   only paths with this prefix
 *   npm run verify:assumptions -- --out bericht.md  other report file
 *
 * Credentials: ANTHROPIC_API_KEY from .env.local (see .env.example) or the environment, or an `ant auth login` profile.
 * Runs with tsx because src/ uses extensionless (bundler style) imports.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { createDefaults, FUNDING_SOURCE_DATE } from '../src/core/defaults';
import { DEFAULT_SOURCES } from '../src/core/sources';
import { SECTIONS } from '../src/ui/fields';
import { checkGroups, claudeAsk, errorText, isFatalApiError, MODEL } from './assumptions-agent/check';
import { fetchSource } from './assumptions-agent/fetch-source';
import { buildReport, collectItems, groupBySource } from './assumptions-agent/lib';

interface Options {
  list: boolean;
  only?: string;
  out?: string;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (!v || v.startsWith('--')) throw new Error(`${a} braucht einen Wert`);
      return v;
    };
    if (a === '--list') opts.list = true;
    else if (a === '--only') opts.only = value();
    else if (a === '--out') opts.out = value();
    else if (a === '--help' || a === '-h') {
      console.log('Aufruf: npm run verify:assumptions [-- --list] [--only <pfad-präfix>] [--out <datei>]');
      process.exit(0);
    } else throw new Error(`Unbekannte Option ${a}`);
  }
  return opts;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
  const items = collectItems(SECTIONS, DEFAULT_SOURCES, createDefaults(new Date()), opts.only);
  const groups = groupBySource(items);
  if (!items.length) throw new Error(`Keine zu prüfenden Werte${opts.only ? ` mit Präfix „${opts.only}“` : ''}.`);

  if (opts.list) {
    for (const g of groups) console.log(`${g.url}\n${g.items.map((i) => `  - ${i.label}: ${i.value} (${i.path})`).join('\n')}`);
    console.log(`\n${items.length} Werte aus ${groups.length} Quellen – ${groups.length} Modellanfragen bei einem Lauf.`);
    return;
  }

  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  const client = new Anthropic();
  console.log(`Prüfe ${items.length} Werte aus ${groups.length} Quellen mit ${MODEL} …`);
  const { checked, failed } = await checkGroups(groups, {
    fetchSource: (url) => fetchSource(url),
    ask: claudeAsk(client),
    log: console.log,
    isFatal: isFatalApiError,
  });

  const report = buildReport({ date: today, model: MODEL, lastReview: FUNDING_SOURCE_DATE, checked, failed });
  const out = opts.out ?? `reports/annahmen-${today}.md`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, report);
  const count = (v: string) => checked.filter((c) => c.finding.verdict === v).length;
  console.log(
    `\n${count('abweichung')} Abweichung(en), ${count('unklar')} unklar, ${failed.reduce((n, g) => n + g.items.length, 0)} nicht abrufbar oder nicht geprüft, ${count('bestaetigt')} bestätigt.\nBericht: ${out}`,
  );
}

main().catch((err) => {
  if (err instanceof Anthropic.AuthenticationError) console.error('Anmeldung bei der Claude-API fehlgeschlagen: ANTHROPIC_API_KEY in .env.local prüfen (siehe .env.example).');
  else if (isFatalApiError(err)) console.error(`Abgebrochen, kein Bericht geschrieben. ${errorText(err)}`);
  else console.error((err as Error).message);
  process.exitCode = 1;
});
