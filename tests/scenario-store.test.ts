import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  findScenario,
  formatSavedAt,
  parseScenarioFile,
  putScenario,
  removeScenarioAt,
  scenarioEntry,
  scenarioViews,
  SCENARIO_LIST_VERSION,
  SCENARIOS_KEY,
  serializeScenarioFile,
  setScenarioAt,
  viewScenario,
} from '../src/core/scenario-store';
import { importJson, exportJson } from '../src/core/serialize';
import { defaults } from './helpers';

const OLD = '2026-11-01T08:00:00.000Z';

/** A readable stored entry with the given name (inputs in the export format). */
function entry(name: string, mut?: (i: ReturnType<typeof defaults>) => void, savedAt = OLD) {
  const i = defaults();
  i.scenario.name = name;
  mut?.(i);
  return scenarioEntry(i, name, '2026-11-18', new Date(savedAt));
}

describe('F37 Gespeicherte Szenarien – Liste im Speicher', () => {
  it('F37.2 Schlüssel und Format { version: 1, entries }', () => {
    expect(SCENARIOS_KEY).toBe('wp-investitionsrechner:szenarien');
    expect(SCENARIO_LIST_VERSION).toBe(1);
    expect(JSON.parse(serializeScenarioFile([]))).toEqual({ version: 1, entries: [] });
  });

  it('F37.11 Liste ist nur bei ungültigem JSON, Nicht-Objekt, anderer Version oder ohne Liste unlesbar; nichts gespeichert ist leer', () => {
    expect(parseScenarioFile(null)).toEqual({ readable: true, entries: [] });
    expect(parseScenarioFile('{kaputt')).toEqual({ readable: false });
    expect(parseScenarioFile('null')).toEqual({ readable: false });
    expect(parseScenarioFile('[]')).toEqual({ readable: false });
    expect(parseScenarioFile(JSON.stringify({ version: 2, entries: [] }))).toEqual({ readable: false });
    expect(parseScenarioFile(JSON.stringify({ version: 1, entries: {} }))).toEqual({ readable: false });
    // an entry that is wrong does not make the whole list unreadable (F37.12)
    expect(parseScenarioFile(JSON.stringify({ version: 1, entries: [1, 'x'] }))).toEqual({ readable: true, entries: [1, 'x'] });
  });

  it('F37.12 Eintrag ist nur ohne Namen oder mit ungültigen Inputs unlesbar; ungültiges savedAt macht ihn nicht unlesbar', () => {
    const good = entry('Angebot A');
    expect(viewScenario(good, 0)).toMatchObject({ index: 0, name: 'Angebot A', readable: true, savedAt: OLD });
    expect(viewScenario('x', 1)).toMatchObject({ name: '', readable: false, inputs: null });
    expect(viewScenario(null, 2)).toMatchObject({ readable: false });
    expect(viewScenario({ ...good, name: '   ' }, 0)).toMatchObject({ name: '', readable: false });
    expect(viewScenario({ ...good, inputs: 'x' }, 0)).toMatchObject({ name: 'Angebot A', readable: false, inputs: null });
    expect(viewScenario({ ...good, inputs: { version: 2 } }, 0)).toMatchObject({ readable: false });
    expect(viewScenario({ ...good, savedAt: 'kaputt' }, 0)).toMatchObject({ readable: true, savedAt: null });
    expect(viewScenario({ ...good, savedAt: 42 }, 0).savedAt).toBeNull();
  });

  it('F37.5 Liste nach Name in deutscher Sortierung, gespeicherte Reihenfolge bleibt', () => {
    const entries = [entry('Zeta'), entry('alpha'), entry('Ärger')];
    expect(scenarioViews(entries).map((v) => v.name)).toEqual(['alpha', 'Ärger', 'Zeta']);
    expect(scenarioViews(entries).map((v) => v.index)).toEqual([1, 2, 0]);
    expect(entries.map((e) => (e as { name: string }).name)).toEqual(['Zeta', 'alpha', 'Ärger']);
  });

  it('F37.5 „Stand TT.MM.JJJJ hh:mm“ in Ortszeit, sonst „Stand unbekannt“', () => {
    expect(formatSavedAt(new Date(2026, 10, 11, 9, 5).toISOString())).toBe('Stand 11.11.2026 09:05');
    expect(formatSavedAt(null)).toBe('Stand unbekannt');
  });

  it('F37.4 Namen werden exakt verglichen; bei doppelten Namen gilt der erste Eintrag', () => {
    const entries = [entry('Angebot A', undefined, OLD), entry('angebot a'), entry('Angebot A', undefined, '2026-11-02T08:00:00.000Z')];
    expect(findScenario(entries, 'Angebot A')).toBe(0);
    expect(findScenario(entries, 'angebot a')).toBe(1);
    expect(findScenario(entries, 'Angebot B')).toBe(-1);
    const replaced = putScenario(entries, 'Angebot A', entry('Angebot A', (i) => (i.heatPump.jaz = 3.3)));
    expect(replaced).toHaveLength(3);
    expect((replaced[0] as { inputs: { heatPump: { jaz: number } } }).inputs.heatPump.jaz).toBe(3.3);
    expect((replaced[2] as { savedAt: string }).savedAt).toBe('2026-11-02T08:00:00.000Z');
  });

  it('F37.2 Ein neuer Name wird angehängt; Eintrag mit dem Namen des Eintrags in den Inputs', () => {
    const appended = putScenario([entry('A')], 'B', entry('B'));
    expect(appended.map((e) => (e as { name: string }).name)).toEqual(['A', 'B']);
    const e = entry('Angebot A', (i) => (i.heatPump.jaz = 3.2));
    expect(e).toMatchObject({ name: 'Angebot A', savedAt: OLD });
    const inputs = (e as { inputs: Record<string, unknown> }).inputs;
    expect(inputs).toMatchObject({ version: 1, defaultsAsOf: '2026-11-18', scenario: { name: 'Angebot A' } });
    expect(inputs).toHaveProperty('appVersion');
    expect(inputs).toHaveProperty('heatPump');
  });

  it('F37.14 gespeichert werden nur Eingaben, keine Ergebnisse', () => {
    // exactly the input sections of the export format, nothing calculated (run, totals, events)
    const keys = Object.keys((entry('A') as { inputs: object }).inputs).sort();
    expect(keys).toEqual(['appVersion', 'defaultsAsOf', ...Object.keys(defaults())].sort());
  });

  it('F37.7 und F37.8 Eintrag an einer Position ersetzen oder entfernen, übrige bleiben', () => {
    const entries = [entry('A'), entry('B'), entry('C')];
    expect(setScenarioAt(entries, 1, entry('B2')).map((e) => (e as { name: string }).name)).toEqual(['A', 'B2', 'C']);
    expect(removeScenarioAt(entries, 0).map((e) => (e as { name: string }).name)).toEqual(['B', 'C']);
  });

  it('F37.12 Invariante: lesbar ⇒ importJson wirft nicht (gültige, unlesbare und manipulierte Einträge)', () => {
    const valid = JSON.parse(exportJson(defaults()));
    const manipulated: unknown[] = [
      { ...valid, heatPump: 'x' },
      { ...valid, heatPump: null, oldHeating: [] },
      { ...valid, heatPump: { jaz: 99, investment: 'viel' } },
      { ...valid, scenario: 42, general: null },
      { ...valid, building: { constructionYear: 'x' }, scenario: { documents: 'nicht eine Liste' } },
      { version: 1 },
      { version: 1, unbekannt: [1, 2] },
    ];
    const fixtures: unknown[] = [
      { name: 'Angebot A', savedAt: OLD, inputs: valid },
      { name: 'Angebot A', savedAt: OLD, inputs: 'x' },
      { name: 'Angebot A', savedAt: OLD, inputs: { version: 2 } },
      { name: 'Angebot A', savedAt: OLD, inputs: null },
      { name: 'Angebot A', savedAt: OLD, inputs: [1] },
      { name: '   ', savedAt: OLD, inputs: valid },
      { savedAt: OLD, inputs: valid },
      { name: 42, savedAt: OLD, inputs: valid },
      'x',
      null,
      ...manipulated.map((inputs) => ({ name: 'M', savedAt: 'kaputt', inputs })),
    ];
    let readableCount = 0;
    for (const raw of fixtures) {
      const view = viewScenario(raw, 0);
      if (!view.readable) continue;
      readableCount++;
      expect(() => importJson(defaults(), JSON.stringify(view.inputs))).not.toThrow();
    }
    // the valid entries and the manipulated ones with version 1 are readable, the others are not
    expect(readableCount).toBe(1 + manipulated.length);
  });

  it('F37.13 keine feste Obergrenze der Zahl der Szenarien', () => {
    let entries: unknown[] = [];
    for (let n = 0; n < 200; n++) entries = putScenario(entries, `Szenario ${n}`, entry(`Szenario ${n}`));
    expect(entries).toHaveLength(200);
    expect(scenarioViews(entries)).toHaveLength(200);
  });

  it('N11 Datenschutzerklärung nennt die gespeicherten Szenarien mit Schlüssel und Rechtsgrundlage', () => {
    const text = readFileSync(new URL('../docs/DATENSCHUTZ.md', import.meta.url), 'utf8');
    expect(text).toContain('wp-investitionsrechner:szenarien');
    expect(text).toContain('Gespeicherte Szenarien');
    expect(text).toContain('§ 25 Abs. 2 Nr. 2 TDDDG');
  });
});
