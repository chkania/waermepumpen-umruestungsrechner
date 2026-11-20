# F39 – Weg zum Angebot und zur Förderung

Ziel: Eigentümer:innen, die nach der ersten Berechnung eine Wärmepumpe anschaffen wollen, sehen auf einer Seite, in welcher Reihenfolge sie ihr Ergebnis sichern, Unterlagen zusammenstellen, Angebote einholen und prüfen, die Förderung beantragen, die Installation begleiten und die Anlage abnehmen. Die Seite ordnet mit Checklisten und verweist auf neutrale Stellen. Sie berät nicht und prüft kein Angebot. Der Inhalt steht als Markdown in `docs/ANGEBOT.md`, die Seite ist `angebot.html`.

- F39.1 Neue Seite `angebot.html` mit dem Titel „Weg zum Angebot und zur Förderung“. Der Inhalt steht als Markdown in `docs/ANGEBOT.md` und wird wie die übrigen Dokumentseiten dargestellt: `renderDocPage`, Inhaltsverzeichnis mit Sprungmarken, Hell und Dunkel, Link „← Zum Rechner“, Seitenfuß aus `DOC_LINKS`. Mindestens 600 Wörter, Ansprache mit „Sie“. *(Test: seo, ui)*
- F39.2 Sechs Schritte in dieser Reihenfolge, je als `h2` mit Checkliste (Aufzählung):
  1. Ergebnis sichern: Bericht (F30), Link mit Werten (F9.2), Export.
  2. Unterlagen für den Termin, darunter die Nachweise zu Selbstnutzung und Einkommen nach A8.
  3. Angebote einholen und prüfen: Fragen an den Anbieter, gleicher Leistungsumfang als Voraussetzung für einen Preisvergleich, Angebote als Links im Szenario ablegen (F16.4), Hinweis auf den Angebotsvergleich der Energieberatung der Verbraucherzentrale.
  4. Förderung beantragen, in der Reihenfolge des Merkblatts 458: Bestätigung zum Antrag durch Energieeffizienz-Experten oder Fachunternehmen, Vertrag mit aufschiebender oder auflösender Bedingung, Antrag vor Vorhabenbeginn, Beginn erst nach der Zusage.
  5. Installation: Fragen zur Ausführung, Zahlungsplan beim Anbieter erfragen.
  6. Abnahme mit praktischen Punkten: Unterlagen, Einweisung, Einstellung der Heizkurve, Nachweis des hydraulischen Abgleichs (falls im Angebot enthalten), Garantie- und Wartungsbedingungen, Bestätigung nach Durchführung und Auszahlung über die KfW. Keine rechtliche Einordnung; Verweis auf die Energieberatung der Verbraucherzentrale.
  *(Test: seo)*
- F39.3 Förderaussagen erscheinen nur, wenn sie in A8 belegt sind. Für alle übrigen Förderdetails, Beträge und Fristen verweist die Seite auf KfW und Merkblatt. Angaben aus A9 werden nicht übernommen. *(Test: seo, Review)*
- F39.4 Verweise nur auf neutrale Stellen: KfW (Programm 458, Merkblatt), Energieberatung der Verbraucherzentrale (Angebotsvergleich) und die dena-Expertenliste „Energieeffizienz-Experten“. Private Ratgeber werden weder verlinkt noch genannt.
  - Externe Links stehen als HTML-`<a>` in `docs/ANGEBOT.md` (marked übernimmt sie unverändert; `renderHelp` bleibt gleich).
  - Jeder externe Link hat `target="_blank"`, `rel="noopener"` und einen Titel, der auf „(öffnet in neuem Tab)“ endet, wie in F33.7.
  - Nichts wird eingebettet oder beim Laden abgefragt.
  *(Test: seo)*
- F39.5 Verbindung zum Rechner:
  - (a) Link „Weg zum Angebot“ auf `./angebot.html` in `DOC_LINKS` direkt nach „Hilfe“ und im Seitenfuß des Rechners (`p.disclaimer.license` in `app.ts`).
  - (b) Handbuch-Abschnitt `## Angebot und Förderung` mit dem Link `./angebot.html`. Er nennt auch den Kasten „Nächste Schritte“.
  - (c) Kasten „Nächste Schritte“ (`aside.card` mit `aria-labelledby`, Überschrift `h2` wie bei „Über diesen Rechner“ und „Mitmachen“). Er steht im Ergebnisbereich nach „Jahresübersicht“ und vor „Über diesen Rechner“, als statisches Markup, das nicht vom Rechenergebnis abhängt. Inhalt: der Satz „Die Seite zeigt die Schritte von der Berechnung bis zur Abnahme und ersetzt keine Beratung.“ und ein Link „Weg zum Angebot und zur Förderung“ auf `./angebot.html` ohne `target` (gleicher Tab, F15.4). Bestehende Kartenoptik, keine neuen Farbtokens. Nicht im Bericht (F30).
  *(Test: ui, help)*
- F39.6 Die Seite ist statisch: keine Eingabefelder, kein Angebotsvergleich, keine Speicherung, keine Erinnerungen, keine Häkchen. Die Checklisten sind zum Lesen und Drucken gedacht.
  - Dokumentseiten werden druckbar: Die Druckregel `body > :not(.report) { display: none }` in `src/style.css` gilt nur noch für den Rechner.
  - Beim Drucken einer Dokumentseite erscheint der Inhalt dunkel auf hellem Grund, auch wenn „Dunkel“ gewählt ist. Kopf-Werkzeugleiste und Inhaltsverzeichnis dürfen dabei entfallen.
  - Wirkt auf alle Dokumentseiten.
  *(Test: ui, manuell Druckvorschau)*
- F39.7 Hinweis vor dem ersten Schritt als `intro` in `DOC_PAGES['angebot.html']`, ohne Überschrift. Inhalt: keine Finanz-, Steuer-, Förder- oder Energieberatung; keine Prüfung von Angeboten oder Förderanträgen; Angaben ohne Gewähr; „Förderbedingungen Stand <FUNDING_SOURCE_DATE>“ (gleiche Quelle wie im Hinweis des Rechners); für verlinkte fremde Seiten gelten deren eigene Datenschutzbestimmungen. *(Test: seo, legal)*
- F39.8 Barrierefreiheit nach N7: Überschriften `h1` > `h2` (> `h3`) ohne Sprung, Checklisten als Listen, aussagekräftige Linktexte, externe Links mit Titel nach F39.4, nur bestehende Farbtokens (Hell und Dunkel), keine horizontale Scrollleiste bei 400 px Breite. *(Test: seo, manuell)*
Ergänzung zu F22.1 (in `F22-regelmaessige-pruefung-der-annahmen.md` beschrieben): Die Checkliste (`scripts/assumptions-lib.ts`, `buildChecklist`) enthält eine feste Zeile: Seite „Weg zum Angebot“ (`docs/ANGEBOT.md`) gegen Merkblatt 458 und die verlinkten Seiten prüfen (Aussagen nach A8, Linkziele). *(Test: freshness)*

## Akzeptanzkriterien

- Der vorgerenderte Container von `angebot.html` enthält genau ein `<h1>` „Weg zum Angebot und zur Förderung“ und genau sechs `<h2>` in der Reihenfolge von F39.2. Der Hinweis nach F39.7 steht vor dem ersten `<h2>`, enthält „keine Finanz-, Steuer- oder Förderberatung“ und das Datum aus `FUNDING_SOURCE_DATE` im Format TT.MM.JJJJ.
- `docs/ANGEBOT.md` hat ohne Markup mindestens 600 Wörter. Der vorgerenderte Container hat mehr als 500 Zeichen Text und genau ein `aria-current="page"` (bestehender Test F33.2, über `DOC_PAGES`).
- `DOC_LINKS` enthält `['./angebot.html', 'Weg zum Angebot']`. Der Seitenfuß des Rechners enthält `href="./angebot.html"` mit dem Text „Weg zum Angebot“.
- Nach dem ersten Rendern des Rechners (happy-dom, Standardeingaben) gilt für den Kasten mit der Überschrift „Nächste Schritte“:
  - Er steht im DOM nach „Jahresübersicht“ und vor `#ueber`.
  - Sein Link auf `./angebot.html` hat kein `target`.
  - Der Bericht (`report.ts`) enthält den Text „Nächste Schritte“ nicht.
- `index.html` (statische Einführung) verlinkt `./angebot.html` mit `title` (F33.1 und F33.5 bestehen).
- `public/sitemap.xml` enthält `https://waermepumpen-investitionsrechner.de/angebot.html`. `angebot.html` hat genau diesen Canonical-Link, einen eigenen `<title>` und eine `<meta name="description">` mit höchstens 160 Zeichen. `public/llms.txt` nennt die Seite mit absoluter Adresse.
- `src/pages/angebot-main.ts` ruft `initAnalytics('Weg zum Angebot')` auf. Die Seitenliste in `tests/analytics.test.ts` enthält `['angebot.html', 'src/pages/angebot-main.ts']`.
- Das Handbuch enthält `## Angebot und Förderung` und `[…](./angebot.html)`. `tests/help.test.ts` ist grün.
- `angebot.html` und der vorgerenderte Inhalt enthalten kein `<input>`, `<select>`, `<textarea>` oder `<form>`.
- Alle `https://`-Links im Inhaltsbereich (`main.help-content`, ohne Seitenfuß) haben einen dieser Hosts: `www.kfw.de`, `verbraucherzentrale-energieberatung.de`, `www.energie-effizienz-experten.de`. Jeder davon hat `target="_blank"`, `rel="noopener"` und einen `title`, der auf „(öffnet in neuem Tab)“ endet. Die Adressen werden bei der Umsetzung einmal von Hand aufgerufen und leiten nicht weiter.
- Jede Ziffernfolge in `docs/ANGEBOT.md` außerhalb von `href`-Werten gehört zu {1, 2, 3, 4, 5, 6, 20, 458}. Eine neue Zahl braucht einen Eintrag in A8 mit Fundstelle und eine Erweiterung der Liste im Test.
- Ohne JavaScript ist der Inhalt vollständig lesbar (vorgerendert, F33.2).
- In `src/style.css` blendet die Druckregel für den Bericht den Inhalt von Dokumentseiten (`#doc`, `#help`) nicht aus (Test auf den CSS-Text). Die Druckvorschau von `angebot.html` zeigt in Hell und Dunkel alle sechs Schritte lesbar (manuell).
- Kasten und Seite haben bei 400 px Breite keine horizontale Scrollleiste und sind in Hell und Dunkel lesbar (manuell in der Vorschau).
- Die Checkliste aus `buildChecklist` enthält die Zeile zu `docs/ANGEBOT.md` (`tests/freshness.test.ts`).

## Annahmen

- A8 (belegt; Grundlage der Förderaussagen der Seite), siehe [Annahmen](annahmen.md#a8). Die Seite nennt die Schritte, die Nachweise und die Reihenfolge des Merkblatts 458, sonst nichts. Die Aussage zu persönlichen Angaben in Link und Datei stammt aus F9.7 (`docs/anforderungen/F9-persistenz.md`), nicht aus A8.
- A9 (nicht übernommen), siehe [Annahmen](annahmen.md#a9).

## Abgrenzung

- Kein Angebotsvergleich und keine Angebotsprüfung im Rechner; keine Eingabe von Angebotspreisen oder Angebotsdateien; kein Upload.
- Keine Aussagen zu Heizlast, Gerät, Hydraulik oder Dimensionierung. Keine technischen Zielwerte (Vorlauftemperatur, Heizleistung, JAZ) als Empfehlung; Fragen an den Anbieter sind Prüffragen, keine Vorgaben.
- Keine Empfehlung für Hersteller, Modelle oder Betriebe; keine Vermittlung von Installateuren; keine Firmenliste; keine Links auf private Ratgeber oder Angebotschecker.
- Kein Förderantrag, keine Antragsvorlagen, kein Vorausfüllen von Formularen.
- Keine vollständige KfW-Regelübersicht; keine Förderung von Ländern oder Kommunen; keine Fristen oder Beträge außer A8.
- Keine Erinnerungen, Fristenwarnungen, Konten oder gespeicherten Häkchen.
- Keine eingebetteten Widgets oder Dienste, die beim Laden Daten senden.
- Nichts nach der Abnahme (Betrieb, Wartung, Gewährleistung als Rechtsfrage); Wartung kommt nur als Frage an den Anbieter vor.
- Kein neuer Eintrag im Menü der Werkzeugleiste; kein neuer Prüfpunkt im Smoketest.
- Externe Links im Handbuch (F15.4) bleiben unverändert.
- Festlegungen ohne eigene A-ID: Dateiname und Titel; Checklisten in eigenen Worten; Abnahme ohne rechtliche Einordnung; Umfang endet mit der Abnahme; keine technischen Zielwerte.
