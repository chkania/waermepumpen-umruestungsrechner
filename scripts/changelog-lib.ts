/**
 * Changelog excerpt for a deployment (N12.1): which versions go live compared with the deployed version?
 * Logic without network, used by scripts/deploy-changelog.ts and tested in tests/deploy-changelog.test.ts.
 */

export interface ChangelogSection {
  version: string;
  date: string;
  /** Markdown below the "## x.y.z – date" heading (without it). */
  body: string;
}

const SEMVER = /^\d+\.\d+\.\d+$/;

/** Sections "## x.y.z – YYYY-MM-DD" of CHANGELOG.md, newest first (as in the file). */
export function parseChangelog(md: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];
  const re = /^## (\d+\.\d+\.\d+)(?: [–-] (\S+))?[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/gm;
  for (const m of md.matchAll(re)) sections.push({ version: m[1], date: m[2] ?? '', body: m[3].trim() });
  return sections;
}

/** Compares two versions x.y.z numerically (negative: a < b). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** Version from the live version.json; anything else than x.y.z (also missing or invalid JSON) counts as unknown. */
export function liveVersionOf(info: unknown): string | null {
  const v = (info as { version?: unknown } | null)?.version;
  return typeof v === 'string' && SEMVER.test(v) ? v : null;
}

/**
 * Markdown for the job summary: the changelog sections that this deployment brings online
 * (newer than the live version, up to the built version). If the live version is unknown, only the built version's section.
 */
export function deploySummary(changelog: string, version: string, live: string | null, liveError?: string): string {
  const sections = parseChangelog(changelog);
  const out: string[] = [];
  let shown: ChangelogSection[];
  if (live === null) {
    out.push(`### Änderungen in Version ${version}`, '', `_Live-Version unbekannt${liveError ? ` (${liveError})` : ''} – gezeigt wird nur der Eintrag der neuen Version._`);
    shown = sections.filter((s) => s.version === version);
  } else if (compareVersions(live, version) >= 0) {
    const what = compareVersions(live, version) === 0 ? 'ist bereits online' : `ist älter als die Live-Version ${live}`;
    return `### Keine neuen Versionen\n\nVersion ${version} ${what} – dieses Deployment bringt laut Changelog keine Änderungen für Nutzer (z. B. erneutes Deployment, nur interne Änderungen).\n`;
  } else {
    shown = sections.filter((s) => compareVersions(s.version, live) > 0 && compareVersions(s.version, version) <= 0);
    out.push(`### Änderungen ${live} → ${version}`, '', `Live ist Version ${live}; dieses Deployment bringt ${shown.length} neue Version(en):`);
  }
  if (!shown.length) out.push('', `_Kein Changelog-Eintrag für Version ${version} gefunden._`);
  for (const s of shown) {
    // the section headings of the changelog (###) become one level lower below the version
    out.push('', `#### ${s.version}${s.date ? ` – ${s.date}` : ''}`, '', s.body.replace(/^### /gm, '##### '));
  }
  return out.join('\n') + '\n';
}
