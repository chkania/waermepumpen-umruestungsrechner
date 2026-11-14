import { DHW_PROFILE, SPACE_PROFILE } from './defaults';
import { energySplit } from './prices';
import type { Inputs } from './types';

/**
 * Energy balance per month in a typical year (F29): useful energy demand (Nutzenergie) for space heating (Raumwärme),
 * hot water (Warmwasser) and cooking compared with the final energy (Endenergie) the old system (gas/oil) and the
 * heat pump (electricity, plus gas if cooking stays on gas) need for it. Shows the efficiency over the year.
 */

/** Share of the gas used by a gas cooker that reaches the pot (40–55 %); defines the useful energy for cooking. */
export const GAS_COOKING_EFFICIENCY = 0.5;

export interface EnergyParts {
  space: number;
  dhw: number;
  cooking: number;
}

export interface EnergyMonth {
  month: number;
  /** Useful energy demand (kWh). */
  need: EnergyParts;
  /** Gas or oil of the old system (kWh). */
  old: EnergyParts;
  /** Electricity with the heat pump (kWh); cooking = induction on the household meter (Haushaltszähler). */
  hp: EnergyParts;
  /** Gas for cooking that remains with the heat pump (kWh). */
  hpCookingGas: number;
}

export interface EnergyYear {
  fuel: 'gas' | 'oil';
  /** Cooking stays on gas after switching to the heat pump. */
  cookingStaysGas: boolean;
  months: EnergyMonth[];
  totals: { need: number; old: number; hp: number; hpCookingGas: number };
}

const total = (p: EnergyParts) => p.space + p.dhw + p.cooking;

export function energyYear(inp: Inputs): EnergyYear {
  const o = inp.oldHeating;
  const s = energySplit(inp);
  const jaz = Math.max(0.1, inp.heatPump.jaz);
  const eff = Math.max(0.01, o.efficiency);
  const cookingStaysGas = s.cookingFuel > 0 && o.cookingAfter === 'gas';
  const months: EnergyMonth[] = SPACE_PROFILE.map((sp, mo) => {
    const space = s.spaceHeat * sp;
    const dhw = s.dhwHeat * DHW_PROFILE[mo];
    const cookFuel = s.cookingFuel / 12;
    return {
      month: mo + 1,
      need: { space, dhw, cooking: cookFuel * GAS_COOKING_EFFICIENCY },
      old: { space: space / eff, dhw: dhw / eff, cooking: cookFuel },
      hp: { space: space / jaz, dhw: dhw / jaz, cooking: cookingStaysGas ? 0 : cookFuel * inp.prices.cookingElecFactor },
      hpCookingGas: cookingStaysGas ? cookFuel : 0,
    };
  });
  const sum = (f: (m: EnergyMonth) => number) => months.reduce((a, m) => a + f(m), 0);
  return {
    fuel: o.fuel,
    cookingStaysGas,
    months,
    totals: {
      need: sum((m) => total(m.need)),
      old: sum((m) => total(m.old)),
      hp: sum((m) => total(m.hp)),
      hpCookingGas: sum((m) => m.hpCookingGas),
    },
  };
}

export { total as energyTotal };
