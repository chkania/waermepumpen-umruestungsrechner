import { rateHouse } from './house';
import type { HeatEmitter, HeatSource, Inputs } from './types';

/**
 * Estimate of the seasonal performance factor (SPF (JAZ)) for the house (F26).
 * Chain: heat emitters (Heizflächen) and space heat (Raumwärme) per m² → design supply temperature (Vorlauftemperatur)
 * on cold days → SPF (JAZ). Calibrated on the Fraunhofer ISE field test "WP-QS im Bestand": air-source heat pumps
 * in existing buildings reached 3.4 on average (supply temperature on cold days mostly around 45 °C),
 * ground-source 4.3. Rule of thumb: each 10 K lower supply temperature ≈ +0.45 SPF.
 * A rough orientation – it does not replace the installer's design or the "55 °C test".
 */

/** Typical supply temperature (°C) on cold days per heat emitter type, for an average space heat demand. */
export const EMITTER_SUPPLY: Record<HeatEmitter, number> = { floor: 35, largeRadiators: 42, radiators: 50 };
export const EMITTER_LABELS: Record<HeatEmitter, string> = {
  floor: 'Fußbodenheizung',
  largeRadiators: 'große Heizkörper',
  radiators: 'normale Heizkörper',
};
/** SPF (JAZ) at a supply temperature of 45 °C (field test mean) and change per kelvin. */
export const SPF_AT_45: Record<HeatSource, number> = { air: 3.4, ground: 4.3 };
export const SPF_PER_KELVIN = 0.045;
/** Half width of the suggested range (±). */
export const SPF_SPREAD = 0.3;

export interface JazEstimate {
  supplyTemp: number;
  low: number;
  mid: number;
  high: number;
  /** Steps of the estimate, as German sentences for the user. */
  steps: string[];
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const de1 = (x: number) => x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function estimateJaz(inp: Inputs): JazEstimate {
  const { emitter, source } = inp.heatPump;
  const perM2 = rateHouse(inp).spaceHeatPerM2;
  // Higher space heat demand per m² needs a higher supply temperature with the same heat emitters (and vice versa);
  // underfloor heating reacts less because of its large surface
  const shift = perM2 <= 70 ? -5 : perM2 <= 120 ? 0 : perM2 <= 170 ? 5 : 8;
  const applied = emitter === 'floor' ? Math.round(shift / 2) : shift;
  const supplyTemp = Math.min(65, Math.max(30, EMITTER_SUPPLY[emitter] + applied));
  const mid = round1(Math.min(5.5, Math.max(2.2, SPF_AT_45[source] - SPF_PER_KELVIN * (supplyTemp - 45))));
  const demandText =
    applied === 0
      ? `Raumwärme ${Math.round(perM2)} kWh/m² im üblichen Bereich – keine Anpassung.`
      : applied > 0
        ? `Raumwärme ${Math.round(perM2)} kWh/m² ist hoch – an kalten Tagen eher ${applied} K mehr nötig.`
        : `Raumwärme ${Math.round(perM2)} kWh/m² ist niedrig – eher ${-applied} K weniger nötig.`;
  const sourceText =
    source === 'air'
      ? `Luft/Wasser-Wärmepumpe: im Feldtest im Bestand im Mittel JAZ 3,4 (Fraunhofer ISE); je 10 K weniger Vorlauf etwa 0,45 mehr.`
      : `Erdwärme (Sole/Wasser): im Feldtest im Bestand im Mittel JAZ 4,3 (Fraunhofer ISE); je 10 K weniger Vorlauf etwa 0,45 mehr.`;
  return {
    supplyTemp,
    low: round1(mid - SPF_SPREAD),
    mid,
    high: round1(mid + SPF_SPREAD),
    steps: [
      `${EMITTER_LABELS[emitter][0].toUpperCase()}${EMITTER_LABELS[emitter].slice(1)}: an kalten Tagen typisch um ${EMITTER_SUPPLY[emitter]} °C Vorlauf.`,
      demandText,
      `Geschätzte Vorlauftemperatur an kalten Tagen: ca. ${supplyTemp} °C.`,
      sourceText,
      `Daraus: JAZ etwa ${de1(round1(mid - SPF_SPREAD))} bis ${de1(round1(mid + SPF_SPREAD))}.`,
    ],
  };
}
