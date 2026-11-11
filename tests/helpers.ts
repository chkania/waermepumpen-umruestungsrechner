import { createDefaults } from '../src/core/defaults';
import type { Inputs } from '../src/core/types';

/** Fester Stichtag für reproduzierbare Tests: 11.11.2026 → Startmonat 2026-11. */
export const TODAY = new Date(2026, 10, 11);

export function defaults(): Inputs {
  return createDefaults(TODAY);
}

/** Defaults mit „neutralen" Annahmen: keine Preissteigerung, konstanter CO2-Preis, kein Zins, kein Restwert. */
export function neutral(mut?: (i: Inputs) => void): Inputs {
  const i = defaults();
  i.general.opportunityRate = 0;
  i.general.costIncrease = 0;
  i.general.investIncrease = 0;
  i.general.residualValue = false;
  i.prices.gasIncrease = 0;
  i.prices.oilIncrease = 0;
  i.prices.co2Path = '2026:60';
  i.prices.bioEnabled = false;
  i.heatPump.elecIncrease = 0;
  mut?.(i);
  return i;
}
