import type { Inputs } from '../core/types';

export type FieldType = 'number' | 'percent' | 'checkbox' | 'select' | 'month' | 'text' | 'textarea';

export interface Field {
  /** Pfad im Inputs-Objekt, z. B. "heatPump.jaz". */
  path: string;
  label: string;
  type: FieldType;
  unit?: string | ((i: Inputs) => string);
  step?: number;
  min?: number;
  max?: number;
  options?: [string, string][];
  help?: string;
  placeholder?: string;
  /** Kein Standardwert mit Herkunft (z. B. Freitext) – kein „i“-Popover. */
  noSource?: boolean;
  /** Ändert die Rechnung nicht (nur speichern, kein Neuberechnen). */
  noRecalc?: boolean;
  show?: (i: Inputs) => boolean;
  /** Reaktion auf Änderung (z. B. Einheitenumrechnung). */
  onChange?: (i: Inputs, prev: unknown) => void;
}

export interface Section {
  id: string;
  title: string;
  expert?: boolean;
  open?: boolean;
  note?: string;
  fields: Field[];
}

const isGas = (i: Inputs) => i.oldHeating.fuel === 'gas';
const isOil = (i: Inputs) => i.oldHeating.fuel === 'oil';

export const SECTIONS: Section[] = [
  {
    id: 'scenario',
    title: 'Szenario',
    open: true,
    fields: [
      {
        path: 'scenario.name',
        label: 'Bezeichnung des Szenarios',
        type: 'text',
        placeholder: 'z. B. Angebot Firma A, Herbst 2027',
        help: 'Zur Unterscheidung mehrerer Szenarien; wird in den Dateinamen beim Export übernommen.',
        noSource: true,
        noRecalc: true,
      },
      {
        path: 'scenario.notes',
        label: 'Bemerkungen',
        type: 'textarea',
        placeholder: 'Beschreibung, Annahmen, Angebote, offene Fragen …',
        noSource: true,
        noRecalc: true,
      },
    ],
  },
  {
    id: 'old',
    title: 'Bestandsheizung',
    open: true,
    fields: [
      {
        path: 'oldHeating.fuel',
        label: 'Energieträger',
        type: 'select',
        options: [
          ['gas', 'Erdgas'],
          ['oil', 'Heizöl'],
        ],
        onChange: (i, prev) => {
          if (prev === 'gas' && i.oldHeating.fuel === 'oil') i.oldHeating.consumption = Math.round(i.oldHeating.consumption / 10);
          if (prev === 'oil' && i.oldHeating.fuel === 'gas') i.oldHeating.consumption = Math.round(i.oldHeating.consumption * 10);
        },
      },
      {
        path: 'oldHeating.consumption',
        label: 'Verbrauch pro Jahr',
        type: 'number',
        unit: (i) => (isGas(i) ? 'kWh' : 'Liter'),
        step: 100,
        min: 0,
        help: 'Gesamter Verbrauch laut Abrechnung (inkl. Warmwasser und ggf. Kochen), am besten der Durchschnitt mehrerer Jahre.',
      },
      { path: 'oldHeating.dhwViaHeating', label: 'Warmwasser über die Heizung', type: 'checkbox', help: 'Nicht ankreuzen bei Durchlauferhitzer oder elektrischem Speicher.' },
      { path: 'oldHeating.dhwShare', label: 'Anteil Warmwasser am Verbrauch', type: 'percent', unit: '%', step: 1, min: 0, max: 60, show: (i) => i.oldHeating.dhwViaHeating, help: 'Typisch 10–20 % im Einfamilienhaus, in gut gedämmten Häusern mehr.' },
      { path: 'oldHeating.cookingWithGas', label: 'Kochen mit Gas', type: 'checkbox', show: isGas, help: 'Gasherd am selben Anschluss.' },
      { path: 'oldHeating.cookingShare', label: 'Anteil Kochen am Verbrauch', type: 'percent', unit: '%', step: 0.5, min: 0, max: 30, show: (i) => isGas(i) && i.oldHeating.cookingWithGas, help: 'Typisch 1–3 % (ein Gasherd braucht etwa 300–600 kWh im Jahr).' },
      {
        path: 'oldHeating.cookingAfter',
        label: 'Kochen nach dem Umstieg',
        type: 'select',
        options: [
          ['electric', 'Mit Strom (Induktion) – Gasanschluss entfällt'],
          ['gas', 'Weiter mit Gas – Gasanschluss bleibt'],
        ],
        show: (i) => isGas(i) && i.oldHeating.cookingWithGas,
        help: 'Bleibt der Gasherd, fallen weiter Gas-Grundpreis und Gaskosten fürs Kochen an.',
      },
      {
        path: 'oldHeating.cookingSwitchCost',
        label: 'Investition neues Kochfeld (Induktion)',
        type: 'number',
        unit: '€',
        step: 100,
        min: 0,
        show: (i) => isGas(i) && i.oldHeating.cookingWithGas,
        help: 'Kochfeld inkl. Einbau und ggf. neuer Töpfe; fällt nur beim Umstieg auf Strom an (nicht förderfähig, aus Eigenmitteln).',
      },
      { path: 'oldHeating.efficiency', label: 'Nutzungsgrad Altanlage', type: 'percent', unit: '%', step: 1, min: 1, help: 'Typisch 80–95 %.' },
      { path: 'oldHeating.ageYears', label: 'Alter der Heizung', type: 'number', unit: 'Jahre', step: 1, min: 0, help: 'Gasheizungen ab 20 Jahren erhalten den Klimageschwindigkeitsbonus.' },
      { path: 'oldHeating.remainingLifeYears', label: 'Restlebensdauer', type: 'number', unit: 'Jahre', step: 0.5, min: 0, help: 'Danach wird im Szenario ohne Wärmepumpe ein neuer Kessel gekauft.' },
      { path: 'oldHeating.maintenance', label: 'Wartung + Schornsteinfeger', type: 'number', unit: '€/Jahr', step: 10, min: 0 },
      { path: 'oldHeating.replacementCost', label: 'Kosten Ersatzkessel', type: 'number', unit: '€', step: 500, min: 0 },
      { path: 'oldHeating.replacementEfficiency', label: 'Nutzungsgrad Ersatzkessel', type: 'percent', unit: '%', step: 1, min: 1 },
      { path: 'oldHeating.replacementLifeYears', label: 'Lebensdauer Ersatzkessel', type: 'number', unit: 'Jahre', step: 1, min: 1 },
    ],
  },
  {
    id: 'prices',
    title: 'Energiepreise',
    open: true,
    fields: [
      { path: 'prices.gasPriceCt', label: 'Gaspreis heute (inkl. CO₂)', type: 'number', unit: 'ct/kWh', step: 0.1, min: 0, show: isGas },
      { path: 'prices.gasBaseFee', label: 'Gas-Grundpreis', type: 'number', unit: '€/Jahr', step: 10, min: 0, show: isGas, help: 'Entfällt nach dem Umstieg (Gasanschluss wird stillgelegt).' },
      { path: 'prices.gasIncrease', label: 'Steigerung Gaspreis (ohne CO₂)', type: 'percent', unit: '% p. a.', step: 0.5, show: isGas },
      { path: 'prices.oilPriceEur', label: 'Heizölpreis heute (inkl. CO₂)', type: 'number', unit: '€/Liter', step: 0.01, min: 0, show: isOil },
      { path: 'prices.oilIncrease', label: 'Steigerung Ölpreis (ohne CO₂)', type: 'percent', unit: '% p. a.', step: 0.5, show: isOil },
      { path: 'prices.co2Path', label: 'CO₂-Preispfad', type: 'text', unit: 'Jahr:€/t', help: 'Stützstellen, linear interpoliert. 2026/27: BEHG-Korridor 55–65 €/t, ab 2028 EU-ETS2 (Annahme).' },
      { path: 'prices.bioEnabled', label: 'Bio-Treppe für neuen fossilen Kessel', type: 'checkbox', help: 'Gebäudemodernisierungsgesetz: ab 2029 steigender Bio-Anteil für neu eingebaute Gas-/Ölheizungen.' },
      { path: 'prices.bioSteps', label: 'Bio-Anteil', type: 'text', unit: 'Jahr:%', show: (i) => i.prices.bioEnabled },
      { path: 'prices.bioPremiumCt', label: 'Mehrpreis Biogas/-öl', type: 'number', unit: 'ct/kWh', step: 0.5, show: (i) => i.prices.bioEnabled },
    ],
  },
  {
    id: 'hp',
    title: 'Wärmepumpe',
    open: true,
    fields: [
      { path: 'heatPump.installMonth', label: 'Geplante Inbetriebnahme', type: 'month', help: 'Bis dahin läuft die Altanlage zu steigenden Preisen weiter.' },
      { path: 'heatPump.investment', label: 'Investition gesamt (brutto)', type: 'number', unit: '€', step: 500, min: 0, help: 'Gerät, Installation, Umfeldmaßnahmen (z. B. Heizkörper, Elektrik).' },
      { path: 'heatPump.eligibleShare', label: 'davon förderfähig', type: 'percent', unit: '%', step: 5, min: 0, max: 100 },
      { path: 'heatPump.extraCost', label: 'Nicht förderfähige Nebenkosten', type: 'number', unit: '€', step: 100, min: 0, help: 'z. B. Stilllegung des Gasanschlusses. Rückbau und Entsorgung der Altanlage inkl. Öl-/Gastank sind förderfähig.' },
      { path: 'heatPump.jaz', label: 'Jahresarbeitszahl (JAZ)', type: 'number', step: 0.1, min: 1, help: 'Luft/Wasser typ. 3,0–4,0; Sole/Wasser 4,0–4,8.' },
      { path: 'heatPump.maintenance', label: 'Wartung', type: 'number', unit: '€/Jahr', step: 10, min: 0 },
      { path: 'heatPump.lifeYears', label: 'Lebensdauer', type: 'number', unit: 'Jahre', step: 1, min: 1 },
      { path: 'heatPump.euOrigin', label: 'Wärmepumpe mit Ursprung in der EU', type: 'checkbox', help: 'Ab dem 1. Quartal 2027: 15 % Grundförderung + 15 % Wertschöpfungs-Bonus nur für Wärmepumpen aus der EU, sonst nur 15 %.' },
      { path: 'heatPump.leadMonths', label: 'Vorlauf Förderantrag', type: 'number', unit: 'Monate', step: 1, min: 0, help: 'Antrag vor Vorhabenbeginn; die Förderkonditionen richten sich nach dem Antragsdatum.' },
    ],
  },
  {
    id: 'elec',
    title: 'Strom',
    fields: [
      { path: 'heatPump.separateTariff', label: 'Separater Wärmepumpentarif', type: 'checkbox', help: 'Gilt für die Berechnung. Beide Varianten werden zusätzlich im Tarifvergleich gegenübergestellt.' },
      { path: 'heatPump.elecPriceCt', label: 'WP-Strompreis (eigener Zähler)', type: 'number', unit: 'ct/kWh', step: 0.5, min: 0 },
      { path: 'heatPump.meterFee', label: 'Grundpreis WP-Zähler', type: 'number', unit: '€/Jahr', step: 10, min: 0 },
      { path: 'heatPump.meterSetupCost', label: 'Einmalig: zweiter Zähler / Zählerschrank-Umbau', type: 'number', unit: '€', step: 100, min: 0, help: 'Nur die Mehrkosten für den zweiten Zählerplatz. Fällt nur mit separatem WP-Tarif an.' },
      { path: 'heatPump.meterSetupEligible', label: 'Umbau als förderfähig angesetzt', type: 'checkbox', show: (i) => i.heatPump.meterSetupCost > 0, help: 'Nur ankreuzen, wenn der Fachbetrieb bzw. Energieeffizienz-Experte das bestätigt.' },
      { path: 'heatPump.householdPriceCt', label: 'Haushaltsstrompreis (ohne WP-Tarif)', type: 'number', unit: 'ct/kWh', step: 0.5, min: 0 },
      { path: 'heatPump.elecIncrease', label: 'Steigerung Strompreis', type: 'percent', unit: '% p. a.', step: 0.5 },
      { path: 'heatPump.para14aReduction', label: 'Netzentgeltreduzierung § 14a EnWG', type: 'number', unit: '€/Jahr', step: 10, help: 'Modul 1: pauschale Reduzierung je Zähler, abhängig vom Netzbetreiber.' },
      { path: 'heatPump.existing14aOnHousehold', label: 'Haushaltszähler hat schon § 14a (z. B. Wallbox)', type: 'checkbox', help: 'Die Pauschale gibt es nur einmal je Zähler. Ohne eigenen WP-Zähler bringt die Wärmepumpe dann keine zusätzliche Reduzierung.' },
      { path: 'heatPump.pvShare', label: 'Anteil PV-Eigenverbrauch', type: 'percent', unit: '%', step: 5, min: 0, max: 100, help: 'Anteil des WP-Stroms aus eigener PV-Anlage.' },
      { path: 'heatPump.feedInCt', label: 'Einspeisevergütung (entgangen)', type: 'number', unit: 'ct/kWh', step: 0.1, min: 0, show: (i) => i.heatPump.pvShare > 0 },
    ],
  },
  {
    id: 'household',
    title: 'Haushalt & Gebäude',
    fields: [
      { path: 'building.ownerOccupied', label: 'Selbstgenutzt (Hauptwohnsitz)', type: 'checkbox', help: 'Voraussetzung für Boni und Steuerbonus.' },
      { path: 'building.units', label: 'Wohneinheiten', type: 'number', step: 1, min: 1 },
      { path: 'building.constructionYear', label: 'Baujahr des Gebäudes', type: 'number', step: 1, min: 1500, max: 2100, help: 'Steuerbonus: Gebäude mindestens 10 Jahre alt. Dient auch der Einordnung des Hauses.' },
      { path: 'building.heatedArea', label: 'Beheizte Wohnfläche', type: 'number', unit: 'm²', step: 5, min: 10, help: 'Für den Verbrauchskennwert in kWh je m² und Jahr.' },
      { path: 'building.renovationYear', label: 'Letzte energetische Sanierung', type: 'number', step: 1, min: 0, max: 2100, help: 'Jahr, 0 = keine (z. B. Dämmung, neue Fenster, Dach).' },
      {
        path: 'building.renovationScope',
        label: 'Umfang der Sanierung',
        type: 'select',
        options: [
          ['partial', 'Einzelne Maßnahmen (z. B. Fenster oder Dach)'],
          ['full', 'Umfassend (Hülle gedämmt, neue Fenster)'],
        ],
        show: (i) => i.building.renovationYear > 0,
      },
      { path: 'building.householdIncome', label: 'Zu versteuerndes Haushaltseinkommen', type: 'number', unit: '€/Jahr', step: 1000, min: 0, help: 'Durchschnitt des 2. und 3. Jahres vor Antragstellung. Maßgeblich für Einkommensbonus und KfW 358.' },
      { path: 'building.hasChild', label: 'Kindergeldberechtigtes Kind unter 18', type: 'checkbox' },
      { path: 'building.incomeTax', label: 'Einkommensteuerschuld', type: 'number', unit: '€/Jahr', step: 500, min: 0, help: 'Begrenzt den Steuerbonus (0 = keine Begrenzung).' },
    ],
  },
  {
    id: 'finance',
    title: 'Finanzierung',
    note: 'Zinssätze sind Annahmen – die aktuellen KfW-Konditionen bitte auf kfw.de bzw. bei der Hausbank prüfen.',
    fields: [
      { path: 'financing.useKfwLoan', label: 'KfW-Kredit nutzen (358/359)', type: 'checkbox' },
      { path: 'financing.kfwEquity', label: 'Eigenkapital (KfW-Weg)', type: 'number', unit: '€', step: 1000, min: 0 },
      { path: 'financing.kfwRate358', label: 'Zins KfW 358 (zinsverbilligt)', type: 'percent', unit: '%', step: 0.05 },
      { path: 'financing.kfwRate359', label: 'Zins KfW 359', type: 'percent', unit: '%', step: 0.05 },
      { path: 'financing.kfwTermYears', label: 'Laufzeit KfW-Kredit', type: 'number', unit: 'Jahre', step: 1, min: 4, max: 35 },
      { path: 'financing.kfwGraceYears', label: 'Tilgungsfreie Anlaufjahre', type: 'number', unit: 'Jahre', step: 1, min: 0, max: 5 },
      { path: 'financing.kfwFixYears', label: 'Zinsbindung', type: 'number', unit: 'Jahre', step: 1, min: 1, max: 10 },
      { path: 'financing.followUpRate', label: 'Anschlusszins', type: 'percent', unit: '%', step: 0.1 },
      { path: 'financing.subsidyAsSpecialRepayment', label: 'Zuschuss als Sondertilgung verwenden', type: 'checkbox' },
      { path: 'financing.subsidyDelayMonths', label: 'Auszahlung Zuschuss nach Inbetriebnahme', type: 'number', unit: 'Monate', step: 1, min: 0 },
      { path: 'financing.taxEquity', label: 'Eigenkapital (Steuer-Weg)', type: 'number', unit: '€', step: 1000, min: 0 },
      { path: 'financing.bankRate', label: 'Zins Bankkredit', type: 'percent', unit: '%', step: 0.1 },
      { path: 'financing.bankTermYears', label: 'Laufzeit Bankkredit', type: 'number', unit: 'Jahre', step: 1, min: 1 },
      { path: 'financing.bankGraceYears', label: 'Tilgungsfreie Jahre (Bank)', type: 'number', unit: 'Jahre', step: 1, min: 0 },
      { path: 'financing.taxRefundMonth', label: 'Steuererstattung im Folgejahr, Monat', type: 'number', step: 1, min: 1, max: 12 },
    ],
  },
  {
    id: 'windfall',
    title: 'Sondertilgung aus Einmalzahlung',
    note: 'Z. B. fällige Lebensversicherung. Der Betrag wird nach den Kreditbedingungen als Sondertilgung eingesetzt; was nicht eingesetzt werden kann, bleibt außen vor.',
    fields: [
      { path: 'financing.windfallAmount', label: 'Verfügbarer Betrag', type: 'number', unit: '€', step: 1000, min: 0, help: '0 = keine Einmalzahlung.' },
      { path: 'financing.windfallMonth', label: 'Verfügbar ab', type: 'month', show: (i) => i.financing.windfallAmount > 0 },
      {
        path: 'financing.windfallRepayMonth',
        label: 'Sondertilgung am',
        type: 'month',
        show: (i) => i.financing.windfallAmount > 0,
        help: 'Leer = sofort, wenn das Geld verfügbar ist. KfW: Teil-Sondertilgungen nur bis zum Ende der ersten Zinsbindung kostenfrei.',
      },
      {
        path: 'financing.windfallTarget',
        label: 'Zuerst tilgen',
        type: 'select',
        options: [
          ['auto', 'Automatisch: höchster Zins zuerst'],
          ['kfw', 'KfW-Kredit'],
          ['bank', 'Bankkredit'],
        ],
        show: (i) => i.financing.windfallAmount > 0,
        help: 'Ist die Sondertilgung beim gewählten Kredit nicht möglich, wird der andere Kredit versucht.',
      },
    ],
  },
  {
    id: 'general',
    title: 'Betrachtung',
    fields: [
      { path: 'general.startMonth', label: 'Start der Betrachtung', type: 'month' },
      { path: 'general.horizonYears', label: 'Betrachtungszeitraum', type: 'number', unit: 'Jahre', step: 1, min: 1, max: 40 },
      { path: 'general.opportunityRate', label: 'Opportunitätszins', type: 'percent', unit: '% p. a.', step: 0.25, help: 'Alternative Verzinsung (z. B. Tagesgeld). Alle Zahlungen werden damit bis zum Ende aufgezinst.' },
      { path: 'general.costIncrease', label: 'Steigerung Wartungskosten', type: 'percent', unit: '% p. a.', step: 0.5 },
      { path: 'general.investIncrease', label: 'Steigerung Anschaffungspreise', type: 'percent', unit: '% p. a.', step: 0.5, help: 'Wirkt, wenn später gekauft wird.' },
      { path: 'general.residualValue', label: 'Restwert am Ende berücksichtigen', type: 'checkbox' },
      { path: 'compare.stepMonths', label: 'Zeitpunktvergleich: Abstand', type: 'number', unit: 'Monate', step: 1, min: 1 },
      { path: 'compare.count', label: 'Zeitpunktvergleich: Anzahl', type: 'number', step: 1, min: 1, max: 30 },
    ],
  },
  {
    id: 'expert-kfw',
    title: 'Experten: KfW-Heizungsförderung 458',
    expert: true,
    note: 'Defaults: Stand KfW-Website 11.11.2026.',
    fields: [
      { path: 'funding.grundRate', label: 'Grundförderung', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.grundRateNewFrom', label: 'Neue WP-Förderung gilt ab (Antrag)', type: 'month', help: 'Start von reduzierter Grundförderung und Wertschöpfungs-Bonus; leer = keine Änderung.' },
      { path: 'funding.grundRateNew', label: 'Grundförderung Wärmepumpe ab Stichtag', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.wsbRate', label: 'Wertschöpfungs-Bonus (EU-Ursprung)', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.kgbRate', label: 'Klimageschwindigkeitsbonus', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.kgbStep', label: 'KGB-Absenkung je Halbjahr', type: 'percent', unit: '%-Pkt.', step: 1 },
      { path: 'funding.kgbDegressionStart', label: 'KGB erste Absenkung', type: 'month' },
      { path: 'funding.kgbEnd', label: 'KGB entfällt ab', type: 'month' },
      { path: 'funding.kgbMinGasAge', label: 'KGB: Mindestalter Gasheizung', type: 'number', unit: 'Jahre', step: 1 },
      { path: 'funding.incomeLimit1', label: 'Einkommensbonus Stufe 1 bis', type: 'number', unit: '€', step: 1000 },
      { path: 'funding.incomeRate1', label: 'Einkommensbonus Stufe 1', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.incomeLimit2', label: 'Einkommensbonus Stufe 2 bis', type: 'number', unit: '€', step: 1000 },
      { path: 'funding.incomeRate2', label: 'Einkommensbonus Stufe 2', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.incomeLimit3', label: 'Einkommensbonus Stufe 3 bis', type: 'number', unit: '€', step: 1000 },
      { path: 'funding.incomeRate3', label: 'Einkommensbonus Stufe 3', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.incomeChildShift', label: 'Grenzerhöhung mit Kind', type: 'number', unit: '€', step: 1000 },
      { path: 'funding.maxRate', label: 'Höchstfördersatz', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.maxRateLowIncome', label: 'Höchstfördersatz (Einkommensstufe 1)', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.cap1', label: 'Förderfähige Kosten 1. WE', type: 'number', unit: '€', step: 500 },
      { path: 'funding.capStep', label: 'Absenkung je Halbjahr', type: 'number', unit: '€', step: 50 },
      { path: 'funding.capDegressionStart', label: 'Erste Absenkung', type: 'month' },
      { path: 'funding.capFloor', label: 'Untergrenze nach Absenkung', type: 'number', unit: '€', step: 500 },
      { path: 'funding.cap2to6', label: 'Förderfähige Kosten 2.–6. WE', type: 'number', unit: '€', step: 500 },
      { path: 'funding.cap7plus', label: 'Förderfähige Kosten ab 7. WE', type: 'number', unit: '€', step: 500 },
      { path: 'funding.loanMaxPerUnit', label: 'KfW-Kredit max. je WE', type: 'number', unit: '€', step: 1000 },
      { path: 'funding.loan358IncomeLimit', label: 'KfW 358: Einkommensgrenze', type: 'number', unit: '€', step: 1000 },
    ],
  },
  {
    id: 'expert-prepay',
    title: 'Experten: Sondertilgungsregeln',
    expert: true,
    fields: [
      { path: 'financing.kfwMinPrepay', label: 'KfW: Mindestbetrag Sondertilgung', type: 'number', unit: '€', step: 500, min: 0 },
      { path: 'financing.kfwFeeAfterFix', label: 'KfW: Vorfälligkeitsentschädigung nach Zinsbindung', type: 'percent', unit: '%', step: 0.1, min: 0 },
      { path: 'financing.bankPrepayFee', label: 'Bank: Vorfälligkeitsentschädigung', type: 'percent', unit: '%', step: 0.1, min: 0 },
      { path: 'financing.bankPrepayFeeShort', label: 'Bank: Entschädigung bei Restlaufzeit ≤ 1 Jahr', type: 'percent', unit: '%', step: 0.1, min: 0 },
    ],
  },
  {
    id: 'expert-tax',
    title: 'Experten: Steuerbonus § 35c & Konstanten',
    expert: true,
    fields: [
      { path: 'tax.rateYear1', label: 'Steuerbonus Jahr 1', type: 'percent', unit: '%', step: 1 },
      { path: 'tax.rateYear2', label: 'Steuerbonus Jahr 2', type: 'percent', unit: '%', step: 1 },
      { path: 'tax.rateYear3', label: 'Steuerbonus Jahr 3', type: 'percent', unit: '%', step: 1 },
      { path: 'tax.maxBonus', label: 'Max. Steuerermäßigung', type: 'number', unit: '€', step: 1000 },
      { path: 'tax.maxCost', label: 'Max. begünstigte Kosten', type: 'number', unit: '€', step: 1000 },
      { path: 'tax.deadline', label: 'Abschluss spätestens', type: 'month' },
      { path: 'tax.minBuildingAge', label: 'Mindestalter Gebäude', type: 'number', unit: 'Jahre', step: 1 },
      { path: 'prices.gasCo2Factor', label: 'CO₂-Faktor Erdgas', type: 'number', unit: 'kg/kWh', step: 0.001 },
      { path: 'prices.oilCo2Factor', label: 'CO₂-Faktor Heizöl', type: 'number', unit: 'kg/kWh', step: 0.001 },
      { path: 'prices.oilKwhPerLiter', label: 'Heizwert Heizöl', type: 'number', unit: 'kWh/Liter', step: 0.1 },
      { path: 'prices.cookingElecFactor', label: 'Strom je kWh Gas beim Kochen (Induktion)', type: 'number', unit: 'kWh/kWh', step: 0.05 },
      { path: 'general.vat', label: 'Mehrwertsteuer', type: 'percent', unit: '%', step: 1 },
    ],
  },
];

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
}

export function setPath(obj: unknown, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as Record<string, unknown>;
  target[last] = value;
}
