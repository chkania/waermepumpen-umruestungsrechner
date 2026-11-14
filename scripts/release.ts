/**
 * Automatische Versionierung (N9) – läuft im Workflow .github/workflows/release.yml nach jedem Push auf main.
 *
 *   node scripts/release.ts             nächste Version berechnen, package.json, package-lock.json und CHANGELOG.md schreiben
 *   node scripts/release.ts --dry-run   nur anzeigen, was passieren würde
 *   node scripts/release.ts --lint "<PR-Titel>"   prüft einen PR-Titel (Squash-Merge-Nachricht) auf das Format
 *
 * Bezugspunkt ist der letzte Commit, der das Feld "version" in package.json geändert hat
 * (also der letzte Release-Commit). Version und Changelog nie von Hand ändern.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  COMMIT_TYPES,
  berlinDate,
  bumpFor,
  changelogSection,
  insertSection,
  maxBump,
  nextVersion,
  parseCommit,
  setPackageVersion,
  type ParsedCommit,
  type RawCommit,
} from './release-lib.ts';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' });
const args = process.argv.slice(2);

const BUMP_TEXT = { major: 'MAJOR (inkompatibel)', minor: 'MINOR (neue Funktion)', patch: 'PATCH (Fehlerkorrektur)' } as const;

if (args[0] === '--lint') {
  const title = args[1] ?? '';
  const parsed = parseCommit({ hash: '', subject: title, body: '' });
  if (!parsed) {
    console.error(`Titel entspricht nicht Conventional Commits: "${title}"`);
    console.error(`Format: <typ>[(bereich)][!]: <beschreibung> – Typen: ${COMMIT_TYPES.join(', ')}`);
    console.error('Beispiele: "feat: Vergleich mit PV-Anlage", "fix(export): Dateiname ohne Umlaute", "feat!: neues Exportformat"');
    process.exit(1);
  }
  const b = bumpFor(parsed);
  console.log(b ? `OK – beim Merge entsteht eine neue ${BUMP_TEXT[b]}-Version.` : 'OK – keine neue Version (nicht für Nutzer sichtbar).');
  process.exit(0);
}

const dryRun = args.includes('--dry-run');
const base = git('log', '-G"version"\\s*:', '-n', '1', '--format=%H', '--', 'package.json').trim();
if (!base) throw new Error('Kein Bezugspunkt gefunden (Commit mit Änderung von "version" in package.json).');

const raw: RawCommit[] = git('log', `${base}..HEAD`, '--no-merges', '--format=%H%x1f%s%x1f%b%x1e')
  .split('\x1e')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [hash, subject, body] = s.split('\x1f');
    return { hash, subject, body: body ?? '' };
  });

const parsed: ParsedCommit[] = [];
for (const c of raw) {
  const p = parseCommit(c);
  if (p) parsed.push(p);
  else console.warn(`Hinweis: ${c.hash.slice(0, 7)} „${c.subject}“ entspricht nicht Conventional Commits und wird ignoriert.`);
}
parsed.reverse(); // chronologisch

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const bump = maxBump(parsed);
console.log(`Bezugspunkt ${base.slice(0, 7)} (Version ${pkg.version}), ${raw.length} Commit(s) seitdem.`);
if (!bump) {
  console.log('Keine neue Version: keine Commits vom Typ feat, fix, perf oder mit Breaking Change.');
  process.exit(0);
}

const version = nextVersion(pkg.version, bump);
const section = changelogSection(version, berlinDate(), parsed);
console.log(`Neue Version ${version} (${BUMP_TEXT[bump]}):\n\n${section}`);
if (dryRun) process.exit(0);

writeFileSync('package.json', setPackageVersion(readFileSync('package.json', 'utf8'), version));
writeFileSync('package-lock.json', setPackageVersion(readFileSync('package-lock.json', 'utf8'), version));
writeFileSync('CHANGELOG.md', insertSection(readFileSync('CHANGELOG.md', 'utf8'), section));
console.log('package.json, package-lock.json und CHANGELOG.md aktualisiert.');
