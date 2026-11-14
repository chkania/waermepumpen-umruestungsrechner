import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOGO_PATHS, logoSvg } from '../src/logo';

/** F23 logo: one geometry everywhere (header, favicon, files for presentations). */
const root = process.cwd();
const read = (f: string) => readFileSync(`${root}/${f}`, 'utf8');

describe('F23 Logo', () => {
  it('alle Logo-Dateien verwenden dieselbe Form wie die Kopfzeile', () => {
    const files = ['public/favicon.svg', ...readdirSync(`${root}/docs/logo`).filter((f) => f.endsWith('.svg')).map((f) => `docs/logo/${f}`)];
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const f of files) {
      const svg = read(f);
      for (const d of Object.values(LOGO_PATHS)) expect(svg, f).toContain(`d="${d}"`);
      expect(svg, f).toContain('aria-label="Wärmepumpen-Umrüstungsrechner"');
    }
  });

  it('Kopfzeilen-Logo ist dekorativ und nutzt die Farbtokens per CSS', () => {
    const svg = logoSvg();
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toMatch(/fill="#|stroke="#|style=/);
    const css = read('src/style-modern.css');
    for (const c of ['logo-house', 'logo-warm', 'logo-rise', 'logo-arrow']) expect(svg + css).toContain(`.${c}`);
  });

  it('alle Seiten verwenden das Favicon', () => {
    for (const f of readdirSync(root).filter((n) => n.endsWith('.html'))) {
      const html = read(f);
      expect(html, f).toContain('<link rel="icon" href="./favicon.svg" type="image/svg+xml" />');
      expect(html, f).toContain('<link rel="apple-touch-icon" href="./apple-touch-icon.png" />');
      expect(html, f).not.toContain('data:image/svg+xml');
    }
    expect(readdirSync(`${root}/public`)).toEqual(expect.arrayContaining(['favicon.svg', 'apple-touch-icon.png']));
  });
});
