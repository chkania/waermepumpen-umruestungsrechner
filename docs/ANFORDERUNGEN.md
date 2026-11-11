# Wärmepumpen-Investitionsrechner – Anforderungen

Dieses Dokument ist die verbindliche Sammlung der Anforderungen. Bei jeder Änderung
an der Anwendung wird es mitgepflegt (neue Anforderung → neue ID, geänderte
Anforderung → Text anpassen + Änderungsprotokoll unten). Jede Anforderung sollte
durch mindestens einen Test abgesichert sein (Spalte „Test").

Stand: 2026-11-11

## 1. Ziel

Single Page Application (SPA), mit der Eigentümer:innen die Umrüstung einer
Gas- oder Ölheizung auf eine Wärmepumpe (WP) wirtschaftlich kalkulieren können –
inklusive steigender Energiepreise, Bundesförderung (KfW 458), Kreditfinanzierung
(KfW 358/359, Bankkredit) und Steuerbonus (§ 35c EStG).

## 2. Entscheidungen aus der Anforderungsaufnahme

| # | Thema | Entscheidung |
|---|---|---|
| E1 | Technik | Vite + TypeScript ohne UI-Framework, Tests mit Vitest, statischer Build |
| E2 | Altanlage | Erdgas **und** Heizöl (wählbar) |
| E3 | Preismodell | Preis ohne CO₂-Anteil mit jährlicher Steigerung + CO₂-Aufschlag aus CO₂-Preispfad; Grundgebühren separat |
| E4 | Förderweg | KfW-Zuschuss (+ Kredit) **und** Steuerbonus werden parallel gerechnet und verglichen (nicht kombinierbar für dieselbe Maßnahme) |
| E5 | Referenzszenario | Altanlage läuft weiter, Ersatz durch neuen Kessel nach Restlebensdauer; Wartung/Schornsteinfeger berücksichtigt |
| E6 | WP-Verbrauch | Wärmebedarf = Brennstoffverbrauch × Kesselnutzungsgrad; WP-Strom = Wärmebedarf / JAZ; separater WP-Tarif inkl. § 14a EnWG-Reduzierung; PV-Eigenverbrauchsanteil |
| E7 | Ergebnisse | Gesamtkosten + Amortisationszeitpunkt, Diagramme, Jahrestabelle (kein expliziter Kapitalwert, aber Opportunitätszins, s. F6) |
| E8 | Speichern | localStorage, teilbarer Link (URL-Hash), JSON-Export/-Import |
| E9 | Finanzierung | KfW 358/359, freier Bankkredit, Eigenkapital mit Opportunitätszins |
| E10 | Zeitachse | Automatischer Vergleich mehrerer Installationszeitpunkte (Kosten des Wartens) |
| E11 | Förderdaten | Aktueller Stand als Defaults in zentraler Konfiguration, in der UI („Experten-Einstellungen") editierbar |
| E12 | Sprache | Deutsche Oberfläche, Beträge in € (brutto, d. h. inkl. MwSt.) |

## 3. Funktionale Anforderungen

### F1 – Zeitmodell
- F1.1 Startmonat (Default: aktueller Monat) und Betrachtungszeitraum in Jahren (Default 20). Die Simulation läuft monatlich, Ergebnisse werden je Kalenderjahr aggregiert. *(Test: simulation)*
- F1.2 Der Wärmebedarf wird über ein Heizgradtag-ähnliches Monatsprofil (Summe = 100 %) auf die Monate verteilt, damit ein Wechsel mitten im Jahr korrekt abgebildet wird. *(Test: simulation)*
- F1.3 Der Installationszeitpunkt der WP ist als Monat wählbar. Bis dahin entstehen die Kosten der Altanlage (mit steigenden Preisen). *(Test: simulation)*
- F1.4 Der Förderantrag wird `Vorlauf` Monate (Default 4) vor der Installation gestellt; die Förderkonditionen richten sich nach dem Antragsmonat. *(Test: funding, compare)*

### F2 – Energiepreise
- F2.1 Gas: Eingabe des **aktuellen Gesamtpreises** (ct/kWh brutto, inkl. CO₂). Der Preis ohne CO₂ wird daraus für das Startjahr abgeleitet und steigt mit eigener Rate p. a. *(Test: prices)*
- F2.2 CO₂-Aufschlag = CO₂-Preis(Jahr) × Emissionsfaktor × (1 + MwSt.). Emissionsfaktoren: Erdgas 0,201 kg/kWh, Heizöl 0,266 kg/kWh (editierbar). *(Test: prices)*
- F2.3 CO₂-Preispfad als Stützstellen „Jahr:€/t", linear interpoliert; vor der ersten/nach der letzten Stützstelle konstant. Default: 2026: 55, 2027: 65, 2028: 80, 2030: 110, 2035: 160, 2040: 200, 2045: 220 (Annahme: BEHG-Korridor 55–65 €/t bis 2027, danach EU-ETS2). *(Test: prices)*
- F2.4 Heizöl: aktueller Gesamtpreis in €/Liter (inkl. CO₂), Heizwert 10 kWh/l. *(Test: prices)*
- F2.5 Strom (WP-Tarif): Arbeitspreis ct/kWh brutto mit Steigerung p. a., Grundpreis Zähler €/Jahr, § 14a-EnWG-Netzentgeltreduzierung €/Jahr (Abzug). Option „kein separater WP-Tarif" → Haushaltsstrompreis, kein Zusatz-Grundpreis/-Zähler. *(Test: simulation)*
- F2.6 PV-Eigenverbrauch: Anteil des WP-Stroms aus eigener PV, bewertet mit der entgangenen Einspeisevergütung (ct/kWh, konstant). *(Test: simulation)*
- F2.7 Bio-Treppe (Gebäudemodernisierungsgesetz): Für einen **neu eingebauten** fossilen Kessel (Ersatzkessel im Referenzszenario) muss ab 2029 ein steigender Bio-Anteil bezogen werden. Mehrkosten = Bio-Anteil(Jahr) × Bio-Aufpreis (ct/kWh). Default-Stufen: 2029: 10 %, 2030: 15 %, 2035: 30 %, 2040: 60 %; Aufpreis 4 ct/kWh. Abschaltbar. *(Test: prices, simulation)*

### F3 – Referenzszenario (ohne WP)
- F3.1 Jährlicher Brennstoffverbrauch (Gas kWh bzw. Öl Liter), Kesselnutzungsgrad, Grundpreis Gas (€/Jahr, steigt mit Gaspreisrate), Wartung + Schornsteinfeger (€/Jahr, steigt mit allgemeiner Kostensteigerung). *(Test: simulation)*
- F3.2 Restlebensdauer der Altanlage (Jahre); danach Ersatzkessel zum heutigen Preis × Investitionskosten-Steigerung; Lebensdauer neuer Kessel (Default 20 Jahre). Neuer Kessel hat eigenen Nutzungsgrad. *(Test: simulation)*
- F3.3 Restwert: Am Ende des Betrachtungszeitraums wird der lineare Restwert neu gekaufter Anlagen (Ersatzkessel bzw. WP) gutgeschrieben (Bruttoinvestition × Restlebensdauer/Lebensdauer). Abschaltbar. *(Test: simulation)*

### F4 – Wärmepumpen-Szenario
- F4.1 Investition WP gesamt (brutto) und davon förderfähig (Default: gesamt), zuzüglich nicht förderfähiger Nebenkosten (z. B. Stilllegung Gasanschluss). Investitionskosten steigen mit Rate p. a. bis zur Installation. *(Test: simulation)*
- F4.2 Ab Installation: WP-Strom = Wärmebedarf / JAZ; Gas-Grundpreis, Gas-/Ölwartung und Schornsteinfeger entfallen; WP-Wartung €/Jahr fällt an. *(Test: simulation)*
- F4.3 Lebensdauer WP (Default 20 Jahre) für Restwert. *(Test: simulation)*
- F4.4 Fällt die Altanlage vor dem gewählten Installationszeitpunkt aus, muss auch im WP-Szenario ein Ersatzkessel gekauft werden (inkl. Warnhinweis). *(Test: simulation)*

### F5 – Förderung und Steuer
- F5.1 **KfW 458** (Zuschuss, Antragsmonat maßgeblich):
  - Grundförderung 30 % (optional: abweichender Satz ab einem Datum, z. B. für den angekündigten Wertschöpfungsbonus 2027).
  - Klimageschwindigkeitsbonus (nur selbstgenutzt, Ersatz einer funktionstüchtigen Öl-Heizung oder einer Gasheizung ≥ 20 Jahre): 16 %, ab 02/2027 halbjährlich (Feb/Aug) −4 Prozentpunkte, ab Anträgen 08/2028 entfallen.
  - Einkommensbonus (nur selbstgenutzt, zu versteuerndes Haushaltseinkommen): ≤ 30.000 € → 40 %, ≤ 40.000 € → 30 %, ≤ 50.000 € → 10 %; mit kindergeldberechtigtem Kind < 18 Grenzen +10.000 €.
  - Höchstfördersatz 70 %; 80 %, wenn der höchste Einkommensbonus-Satz (40 %) greift (Annahme aus KfW-Beispielen).
  - Förderfähige Kosten: 1. Wohneinheit 28.000 € (ab 02/2027 halbjährlich −750 €), 2.–6. WE je 15.000 €, ab 7. WE je 8.000 €. Boni gelten nur für den Kostenanteil der selbstgenutzten WE (Kosten gleichmäßig auf WE verteilt).
  - Auszahlung `n` Monate nach Installation (Default 3).
  - Effizienzbonus existiert nicht mehr (nicht modelliert).
  *(Test: funding)*
- F5.2 **§ 35c EStG**: 20 % der Kosten (max. 200.000 € Kosten, max. 40.000 € Steuerermäßigung), verteilt 7 % / 7 % / 6 % auf Abschlussjahr und zwei Folgejahre; Erstattung jeweils im Folgejahr (Monat wählbar, Default Juni). Nur selbstgenutzt, Gebäude ≥ 10 Jahre, Abschluss bis 31.12.2029 (editierbar). Optional begrenzt durch die jährliche Einkommensteuerschuld (keine Erstattung darüber hinaus, kein Vor-/Rücktrag). *(Test: tax)*
- F5.3 KfW-Zuschuss und Steuerbonus werden **nicht** kombiniert; beide Wege werden als eigenständige Szenarien gerechnet (E4). *(Test: simulation)*

### F6 – Finanzierung
- F6.1 Eigenkapitaleinsatz (€) je Szenario; Rest wird über Kredit finanziert. *(Test: simulation)*
- F6.2 KfW-Weg: Ergänzungskredit 358 (selbstgenutztes EFH, Haushalts-zVE ≤ 90.000 €) sonst 359; max. 120.000 € je WE; Annuitätendarlehen mit tilgungsfreien Anlaufjahren, Laufzeit, Zinsbindung, Anschlusszins. Ein darüber hinausgehender Rest läuft über den Bankkredit. Option: Zuschuss bei Auszahlung als Sondertilgung (verkürzt Laufzeit, Rate bleibt). *(Test: loan, simulation)*
- F6.3 Steuer-Weg: freier Bankkredit (Zins, Laufzeit, tilgungsfreie Jahre). *(Test: simulation)*
- F6.4 Opportunitätszins p. a. (Default 2 %): Alle Zahlungsströme werden monatlich mit diesem Zins aufgezinst (Endwert-Betrachtung). Bei 0 % entspricht das der einfachen Summe. *(Test: simulation)*
- F6.5 Kreditzinsen sind Annahmen (die KfW veröffentlicht tagesaktuelle Zinsen) und müssen in der UI als „bitte prüfen" gekennzeichnet sein.

### F7 – Vergleich der Installationszeitpunkte
- F7.1 Automatische Berechnung für Installationszeitpunkte ab dem gewählten Startmonat in Schritten von `x` Monaten (Default 6) für `n` Zeitpunkte (Default 9 → 0–4 Jahre). *(Test: compare)*
- F7.2 Je Zeitpunkt: Gesamtkosten KfW-Weg, Steuer-Weg, bester Weg, Differenz zur Referenz und zum sofortigen Umstieg; Darstellung als Diagramm + Tabelle. *(Test: compare)*

### F8 – Ergebnisse
- F8.1 Kennzahlen: Gesamtkosten Referenz / WP-KfW / WP-Steuer über den Betrachtungszeitraum, Ersparnis, bester Förderweg, Förderbetrag/Steuerbonus, Amortisationszeitpunkt (erster Monat, ab dem die kumulierten WP-Kosten dauerhaft ≤ Referenz sind). *(Test: simulation)*
- F8.2 Diagramme: kumulierte Kosten (alle Szenarien), jährliche Kosten, Preisentwicklung (Brennstoff/Strom je kWh Nutzwärme), Vergleich Installationszeitpunkte. *(manuell / UI-Smoke-Test)*
- F8.3 Jahrestabelle je Szenario: Energie, Grund-/Fixkosten, Wartung, Investition, Kreditauszahlung, Zinsen, Tilgung, Förderung, Steuerbonus, Restwert, Summe, kumuliert. *(Test: ui)*
- F8.4 Warnhinweise (z. B. Altanlage fällt vor Installation aus, Steuerbonus nicht möglich, Kredit über Höchstbetrag). *(Test: simulation)*

### F10 – Wichtige Ereignisse & Hinweise
Wichtige Fakten werden zusätzlich zu den Zahlen ausdrücklich ausgewiesen, damit sie wahrgenommen werden (Block „Wichtige Ereignisse & Hinweise" unter den Kennzahlen, Rauten-Markierungen im Diagramm „Kumulierte Kosten" mit Tooltip, Spalte „Ereignisse" in der Jahrestabelle). Stufen: *info*, *important* (großer Zahlungsfluss/Wendepunkt), *warning* (leicht übersehener Nachteil).
- F10.1 Zeitleiste Referenz: Kauf eines Ersatzkessels (Monat, Betrag inkl. Preissteigerung); Bio-Treppen-Stufen ab Kesselkauf mit Mehrkosten/Jahr. Im WP-Szenario: Ausfall der Altanlage vor Installation als Warnung. *(Test: events)*
- F10.2 Zeitleiste Steuer-Weg: jede Steuererstattung; die **letzte** ist hervorgehoben mit Hinweis, dass danach die Entlastung entfällt (und Kreditraten weiterlaufen). *(Test: events)*
- F10.3 Zeitleiste WP: Förderantrag, Inbetriebnahme (Investition), Auszahlung Zuschuss, Tilgungsbeginn, Ende der Zinsbindung (Anschlusszins), vollständige Tilgung bzw. Restschuld am Ende. *(Test: events)*
- F10.4 Hinweise: Klimageschwindigkeitsbonus – gesichert (mit Betrag und nächster Absenkung), ausgelaufen, später erreichbar (ab wann, welcher Satz) oder **nicht erreichbar** (Heizung erreicht das Mindestalter erst nach Auslaufen des Bonus bzw. nach Ende der Restlebensdauer); Einkommensbonus ja/nein; Begrenzung der förderfähigen Kosten mit nächster Absenkung; KfW 359 statt 358; Frist bzw. Nichtverfügbarkeit des Steuerbonus. *(Test: events)*
- F10.5 Diese Fakten werden im Warnhinweis-Block nicht doppelt angezeigt. *(Test: ui)*

### F9 – Persistenz
- F9.1 Eingaben werden automatisch im localStorage gespeichert und beim Laden wiederhergestellt. *(Test: serialize)*
- F9.2 „Link teilen": Eingaben (nur Abweichungen von den Defaults) als Base64url-JSON im URL-Hash `#s=…`; ein Link hat Vorrang vor localStorage. *(Test: serialize)*
- F9.3 JSON-Export als Datei und Import; unbekannte/fehlende Felder werden mit Defaults gemischt, ungültige Dateien abgelehnt. *(Test: serialize)*
- F9.4 „Zurücksetzen" auf Defaults. *(Test: ui)*

## 4. Nicht-funktionale Anforderungen
- N1 Rechenkern (`src/core`) ist frei von DOM-Zugriffen und vollständig unit-getestet.
- N2 Alle Förder-/Steuer-/Preisannahmen stehen zentral in `src/core/defaults.ts` mit Quelle und Stand.
- N3 Regressionstests: `npm test` muss vor jeder Änderung und danach grün sein; ein Snapshot-Test sichert die Ergebnisse des Default-Szenarios. Bewusste Ergebnisänderungen → Snapshot mit `npm test -- -u` aktualisieren und im Änderungsprotokoll begründen.
- N4 Responsive (nutzbar ab 360 px Breite), funktioniert offline nach dem Laden, keine Server-Komponente.
- N5 Hinweis in der UI: keine Finanz-/Steuerberatung, Angaben ohne Gewähr.

## 5. Quellen (abgerufen 2026-11-11)
- KfW 458: https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Heizungsf%C3%B6rderung-f%C3%BCr-Privatpersonen-Wohngeb%C3%A4ude-(458)/
- KfW Heizung: https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Energieeffizient-sanieren/Heizung/
- KfW 358/359: https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Einzelma%C3%9Fnahmen-Erg%C3%A4nzungskredit-Wohngeb%C3%A4ude-(358-359)/ (Zinsen auf der Seite nicht verfügbar → Annahmen)
- co2online BAFA/Steuer/GModG: https://www.co2online.de/foerdermittel/bafa-foerderung/
- Methodische Inspiration: https://akkudoktor.net/pub/waermepumpen-rechner (Inhalt nicht maschinenlesbar)

## 6. Offene Punkte / Annahmen zum Nachprüfen
- A1 Aktuelle Zinssätze KfW 358/359 (Defaults: 358 = 1,5 %, 359 = 3,3 %, Bank 5,0 %, Anschlusszins 4,0 %).
- A2 Ob die Degression der förderfähigen Kosten (−750 €) auch nach 2028 weiterläuft (aktuell: ja, ohne Ende).
- A3 Angekündigter Wertschöpfungsbonus ab Q1/2027 (evtl. 15 % Grund + 15 % Bonus) – über „abweichende Grundförderung ab Datum" abbildbar, Default unverändert 30 %.
- A4 Höchstfördersatz 80 % nur bei Einkommensbonus 40 % (aus KfW-Beispielen abgeleitet).
- A5 Bio-Treppe: Gilt hier nur für neu eingebaute fossile Kessel; Aufpreis Biomethan/Bioöl als Pauschale.
- A6 CO₂-Preispfad ab 2028 (EU-ETS2) ist eine Annahme.

## 7. Änderungsprotokoll
| Datum | Änderung |
|---|---|
| 2026-11-11 | Erstfassung nach Anforderungsaufnahme (E1–E12) und Recherche |
| 2026-11-11 | F10 „Wichtige Ereignisse & Hinweise" ergänzt (Anlass: Kostenspitze durch Ersatzkessel 2031 war nicht erkennbar). Rechenergebnisse unverändert. |
