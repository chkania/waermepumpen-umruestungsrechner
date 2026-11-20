# Offene Punkte und Annahmen zum Nachprüfen

- A1 Zinssätze KfW 358/359 stammen nur aus einer Sekundärquelle (hausvoraus.de, 10.11.2026; 358 für 20 Jahre interpoliert), der Bankzins aus einem Verivox-Median und der Anschlusszins ist eine Annahme. Die aktuellen Werte stehen in `src/core/defaults.ts`, ihre Herkunft in `src/core/sources.ts`.
- A7 Markt-Defaults (Preise, Kosten, Wartung) stammen überwiegend aus Ratgeber- und Vergleichsportalen bzw. Verbänden (BDEW, co2online, Verivox, esyoil); für Investitionskosten gibt es keine amtliche Erhebung. Quellen je Feld in `src/core/sources.ts`. Regelmäßig (z. B. halbjährlich) aktualisieren.
- A2 Ob die Degression der förderfähigen Kosten (−750 €) auch nach 2028 weiterläuft (aktuell: ja, ohne Ende).
- A3 Wertschöpfungs-Bonus: Die Richtlinie (Nr. 8.4.1 c, 8.4.6) regelt 15 % Grundförderung + 15 % Bonus bei EU-Ursprung „ab dem ersten Quartal 2027“; Stichtag und Nachweis sind noch offen (Infoblatt Nr. 1.8). Angenommen: Anträge ab 01/2027.
- A4 ~~Höchstfördersatz 80 % aus Beispielen abgeleitet~~ – bestätigt durch Richtlinie Nr. 8.4.1 und Merkblatt 458 S. 4.
- A5 Bio-Treppe: Gilt hier nur für neu eingebaute fossile Kessel; Aufpreis Biomethan/Bioöl als Pauschale.
- A6 CO₂-Preispfad ab 2028 (EU-ETS2) ist eine Annahme.
