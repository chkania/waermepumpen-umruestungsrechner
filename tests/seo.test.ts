import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const BASE = 'https://waermepumpen-investitionsrechner.de/';
const root = process.cwd();
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const pages = readdirSync(root).filter((f) => f.endsWith('.html'));
const urlOf = (page: string) => BASE + (page === 'index.html' ? '' : page);

describe('N13 Suchmaschinen: kanonische Adresse, robots.txt, Sitemap', () => {
  it('jede Seite verweist auf ihre Adresse unter der Hauptdomain', () => {
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      const links = [...read(page).matchAll(/<link rel="canonical" href="([^"]+)" \/>/g)].map((m) => m[1]);
      expect(links, page).toEqual([urlOf(page)]);
    }
  });

  it('robots.txt erlaubt alles und nennt die Sitemap', () => {
    const robots = read('public/robots.txt');
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).not.toMatch(/^Disallow: \/\s*$/m);
    expect(robots).toContain(`Sitemap: ${BASE}sitemap.xml`);
  });

  it('Sitemap enthält genau alle Seiten', () => {
    const locs = [...read('public/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.sort()).toEqual(pages.map(urlOf).sort());
  });
});

describe('F33 Inhalt für Suchmaschinen und Linkvorschauen', () => {
  const index = read('index.html');
  const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  it('F33.1 Rechner ohne JavaScript: Überschrift, Text und Links zu allen Seiten im HTML', () => {
    const app = /<div id="app">([\s\S]*?)<\/div>\s*<script/.exec(index)![1];
    expect(app).toMatch(/<h1>Wärmepumpen-Investitionsrechner<\/h1>/);
    expect((app.match(/<h2>/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(text(app).split(' ').length).toBeGreaterThanOrEqual(250);
    for (const page of pages.filter((p) => p !== 'index.html' && p !== 'lizenzen-drittanbieter.html')) expect(app, page).toContain(`href="./${page}"`);
    expect(app).toContain('<noscript>');
    expect(read('rechenweg.html')).toMatch(/<div id="doc">\s*<main class="static-intro">\s*<h1>Rechenweg<\/h1>/);
  });

  it('F33.3 Titel und Beschreibung: aussagekräftig, nicht zu lang, je Seite verschieden; Rechner setzt denselben Titel', async () => {
    const { PAGE_TITLE } = await import('../src/project');
    const titles = pages.map((p) => /<title>([^<]+)<\/title>/.exec(read(p))![1]);
    expect(new Set(titles).size).toBe(pages.length);
    expect(titles[pages.indexOf('index.html')]).toBe(PAGE_TITLE);
    expect(PAGE_TITLE.length).toBeLessThanOrEqual(65);
    expect(PAGE_TITLE).toMatch(/Wärmepumpe.*KfW/);
    for (const p of pages) {
      const d = /<meta name="description" content="([^"]+)"/.exec(read(p))?.[1];
      expect(d, p).toBeTruthy();
      expect(d!.length, p).toBeLessThanOrEqual(160);
    }
  });

  it('F33.4 Linkvorschau (Open Graph) und strukturierte Daten', () => {
    const og = (k: string) => new RegExp(`<meta property="og:${k}" content="([^"]+)"`).exec(index)?.[1];
    expect(og('title')).toBe(/<title>([^<]+)<\/title>/.exec(index)![1]);
    expect(og('url')).toBe(BASE);
    expect(og('image')).toBe(`${BASE}og-image.png`);
    expect(index).toContain('<meta name="twitter:card" content="summary_large_image" />');
    // the image exists locally with the declared size (PNG header: width/height at bytes 16–23)
    const png = readFileSync(join(root, 'public/og-image.png'));
    expect(png.readUInt32BE(16)).toBe(Number(og('image:width')));
    expect(png.readUInt32BE(20)).toBe(Number(og('image:height')));
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(index)![1]);
    expect(ld).toMatchObject({ '@context': 'https://schema.org', '@type': 'WebApplication', url: BASE, isAccessibleForFree: true, inLanguage: 'de' });
    expect(ld.offers.price).toBe('0');
  });

  it('F33.2 Dokumentseiten werden beim Build mit Inhalt vorgerendert', async () => {
    const { prerenderDocPage } = await import('../prerender');
    const { DOC_PAGES } = await import('../src/pages/doc-pages');
    for (const [file, config] of Object.entries(DOC_PAGES)) {
      const out = prerenderDocPage(read(file), file, read);
      const container = new RegExp(`<div id="${config.element}">([\\s\\S]*)</div>\\s*<script`).exec(out)![1];
      expect(container, file).toMatch(/<h1>[^<]+<\/h1>/);
      expect(text(container).length, file).toBeGreaterThan(500);
      expect(container, file).toContain(`<a href="./${file}" aria-current="page">`);
      expect((container.match(/aria-current="page"/g) ?? []).length, file).toBe(1);
    }
    expect(Object.keys(DOC_PAGES).sort()).toEqual(pages.filter((p) => !['index.html', 'rechenweg.html'].includes(p)).sort());
    expect(prerenderDocPage('<div id="app"></div>', 'index.html', read)).toBe('<div id="app"></div>');
    expect(() => prerenderDocPage('<body></body>', 'hilfe.html', read)).toThrow('Container');
    // "$" in the content is kept as written
    expect(prerenderDocPage('<div id="doc"></div>', 'impressum.html', () => '# T\n\nPreis $& und $1')).toContain('Preis $&amp; und $1');
  });
});
