/**
 * Automatic versioning (N9): derives the next version per Semantic Versioning
 * (https://semver.org/) from commit messages in Conventional Commits format
 * (https://www.conventionalcommits.org/en/v1.0.0/).
 *
 * - `feat`                                → MINOR (new feature, backwards compatible)
 * - `fix`, `perf`                         → PATCH (bug fix or improvement, backwards compatible)
 * - `!` after type/scope or footer `BREAKING CHANGE:` → MAJOR (incompatible, e.g. export/link format)
 * - all other types (docs, test, refactor, build, ci, chore, style, revert) → no new version
 *
 * Node built-ins only, so the release workflow never runs third-party package code with write permissions.
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
  /** Text of the `BREAKING CHANGE:` footer (if present). */
  breakingNote: string | null;
}

const HEADER = /^([a-z]+)(?:\(([^()\r\n]+)\))?(!)?: (\S.*)$/;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE: *(\S.*)$/m;

/** Parses a commit message; null if it does not match the format. */
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

const LISTED = /^[*-] +(\S.*)$/;

/**
 * Splits a squash-merge commit into the commits it contains, so that every change gets its own
 * changelog entry instead of only the PR title. Contained commits are list lines in the body in
 * Conventional Commits format – GitHub writes them as `* feat: …` when the squash message is built
 * from the commit messages; `- feat: …` in the PR description works as well. Lines up to the next
 * entry belong to that entry (e.g. a `BREAKING CHANGE:` footer). Falls back to the commit itself
 * if the body lists no change that leads to a version (feat, fix, perf, breaking).
 */
export function expandSquash(c: RawCommit): RawCommit[] {
  const entries: RawCommit[] = [];
  for (const line of c.body.split(/\r?\n/)) {
    const m = LISTED.exec(line.trim());
    if (m && parseCommit({ hash: c.hash, subject: m[1], body: '' })) entries.push({ hash: c.hash, subject: m[1], body: '' });
    else if (entries.length) entries[entries.length - 1].body += `${line}\n`;
  }
  const relevant = entries.some((e) => {
    const p = parseCommit(e);
    return p !== null && bumpFor(p) !== null;
  });
  return relevant ? entries : [c];
}

export function bumpFor(c: ParsedCommit): Bump | null {
  if (c.breaking) return 'major';
  if (c.type === 'feat') return 'minor';
  if (c.type === 'fix' || c.type === 'perf') return 'patch';
  return null;
}

const RANK: Record<Bump, number> = { patch: 1, minor: 2, major: 3 };

/** Highest level across all commits; null = no new version. */
export function maxBump(commits: ParsedCommit[]): Bump | null {
  let best: Bump | null = null;
  for (const c of commits) {
    const b = bumpFor(c);
    if (b && (!best || RANK[b] > RANK[best])) best = b;
  }
  return best;
}

/** Next version per SemVer 2.0.0 (items 6–8: lower positions are reset to 0). */
export function nextVersion(version: string, bump: Bump): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`Keine gültige Version: ${version}`);
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Changelog section "## x.y.z – YYYY-MM-DD" with German headings. */
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

/** Inserts the section before the previously newest version (after the introduction). */
export function insertSection(changelog: string, section: string): string {
  const m = /^## /m.exec(changelog);
  if (!m) return `${changelog.trimEnd()}\n\n${section}`;
  return `${changelog.slice(0, m.index)}${section}\n${changelog.slice(m.index)}`;
}

/** Sets the version in package.json or package-lock.json (npm format: 2 spaces, trailing newline). */
export function setPackageVersion(jsonText: string, version: string): string {
  const data = JSON.parse(jsonText);
  data.version = version;
  if (data.packages?.['']) data.packages[''].version = version;
  return JSON.stringify(data, null, 2) + '\n';
}

/** Date YYYY-MM-DD in German time (Europe/Berlin). */
export function berlinDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d);
}
