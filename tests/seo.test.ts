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
