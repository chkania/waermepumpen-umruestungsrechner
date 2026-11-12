import { parseMonth, yearOf } from './dates';
import { energySplit } from './prices';
import type { Inputs } from './types';

/**
 * Einordnung des Hauses (F18): Verbrauchskennwert, Effizienzklasse, Vergleich mit dem Baualter,
 * Sanierungsstand und grobe Eignung für eine Wärmepumpe.
 */

/** Effizienzklassen nach GEG Anlage 10 (Endenergie, kWh/(m²·a)): Obergrenze (exklusiv). */
export const EFFICIENCY_CLASSES: readonly { cls: string; below: number }[] = [
  { cls: 'A+', below: 30 },
  { cls: 'A', below: 50 },
  { cls: 'B', below: 75 },
  { cls: 'C', below: 100 },
  { cls: 'D', below: 130 },
  { cls: 'E', below: 160 },
  { cls: 'F', below: 200 },
  { cls: 'G', below: 250 },
  { cls: 'H', below: Infinity },
];

/**
 * Typischer Endenergieverbrauch (Heizung + Warmwasser) unsanierter Einfamilienhäuser nach Baualter.
 * Grobe Orientierung (Schätzung nach den Anforderungen der jeweiligen Wärmeschutzverordnung/EnEV), keine Erhebung.
 */
export const TYPICAL_BY_AGE: readonly { until: number; label: string; range: [number, number] }[] = [
  { until: 1948, label: 'bis 1948', range: [180, 250] },
  { until: 1978, label: '1949–1978 (vor der 1. Wärmeschutzverordnung)', range: [160, 220] },
  { until: 1994, label: '1979–1994 (Wärmeschutzverordnung 1977/1984)', range: [120, 170] },
  { until: 2001, label: '1995–2001 (Wärmeschutzverordnung 1995)', range: [90, 130] },
  { until: 2015, label: '2002–2015 (Energieeinsparverordnung)', range: [60, 100] },
  { until: Infinity, label: 'ab 2016 (EnEV 2016 / GEG)', range: [30, 70] },
];

/** Typische Einsparung durch Sanierung gegenüber unsaniert (grob). */
const RENOVATION_SAVING = { partial: [0.1, 0.25], full: [0.4, 0.6] } as const;

/** Vollbenutzungsstunden für die grobe Heizlast (Einfamilienhaus, typisch 1.800–2.100 h). */
export const FULL_LOAD_HOURS = 2000;

export type Comparison = 'better' | 'typical' | 'worse';

export interface HouseRating {
  area: number;
  /** Endenergie Heizung + Warmwasser (ohne Kochen), kWh/Jahr. */
  heatingFuel: number;
  /** Verbrauchskennwert Endenergie (Heizung + Warmwasser), kWh/(m²·a). */
  kwhPerM2: number;
  /** Nutzwärme nur Raumheizung je m² (für die WP-Eignung). */
  spaceHeatPerM2: number;
  efficiencyClass: string;
  /** Warmwasser im Kennwert enthalten? (sonst wie im Energieausweis ohne Warmwasser) */
  includesDhw: boolean;
  buildingAge: number;
  ageClass: (typeof TYPICAL_BY_AGE)[number];
  /** Erwartungsbereich unter Berücksichtigung der Sanierung. */
  expected: [number, number];
  comparison: Comparison;
  renovation: { state: 'unsaniert' | 'teilsaniert' | 'umfassend saniert'; year: number | null; text: string };
  /** Grobe Heizlast (kW) für die Größe der Wärmepumpe. */
  heatLoadKW: number;
  wpSuitability: { level: 'good' | 'ok' | 'check'; text: string };
  notes: string[];
}

export function efficiencyClass(kwhPerM2: number): string {
  return EFFICIENCY_CLASSES.find((c) => kwhPerM2 < c.below)!.cls;
}

export function rateHouse(inp: Inputs): HouseRating {
  const b = inp.building;
  const s = energySplit(inp);
  const area = Math.max(1, b.heatedArea);
  const kwhPerM2 = s.heatingFuel / area;
  const startYear = yearOf(parseMonth(inp.general.startMonth));
  const ageClass = TYPICAL_BY_AGE.find((c) => b.constructionYear <= c.until)!;
  const notes: string[] = [];

  // Sanierungsstand
  const renovated = b.renovationYear > 0 && b.renovationYear >= b.constructionYear;
  if (b.renovationYear > 0 && b.renovationYear < b.constructionYear) {
    notes.push('Das Sanierungsjahr liegt vor dem Baujahr und wird ignoriert.');
  }
  const state = !renovated ? 'unsaniert' : b.renovationScope === 'full' ? 'umfassend saniert' : 'teilsaniert';
  const saving = !renovated ? ([0, 0] as const) : RENOVATION_SAVING[b.renovationScope];
  // Erwartung: unsaniert-Bereich, durch die Sanierung abgesenkt
  const expected: [number, number] = [
    Math.round(ageClass.range[0] * (1 - saving[1])),
    Math.round(ageClass.range[1] * (1 - saving[0])),
  ];
  const comparison: Comparison = kwhPerM2 < expected[0] ? 'better' : kwhPerM2 > expected[1] ? 'worse' : 'typical';
  const renovationText = !renovated
    ? 'Keine energetische Sanierung angegeben.'
    : `${state === 'teilsaniert' ? 'Einzelne Maßnahmen' : 'Umfassende Sanierung'} ${b.renovationYear}` +
      (startYear - b.renovationYear >= 25 ? ' – liegt über 25 Jahre zurück.' : '.');

  if (!inp.oldHeating.dhwViaHeating) {
    notes.push('Warmwasser läuft nicht über die Heizung; der Kennwert enthält nur die Raumwärme (im Energieausweis werden dafür pauschal 20 kWh/m² ergänzt).');
  }
  notes.push('Kennwert ohne Witterungsbereinigung und bezogen auf die beheizte Wohnfläche (der Energieausweis nutzt die meist größere Gebäudenutzfläche).');

  // Eignung WP: Raumwärme (Nutzwärme) je m²
  const spaceHeatPerM2 = s.spaceHeat / area;
  const wpSuitability =
    spaceHeatPerM2 <= 100
      ? { level: 'good' as const, text: 'Gute Voraussetzungen: Der Wärmebedarf ist moderat; mit den vorhandenen Heizkörpern reichen meist niedrige Vorlauftemperaturen.' }
      : spaceHeatPerM2 <= 150
        ? { level: 'ok' as const, text: 'Geeignet. Prüfen Sie die nötige Vorlauftemperatur (z. B. an kalten Tagen Thermostate voll auf, Kessel auf 55 °C) und tauschen Sie ggf. einzelne zu kleine Heizkörper.' }
        : { level: 'check' as const, text: 'Hoher Wärmebedarf: Eine Wärmepumpe ist möglich, arbeitet aber mit höherer Vorlauftemperatur weniger effizient (niedrigere JAZ). Größere Heizkörper oder einzelne Dämmmaßnahmen (Dach, Fenster) vorab verbessern die Wirtschaftlichkeit.' };

  return {
    area,
    heatingFuel: s.heatingFuel,
    kwhPerM2,
    spaceHeatPerM2,
    efficiencyClass: efficiencyClass(kwhPerM2),
    includesDhw: inp.oldHeating.dhwViaHeating,
    buildingAge: Math.max(0, startYear - b.constructionYear),
    ageClass,
    expected,
    comparison,
    renovation: { state, year: renovated ? b.renovationYear : null, text: renovationText },
    heatLoadKW: (s.spaceHeat + s.dhwHeat) / FULL_LOAD_HOURS,
    wpSuitability,
    notes,
  };
}
