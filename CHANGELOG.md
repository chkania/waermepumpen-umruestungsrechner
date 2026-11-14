# Changelog

Alle wesentlichen Änderungen am Wärmepumpen-Investitionsrechner. Das Format orientiert sich an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionsnummern folgen
[Semantic Versioning](https://semver.org/lang/de/):

- **Major** (x.0.0): inkompatible Änderungen, z. B. am Format von Export-Dateien oder geteilten Links, die ältere Stände nicht mehr übernehmen können.
- **Minor** (1.x.0): neue Funktionen oder Eingaben sowie bewusst geänderte Rechenmodelle oder Standardwerte (Ergebnisse können sich ändern).
- **Patch** (1.0.x): Fehlerkorrekturen, Texte, Darstellung – ohne neue Funktionen.

## Unveröffentlicht

### Neu
- „Wann umrüsten?“ erklärt, warum der günstigste Zeitpunkt am günstigsten ist: Vergleich mit dem vorherigen und nächsten Zeitpunkt nach Kostenarten, Hauptgrund und Ursachen (Heizwinter, Zuschuss, Steuerbonus, Ersatzkessel).

## 1.0.0 – 2026-11-12

Erste veröffentlichte Version.

### Rechnung
- Monatliche Simulation über einen wählbaren Zeitraum (Standard 20 Jahre) für drei Szenarien: ohne Wärmepumpe, Wärmepumpe mit KfW-Zuschuss, Wärmepumpe mit Steuerbonus (§ 35c EStG); Endwert mit Opportunitätszins.
- Energiepreise mit eigener Steigerung ab dem Startmonat, CO₂-Preispfad (BEHG/ETS2), Bio-Treppe für neue fossile Kessel; Gas oder Heizöl.
- Verbrauch aufgeteilt in Raumwärme, Warmwasser und Kochen; Kochen nach dem Umstieg mit Induktion (inkl. Kochfeld) oder weiter mit Gas.
- Ersatzkessel bei Ausfall der Altanlage, Ersatz-Wärmepumpe nach Ablauf der Lebensdauer, Restwerte am Ende.
- KfW-Heizungsförderung 458 nach Richtlinie vom 17.08.2026: Grundförderung, Wertschöpfungs-Bonus, Klimageschwindigkeitsbonus mit Degression, Einkommensbonus, Höchstbeträge.
- Finanzierung mit KfW-Ergänzungskredit 358/359 (abschaltbar) und Bankkredit, Zinsbindung und Anschlusszins; Zuschuss als Sondertilgung; Einmalzahlung (z. B. Lebensversicherung) als Sondertilgung mit eigenem Termin, Kreditbedingungen und Zinsersparnis.
- Stromkostenvergleich mit und ohne Wärmepumpentarif inkl. Zählerschrank-Umbau und § 14a EnWG je Zähler.
- Vergleich verschiedener Umrüstzeitpunkte.

### Oberfläche
- Kennzahlen, wichtige Ereignisse und Hinweise, Einordnung des Hauses (kWh/m², Effizienzklasse, Baualter, Sanierung, Heizlast), Diagramme mit Datentabellen, Jahresübersicht.
- Herkunft jedes Standardwerts mit offiziellen Fundstellen im Info-Popover.
- Szenario-Bezeichnung und Bemerkungen; Speichern im Browser, Link teilen, Export und Import.
- Zwei Designs (Modern, Klassisch) mit Hell/Dunkel/Auto; barrierearm nach WCAG 2.1 AA.
- Benutzerhandbuch, Lizenz und Lizenzen von Drittanbietern als eigene Seiten.

### Sicherheit
- Prüfung aller Werte aus Links, Dateien und Browser-Speicher; geteilte Links überschreiben eigene Eingaben nicht ohne Zustimmung; Content-Security-Policy im Build.

### Lizenz
- PolyForm Noncommercial License 1.0.0.
