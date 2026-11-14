import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** N7 accessibility: colour contrasts of the design tokens (WCAG 2.1 AA, 1.4.3). */
const css = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const tokens = (text: string, selector: string): Record<string, string> => {
  const start = text.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Block ${selector} fehlt`);
  const body = text.slice(start, text.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
};
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const base = css('style.css');
const modern = css('style-modern.css');
const classicLight = tokens(base, ':root');
const classicDark = { ...classicLight, ...tokens(base, ":root[data-theme='dark']") };
const modernLight = { ...classicLight, ...tokens(modern, ":root[data-design='modern']") };
const modernDark = { ...classicDark, ...modernLight, ...tokens(modern, ":root[data-design='modern'][data-theme='dark']") };
const themes = { classicLight, classicDark, modernLight, modernDark };

describe('N7 Kontraste (WCAG 1.4.3, ≥ 4,5:1)', () => {
  for (const [name, t] of Object.entries(themes)) {
    it(name, () => {
      const surfaces = ['bg', 'surface', 'surface-2', 'accent-soft', 'warn-bg', 'imp-bg', 'info-bg'].filter((k) => t[k]);
      const fails: string[] = [];
      for (const fg of ['c-text', 'c-text-2', 'c-muted', 'good', 'bad']) {
        for (const bg of surfaces) {
          const r = ratio(t[fg], t[bg]);
          if (r < 4.5) fails.push(`${fg} auf ${bg}: ${r.toFixed(2)}`);
        }
      }
      const onAccent = ratio(t['on-accent'], t.accent);
      if (onAccent < 4.5) fails.push(`on-accent auf accent: ${onAccent.toFixed(2)}`);
      expect(fails).toEqual([]);
    });
  }
});

describe('N7 Fokus sichtbar (WCAG 2.4.7)', () => {
  it('kein outline: none ohne Ersatz', () => {
    for (const text of [base, modern, css('help.css')]) expect(text).not.toMatch(/outline:\s*(none|0)\b/);
  });
});
