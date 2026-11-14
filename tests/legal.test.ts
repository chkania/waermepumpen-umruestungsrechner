// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOC_LINKS, renderDocPage } from '../src/doc-page';
import { slugify } from '../src/help';

// happy-dom replaces import.meta.url, so resolve from the project root
const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');

describe('N11 Impressum und Datenschutzerklärung', () => {
  it('Impressum mit Pflichtangaben nach § 5 DDG und Verantwortlichem nach § 18 Abs. 2 MStV', () => {
    const md = read('docs/IMPRESSUM.md');
    for (const s of ['§ 5 DDG', 'Christoph Kania', 'Höhrather Str. 11', '40591 Düsseldorf', 'E-Mail:', '§ 18 Abs. 2 MStV', 'keine Finanz-, Steuer-, Förder- oder Energieberatung']) {
      expect(md).toContain(s);
    }
    expect(md).not.toMatch(/TMG|RStV/); // outdated laws
  });

  it('Datenschutzerklärung beschreibt Matomo, lokale Speicherung und Widerspruch', () => {
    const md = read('docs/DATENSCHUTZ.md');
    for (const s of ['Matomo', 'keine Cookies', 'Do Not Track', 'IP-Maskierung', 'localStorage', '§ 25 Abs. 2 Nr. 2 TDDDG', 'Art. 6 Abs. 1 lit. f DSGVO', 'Aufsichtsbehörde', '<div id="analytics-opt-out"']) {
      expect(md).toContain(s);
    }
    // internal anchors point to existing headings
    const { html } = renderDocPage({ markdown: md, subtitle: 'x' });
    for (const [, id] of md.matchAll(/\]\(#([^)]+)\)/g)) expect(html, id).toContain(`id="${id}"`);
    expect(slugify('4. Plugins und Tools')).toBe('4-plugins-und-tools');
  });

  it('erreichbar aus Rechner und allen Dokumentseiten, Teil des Builds', () => {
    expect(DOC_LINKS.map(([h]) => h)).toEqual(expect.arrayContaining(['./impressum.html', './datenschutz.html']));
    const app = read('src/ui/app.ts');
    expect(app).toContain('href="./impressum.html"');
    expect(app).toContain('href="./datenschutz.html"');
    const vite = read('vite.config.ts');
    expect(vite).toContain("resolve(__dirname, 'impressum.html')");
    expect(vite).toContain("resolve(__dirname, 'datenschutz.html')");
  });
});
