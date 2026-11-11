import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderHelp, slugify } from '../src/help';
import { SECTIONS } from '../src/ui/fields';

const handbook = readFileSync(new URL('../docs/BENUTZERHANDBUCH.md', import.meta.url), 'utf8');

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
    for (const t of ['Link teilen', 'Export', 'Import', 'Zurücksetzen', 'Hilfe', 'Modern | Klassisch', 'Hell | Dunkel | Auto']) {
      expect(handbook, t).toContain(`### ${t.startsWith('Modern') ? 'Design: ' + t : t}`);
    }
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
    expect(toc.find((t) => t.text === 'Link teilen')).toMatchObject({ id: 'link-teilen', level: 3 });
    expect(html).toContain('<h3 id="link-teilen">');
    expect(html).toContain('<div class="table-wrap"><table>');
  });

  it('doppelte Überschriften erhalten eindeutige IDs', () => {
    const { toc } = renderHelp('## A\n\n## A\n');
    expect(toc.map((t) => t.id)).toEqual(['a', 'a-2']);
  });
});
