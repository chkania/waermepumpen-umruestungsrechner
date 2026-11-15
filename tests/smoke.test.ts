import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  baseUrl,
  checkVersionInfo,
  isIgnoredUrl,
  MAIN_URL,
  parseArgs,
  REQUIRED_SECURITY_HEADERS,
  securityHeaderErrors,
  sitemapPages,
} from '../scripts/smoke-lib';

/** Delivered headers of the live site (docs/DEPLOYMENT.md). */
const delivered = (values: Record<string, string>): Headers =>
  new Headers(Object.fromEntries(Object.entries(values).map(([k, v]) => [k.toLowerCase(), v])));
const allHeaders = () => delivered(Object.fromEntries(REQUIRED_SECURITY_HEADERS.map((h) => [h.name, h.value])));

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

  it('Sicherheits-Header: alle gesetzt → keine Abweichung, auch mit Zusatzangaben', () => {
    expect(securityHeaderErrors(allHeaders())).toEqual([]);
    expect(
      securityHeaderErrors(
        delivered({
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
          'Cross-Origin-Opener-Policy': 'same-origin',
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        }),
      ),
    ).toEqual([]);
  });

  it('Sicherheits-Header: fehlende und falsche Werte werden benannt', () => {
    const missing = allHeaders();
    missing.delete('cross-origin-opener-policy');
    missing.delete('referrer-policy');
    expect(securityHeaderErrors(missing)).toEqual(['cross-origin-opener-policy fehlt', 'referrer-policy fehlt']);

    const wrong = allHeaders();
    wrong.set('x-frame-options', 'SAMEORIGIN');
    wrong.set('strict-transport-security', 'max-age=600');
    expect(securityHeaderErrors(wrong)).toEqual([
      'strict-transport-security: „max-age=600“, erwartet „max-age=31536000“',
      'x-frame-options: „SAMEORIGIN“, erwartet „deny“',
    ]);
  });

  it('Sicherheits-Header in Code und Dokumentation stimmen überein', () => {
    const doc = readFileSync('docs/DEPLOYMENT.md', 'utf8');
    const documented = [...doc.matchAll(/Header always set ([\w-]+) "([^"]+)"/g)].map((m) => ({
      name: m[1].toLowerCase(),
      value: m[2].toLowerCase(),
    }));
    expect(documented).toEqual(REQUIRED_SECURITY_HEADERS.map((h) => ({ name: h.name, value: h.value })));
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
