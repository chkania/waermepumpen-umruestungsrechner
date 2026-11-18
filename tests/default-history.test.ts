import { describe, expect, it } from 'vitest';
import { applyNewDefaults, DEFAULT_CHANGES, type DefaultChange, DEFAULTS_AS_OF, outdatedDefaults, savedDefaultsAsOf } from '../src/core/default-history';
import { exportJson } from '../src/core/serialize';
import { getPath } from '../src/ui/fields';
import { defaults } from './helpers';

describe('F22.4 Verlauf geänderter Standardwerte', () => {
  it('Einträge: aufsteigendes Datum, bekannte Felder, Wert vom gleichen Typ', () => {
    const d = defaults();
    DEFAULT_CHANGES.forEach((c, i) => {
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (i > 0) expect(c.date > DEFAULT_CHANGES[i - 1].date).toBe(true);
      for (const [path, v] of Object.entries(c.previous)) expect(typeof getPath(d, path), path).toBe(typeof v);
    });
    expect(DEFAULTS_AS_OF).toBe(DEFAULT_CHANGES.at(-1)!.date);
  });

  it('meldet nur Felder auf dem früheren Standard; der erste Eintrag nach dem Speicherstand zählt', () => {
    const d = defaults();
    const changes: DefaultChange[] = [
      { date: '2026-01-01', previous: { 'heatPump.jaz': 3.0 } },
      { date: '2026-06-01', previous: { 'heatPump.jaz': 3.1, 'oldHeating.maintenance': 250 } },
    ];
    const i = defaults();
    i.heatPump.jaz = 3.1;
    i.oldHeating.maintenance = 250;
    // saved before both changes: the value seen then was 3.0 → 3.1 is an own value
    expect(outdatedDefaults(i, d, '', changes).map((x) => x.path)).toEqual(['oldHeating.maintenance']);
    // saved between the changes: 3.1 was the default
    expect(outdatedDefaults(i, d, '2026-03-01', changes).map((x) => x.path)).toEqual(['heatPump.jaz', 'oldHeating.maintenance']);
    expect(outdatedDefaults(i, d, '2026-06-01', changes)).toEqual([]);
  });

  it('Übernehmen setzt den neuen Standard, aber nicht bei inzwischen geändertem Wert', () => {
    const d = defaults();
    const i = defaults();
    i.oldHeating.replacementCost = 12000;
    i.financing.bankRate = 0.075;
    const list = outdatedDefaults(i, d, '');
    i.financing.bankRate = 0.05;
    applyNewDefaults(i, list);
    expect(i.oldHeating.replacementCost).toBe(d.oldHeating.replacementCost);
    expect(i.financing.bankRate).toBe(0.05);
  });

  it('Speicherstand aus Datei/Speicher lesen; Export enthält ihn', () => {
    expect(savedDefaultsAsOf({ defaultsAsOf: '2026-11-18' })).toBe('2026-11-18');
    expect(savedDefaultsAsOf({ defaultsAsOf: 'gestern' })).toBe('');
    expect(savedDefaultsAsOf(null)).toBe('');
    expect(JSON.parse(exportJson(defaults())).defaultsAsOf).toBe(DEFAULTS_AS_OF);
  });
});
