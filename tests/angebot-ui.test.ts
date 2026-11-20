// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { DOC_LINKS } from '../src/doc-page';
import { mountApp } from '../src/ui/app';
import { TODAY } from './helpers';

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}

function mount() {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.getElementById('app')!;
  const app = mountApp(root, { storage: new MemoryStorage(), today: TODAY, debounceMs: 0 });
  return { root, app };
}

describe('F39.5 Verbindung zum Rechner', () => {
  it('DOC_LINKS: „Weg zum Angebot“ direkt nach „Hilfe“', () => {
    expect(DOC_LINKS[DOC_LINKS.findIndex(([h]) => h === './hilfe.html') + 1]).toEqual(['./angebot.html', 'Weg zum Angebot']);
  });

  it('Seitenfuß des Rechners verlinkt die Seite im selben Tab', () => {
    const { root } = mount();
    const link = root.querySelector<HTMLAnchorElement>('p.disclaimer.license a[href="./angebot.html"]')!;
    expect(link.textContent).toBe('Weg zum Angebot');
    expect(link.target).toBe('');
    // separators keep their spaces (F15-style footer): "Weg zum Angebot · Quellcode auf GitHub"
    const footer = root.querySelector<HTMLElement>('p.disclaimer.license')!;
    expect(footer.textContent).toContain('Weg zum Angebot · Quellcode auf GitHub');
    expect(footer.innerHTML).not.toMatch(/·<|<\/a>·/);
  });

  it('Kasten „Nächste Schritte“ steht nach „Jahresübersicht“ und vor „Über diesen Rechner“, ohne target', () => {
    const { root } = mount();
    const box = root.querySelector<HTMLElement>('aside.card[aria-labelledby="next-steps-title"]')!;
    expect(box.querySelector('h2')!.textContent).toBe('Nächste Schritte');
    expect(box.textContent).toContain('ersetzt keine Beratung');
    const year = [...root.querySelectorAll('h2')].find((h) => h.textContent === 'Jahresübersicht')!;
    const about = root.querySelector('#ueber')!;
    expect(year.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(box.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const link = box.querySelector<HTMLAnchorElement>('a[href="./angebot.html"]')!;
    expect(link.textContent).toBe('Weg zum Angebot und zur Förderung');
    expect(link.hasAttribute('target')).toBe(false);
  });

  it('der Bericht enthält den Kasten „Nächste Schritte“ nicht', () => {
    const { app } = mount();
    const report = app.buildReport()!;
    expect(report.textContent).not.toContain('Nächste Schritte');
  });
});
