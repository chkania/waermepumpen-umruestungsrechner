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
- F2.1 Gas: Eingabe des **aktuellen Gesamtpreises** (ct/kWh brutto, inkl. CO₂). Der Preis ohne CO₂ wird daraus für das Startjahr abgeleitet und steigt mit eigener Rate p. a., stetig ab dem Startmonat ((1 + Rate)^(Monate/12), wie Wartung und Investitionen); der CO₂-Aufschlag folgt dem Pfad je Kalenderjahr. Gilt ebenso für Heizöl, Gas-Grundpreis, Strompreise und Zählergrundpreis. *(Test: prices)*
- F2.2 CO₂-Aufschlag = CO₂-Preis(Jahr) × Emissionsfaktor × (1 + MwSt.). Emissionsfaktoren: Erdgas 0,201 kg/kWh, Heizöl 0,266 kg/kWh (editierbar). *(Test: prices)*
- F2.3 CO₂-Preispfad als Stützstellen „Jahr:€/t", linear interpoliert; vor der ersten/nach der letzten Stützstelle konstant. Default: 2026: 55, 2027: 65, 2028: 80, 2030: 110, 2035: 160, 2040: 200, 2045: 220 (Annahme: BEHG-Korridor 55–65 €/t bis 2027, danach EU-ETS2). *(Test: prices)*
- F2.4 Heizöl: aktueller Gesamtpreis in €/Liter (inkl. CO₂), Heizwert 10 kWh/l. *(Test: prices)*
- F2.5 Strom (WP-Tarif): Arbeitspreis ct/kWh brutto mit Steigerung p. a., Grundpreis Zähler €/Jahr, § 14a-EnWG-Netzentgeltreduzierung €/Jahr (Abzug). Option „kein separater WP-Tarif" → Haushaltsstrompreis, kein Zusatz-Grundpreis/-Zähler. *(Test: simulation)*
- F2.6 PV-Eigenverbrauch: Anteil des WP-Stroms aus eigener PV, bewertet mit der entgangenen Einspeisevergütung (ct/kWh, konstant). *(Test: simulation)*
- F2.7 Bio-Treppe (Gebäudemodernisierungsgesetz): Für einen **neu eingebauten** fossilen Kessel (Ersatzkessel im Referenzszenario) muss ab 2029 ein steigender Bio-Anteil bezogen werden. Mehrkosten = Bio-Anteil(Jahr) × Bio-Aufpreis (ct/kWh). Default-Stufen: 2029: 10 %, 2030: 15 %, 2035: 30 %, 2040: 60 %; Aufpreis 4 ct/kWh. Abschaltbar. *(Test: prices, simulation)*

### F3 – Referenzszenario (ohne WP)
- F3.1 Jährlicher Brennstoffverbrauch (Gas kWh bzw. Öl Liter), Kesselnutzungsgrad, Grundpreis Gas (€/Jahr, steigt mit Gaspreisrate), Wartung + Schornsteinfeger (€/Jahr, steigt mit allgemeiner Kostensteigerung). *(Test: simulation)*
- F3.2 Restlebensdauer der Altanlage (Jahre); danach Ersatzkessel zum heutigen Preis × Investitionskosten-Steigerung; Lebensdauer neuer Kessel (Default 20 Jahre). Neuer Kessel hat eigenen Nutzungsgrad. *(Test: simulation)*
- F3.3 Restwert: Am Ende des Betrachtungszeitraums wird der lineare Restwert neu gekaufter Anlagen (Ersatzkessel bzw. WP) gutgeschrieben (Bruttoinvestition × Restlebensdauer/Lebensdauer). Ein Ersatzkessel, der im WP-Szenario vor der Installation gekauft und dann durch die WP ersetzt wurde, hat keinen Restwert. Abschaltbar. *(Test: simulation)*

### F4 – Wärmepumpen-Szenario
- F4.1 Investition WP gesamt (brutto) und davon förderfähig (Default: gesamt), zuzüglich nicht förderfähiger Nebenkosten (z. B. Stilllegung Gasanschluss). Investitionskosten steigen mit Rate p. a. bis zur Installation. *(Test: simulation)*
- F4.2 Ab Installation: WP-Strom = Wärmebedarf / JAZ; Gas-Grundpreis, Gas-/Ölwartung und Schornsteinfeger entfallen; WP-Wartung €/Jahr fällt an. *(Test: simulation)*
- F4.3 Lebensdauer WP (Default 20 Jahre) für Restwert. Ist der Betrachtungszeitraum länger, wird nach Ablauf eine Ersatz-WP zum heutigen Preis × Investitionskosten-Steigerung ohne Förderung eingerechnet (Warnung und Ereignis). *(Test: simulation, events)*
- F4.4 Fällt die Altanlage vor dem gewählten Installationszeitpunkt aus, muss auch im WP-Szenario ein Ersatzkessel gekauft werden (inkl. Warnhinweis). *(Test: simulation)*

### F5 – Förderung und Steuer
- F5.1 **KfW 458** (Zuschuss, Antragsmonat maßgeblich):
  - Grundförderung 30 %; ab Anträgen im 1. Quartal 2027 (angenommen ab 01/2027) für Wärmepumpen 15 % plus Wertschöpfungs-Bonus 15 % bei EU-Ursprung (Richtlinie Nr. 8.4.1 c, 8.4.6). Eingabe „Wärmepumpe mit Ursprung in der EU“ (Default: ja).
  - Klimageschwindigkeitsbonus (nur selbstgenutzt, Ersatz einer funktionstüchtigen Öl-Heizung oder einer Gasheizung ≥ 20 Jahre): 16 %, ab 02/2027 halbjährlich (Feb/Aug) −4 Prozentpunkte, ab Anträgen 08/2028 entfallen.
  - Einkommensbonus (nur selbstgenutzt, zu versteuerndes Haushaltseinkommen): ≤ 30.000 € → 40 %, ≤ 40.000 € → 30 %, ≤ 50.000 € → 10 %; mit kindergeldberechtigtem Kind < 18 Grenzen +10.000 €.
  - Höchstfördersatz 70 %; 80 % bei zvE bis 30.000 € bzw. 40.000 € mit Familienzuschlag (Richtlinie Nr. 8.4.1).
  - Förderfähige Kosten: 1. Wohneinheit 28.000 € (ab 02/2027 halbjährlich −750 €, Untergrenze 22.000 € ab 08/2030, Richtlinie Nr. 8.3.1 a), 2.–6. WE je 15.000 €, ab 7. WE je 8.000 €. Boni gelten nur für den Kostenanteil der selbstgenutzten WE (Kosten gleichmäßig auf WE verteilt).
  - Auszahlung `n` Monate nach Installation (Default 3). Liegt die Auszahlung nach dem Betrachtungszeitraum, wird der Zuschuss als Forderung im letzten Monat eingerechnet (wie die Ablösung einer Restschuld), mit Warnung.
  - Effizienzbonus existiert nicht mehr (nicht modelliert).
  *(Test: funding)*
- F5.2 **§ 35c EStG**: 20 % der Kosten (max. 200.000 € Kosten, max. 40.000 € Steuerermäßigung), verteilt 7 % / 7 % / 6 % auf Abschlussjahr und zwei Folgejahre; Erstattung jeweils im Folgejahr (Monat wählbar, Default Juni). Nur selbstgenutzt, Gebäude ≥ 10 Jahre, Abschluss bis 31.12.2029 (editierbar). Optional begrenzt durch die jährliche Einkommensteuerschuld (keine Erstattung darüber hinaus, kein Vor-/Rücktrag). *(Test: tax)*
- F5.3 KfW-Zuschuss und Steuerbonus werden **nicht** kombiniert; beide Wege werden als eigenständige Szenarien gerechnet (E4). *(Test: simulation)*

### F6 – Finanzierung
- F6.1 Eigenkapitaleinsatz (€) je Szenario; Rest wird über Kredit finanziert. *(Test: simulation)*
- F6.2 KfW-Weg: Ergänzungskredit 358 (selbstgenutztes EFH, Haushalts-zVE ≤ 90.000 €) sonst 359; max. 120.000 € je WE; Annuitätendarlehen mit tilgungsfreien Anlaufjahren, Laufzeit, Zinsbindung, Anschlusszins. Ein darüber hinausgehender Rest läuft über den Bankkredit. Schalter „KfW-Kredit nutzen“ (Default: ja); ohne ihn läuft der gesamte Finanzierungsbedarf über den Bankkredit, der Zuschuss bleibt unverändert. Option: Zuschuss bei Auszahlung als Sondertilgung (verkürzt Laufzeit, Rate bleibt). *(Test: loan, simulation)*
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
- F10.1 Zeitleiste Referenz: Kauf eines Ersatzkessels (Monat, Betrag inkl. Preissteigerung); Bio-Treppen-Stufen ab Kesselkauf mit Mehrkosten/Jahr. Im WP-Szenario: Ausfall der Altanlage vor Installation als Warnung; Ersatz der WP nach Ablauf der Lebensdauer (F4.3). *(Test: events)*
- F10.2 Zeitleiste Steuer-Weg: jede Steuererstattung; die **letzte** ist hervorgehoben mit Hinweis, dass danach die Entlastung entfällt (und Kreditraten weiterlaufen). *(Test: events)*
- F10.3 Zeitleiste WP: Förderantrag, Inbetriebnahme (Investition), Auszahlung Zuschuss, Tilgungsbeginn, Ende der Zinsbindung (Anschlusszins), vollständige Tilgung bzw. Restschuld am Ende. *(Test: events)*
- F10.4 Hinweise: Klimageschwindigkeitsbonus – gesichert (mit Betrag und nächster Absenkung), ausgelaufen, später erreichbar (ab wann, welcher Satz) oder **nicht erreichbar** (Heizung erreicht das Mindestalter erst nach Auslaufen des Bonus bzw. nach Ende der Restlebensdauer); Einkommensbonus ja/nein; Begrenzung der förderfähigen Kosten mit nächster Absenkung; KfW 359 statt 358; Frist bzw. Nichtverfügbarkeit des Steuerbonus. *(Test: events)*
- F10.5 Diese Fakten werden im Warnhinweis-Block nicht doppelt angezeigt. *(Test: ui)*

### F11 – Herkunft der Standardwerte
- F11.1 Jedes Eingabefeld hat einen Info-Button („i") neben der Beschriftung; er öffnet ein Popover mit dem Standardwert, der Art der Herkunft und einer Erläuterung (ggf. Link und Stand). Nur ein Popover ist gleichzeitig offen; Klick daneben oder Escape schließt. *(Test: ui)*
- F11.2 Herkunftsarten: *Offizielle Quelle* (mit Link + Stand), *Gesetz / Regelung*, *Marktdaten (recherchiert)* (mit Link + Stand), *Schätzung* (keine konkrete Erhebung, mit typischer Spanne), *Beispielwert* (eigene Angabe nötig), *Technischer Richtwert*, *Modellannahme*. Schätzungen und Annahmen müssen ehrlich als solche gekennzeichnet sein. *(Test: sources)*
- F11.3 Die Herkunft wird zentral in `src/core/sources.ts` gepflegt; jedes Feld braucht einen Eintrag, verwaiste Einträge sind unzulässig. *(Test: sources)*
- F11.4 Soweit relevant nennt das Popover zusätzlich die **offiziellen Fundstellen** mit Link (BEG-EM-Richtlinie mit Nummer, KfW-Merkblätter 458 und 358/359 mit Seite, KfW-Infoblatt mit Nummer, Gesetze mit Paragraf). Jede KfW-Förderregel (`funding.*`) muss auf Richtlinie oder Merkblatt verweisen. *(Test: sources, ui)*

### F12 – Sondertilgung aus Einmalzahlung
- F12.1 Eingaben: verfügbarer Betrag (z. B. fällige Lebensversicherung, Default 0 €), Monat der Verfügbarkeit, Ziel „automatisch (höchster Zins zuerst)“ / „KfW-Kredit“ / „Bankkredit“. Ist die Sondertilgung beim ersten Kredit nicht (vollständig) möglich, wird der andere Kredit versucht; nicht einsetzbares Geld bleibt außen vor. *(Test: prepayment)*
- F12.2 Regeln KfW 358/359 (Merkblatt S. 5): Teil-Sondertilgung nur innerhalb der ersten Zinsbindung, Mindestbetrag 5.000 €, kostenfrei; nach Ende der Zinsbindung nur vollständige Rückzahlung gegen Vorfälligkeitsentschädigung (Höhe = Annahme, Default 1 %). Gilt auch für den Zuschuss als Sondertilgung. *(Test: prepayment)*
- F12.3 Regeln Bankkredit (§ 500 Abs. 2, § 502 BGB): jederzeit ganz oder teilweise; Vorfälligkeitsentschädigung max. 1 % (Restlaufzeit ≤ 1 Jahr: 0,5 %), höchstens die entgangenen Sollzinsen (vereinfacht: Betrag × Zins × Restlaufzeit). *(Test: prepayment)*
- F12.4 Wirkung: Sondertilgung = Ausgabe (Tilgung) im Monat der Verfügbarkeit; Rate bleibt, Laufzeit verkürzt sich; beim Zinswechsel nach der Zinsbindung wird die Rate auf die tatsächlich verbleibende Laufzeit gerechnet. Vorfälligkeitsentschädigungen erscheinen als eigene Kostenkategorie (Jahrestabelle). *(Test: prepayment, loan)*
- F12.5 Ereignisse: eingesetzte Sondertilgung (Betrag, Kredit, Entschädigung, ggf. vollständig getilgt), abgelehnte Sondertilgung mit Begründung, nicht eingesetzter Rest, abgelehnte Zuschuss-Sondertilgung. *(Test: prepayment)*

### F13 – Stromkosten mit oder ohne Wärmepumpentarif
- F13.1 Block „Stromkosten: mit oder ohne Wärmepumpentarif“: Kosten des WP-Stroms im ersten vollen Betriebsjahr und über den Zeitraum ab Inbetriebnahme (nominal) für beide Varianten, günstigere Variante markiert, Ersparnis/Mehrkosten, Hinweis, ob die gewählte Variante die günstigere ist. *(Test: tariff, ui)*
- F13.2 Mit WP-Tarif: WP-Arbeitspreis + Grundpreis Zähler − § 14a-Reduzierung; ohne: Haushaltsstrompreis − § 14a-Reduzierung (Modul 1 gilt auch ohne separaten Zähler). PV-Anteil und Preissteigerung wie in der Simulation. *(Test: tariff)*
- F13.3 Schwelle: Netzbezug pro Jahr, ab dem sich der eigene Zähler lohnt = (Zählergrundpreis − zusätzliche § 14a-Pauschale) ÷ (Haushaltspreis − WP-Preis), heutige Preise. Die zusätzliche Pauschale gibt es nur, wenn sie am Haushaltszähler schon genutzt wird (F13.6); deckt sie den Grundpreis, lohnt sich der Zähler bei jedem Verbrauch. Ohne Preisvorteil: Hinweis „lohnt sich nicht“. *(Test: tariff)*
- F13.4 Jahreswerte aufklappbar; die Preisfelder beider Varianten sind immer sichtbar. *(Test: ui)*
- F13.5 Einmalige Kosten für den zweiten Zähler / Zählerschrank-Umbau (Default 0 €): fallen nur mit separatem WP-Tarif an, gehen zum Inbetriebnahmezeitpunkt in die Investition ein (nicht förderfähig → Nebenkosten/Bankkredit; optional „förderfähig“, wenn vom Fachbetrieb bestätigt). Im Tarifvergleich: Netto-Umbaukosten in der Summe „mit WP-Tarif“ und Amortisationszeit = Netto-Umbaukosten ÷ jährliche Ersparnis der laufenden Kosten. Herkunft: Infoblatt Nr. 4.1.3 (notwendige Netzanschlüsse, iMSys förderfähig), 4.1.3.2 (iMSys-Bestellpflicht); ein zweiter Zählerplatz ist nicht ausdrücklich genannt. *(Test: tariff)*
- F13.6 § 14a EnWG Modul 1 gilt je Marktlokation (Zähler), nicht je Gerät (Bundesnetzagentur). Eingabe „Haushaltszähler hat schon § 14a (z. B. Wallbox)“ (Default: nein): dann erhält die WP ohne eigenen Zähler keine zusätzliche Pauschale; mit eigenem WP-Zähler weiterhin. Wirkt in Hauptrechnung und Tarifvergleich, mit Hinweistext. *(Test: tariff, ui)*

### F14 – Design-Umschalter
- F14.1 Umschalter „Modern | Klassisch“ im Kopfbereich. Standard: Modern. Das bisherige Design bleibt als „Klassisch“ unverändert erhalten. *(Test: ui)*
- F14.2 Die Wahl wird im Browser gespeichert (`localStorage`, Schlüssel `wp-investitionsrechner:design`), ist aber keine Eingabe: nicht Teil von Link, Export/Import oder „Zurücksetzen“. Ungültige Werte → Modern. Ein Inline-Skript in `index.html` setzt das Design vor dem ersten Zeichnen (kein Aufblitzen). *(Test: ui)*
- F14.3 Modernes Design: Umsetzung ausschließlich in `src/style-modern.css` unter `:root[data-design='modern']`; eigene Farbtokens für hell und dunkel; Diagrammfarben folgen den Tokens und werden beim Umschalten neu gezeichnet. Mobil ohne horizontales Scrollen (in beiden Designs). *(manuell geprüft)*
- F14.4 Farben und Schriften angelehnt an chkania.net (Stand 11.11.2026): Hintergrund #fdfcfa, Fläche #f0eeea, Linien #e4e2dd, Text #23252a, gedämpft #5b5a53, Akzent #2864a6 / #1f4e82; Inter für Text, JetBrains Mono in Großbuchstaben für Labels, Datumsangaben, Tabellenköpfe und Zahlen; fast eckige Kanten (2–4 px), Linien statt Schatten, keine Verläufe; Marke „~wp“ im Kopf. Szenariofarben: Referenz #b4532a, KfW #2864a6, Steuer #4b7f52. Dunkelmodus (auf chkania.net nicht vorhanden) als warme, abgeleitete Variante. Schriften lokal über `@fontsource-variable/inter` und `@fontsource-variable/jetbrains-mono` (offlinefähig, kein Abruf von chkania.net). *(manuell geprüft)*
- F14.5 Schalter „Hell | Dunkel | Auto“ im Kopfbereich (Default: Auto = Browser-/Systemeinstellung). Hell/Dunkel übersteuern die Browser-Einstellung – nötig z. B. für Brave, das bei dunklem Browser-Design „dunkel bevorzugt“ meldet, auch wenn das System hell ist. Umsetzung: `data-theme='light|dark'` am `<html>` (Auto wird per JS aufgelöst und folgt Änderungen), CSS beider Designs nur noch über `:root[data-theme='dark']`, keine `prefers-color-scheme`-Media-Queries mehr. Gespeichert unter `wp-investitionsrechner:theme`, nicht Teil der Eingaben; Inline-Skript setzt das Theme vor dem ersten Zeichnen. *(Test: ui)*

### F15 – Benutzerhandbuch
- F15.1 Benutzerhandbuch in `docs/BENUTZERHANDBUCH.md`: Schnellstart, Aufbau der Oberfläche, Werkzeugleiste (Design, Hell/Dunkel, Hilfe, Link teilen inkl. Datenschutzhinweis, Export, Import, Zurücksetzen, automatisches Speichern), alle Eingabe-Abschnitte und Felder, Ergebnisbereiche, Tipps, Datenschutz. *(Test: help)*
- F15.2 Im Browser aufrufbar als eigene Seite `hilfe.html` (Vite-Mehrseiten-Build): gerendert aus dem Markdown, Inhaltsverzeichnis mit Sprungmarken (`hilfe.html#link-teilen`), gleiches Design und Hell/Dunkel wie der Rechner (folgt Änderungen im anderen Tab), mobil ohne Überlauf. Im Rechner öffnet „Hilfe“ in der Werkzeugleiste die Seite in einem neuen Tab. *(Test: help, ui)*
- F15.3 Das Handbuch muss jeden Eingabe-Abschnitt, jedes Feld (Beschriftung wie in `fields.ts`), jede Werkzeugleisten-Funktion und jeden Ergebnisbereich nennen – neue Felder/Funktionen erfordern eine Ergänzung (Test schlägt sonst fehl). *(Test: help)*

### F9 – Persistenz
- F9.1 Eingaben werden automatisch im localStorage gespeichert und beim Laden wiederhergestellt. *(Test: serialize)*
- F9.2 „Link teilen": Eingaben (nur Abweichungen von den Defaults) als Base64url-JSON im URL-Hash `#s=…`; ein Link hat Vorrang vor localStorage. *(Test: serialize)*
- F9.3 JSON-Export als Datei und Import; unbekannte/fehlende Felder werden mit Defaults gemischt, ungültige Dateien abgelehnt. *(Test: serialize)*
- F9.4 „Zurücksetzen" auf Defaults. *(Test: ui)*

## 4. Nicht-funktionale Anforderungen
- N1 Rechenkern (`src/core`) ist frei von DOM-Zugriffen und vollständig unit-getestet.
- N2 Alle Förder-/Steuer-/Preisannahmen stehen zentral in `src/core/defaults.ts`; die Herkunft jedes Standardwerts in `src/core/sources.ts` (F11).
- N3 Regressionstests: `npm test` muss vor jeder Änderung und danach grün sein; ein Snapshot-Test sichert die Ergebnisse des Default-Szenarios. Bewusste Ergebnisänderungen → Snapshot mit `npm test -- -u` aktualisieren und im Änderungsprotokoll begründen.
- N4 Responsive (nutzbar ab 360 px Breite), funktioniert offline nach dem Laden, keine Server-Komponente.
- N5 Hinweis in der UI: keine Finanz-/Steuerberatung, Angaben ohne Gewähr.

## 5. Quellen (abgerufen 2026-11-11)
- BEG-EM-Richtlinie vom 17.08.2026 (BAnz AT 27.08.2026 B1): https://www.bundesanzeiger.de/pub/publication/jLXvW09kHTQoDINAdoC/content/jLXvW09kHTQoDINAdoC/BAnz%20AT%2027.08.2026%20B1.pdf?inline
- KfW-Merkblatt 458 (Stand 09/2026, gültig ab 24.09.2026): https://www.kfw.de/PDF/Download-Center/F%C3%B6rderprogramme-(Inlandsf%C3%B6rderung)/PDF-Dokumente/6000005131_M_458.pdf
- KfW-Merkblatt 358/359 (Stand 09/2026): https://www.kfw.de/PDF/Download-Center/F%C3%B6rderprogramme-(Inlandsf%C3%B6rderung)/PDF-Dokumente/6000005135_M_358_359.pdf
- KfW-Infoblatt förderfähige Maßnahmen (Version 11.1, 11/2026): https://www.kfw.de/PDF/Download-Center/F%C3%B6rderprogramme-(Inlandsf%C3%B6rderung)/PDF-Dokumente/6000004863_Infoblatt_BEG_F%C3%B6rderf%C3%A4hige_Ma%C3%9Fnahmen.pdf
- KfW Technische FAQ BEG EM (10/2026): https://www.kfw.de/PDF/Download-Center/F%C3%B6rderprogramme-(Inlandsf%C3%B6rderung)/PDF-Dokumente/6000004864_BEG_TFAQ_EM.pdf
- KfW 458: https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Heizungsf%C3%B6rderung-f%C3%BCr-Privatpersonen-Wohngeb%C3%A4ude-(458)/
- KfW Heizung: https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Energieeffizient-sanieren/Heizung/
- KfW 358/359: https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Einzelma%C3%9Fnahmen-Erg%C3%A4nzungskredit-Wohngeb%C3%A4ude-(358-359)/ (Zinsen auf der Seite nicht verfügbar → Annahmen)
- co2online BAFA/Steuer/GModG: https://www.co2online.de/foerdermittel/bafa-foerderung/
- Methodische Inspiration: https://akkudoktor.net/pub/waermepumpen-rechner (Inhalt nicht maschinenlesbar)
- Marktdaten (recherchiert 2026-11-11): BDEW Gas-/Strompreisanalyse, Destatis, esyoil, Verivox, co2online (Wartung), Schwäbisch Hall (Kesselkosten), Fraunhofer ISE (JAZ-Feldtest), DGS (EEG-Vergütung), hausvoraus.de (KfW-Zinsen), 42watt (Modernisierungskredit), Finanztip (Biogas) – Links im Info-Popover des jeweiligen Felds.

## 6. Offene Punkte / Annahmen zum Nachprüfen
- A1 Zinssätze KfW 358/359 nur aus Sekundärquelle (hausvoraus.de, 10.11.2026): 358 = 2,2 % (interpoliert für 20 J.), 359 = 4,6 %; Bank 7,5 %; Anschlusszins 4,0 % (Annahme).
- A7 Markt-Defaults (Preise, Kosten, Wartung) stammen überwiegend aus Ratgeber- und Vergleichsportalen bzw. Verbänden (BDEW, co2online, Verivox, esyoil); für Investitionskosten gibt es keine amtliche Erhebung. Quellen je Feld in `src/core/sources.ts`. Regelmäßig (z. B. halbjährlich) aktualisieren.
- A2 Ob die Degression der förderfähigen Kosten (−750 €) auch nach 2028 weiterläuft (aktuell: ja, ohne Ende).
- A3 Wertschöpfungs-Bonus: Die Richtlinie (Nr. 8.4.1 c, 8.4.6) regelt 15 % Grundförderung + 15 % Bonus bei EU-Ursprung „ab dem ersten Quartal 2027“; Stichtag und Nachweis sind noch offen (Infoblatt Nr. 1.8). Angenommen: Anträge ab 01/2027.
- A4 ~~Höchstfördersatz 80 % aus Beispielen abgeleitet~~ – bestätigt durch Richtlinie Nr. 8.4.1 und Merkblatt 458 S. 4.
- A5 Bio-Treppe: Gilt hier nur für neu eingebaute fossile Kessel; Aufpreis Biomethan/Bioöl als Pauschale.
- A6 CO₂-Preispfad ab 2028 (EU-ETS2) ist eine Annahme.

## 7. Änderungsprotokoll
| Datum | Änderung |
|---|---|
| 2026-11-11 | Erstfassung nach Anforderungsaufnahme (E1–E12) und Recherche |
| 2026-11-11 | F10 „Wichtige Ereignisse & Hinweise" ergänzt (Anlass: Kostenspitze durch Ersatzkessel 2031 war nicht erkennbar). Rechenergebnisse unverändert. |
| 2026-11-11 | F11 Herkunfts-Popover für alle Standardwerte. Klarstellung: Preise und Kosten (z. B. Ersatzkessel) sind Schätzungen ohne konkrete Erhebung. Rechenergebnisse unverändert. |
| 2026-11-11 | Markt-Defaults recherchiert und aktualisiert: Gas 12,2 ct (vorher 11,5), Gas-Grundpreis 150 € (180), Heizöl 1,64 €/l (1,00), Wartung Gas 200 € (300) / WP 150 € (200), WP-Tarif 24 ct (26), Haushaltsstrom 37 ct (34), Einspeisung 7,7 ct (7,8), KfW 358 2,2 % (1,5), 359 4,6 % (3,3), Bank 7,5 % (5,0), Bio-Aufpreis 3 ct (4). Regressions-Snapshots bewusst aktualisiert (Default-Ersparnis KfW-Weg 39,2 → 42,1 T€). Tests nutzen feste Testpreise (`pinPrices`), damit künftige Preis-Updates nur die Snapshots betreffen. |
| 2026-11-11 | Offizielle Fundstellen (Richtlinie, Merkblätter, Infoblatt, Gesetze) in den Popovers (F11.4). Abgleich mit der Richtlinie: Untergrenze förderfähige Kosten 22.000 € ab 08/2030 ergänzt; Grundförderung WP 15 % + Wertschöpfungs-Bonus 15 % (EU-Ursprung) ab 01/2027 modelliert, neue Eingabe „Wärmepumpe mit Ursprung in der EU“; 80-%-Obergrenze bestätigt. Hilfetext korrigiert: Öl-/Gastank-Entsorgung ist förderfähig (Infoblatt Nr. 4.2.8). Default-Ergebnisse unverändert (EU-Wärmepumpe). |
| 2026-11-11 | F12 Sondertilgung aus Einmalzahlung (z. B. Lebensversicherung) mit KfW- und BGB-Regeln; Kostenkategorie Vorfälligkeitsentschädigung; Zuschuss-Sondertilgung unterliegt jetzt dem KfW-Mindestbetrag 5.000 €. Korrektur: Beim Ende der Zinsbindung wird die Annuität auf die tatsächliche Restlaufzeit gerechnet (vorher wurde eine durch Sondertilgung verkürzte Laufzeit wieder gestreckt). Default-Ergebnisse unverändert. |
| 2026-11-11 | F13 Vergleich der Stromkosten mit/ohne Wärmepumpentarif. Rechenergebnisse unverändert. |
| 2026-11-11 | F13.5 Zählerschrank-Umbau für den zweiten Zähler (einmalig, optional förderfähig) in Hauptrechnung und Tarifvergleich. Default 0 € – Ergebnisse unverändert. |
| 2026-11-11 | F13.6 § 14a-Pauschale je Zähler: vorhandene Wallbox am Haushaltszähler berücksichtigt. Default nein – Ergebnisse unverändert. |
| 2026-11-11 | F14 Design-Umschalter: modernes Design (Standard) und klassisches Design als Option. Rechenergebnisse unverändert. |
| 2026-11-11 | F14.4 Modernes Design an Farben und Schriften von chkania.net ausgerichtet (Inter, JetBrains Mono lokal eingebunden). Fix: Szenario-Auswahl der Jahrestabelle verursachte mobil horizontalen Überlauf. |
| 2026-11-11 | F14.5 Hell/Dunkel/Auto-Schalter. Anlass: In Brave erschien nur das dunkle Design, weil Brave „dunkel bevorzugt“ meldet und es keine manuelle Wahl gab. |
| 2026-11-11 | F15 Benutzerhandbuch als Markdown und eigene Hilfeseite im Browser (`hilfe.html`), Link „Hilfe“ im Rechner. |
| 2026-11-11 | Konsistenzprüfung, fünf Korrekturen: (1) kein Restwert mehr für einen Ersatzkessel, den die WP bereits ersetzt hat (F3.3; spät installierte WP wurde zu günstig gerechnet); (2) Zuschuss bzw. Steuererstattung nach Zeitraumende als Forderung im letzten Monat (F5.1/F5.2; vorher entfallen, Kredit-Restschuld aber abgelöst); (3) Tarif-Schwelle berücksichtigt die zusätzliche § 14a-Pauschale bei Wallbox (F13.3); (4) Ersatz-WP bei Betrachtungszeitraum > Lebensdauer (F4.3); (5) Energie-, Grund- und Strompreise steigen stetig ab Startmonat statt in vollen Schritten je Kalenderjahr (F2.1; vorher wirkte die Jahressteigerung bei Start im November schon ab Januar). Regressions-Snapshots bewusst aktualisiert, nur durch (5): Default-Gesamtkosten Referenz 115.827 → 114.913 €, KfW-Weg 73.698 → 73.328 €, Steuer-Weg 97.007 → 96.637 € (Ersparnis KfW-Weg 42,1 → 41,6 T€). |
| 2026-11-12 | F6.2 Schalter „KfW-Kredit nutzen“: KfW-Weg auch ohne Ergänzungskredit rechenbar (Bankkredit bzw. nur Eigenkapital). Default ja – Ergebnisse unverändert. |
