/**
 * Automatische Versionierung (N9): Ableitung der nächsten Version nach Semantic Versioning
 * (https://semver.org/) aus Commit-Nachrichten im Format Conventional Commits
 * (https://www.conventionalcommits.org/de/v1.0.0/).
 *
 * - `feat`                                → MINOR (neue Funktion, abwärtskompatibel)
 * - `fix`, `perf`                         → PATCH (Fehlerkorrektur bzw. Verbesserung, abwärtskompatibel)
 * - `!` nach Typ/Scope oder Fußzeile `BREAKING CHANGE:` → MAJOR (inkompatibel, z. B. Export-/Link-Format)
 * - alle übrigen Typen (docs, test, refactor, build, ci, chore, style, revert) → keine neue Version
 *
 * Nur Node-Bordmittel, damit der Release-Workflow keinen fremden Paketcode mit Schreibrechten ausführt.
 */

export type Bump = 'major' | 'minor' | 'patch';

export const COMMIT_TYPES = ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'chore', 'style', 'revert'] as const;

export interface RawCommit {
  hash: string;
  subject: string;
  body: string;
}

export interface ParsedCommit {
  hash: string;
  type: string;
  scope: string | null;
  breaking: boolean;
  description: string;
  /** Text der Fußzeile `BREAKING CHANGE:` (falls vorhanden). */
  breakingNote: string | null;
}

const HEADER = /^([a-z]+)(?:\(([^()\r\n]+)\))?(!)?: (\S.*)$/;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE: *(\S.*)$/m;

/** Zerlegt eine Commit-Nachricht; null, wenn sie nicht dem Format entspricht. */
export function parseCommit(c: RawCommit): ParsedCommit | null {
  const m = HEADER.exec(c.subject.trim());
  if (!m || !(COMMIT_TYPES as readonly string[]).includes(m[1])) return null;
  const footer = BREAKING_FOOTER.exec(c.body);
  return {
    hash: c.hash,
    type: m[1],
    scope: m[2] ?? null,
    breaking: m[3] === '!' || footer !== null,
    description: m[4].trim(),
    breakingNote: footer ? footer[1].trim() : null,
  };
}

export function bumpFor(c: ParsedCommit): Bump | null {
  if (c.breaking) return 'major';
  if (c.type === 'feat') return 'minor';
  if (c.type === 'fix' || c.type === 'perf') return 'patch';
  return null;
}

const RANK: Record<Bump, number> = { patch: 1, minor: 2, major: 3 };

/** Höchste Stufe aller Commits; null = keine neue Version. */
export function maxBump(commits: ParsedCommit[]): Bump | null {
  let best: Bump | null = null;
  for (const c of commits) {
    const b = bumpFor(c);
    if (b && (!best || RANK[b] > RANK[best])) best = b;
  }
  return best;
}

/** Nächste Version nach SemVer 2.0.0 (Nr. 6–8: niedrigere Stellen werden auf 0 gesetzt). */
export function nextVersion(version: string, bump: Bump): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`Keine gültige Version: ${version}`);
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Changelog-Abschnitt „## x.y.z – JJJJ-MM-TT“ mit deutschen Rubriken. */
export function changelogSection(version: string, date: string, commits: ParsedCommit[]): string {
  const groups: [string, string[]][] = [
    ['Inkompatible Änderungen', []],
    ['Neu', []],
    ['Fehlerkorrekturen', []],
    ['Verbessert', []],
  ];
  const add = (i: number, text: string) => {
    const line = `- ${capitalize(text)}`;
    if (!groups[i][1].includes(line)) groups[i][1].push(line);
  };
  for (const c of commits) {
    if (c.breaking) add(0, c.breakingNote && c.breakingNote !== c.description ? `${c.description} – ${c.breakingNote}` : c.description);
    else if (c.type === 'feat') add(1, c.description);
    else if (c.type === 'fix') add(2, c.description);
    else if (c.type === 'perf') add(3, c.description);
  }
  const body = groups
    .filter(([, lines]) => lines.length > 0)
    .map(([title, lines]) => `### ${title}\n${lines.join('\n')}\n`)
    .join('\n');
  return `## ${version} – ${date}\n\n${body}`;
}

/** Fügt den Abschnitt vor der bisher neuesten Version ein (nach dem Einleitungstext). */
export function insertSection(changelog: string, section: string): string {
  const m = /^## /m.exec(changelog);
  if (!m) return `${changelog.trimEnd()}\n\n${section}`;
  return `${changelog.slice(0, m.index)}${section}\n${changelog.slice(m.index)}`;
}

/** Setzt die Version in package.json bzw. package-lock.json (Format wie npm: 2 Leerzeichen, Zeilenende). */
export function setPackageVersion(jsonText: string, version: string): string {
  const data = JSON.parse(jsonText);
  data.version = version;
  if (data.packages?.['']) data.packages[''].version = version;
  return JSON.stringify(data, null, 2) + '\n';
}

/** Datum JJJJ-MM-TT in deutscher Zeit. */
export function berlinDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d);
}
