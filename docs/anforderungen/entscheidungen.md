# Entscheidungen aus der Anforderungsaufnahme

Historisch (Stand 2026-11-11). Maßgeblich sind die Anforderungen F* und N* sowie die [Produktbeschreibung](produktbeschreibung.md); diese Tabelle wird nicht fortgeschrieben.

| # | Thema | Entscheidung |
|---|---|---|
| E1 | Technik | Vite + TypeScript ohne UI-Framework, Tests mit Vitest, statischer Build |
| E2 | Altanlage | Erdgas **und** Heizöl (wählbar) |
| E3 | Preismodell | Preis ohne CO₂-Anteil mit jährlicher Steigerung + CO₂-Aufschlag aus CO₂-Preispfad; Grundgebühren separat |
| E4 | Förderweg | KfW-Zuschuss (+ Kredit) **und** Steuerbonus werden parallel gerechnet und verglichen (nicht kombinierbar für dieselbe Maßnahme) |
| E5 | Referenzszenario | Altanlage läuft weiter, Ersatz durch neuen Kessel nach Restlebensdauer; Wartung/Schornsteinfeger berücksichtigt |
| E6 | WP-Verbrauch | Wärmebedarf = Brennstoffverbrauch × Kesselnutzungsgrad; WP-Strom = Wärmebedarf / JAZ; separater WP-Tarif inkl. § 14a EnWG-Reduzierung; PV-Anlage mit Monatsmodell (F28) |
| E7 | Ergebnisse | Gesamtkosten + Amortisationszeitpunkt, Diagramme, Jahrestabelle (kein expliziter Kapitalwert, aber Opportunitätszins, s. F6) |
| E8 | Speichern | localStorage, teilbarer Link (URL-Hash), JSON-Export/-Import |
| E9 | Finanzierung | KfW 358/359, freier Bankkredit, Eigenkapital mit Opportunitätszins |
| E10 | Zeitachse | Automatischer Vergleich mehrerer Installationszeitpunkte (Kosten des Wartens) |
| E11 | Förderdaten | Aktueller Stand als Defaults in zentraler Konfiguration, in der UI („Experten-Einstellungen") editierbar |
| E12 | Sprache | Deutsche Oberfläche, Beträge in € (brutto, d. h. inkl. MwSt.) |
