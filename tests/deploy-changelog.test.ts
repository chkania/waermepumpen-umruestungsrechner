import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compareVersions, deploySummary, liveVersionOf, parseChangelog } from '../scripts/changelog-lib';

const md = `# Changelog

Einleitung.

## 1.3.0 – 2026-11-15

### Neu
- Hinweis zum Startmonat

## 1.2.1 – 2026-11-14

### Fehlerkorrekturen
- Text korrigiert

## 1.2.0 – 2026-11-13

### Neu
- Variantenvergleich

## 1.0.0 – 2026-11-01

Erste Version.
`;

describe('N12.1 Changelog beim Deployment', () => {
  it('liest die Versionsabschnitte des Changelogs', () => {
    const s = parseChangelog(md);
    expect(s.map((x) => x.version)).toEqual(['1.3.0', '1.2.1', '1.2.0', '1.0.0']);
    expect(s[0]).toEqual({ version: '1.3.0', date: '2026-11-15', body: '### Neu\n- Hinweis zum Startmonat' });
    expect(s[3].body).toBe('Erste Version.');
    // the real changelog: newest entry = version of package.json
    const real = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'));
    expect(real[0].version).toBe(JSON.parse(readFileSync('package.json', 'utf8')).version);
  });

  it('vergleicht Versionen numerisch und akzeptiert nur x.y.z als Live-Version', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
    expect(liveVersionOf({ version: '1.2.0', commit: 'abc' })).toBe('1.2.0');
    expect(liveVersionOf({ version: '<b>1</b>' })).toBeNull();
    expect(liveVersionOf(null)).toBeNull();
  });

  it('zeigt alle Versionen zwischen Live-Stand und neuem Build', () => {
    const out = deploySummary(md, '1.3.0', '1.2.0');
    expect(out).toContain('### Änderungen 1.2.0 → 1.3.0');
    expect(out).toContain('2 neue Version(en)');
    expect(out).toContain('#### 1.3.0 – 2026-11-15');
    expect(out).toContain('#### 1.2.1 – 2026-11-14');
    expect(out).toContain('##### Fehlerkorrekturen\n- Text korrigiert');
    expect(out).not.toContain('Variantenvergleich');
    expect(out.indexOf('1.3.0 – ')).toBeLessThan(out.indexOf('1.2.1 – '));
  });

  it('gleiche Version: keine neuen Einträge; unbekannte Live-Version: nur der neue Eintrag', () => {
    expect(deploySummary(md, '1.3.0', '1.3.0')).toMatch(/^### Keine neuen Versionen[\s\S]*ist bereits online/);
    expect(deploySummary(md, '1.2.0', '1.3.0')).toMatch(/ist älter als die Live-Version 1\.3\.0/);
    const unknown = deploySummary(md, '1.3.0', null, 'HTTP 404');
    expect(unknown).toContain('Live-Version unbekannt (HTTP 404)');
    expect(unknown).toContain('Hinweis zum Startmonat');
    expect(unknown).not.toContain('Text korrigiert');
    expect(deploySummary(md, '9.9.9', null)).toContain('Kein Changelog-Eintrag für Version 9.9.9');
  });

  it('Deploy-Workflow zeigt den Auszug im Build-Job (vor der Freigabe), ohne den Build scheitern zu lassen', () => {
    const wf = readFileSync('.github/workflows/deploy.yml', 'utf8');
    const build = wf.slice(wf.indexOf('\n  build:'), wf.indexOf('\n  deploy:'));
    expect(build).toMatch(/node scripts\/deploy-changelog\.ts "\$URL" "\$VERSION" \| tee -a "\$GITHUB_STEP_SUMMARY"/);
    expect(build).not.toMatch(/secrets\./);
  });
});
