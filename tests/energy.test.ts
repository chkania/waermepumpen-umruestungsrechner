import { describe, expect, it } from 'vitest';
import { energyTotal, energyYear, GAS_COOKING_EFFICIENCY } from '../src/core/energy';
import { energySplit } from '../src/core/prices';
import { shareFuel } from '../src/ui/fields';
import type { Inputs } from '../src/core/types';
import { defaults } from './helpers';

/** F29 energy per month: demand vs. consumption of the old system and the heat pump. */
const year = (mut?: (i: Inputs) => void) => {
  const i = defaults();
  mut?.(i);
  return { i, e: energyYear(i) };
};

describe('F29 Energie je Monat', () => {
  it('Jahressummen: Bedarf = Raumwärme + Warmwasser; Altanlage = Bedarf ÷ Nutzungsgrad; WP = Bedarf ÷ JAZ', () => {
    const { i, e } = year();
    const s = energySplit(i);
    expect(e.months).toHaveLength(12);
    expect(e.totals.need).toBeCloseTo(s.spaceHeat + s.dhwHeat, 6);
    expect(e.totals.old).toBeCloseTo((s.spaceHeat + s.dhwHeat) / i.oldHeating.efficiency, 6);
    expect(e.totals.hp).toBeCloseTo((s.spaceHeat + s.dhwHeat) / i.heatPump.jaz, 6);
    expect(e.cookingStaysGas).toBe(false);
    // F17.5 hot-water final energy: useful heat ÷ efficiency
    expect(s.dhwFuel).toBeCloseTo(s.dhwHeat / i.oldHeating.efficiency, 6);
    // the field notes use the same split
    for (const mut of [(x: typeof i) => x, (x: typeof i) => ((x.oldHeating.cookingWithGas = true), (x.oldHeating.cookingShare = 0.03), x), (x: typeof i) => ((x.oldHeating.fuel = 'oil'), (x.oldHeating.consumption = 2000), x)]) {
      const j = mut(structuredClone(i));
      const sp = energySplit(j);
      expect(shareFuel(j).dhw).toBeCloseTo(sp.dhwFuel, 6);
      expect(shareFuel(j).cooking).toBeCloseTo(sp.cookingFuel, 6);
    }
  });

  it('Winter braucht ein Vielfaches des Sommers', () => {
    const { e } = year();
    expect(energyTotal(e.months[0].need)).toBeGreaterThan(5 * energyTotal(e.months[6].need));
  });

  it('Kochen mit Gas: Nutzenergie, nach dem Umstieg Induktion bzw. weiter Gas', () => {
    const gasCook = (after: 'electric' | 'gas') =>
      year((i) => {
        i.oldHeating.cookingWithGas = true;
        i.oldHeating.cookingAfter = after;
      });
    const ind = gasCook('electric');
    const cookFuel = energySplit(ind.i).cookingFuel;
    expect(cookFuel).toBeGreaterThan(0);
    const m = ind.e.months[3];
    expect(m.need.cooking).toBeCloseTo((cookFuel / 12) * GAS_COOKING_EFFICIENCY, 9);
    expect(m.old.cooking).toBeCloseTo(cookFuel / 12, 9);
    expect(m.hp.cooking).toBeCloseTo((cookFuel / 12) * ind.i.prices.cookingElecFactor, 9);
    expect(m.hpCookingGas).toBe(0);
    const gas = gasCook('gas');
    expect(gas.e.cookingStaysGas).toBe(true);
    expect(gas.e.months[3].hp.cooking).toBe(0);
    expect(gas.e.totals.hpCookingGas).toBeCloseTo(cookFuel, 6);
  });
});
