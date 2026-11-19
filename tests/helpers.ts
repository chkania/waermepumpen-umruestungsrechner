import { createDefaults } from '../src/core/defaults';
import type { Inputs } from '../src/core/types';

/** Fixed reference date for reproducible tests: 2026-11-11 → start month 2026-11. */
export const TODAY = new Date(2026, 10, 11);

export function defaults(): Inputs {
  return createDefaults(TODAY);
}

/** Defaults with "neutral" assumptions: no price increase, constant CO2 price, no interest, no residual value (Restwert). */
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
  pinPrices(i);
  mut?.(i);
  return i;
}

/** Fixed test prices, independent of the (researched, changing) market defaults. */
export function pinPrices(i: Inputs): Inputs {
  i.prices.gasPriceCt = 11.5;
  i.prices.gasBaseFee = 180;
  i.prices.bioPremiumCt = 4;
  i.oldHeating.maintenance = 300;
  i.heatPump.maintenance = 200;
  i.heatPump.smartMeterFee = 0; // hand-computed expectations without smart metering system (F13.7 has its own tests)
  i.heatPump.elecPriceCt = 26;
  i.heatPump.householdPriceCt = 34;
  i.heatPump.feedInCt = 7.8;
  i.financing.kfwRate358 = 0.015;
  i.financing.kfwRate359 = 0.033;
  i.financing.bankRate = 0.05;
  return i;
}

/** Defaults with fixed test prices (price increases and CO2 path stay as in the defaults). */
export function pinned(): Inputs {
  return pinPrices(defaults());
}
