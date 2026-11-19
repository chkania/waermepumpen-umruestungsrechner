# Änderungsprotokoll

Neue Einträge unten anfügen (Datum, betroffene IDs, Änderung; bei bewusster Ergebnisänderung Vorher/Nachher-Werte).

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
| 2026-11-12 | F16 Bezeichnung und Bemerkungen des Szenarios; Bezeichnung im Export-Dateinamen. Rechenergebnisse unverändert. |
| 2026-11-12 | Sicherheitsprüfung: F9.5 Eingabeprüfung für Link/Import/Speicher (Schutz vor Einfrieren und lahmgelegter Rechnung), F9.6 geteilter Link überschreibt eigene Eingaben nicht mehr still, N6 Content-Security-Policy im Build. Kein Einschleusen von Code gefunden (alle Ausgaben maskiert). Rechenergebnisse unverändert. |
| 2026-11-12 | N7 Barrierefreiheit (Prüfung gegen WCAG 2.1 AA): Kontraste der Grautöne, des Erfolgs-Grüns und von Text auf Akzentflächen angehoben, Fokusrahmen im modernen Design, Fehlertexte für ungültige Eingaben, Textalternative und Datentabellen für Diagramme, Reiter mit Pfeiltasten. Rechenergebnisse unverändert. |
| 2026-11-12 | F12.6 Tilgungstermin der Sondertilgung getrennt von der Verfügbarkeit; Zinsersparnis und Übersicht in der Finanzierungskarte. Default leer – Ergebnisse unverändert. |
| 2026-11-12 | N8 Lizenz PolyForm Noncommercial 1.0.0 gewählt (Wunsch: nicht-kommerziell kostenfrei; damit „source available“, nicht OSI-Open-Source), Drittanbieter-Hinweise, Fußzeile. Rechenergebnisse unverändert. |
| 2026-11-12 | N8 Lizenzangaben zusätzlich als HTML-Seiten (`lizenz.html`, `lizenzen-drittanbieter.html`); Hilfe- und Lizenzseiten nutzen gemeinsam `src/doc-page.ts`. |
| 2026-11-12 | F17/F18 Baujahr, Wohnfläche, Sanierung, Warmwasser- und Kochanteil; Rechnung trennt Raumwärme, Warmwasser und Kochen; Karte „Einordnung des Hauses“. Regressions-Snapshots bewusst aktualisiert: Profil aus Raumwärme- und Warmwasseranteil (gerundet) sowie Gebäudealter aus dem Baujahr – nur Rundungsabweichungen. |
| 2026-11-12 | F17.3/F17.4 Investition neues Kochfeld beim Umstieg auf Strom; Hinweis zur Ersparnis, wenn weiter mit Gas gekocht wird. Default ohne Gasherd – Ergebnisse unverändert. |
| 2026-11-12 | N9 Semantic Versioning, Version 1.0.0, CHANGELOG.md und Seite `changelog.html`; Version im Rechner und im Export. |
| 2026-11-12 | F7.3 Begründung des günstigsten Umrüstzeitpunkts unter der Tabelle „Wann umrüsten?“. Ergebnisse unverändert. |
| 2026-11-14 | N9 auf Trunk-Based umgestellt: kein Abschnitt „Unveröffentlicht“, jede sichtbare Änderung bekommt sofort eine Version; F7.3 als Version 1.1.0. |
| 2026-11-14 | N9 Version und Changelog automatisch aus Conventional Commits (Release-Workflow, PR-Titel-Prüfung, `CONTRIBUTING.md`); keine manuellen Versionssprünge mehr. |
| 2026-11-14 | N10 Besucherstatistik mit Matomo (ohne Cookies, ohne URL-Hash und Szenario-Bezeichnung); CSP um `analytics.chkania.net` erweitert; Handbuch-Abschnitt Datenschutz angepasst. |
| 2026-11-14 | N11 Impressum und Datenschutzerklärung; N10 um Widerspruch (Opt-out) ergänzt, noscript-Pixel entfernt. |
| 2026-11-14 | F19 Link zum GitHub-Repository und Hinweis zur Mitarbeit (Rechner, Dokumentseiten, Handbuch, README, CONTRIBUTING). |
| 2026-11-14 | N12 Deployment-Workflow per SSH/rsync auf einen Webspace mit Anleitung `docs/DEPLOYMENT.md`. |
| 2026-11-14 | F20 Einführung beim ersten Besuch (Dialog mit Zweck, Bedienung, Link zur Hilfe; Knopf „Einführung“). |
| 2026-11-14 | F21 Weiterempfehlen per WhatsApp, Threema, E-Mail, Link und Teilen-Menü des Geräts („Andere“, z. B. Signal) (ohne Facebook/X), nur mit der Adresse des Rechners. |
| 2026-11-14 | Schaltfläche „Link teilen“ in „Link mit Werten teilen“ umbenannt, um sie vom Weiterempfehlen (nur Adresse des Rechners) zu unterscheiden. |
| 2026-11-14 | F22 vierteljährliches Prüf-Issue für die Annahmen und Hinweis im Rechner, wenn die letzte Prüfung über 6 Monate zurückliegt. |
| 2026-11-14 | Name geändert: „Wärmepumpen-Umrüstungsrechner“ (vorher Wärmepumpen-Investitionsrechner bzw. „Wärmepumpen-Rechner“ im Fenstertitel). Speicherschlüssel `wp-investitionsrechner:*` und Paketname bleiben, damit gespeicherte Eingaben erhalten bleiben. |
| 2026-11-14 | F14 Design „Klassisch“ und Design-Umschalter entfernt; „Modern“ ist das einzige Design. Gespeicherte Design-Wahl wird gelöscht. Rechenergebnisse unverändert. |
| 2026-11-14 | F23 Logo (Haus mit Umstiegskurve) in der Kopfzeile, als Favicon und als Dateien für Präsentationen; ersetzt die Marke „~wp“. |
| 2026-11-14 | F24 Schaltflächen „Alle aufklappen“ / „Alle zuklappen“ für die Eingabeabschnitte. |
| 2026-11-14 | N9 Changelog: Änderungen aus einem Squash-Merge mit mehreren Änderungen werden einzeln aufgeführt, nicht zusammengefasst. |
| 2026-11-14 | F25 CO₂-Bilanz: Kennzahl „CO₂-Einsparung“ und Eingabe „CO₂-Faktor Strommix“. Kostenergebnisse und Regressions-Snapshots unverändert. |
| 2026-11-14 | F25.4 CO₂-Bilanz berücksichtigt Ökostromtarif und heute schon bezogenen Bio-Anteil; Bio-Mehrpreis eines neuen Kessels nur für den zusätzlich nötigen Anteil. Defaults und Regressions-Snapshots unverändert. |
| 2026-11-14 | F26 Schätzung der Jahresarbeitszahl aus Heizflächen, Wärmequelle und Wärmebedarf je m², mit Erklärung, Übernehmen-Knopf und Warnung bei zu optimistischer JAZ. Ergebnisse unverändert. |
| 2026-11-14 | F27 Einflussgrößen: Sensitivitätsanalyse der wichtigsten Annahmen als Tornado-Diagramm mit Tabelle. Ergebnisse unverändert. |
| 2026-11-14 | F28 PV-Anlage im Monatsmodell (Leistung, Ertrag, Speicher, Haushaltsstrom) statt festem PV-Anteil; Anzeige der PV-Deckung je Monat. Beispiel 02 auf 8 kWp mit 5 kWh Speicher umgestellt. Defaults unverändert. |
| 2026-11-14 | F29 Diagramm „Energie je Monat“: Bedarf für Heizen, Warmwasser und Kochen gegenüber Gas/Öl und Strom in kWh. Ergebnisse unverändert. |
| 2026-11-14 | F30 Bericht zum Drucken bzw. als PDF für Energieberatung, Handwerksbetrieb oder Bank. |
| 2026-11-14 | F30.3 QR-Code im Bericht, der den Rechner mit den Eingaben öffnet; F9.2 Link mit Werten jetzt komprimiert (`#z=…`, etwa ein Drittel bis halb so lang), ältere Links `#s=…` bleiben gültig. Neue Laufzeit-Abhängigkeiten `fflate` und `uqr` (MIT). |
| 2026-11-14 | F31 Varianten vergleichen: zwei oder drei Exporte bzw. die aktuellen Eingaben mit Kennzahlen, Kostenkurven und Unterschieden nebeneinander. |
| 2026-11-14 | F19.3 Kasten „Über diesen Rechner“ mit der Entstehungsgeschichte als privates Hobbyprojekt. |
| 2026-11-15 | Name wieder „Wärmepumpen-Investitionsrechner“ (statt „Wärmepumpen-Umrüstungsrechner“): Kopf, Seitentitel, Einführung, Weiterempfehlen, Bericht, Logo-Dateien, Handbuch und rechtliche Seiten. Repository-Name, Domain und Speicherschlüssel unverändert. |
| 2026-11-15 | Handbuch, Abschnitt „Mitmachen“: Liste der geplanten Ideen (Förderprogramme der Länder und Kommunen; Wohnungseigentümergemeinschaften, Vermieter). |
| 2026-11-15 | N13 Kanonische Adresse auf allen Seiten, `robots.txt` und `sitemap.xml`; N6 um die auf dem Webspace gesetzten Sicherheits-Header ergänzt. Ergebnisse unverändert. |
| 2026-11-15 | N14 Schnellere Ladezeit: Chart.js wird nachgeladen, Quellen-Popover entstehen erst beim Öffnen. Ergebnisse unverändert. |
| 2026-11-15 | N15 Prüfung nach dem Deployment: `version.json` im Build, Job `verify` im Deploy-Workflow mit Rauchtest im Browser (`npm run smoke`). Ergebnisse unverändert. |
| 2026-11-15 | F9.2/F30.3 Link mit Werten und QR-Code im Bericht verwenden die Kurzdomain `wpir.de` (leitet auf die Hauptdomain weiter). Ergebnisse unverändert. |
| 2026-11-15 | F22.3 Vorprüfung der Annahmen mit Claude: liest Werte aus `defaults.ts` und Quellen aus `sources.ts`, nur Bericht, keine automatische Änderung. Ergebnisse unverändert. |
| 2026-11-15 | F11 Herkunft der Untergrenze der förderfähigen Kosten (22.000 € ab 01.08.2030) korrigiert: steht in der BEG-EM-Richtlinie Nr. 8.3.1, nicht auf der KfW-Seite (gefunden mit F22.3). Ergebnisse unverändert. |
| 2026-11-15 | N12.1 Deployment zeigt vor der Freigabe die Changelog-Einträge seit der Live-Version. Ergebnisse unverändert. |
| 2026-11-15 | F10.6 Hinweis, wenn der Start der Betrachtung in der Zukunft liegt (heutige Preise würden sonst ohne Steigerung bis zum Start gerechnet). Ergebnisse unverändert. |
| 2026-11-15 | F15.4 Eigene Seiten (Hilfe, Impressum, Datenschutz, Lizenzen) öffnen im selben Tab statt in einem neuen; fremde Seiten weiter in neuem Tab. |
| 2026-11-15 | F19.4 Schaltfläche „Unterstützen“ mit Dialog sowie Links zum Unterstützen (Buy Me a Coffee, PayPal) im Kasten „Mitmachen“, in README und Handbuch; Badges in der README. Ergebnisse unverändert. |
| 2026-11-15 | F19.5 Unterstützen per Überweisung mit GiroCode und „IBAN kopieren“. Ergebnisse unverändert. |
| 2026-11-15 | F9.7 Hinweis auf persönliche Daten vor „Link mit Werten teilen“ und „Export“. Ergebnisse unverändert. |
| 2026-11-15 | F9.8 Warnung vor dem Überschreiben der Eingaben bei „Import“, „Zurücksetzen“ und der Übernahme einer Variante. Ergebnisse unverändert. |
| 2026-11-15 | F17.5 Absoluter Verbrauch für Warmwasser und Kochen unter den Anteilen; F26.4 Hinweis, die JAZ zu prüfen, wenn eine Eingabe die Schätzung verschiebt. Ergebnisse unverändert. |
| 2026-11-15 | F31.3 Variantenvergleich: Die Spalte „Aktuelle Eingaben“ blieb auf dem Stand des Hinzufügens stehen und zeigte nach Änderungen im Rechner veraltete Werte (z. B. JAZ, Amortisation, CO₂-Einsparung). Sie folgt nun dem Rechner; „Stand festhalten“ behält einen Stand als feste Variante. F31.2: Eingaben, die für keine Variante gelten (Heizölpreis bei Gas), erscheinen nicht mehr unter den Unterschieden. |
| 2026-11-17 | F30.4 Bericht: Text unter dem QR-Code ist mit dem Link zum Rechner hinterlegt (in der PDF-Datei anklickbar). Ergebnisse unverändert. |
| 2026-11-17 | F32 Rechenweg: eigene Seite mit allen Zwischenwerten und Erklärungen, Link im Seitenfuß (neuer Tab) und im Handbuch, Kosten je Jahr mit aufklappbaren Monaten, CSV-Download, Link zum Teilen. Simulation liefert zusätzlich Investitionsaufteilung, Auszahlungs- und Erstattungsmonate. Ergebnisse unverändert. |
| 2026-11-17 | F33 Auffindbarkeit (nach SEO-Check): statische Einführung im Rechner und Einleitung im Rechenweg für Crawler ohne JavaScript, Dokumentseiten beim Build vorgerendert, neuer Titel und kürzere Beschreibung, Open Graph mit Vorschaubild, JSON-LD. Ergebnisse unverändert. |
| 2026-11-18 | F33.5 Einführung für Suchmaschinen nachgebessert: Gliederung mit Überschriften, nummerierte Schritte, Logo mit Alternativtext, Links mit Titel und Verweise ins Handbuch; Hell/Dunkel-Skript in eigene Datei ausgelagert. Ergebnisse unverändert. |
| 2026-11-18 | F33.6 `.htaccess` aus dem Repository (`public/.htaccess`) wird mit dem Deployment übertragen; Weiterleitung, Cache- und Sicherheitsheader unverändert. |
| 2026-11-18 | F33.7 Einführung ausgebaut: Methode und Regeln mit Quellenlinks (KfW, § 35c EStG, Umweltbundesamt), Wortzahl und Lesbarkeit verbessert. Ergebnisse unverändert. |
| 2026-11-18 | F33.8 `llms.txt` für KI-Assistenten, GitHub-Profil als Autor-Link im strukturierten Datensatz. Ergebnisse unverändert. |
| 2026-11-18 | F20.3 Einführung und Bestätigungsdialoge öffnen auf dem Smartphone oben statt mit dem Button am Ende. |
| 2026-11-18 | F33.9 Beim Laden springt die Seite nicht mehr zwischen statischer Einführung und Rechner; mit JavaScript ist die Einführung von Anfang an ausgeblendet. |
| 2026-11-18 | F16.2 Unterlagen und Links im Szenario (bis 5): reisen mit Link und Export mit, erscheinen im Bericht mit Adresse und QR-Code je Eintrag. Ergebnisse unverändert. |
| 2026-11-18 | F33.10 Schrift vorgeladen, Einführung lesbarer (kürzere Sätze), Bild mit Titel, JSON-LD mit Unicode-Escapes, Cache-Regel für theme-init.js. Ergebnisse unverändert. |
| 2026-11-18 | F32.1 Rechenweg öffnet im selben Tab wie die übrigen eigenen Seiten (vorher neuer Tab). Ergebnisse unverändert. |
| 2026-11-18 | F22.3 Annahmen nach Vorprüfung aktualisiert: Ersatzkessel 17.500 € (vorher 12.000; BKI Q3/2026 14.700 € netto Altbau), Wartung + Schornsteinfeger Gas 300 € (200; 42watt 200–400 €), Bankkredit 6,5 % (7,5; Verivox-Median 6,22 %). Herkunftstexte korrigiert (Haushaltsstrom 37,3 ct, § 35c-Höchstkosten rechnerisch, Frist nach § 52 Abs. 35a EStG), „Haushaltszähler hat schon § 14a“ als Annahme gekennzeichnet, `FUNDING_SOURCE_DATE` 2026-11-18. Regressions-Snapshots bewusst aktualisiert: Referenz 114,9 → 124,5 T€, § 35c-Weg 96,6 → 93,9 T€, KfW-Weg 73,3 → 73,4 T€. |
| 2026-11-18 | F22.4 Hinweis „Neue Standardwerte“ beim Laden gespeicherter Eingaben und beim Import, wenn Felder noch auf einem inzwischen geänderten Standard stehen; Übernehmen oder Behalten. Speicher und Export enthalten dafür `defaultsAsOf`. Ergebnisse unverändert. |
| 2026-11-18 | F34 Inbetriebnahme der Heizung als Monat statt Alter in Jahren; Mindestalter für den Klimageschwindigkeitsbonus monatsgenau, ältere Daten werden umgerechnet und gemeldet. Ergebnisse des Standardbeispiels unverändert (Standard = 22 Jahre vor dem Start). |
| 2026-11-18 | F35 Export für KI-Assistenten: Markdown-Datei mit Hinweisen für den Agenten, Ergebnissen, Rechenweg, allen Eingaben samt Standardwerten, Herkunft und Fundstellen, JSON und Monatswerten; im Export-Fenster neben „Datei (JSON)“ wählbar. Ergebnisse unverändert. |
| 2026-11-18 | F12.8 Zuschuss tilgt ohne KfW-Kredit den Bankkredit; neue Eingabe „Steuererstattungen als Sondertilgung verwenden“ (Default an). Regressions-Snapshots bewusst aktualisiert: Standardbeispiel Steuer-Weg 93,9 → 88,6 T€ (Zinsen Bankkredit 12.677 → 6.573 €), KfW-Weg und Referenz unverändert. |
| 2026-11-18 | F12.9 Kostenfreies Sondertilgungsrecht je Jahr für den Bankkredit (Anteil am Kreditbetrag oder fester Betrag). Default 0 – Ergebnisse unverändert. |
| 2026-11-18 | Bezeichnungen „Eigenkapital (Weg mit KfW-Zuschuss)“ und „Eigenkapital (Weg mit Steuerbonus)“ statt „(KfW-Weg)“/„(Steuer-Weg)“, mit Hilfetext: Das Eigenkapital des Zuschuss-Wegs gilt auch ohne KfW-Kredit (Anlass: Missverständnis, „KfW-Weg“ meine den KfW-Kredit). Ergebnisse unverändert. |
| 2026-11-18 | F36 Monatliche Belastung je Szenario und 12-Monats-Zeitraum im Vergleich zu heute; einmalige Beträge getrennt. Ergebnisse unverändert. |
| 2026-11-18 | F35.2 KI-Export enthält die monatliche Belastung (F36) und in den Hinweisen für den Agenten die Wirkung von Sondertilgungen (Rate bleibt, Laufzeit sinkt). Ergebnisse unverändert. |
| 2026-11-19 | F13.7 Laufende Kosten des intelligenten Messsystems (iMSys) mit Steuerungseinrichtung – Pflicht für die KfW-Förderung (Bestellpflicht, Infoblatt Nr. 4.1.3.2), Default 100 €/Jahr (Preisobergrenzen § 30 MsbG), in beiden WP-Szenarien mit und ohne eigenen Zähler. „Grundpreis WP-Zähler“ meint nur noch den Tarif-Grundpreis. Regressions-Snapshots bewusst aktualisiert: Default KfW-Weg 73.402 → 75.780 €, Steuer-Weg 88.609 → 90.987 € (nominal je +1.950 € = 19,5 Betriebsjahre × 100 €), Referenz unverändert. |
| 2026-11-19 | Anforderungen aufgeteilt: statt einer Datei `docs/ANFORDERUNGEN.md` jetzt `docs/anforderungen/` mit einer Datei je Anforderung (F1–F36, N1–N15, Unterpunkte jeweils in der Datei), Index `README.md` sowie `entscheidungen.md`, `annahmen.md`, `quellen.md` und diesem Änderungsprotokoll. Inhalte unverändert; `tests/requirements-docs.test.ts` prüft Index und IDs. |
| 2026-11-19 | Nummer korrigiert: „Unterlagen und Links“ (seit 1.20.0) stand als zweites F16.2 unter F35 – jetzt F16.4 in F16 (Verweise in Code und Tests angepasst). Inhalt unverändert. |
