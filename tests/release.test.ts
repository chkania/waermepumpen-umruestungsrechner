import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  changelogSection,
  expandSquash,
  insertSection,
  maxBump,
  nextVersion,
  parseCommit,
  setPackageVersion,
  type ParsedCommit,
} from '../scripts/release-lib.ts';

const p = (subject: string, body = '') => parseCommit({ hash: 'abc', subject, body });
const all = (...subjects: string[]) => subjects.map((s) => p(s)).filter((x): x is ParsedCommit => x !== null);

describe('N9 Versionierung aus Conventional Commits', () => {
  it('erkennt Typ, Bereich, Breaking Change und Beschreibung', () => {
    expect(p('feat(export): Dateiname mit Szenario')).toMatchObject({ type: 'feat', scope: 'export', breaking: false, description: 'Dateiname mit Szenario' });
    expect(p('feat!: neues Exportformat')?.breaking).toBe(true);
    expect(p('fix: Rundung', 'Details\n\nBREAKING CHANGE: alte Links ungültig')).toMatchObject({ breaking: true, breakingNote: 'alte Links ungültig' });
    expect(p('Neue Funktion')).toBeNull();
    expect(p('feature: x')).toBeNull(); // unknown type
    expect(p('feat:ohne Leerzeichen')).toBeNull();
  });

  it('höchste Stufe entscheidet (feat → minor, fix/perf → patch, Breaking → major, Rest → keine)', () => {
    expect(maxBump(all('docs: Handbuch', 'test: mehr Tests', 'chore(deps): bump vite', 'ci: Workflow'))).toBeNull();
    expect(maxBump(all('fix: a', 'docs: b'))).toBe('patch');
    expect(maxBump(all('perf: schneller'))).toBe('patch');
    expect(maxBump(all('fix: a', 'feat: b'))).toBe('minor');
    expect(maxBump(all('fix: a', 'feat: b', 'refactor!: c'))).toBe('major');
  });

  it('nächste Version nach SemVer: niedrigere Stellen werden zurückgesetzt', () => {
    expect(nextVersion('1.1.0', 'patch')).toBe('1.1.1');
    expect(nextVersion('1.1.3', 'minor')).toBe('1.2.0');
    expect(nextVersion('1.4.2', 'major')).toBe('2.0.0');
    expect(() => nextVersion('1.0', 'patch')).toThrow();
  });

  it('Changelog-Abschnitt mit deutschen Rubriken, ohne Duplikate und ohne nicht sichtbare Änderungen', () => {
    const s = changelogSection('1.2.0', '2026-11-14', all('feat: vergleich mit PV', 'fix: Rundung im Export', 'docs: Handbuch', 'feat: vergleich mit PV', 'perf: schnellere Simulation'));
    expect(s).toBe(
      '## 1.2.0 – 2026-11-14\n\n### Neu\n- Vergleich mit PV\n\n### Fehlerkorrekturen\n- Rundung im Export\n\n### Verbessert\n- Schnellere Simulation\n',
    );
    const b = changelogSection('2.0.0', '2026-11-14', [p('feat!: neues Exportformat', 'BREAKING CHANGE: Dateien vor 2.0 werden nicht mehr geladen')!]);
    expect(b).toContain('### Inkompatible Änderungen\n- Neues Exportformat – Dateien vor 2.0 werden nicht mehr geladen');
    expect(b).not.toContain('### Neu');
  });

  it('Squash-Merge: jede enthaltene Änderung bekommt einen eigenen Eintrag', () => {
    // GitHub format when the squash message is built from the commit messages
    const squash = {
      hash: 'abc',
      subject: 'feat: Name, Logo und Design (#13)',
      body: '* feat: Neuer Name\n\nDetails zum Namen\n\nCo-Authored-By: X <x@example.invalid>\n\n* feat!: Neues Exportformat\n\nBREAKING CHANGE: alte Dateien neu exportieren\n\n* test: mehr Tests\n\n* fix: Logo-Übergang sauber\n',
    };
    const entries = expandSquash(squash);
    expect(entries.map((e) => e.subject)).toEqual(['feat: Neuer Name', 'feat!: Neues Exportformat', 'test: mehr Tests', 'fix: Logo-Übergang sauber']);
    const parsed = entries.map(parseCommit).filter((x): x is ParsedCommit => x !== null);
    expect(parsed[1].breakingNote).toBe('alte Dateien neu exportieren');
    expect(changelogSection('2.0.0', '2026-11-14', parsed)).toBe(
      '## 2.0.0 – 2026-11-14\n\n### Inkompatible Änderungen\n- Neues Exportformat – alte Dateien neu exportieren\n\n### Neu\n- Neuer Name\n\n### Fehlerkorrekturen\n- Logo-Übergang sauber\n',
    );
    // PR description with a list works as well
    expect(expandSquash({ hash: 'a', subject: 'feat: Sammel-PR', body: 'Text\n- feat: Eins\n- fix: Zwei\n- **kein Commit**\n' }).map((e) => e.subject)).toEqual(['feat: Eins', 'fix: Zwei']);
    // no listed change with a version → the commit itself (title) counts
    const single = { hash: 'b', subject: 'feat: Nur ein Commit (#14)', body: 'Beschreibung\n- **Punkt**\n* docs: Handbuch\n' };
    expect(expandSquash(single)).toEqual([single]);
  });

  it('neuer Abschnitt steht vor der bisher neuesten Version; Paketversion wird gesetzt', () => {
    const log = '# Changelog\n\nIntro\n\n## 1.1.0 – 2026-11-14\n\n### Neu\n- x\n';
    expect(insertSection(log, '## 1.2.0 – 2026-11-15\n\n### Neu\n- y\n')).toBe(
      '# Changelog\n\nIntro\n\n## 1.2.0 – 2026-11-15\n\n### Neu\n- y\n\n## 1.1.0 – 2026-11-14\n\n### Neu\n- x\n',
    );
    const lock = JSON.parse(setPackageVersion(JSON.stringify({ version: '1.1.0', packages: { '': { version: '1.1.0' } } }), '1.2.0'));
    expect(lock.version).toBe('1.2.0');
    expect(lock.packages[''].version).toBe('1.2.0');
  });
});

describe('N9 Release-Skript im Git-Repository', () => {
  const script = fileURLToPath(new URL('../scripts/release.ts', import.meta.url));
  let dir = '';
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  const sh = (cmd: string, ...a: string[]) => execFileSync(cmd, a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const commit = (msg: string) => {
    writeFileSync(join(dir, 'src.txt'), msg + Math.random());
    sh('git', 'add', '-A');
    sh('git', 'commit', '-q', '-m', msg);
  };

  // Creates its own repository and starts about a dozen git processes plus the release script. Alone it takes
  // just under 2 s; under load (many test files in parallel) it would otherwise exceed the default limit of 5 s.
  it('parallele Entwicklung: Version entsteht erst auf main aus allen Commits seit dem letzten Release', { timeout: 30_000 }, () => {
    dir = mkdtempSync(join(tmpdir(), 'release-test-'));
    sh('git', 'init', '-q', '-b', 'main');
    sh('git', 'config', 'user.email', 'test@example.invalid');
    sh('git', 'config', 'user.name', 'Test');
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '1.1.0' }, null, 2) + '\n');
    writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({ name: 'x', version: '1.1.0', packages: { '': { version: '1.1.0' } } }, null, 2) + '\n');
    writeFileSync(join(dir, 'CHANGELOG.md'), '# Changelog\n\n## 1.1.0 – 2026-11-14\n\n### Neu\n- Alt\n');
    sh('git', 'add', '-A');
    sh('git', 'commit', '-q', '-m', 'chore(release): 1.1.0');

    // two people, two PRs – neither changes version or changelog
    commit('fix: Rundung im Export');
    commit('docs: Handbuch ergänzt');
    commit('feat(vergleich): PV-Anlage berücksichtigen');
    commit('Aufräumen ohne Format');
    // squash merge of a PR with several changes (GitHub: message from the commit messages)
    commit('feat: Sammel-PR (#7)\n\n* feat: Logo im Kopf\n\n* fix: Favicon im Dunkelmodus\n');

    const out = sh('node', script);
    expect(out).toContain('Neue Version 1.2.0');
    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version).toBe('1.2.0');
    expect(JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf8')).packages[''].version).toBe('1.2.0');
    const log = readFileSync(join(dir, 'CHANGELOG.md'), 'utf8');
    expect(log).toMatch(/^# Changelog\n\n## 1\.2\.0 – \d{4}-\d{2}-\d{2}\n\n### Neu\n- PV-Anlage berücksichtigen\n- Logo im Kopf\n\n### Fehlerkorrekturen\n- Rundung im Export\n- Favicon im Dunkelmodus\n\n## 1\.1\.0/);
    expect(log).not.toContain('Handbuch');

    // The release commit becomes the new reference point; afterwards only docs → no new version
    sh('git', 'commit', '-q', '-am', 'chore(release): 1.2.0');
    commit('docs: Tippfehler');
    expect(sh('node', script)).toContain('Keine neue Version');
    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version).toBe('1.2.0');
  });
});
