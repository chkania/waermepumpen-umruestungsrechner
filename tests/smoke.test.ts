import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { baseUrl, checkVersionInfo, isIgnoredUrl, MAIN_URL, parseArgs, sitemapPages } from '../scripts/smoke-lib';

describe('N15 Prüfung nach dem Deployment', () => {
  it('Kommandozeile: Standard ist die Hauptadresse mit der Version aus package.json', () => {
    expect(parseArgs([], '1.2.3')).toEqual({ url: MAIN_URL, version: '1.2.3' });
    expect(parseArgs(['http://localhost:4173', '--version', '2.0.0', '--commit', 'abc'], '1.2.3')).toEqual({
      url: 'http://localhost:4173/',
      version: '2.0.0',
      commit: 'abc',
    });
    expect(() => parseArgs(['--version'], '1.2.3')).toThrow(/braucht einen Wert/);
    expect(() => parseArgs(['--foo'], '1.2.3')).toThrow(/Unbekannte Option/);
    expect(baseUrl('https://example.org/rechner?x=1#y')).toBe('https://example.org/rechner/');
  });

  it('version.json: Version und Commit müssen stimmen', () => {
    expect(checkVersionInfo({ version: '1.2.3', commit: 'abc' }, { version: '1.2.3', commit: 'abc' })).toEqual([]);
    expect(checkVersionInfo({ version: '1.2.3', commit: 'abc' }, { version: '1.2.3' })).toEqual([]);
    expect(checkVersionInfo({ version: '1.2.2', commit: 'abc' }, { version: '1.2.3', commit: 'def' })).toEqual([
      'Version 1.2.2 ausgeliefert, erwartet 1.2.3',
      'Commit abc ausgeliefert, erwartet def',
    ]);
    expect(checkVersionInfo(null, { version: '1.2.3' })).toEqual(['version.json ist kein JSON-Objekt']);
  });

  it('Seiten aus der Sitemap werden auf die geprüfte Adresse umgesetzt, der Rechner selbst fehlt', () => {
    const xml = readFileSync('public/sitemap.xml', 'utf8');
    const pages = sitemapPages(xml, 'http://localhost:4173/');
    expect(pages).toContain('http://localhost:4173/hilfe.html');
    expect(pages).toContain('http://localhost:4173/changelog.html');
    expect(pages).not.toContain('http://localhost:4173/');
    expect(pages.every((p) => p.startsWith('http://localhost:4173/'))).toBe(true);
  });

  it('nur die Besucherstatistik wird ignoriert (blockiert)', () => {
    expect(isIgnoredUrl('https://analytics.chkania.net/matomo.js')).toBe(true);
    expect(isIgnoredUrl('https://waermepumpen-investitionsrechner.de/assets/main.js')).toBe(false);
    expect(isIgnoredUrl('kein url')).toBe(false);
  });

  it('Build schreibt version.json, Deploy-Workflow prüft danach ohne Secrets', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/fileName: 'version\.json'/);
    const wf = readFileSync('.github/workflows/deploy.yml', 'utf8');
    const verify = wf.slice(wf.indexOf('\n  verify:'));
    expect(verify).toMatch(/needs: \[build, deploy\]/);
    expect(verify).toMatch(/node scripts\/smoke-test\.ts "\$URL" --version "\$VERSION" --commit "\$COMMIT"/);
    expect(verify).not.toMatch(/secrets\.|environment:/);
  });
});
