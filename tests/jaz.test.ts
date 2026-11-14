import { describe, expect, it } from 'vitest';
import { estimateJaz } from '../src/core/jaz';
import { rateHouse } from '../src/core/house';
import type { Inputs } from '../src/core/types';
import { defaults } from './helpers';

/** F26 SPF (JAZ) estimate from heat emitters, heat source and space heat per m². */
const est = (mut: (i: Inputs) => void) => {
  const i = defaults();
  mut(i);
  return estimateJaz(i);
};
/** Sets the space heat per m² via the heated area (default house). */
const withPerM2 = (target: number) => (i: Inputs) => {
  const per = rateHouse(i).spaceHeatPerM2;
  i.building.heatedArea = Math.round((i.building.heatedArea * per) / target);
};

describe('F26 Schätzung der Jahresarbeitszahl', () => {
  it('Standardhaus: normale Heizkörper, Luft → 50 °C, Spanne 2,9–3,5 enthält den Default 3,3', () => {
    const e = est(() => {});
    expect(rateHouse(defaults()).spaceHeatPerM2).toBeGreaterThan(70);
    expect(rateHouse(defaults()).spaceHeatPerM2).toBeLessThanOrEqual(120);
    expect(e).toMatchObject({ supplyTemp: 50, low: 2.9, mid: 3.2, high: 3.5 });
    expect(defaults().heatPump.jaz).toBeGreaterThanOrEqual(e.low);
    expect(defaults().heatPump.jaz).toBeLessThanOrEqual(e.high);
    expect(e.steps.join(' ')).toMatch(/Normale Heizkörper.*50 °C.*Fraunhofer ISE/);
  });

  it('Heizflächen: Fußbodenheizung > große Heizkörper > normale Heizkörper', () => {
    const floor = est((i) => (i.heatPump.emitter = 'floor'));
    const large = est((i) => (i.heatPump.emitter = 'largeRadiators'));
    expect(floor).toMatchObject({ supplyTemp: 35, mid: 3.9 });
    expect(large).toMatchObject({ supplyTemp: 42, mid: 3.5 });
  });

  it('Erdwärme liegt 0,9 über Luft', () => {
    expect(est((i) => (i.heatPump.source = 'ground')).mid).toBe(4.1);
  });

  it('Wärmebedarf je m² verschiebt die Vorlauftemperatur (Fußbodenheizung nur halb)', () => {
    expect(est(withPerM2(60)).supplyTemp).toBe(45);
    expect(est(withPerM2(150)).supplyTemp).toBe(55);
    expect(est(withPerM2(200)).supplyTemp).toBe(58);
    expect(est((i) => { withPerM2(200)(i); i.heatPump.emitter = 'floor'; }).supplyTemp).toBe(39);
    expect(est(withPerM2(200)).steps[1]).toMatch(/hoch – an kalten Tagen eher 8 K mehr/);
  });
});
