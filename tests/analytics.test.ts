// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"handleDisabledFileLoadingAsSuccess":true}}
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { addCsp } from '../csp';
import { initAnalytics, MATOMO_SITE_ID, MATOMO_URL } from '../src/analytics';

// happy-dom replaces import.meta.url, so resolve from the project root
const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');
const commands = () => (window._paq ?? []).map((c) => c[0]);

describe('N10 Besucherstatistik (Matomo)', () => {
  afterEach(() => {
    delete window._paq;
    document.head.querySelectorAll('script[src*="matomo"]').forEach((s) => s.remove());
  });

  it('nur im Produktions-Build aktiv (nicht in Entwicklung und Tests)', () => {
    initAnalytics('Rechner');
    expect(window._paq).toBeUndefined();
    expect(document.querySelector('script[src*="matomo"]')).toBeNull();
  });

  it('ohne Cookies, mit Do Not Track, ohne URL-Hash und mit festem Seitentitel', () => {
    location.hash = '#s=geheime-eingaben';
    document.title = 'Angebot Müller – Wärmepumpen-Rechner';
    initAnalytics('Rechner', { enabled: true });
    const q = window._paq!;
    expect(q).toContainEqual(['disableCookies']);
    expect(q).toContainEqual(['setDoNotTrack', true]);
    expect(q).toContainEqual(['discardHashTag', true]);
    expect(q).toContainEqual(['setDocumentTitle', 'Rechner']);
    expect(q).toContainEqual(['setSiteId', MATOMO_SITE_ID]);
    expect(q).toContainEqual(['setTrackerUrl', `${MATOMO_URL}matomo.php`]);
    // all privacy settings before the page view
    const c = commands();
    for (const cmd of ['disableCookies', 'setDoNotTrack', 'discardHashTag', 'setDocumentTitle', 'setExcludedQueryParams']) {
      expect(c.indexOf(cmd)).toBeLessThan(c.indexOf('trackPageView'));
    }
    expect(JSON.stringify(q)).not.toContain('geheime-eingaben');
    expect(JSON.stringify(q)).not.toContain('Müller');
    const excluded = q.find((x) => x[0] === 'setExcludedQueryParams')![1] as string[];
    expect(excluded).toEqual(expect.arrayContaining(['email', 'iban', 'password', 'token']));
    const script = document.querySelector<HTMLScriptElement>('script[src*="matomo"]')!;
    expect(script.src).toBe(`${MATOMO_URL}matomo.js`);
    expect(script.async).toBe(true);
  });

  it('alle Seiten melden sich mit festem Titel und haben das noscript-Pixel', () => {
    const pages: [string, string][] = [
      ['index.html', 'src/main.ts'],
      ['hilfe.html', 'src/help-main.ts'],
      ['lizenz.html', 'src/pages/lizenz-main.ts'],
      ['lizenzen-drittanbieter.html', 'src/pages/drittanbieter-main.ts'],
      ['changelog.html', 'src/pages/changelog-main.ts'],
    ];
    for (const [html, entry] of pages) {
      expect(read(html), html).toContain(`src="${MATOMO_URL}matomo.php?idsite=${MATOMO_SITE_ID}&amp;rec=1"`);
      expect(read(html), html).not.toMatch(/style="/);
      expect(read(entry), entry).toMatch(/initAnalytics\('[^']+'\);/);
    }
  });

  it('CSP erlaubt nur zusätzlich die Matomo-Instanz', async () => {
    const out = await addCsp('<head><meta charset="UTF-8" /><script>x()</script></head>');
    const csp = /content="([^"]+)"/.exec(out)![1];
    expect(csp).toMatch(/script-src 'self' https:\/\/analytics\.chkania\.net 'sha256-/);
    expect(csp).toContain("img-src 'self' data: https://analytics.chkania.net");
    expect(csp).toContain("connect-src 'self' https://analytics.chkania.net");
    expect(csp).not.toContain('unsafe-inline');
  });
});
