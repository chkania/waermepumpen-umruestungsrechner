import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));
const ALLOWED = ['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'OFL-1.1'];

describe('N8 Lizenz', () => {
  it('PolyForm Noncommercial mit Copyright-Hinweis', () => {
    const lic = read('LICENSE.md');
    expect(lic.startsWith('Required Notice: Copyright (c) 2026 Christoph Kania')).toBe(true);
    expect(lic).toContain('# PolyForm Noncommercial License 1.0.0');
    expect(lic).toContain('Any noncommercial purpose is a permitted purpose.');
    expect(pkg.license).toBe('PolyForm-Noncommercial-1.0.0');
  });

  it('Drittanbieter-Hinweise sind aktuell und vollständig (sonst: npm run notices)', () => {
    const notices = read('THIRD-PARTY-NOTICES.md');
    for (const name of Object.keys(pkg.dependencies)) {
      const meta = JSON.parse(read(`node_modules/${name}/package.json`));
      expect(notices, name).toContain(`## ${name} ${meta.version}`);
      expect(ALLOWED, `${name}: ${meta.license}`).toContain(meta.license);
    }
  });
});

describe('N8 Lizenzseiten (HTML aus den .md-Dateien)', () => {
  it('Lizenzseite zeigt Kurzfassung, Required Notice und Originaltext', async () => {
    const { renderDocPage } = await import('../src/doc-page');
    const { html, title } = renderDocPage({ markdown: read('LICENSE.md'), subtitle: 'x', intro: '<section>Kurzfassung</section>', toc: false, contentLang: 'en' });
    expect(html).toContain('<div lang="en">');
    expect(title).toBe('PolyForm Noncommercial License 1.0.0');
    expect(html).toContain('Required Notice: Copyright (c) 2026 Christoph Kania');
    expect(html).toContain('Kurzfassung');
    expect(html).toContain('Any noncommercial purpose is a permitted purpose.');
    expect(html).not.toContain('class="help-toc"');
  });

  it('Drittanbieter-Seite mit Inhaltsverzeichnis je Paket', async () => {
    const { renderDocPage } = await import('../src/doc-page');
    const { html } = renderDocPage({ markdown: read('THIRD-PARTY-NOTICES.md'), subtitle: 'x', codeLang: 'en' });
    for (const name of Object.keys(pkg.dependencies)) expect(html).toContain(name);
    expect(html).toContain('class="help-toc"');
    expect(html).toContain('<pre lang="en"><code class="language-text">');
  });

  it('alle verlinkten Seiten existieren, sind im Build und laden ihr Skript', async () => {
    const { DOC_LINKS } = await import('../src/doc-page');
    const vite = read('vite.config.ts');
    for (const [href] of DOC_LINKS) {
      const file = href.replace('./', '');
      const page = read(file);
      expect(page, file).toMatch(/<script type="module" src="\/src\/[\w/-]+\.ts"><\/script>/);
      expect(vite, file).toContain(`'${file}'`);
    }
    // Fußzeile des Rechners verlinkt die HTML-Seiten
    const app = read('src/ui/app.ts');
    expect(app).toContain('href="./lizenz.html"');
    expect(app).toContain('href="./lizenzen-drittanbieter.html"');
  });
});
