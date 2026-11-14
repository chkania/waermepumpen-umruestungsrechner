import { describe, expect, it } from 'vitest';
import { savingOf } from '../src/core/sensitivity';
import type { Inputs } from '../src/core/types';
import { MAX_VARIANTS, variantName, variantResult } from '../src/core/variants';
import { variantCurves, variantDiffs, variantsTableHtml } from '../src/ui/variants';
import { defaults } from './helpers';

/** F31 comparing variants. */
const v = (name: string, mut?: (i: Inputs) => void) => {
  const i = defaults();
  i.scenario.name = name;
  mut?.(i);
  return variantResult({ name, inputs: i });
};

describe('F31 Varianten vergleichen', () => {
  it('jede Variante für sich gerechnet: Ersparnis wie im Rechner', () => {
    const a = v('Angebot A');
    const b = v('Angebot B', (i) => (i.heatPump.investment = 40000));
    expect(a.saving).toBeCloseTo(savingOf(a.inputs), 6);
    expect(b.saving).toBeLessThan(a.saving);
    expect(MAX_VARIANTS).toBe(3);
  });

  it('Namen: Bezeichnung, sonst Fallback; doppelte nummeriert', () => {
    const i = defaults();
    expect(variantName(i, 'datei-1', [])).toBe('datei-1');
    i.scenario.name = 'Angebot A';
    expect(variantName(i, 'x', [])).toBe('Angebot A');
    expect(variantName(i, 'x', ['Angebot A', 'Angebot A (2)'])).toBe('Angebot A (3)');
    i.scenario.name = ' ';
    expect(variantName(i, '', [])).toBe('Variante');
  });

  it('Unterschiede: nur abweichende Eingaben, ohne Bezeichnung', () => {
    const now = v('jetzt');
    const later = v('2028', (i) => (i.heatPump.installMonth = '2028-05'));
    const diffs = variantDiffs([now, later]);
    expect(diffs.map((d) => d.label)).toEqual(['Geplante Inbetriebnahme']);
    expect(diffs[0].values[1]).toBe('05/2028');
  });

  it('Tabelle: höchste Ersparnis markiert, Namen maskiert', () => {
    const html = variantsTableHtml([v('A <1>'), v('B', (i) => (i.heatPump.investment = 45000))]);
    expect(html).toContain('A &lt;1&gt;');
    expect((html.match(/★/g) ?? []).length).toBe(2); // marker + legend
  });

  it('Kurven: gemeinsame Jahresachse auch bei unterschiedlichem Zeitraum', () => {
    const a = v('A');
    const b = v('B', (i) => (i.general.horizonYears = 25));
    const c = variantCurves([a, b]);
    expect(c.years.length).toBe(b.run.ref.years.length);
    expect(c.series[0].best.at(-1)).toBeNull();
    expect(c.series[1].best.at(-1)).not.toBeNull();
  });
});
