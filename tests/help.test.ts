import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderHelp, slugify } from '../src/help';
import { SECTIONS } from '../src/ui/fields';

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const handbook = read('docs/BENUTZERHANDBUCH.md');

describe('F15 Benutzerhandbuch – Vollständigkeit', () => {
  it('jeder Eingabe-Abschnitt und jedes Feld ist beschrieben', () => {
    const missing: string[] = [];
    for (const s of SECTIONS) {
      if (!handbook.includes(s.title)) missing.push(`Abschnitt: ${s.title}`);
      for (const f of s.fields) if (!handbook.includes(f.label)) missing.push(`${s.title} → ${f.label}`);
    }
    expect(missing).toEqual([]);
  });

  it('alle Funktionen der Werkzeugleiste sind beschrieben', () => {
    for (const t of ['Einführung', 'Weiterempfehlen', 'Link mit Werten teilen', 'Varianten vergleichen', 'Bericht drucken', 'Export', 'Import', 'Zurücksetzen', 'Hilfe', 'Hell | Dunkel | Auto']) {
      expect(handbook, t).toContain(`### ${t}`);
    }
  });

  it('F24 Alle auf-/zuklappen ist beschrieben', () => {
    expect(handbook).toContain('„Alle aufklappen“');
    expect(handbook).toContain('„Alle zuklappen“');
  });

  it('F19.3 Entstehung des Rechners ist beschrieben', () => {
    expect(handbook).toContain('## Über diesen Rechner');
    expect(handbook).toContain('rein privates Hobbyprojekt');
  });

  it('alle Ergebnisbereiche sind beschrieben', () => {
    for (const t of ['Kennzahlen', 'Wichtige Ereignisse & Hinweise', 'Diagramme', 'Stromkosten: mit oder ohne Wärmepumpentarif', 'Wann umrüsten?', 'Jahresübersicht']) {
      expect(handbook, t).toContain(t);
    }
  });
});

describe('F15 Hilfeseite – Darstellung', () => {
  it('Anker-IDs mit Umlauten, eindeutig, Inhaltsverzeichnis aus h2/h3', () => {
    expect(slugify('Hell | Dunkel | Auto')).toBe('hell-dunkel-auto');
    expect(slugify('Wann umrüsten?')).toBe('wann-umruesten');
    const { toc, html, title } = renderHelp(handbook);
    expect(title).toBe('Benutzerhandbuch');
    expect(toc.length).toBeGreaterThan(20);
    expect(new Set(toc.map((t) => t.id)).size).toBe(toc.length);
    expect(toc.find((t) => t.text === 'Link mit Werten teilen')).toMatchObject({ id: 'link-mit-werten-teilen', level: 3 });
    expect(html).toContain('<h3 id="link-mit-werten-teilen">');
    expect(html).toContain('<div class="table-wrap"><table>');
  });

  it('doppelte Überschriften erhalten eindeutige IDs', () => {
    const { toc } = renderHelp('## A\n\n## A\n');
    expect(toc.map((t) => t.id)).toEqual(['a', 'a-2']);
  });
});

describe('F19 Projektlinks und Mitmachen', () => {
  it('Handbuch, README und CONTRIBUTING laden zur Mitarbeit ein und verlinken das Repository', async () => {
    const { REPO_URL, BUG_REPORT_URL, CONTRIBUTING_URL, FEATURE_REQUEST_URL } = await import('../src/project');
    expect(REPO_URL).toBe('https://github.com/chkania/waermepumpen-umruestungsrechner');
    const handbook = read('docs/BENUTZERHANDBUCH.md');
    expect(handbook).toMatch(/^## Mitmachen$/m);
    for (const url of [REPO_URL, BUG_REPORT_URL, CONTRIBUTING_URL, FEATURE_REQUEST_URL]) expect(handbook).toContain(url);
    // the linked issue forms exist
    expect(read('.github/ISSUE_TEMPLATE/feature_request.yml')).toContain('labels: [enhancement]');
    expect(read('.github/ISSUE_TEMPLATE/bug_report.yml')).toContain('labels: [bug]');
    expect(read('README.md')).toMatch(/^## Mitmachen$/m);
    expect(read('README.md')).toContain(BUG_REPORT_URL);
    expect(read('CONTRIBUTING.md')).toContain(BUG_REPORT_URL);
    expect(read('CONTRIBUTING.md')).toContain(FEATURE_REQUEST_URL);
  });

  it('Dokumentseiten verlinken das Repository im Seitenfuß', async () => {
    const { renderDocPage } = await import('../src/doc-page');
    const { REPO_URL } = await import('../src/project');
    expect(renderDocPage({ markdown: '# T\n\nx', subtitle: 's' }).html).toContain(`<a href="${REPO_URL}">`);
  });
});
