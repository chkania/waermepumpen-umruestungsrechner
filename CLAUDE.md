# Wärmepumpen-Investitionsrechner

SPA (Vite + TypeScript, ohne UI-Framework, Chart.js) zur Wirtschaftlichkeitsrechnung Gas/Öl → Wärmepumpe.

## Vor jeder Änderung
1. `docs/ANFORDERUNGEN.md` lesen – verbindliche Anforderungen (IDs E*, F*, N*), Annahmen (A*) und Änderungsprotokoll.
2. `npm test` muss vorher und nachher grün sein (Regressionsschutz).
3. Neue/geänderte Anforderung → Dokument aktualisieren (ID, Test-Verweis, Änderungsprotokoll) und Test ergänzen.
   Neue Felder oder Bedienfunktionen auch im Benutzerhandbuch `docs/BENUTZERHANDBUCH.md` beschreiben (`tests/help.test.ts` prüft das).
4. Ändert sich ein Ergebnis bewusst, schlägt `tests/regression.test.ts` fehl → prüfen, dann `npm test -- -u` und im Änderungsprotokoll begründen.

## Struktur
- `src/core/` – reiner Rechenkern ohne DOM (monatliche Simulation):
  - `defaults.ts` – alle Förder-/Preis-/Steuerannahmen (einzige Stelle für Konditionen)
  - `sources.ts` – Herkunft jedes Standardwerts (Popover „i“); bei Änderung eines Defaults mitpflegen, neues Feld braucht Eintrag (Test erzwingt das)
  - `prices.ts` (Energiepreise, CO₂-Pfad, Bio-Treppe), `funding.ts` (KfW 458, 358/359), `tax.ts` (§ 35c), `loan.ts` (Annuitätendarlehen)
  - `validate.ts` – Grenzen/Prüfung aller Eingaben aus Link, Datei und Speicher (neues Zahlenfeld mit Schleifen-/Divisionswirkung → Grenze in `NUMBER_LIMITS`, neues Monats-/Auswahlfeld → `MONTH_FIELDS`/`SELECT_VALUES`)
  - `house.ts` – Einordnung des Hauses (F18): kWh/m², Effizienzklasse, Baualter, Sanierung, Heizlast; `prices.ts#energySplit` teilt den Verbrauch in Raumwärme/Warmwasser/Kochen (F17)
  - `simulation.ts` (Szenarien ref/kfw/tax, Amortisation), `compare.ts` (Installationszeitpunkte), `events.ts` (wichtige Ereignisse & Hinweise, F10), `tariff.ts` (Stromtarifvergleich, F13), `serialize.ts` (localStorage/Link/JSON)
- `hilfe.html` + `src/help.ts`/`help-main.ts`/`help.css` – Hilfeseite, rendert `docs/BENUTZERHANDBUCH.md`
- `lizenz.html`, `lizenzen-drittanbieter.html` + `src/pages/*` – rendern `LICENSE.md` bzw. `THIRD-PARTY-NOTICES.md`; gemeinsamer Seitenaufbau in `src/doc-page.ts` (neue Dokumentseite: HTML-Datei, Eintrag in `vite.config.ts` und `DOC_LINKS`)
- `src/ui/` – `fields.ts` (deklarative Formularfelder; neues Eingabefeld = Eintrag hier + in `types.ts`/`defaults.ts`), `app.ts`, `charts.ts`
- `tests/` – Vitest; `ui.test.ts` läuft mit happy-dom; `helpers.ts` fixiert den Stichtag 2026-11-11 und feste Testpreise (`pinPrices`/`neutral`). Markt-Defaults aktualisieren → nur Regressions-Snapshots ändern sich (`npm test -- -u`, im Änderungsprotokoll begründen).

## Version & Changelog
Semantic Versioning (N9), Quelle `package.json`. Trunk-Based: Es gibt keine gesonderten Releases und keinen Abschnitt „Unveröffentlicht“ – jeder Stand auf `main` gilt als veröffentlicht. Jede für Nutzer sichtbare Änderung erhöht deshalb im selben Commit die Version (`npm version --no-git-tag-version x.y.z`; Major = Export/Link inkompatibel, Minor = Funktion/Rechenmodell/Defaults, Patch = Fehlerkorrektur/Text/Darstellung) und bekommt in `CHANGELOG.md` oben einen Abschnitt „## x.y.z – JJJJ-MM-TT“. Mehrere Änderungen am selben Tag ohne Commit dazwischen → ein gemeinsamer Abschnitt. Nicht sichtbare Änderungen (Tests, Refactoring, Doku im Repo) brauchen keine neue Version. `tests/version.test.ts` prüft die Übereinstimmung.

## Lizenz
PolyForm Noncommercial 1.0.0 (`LICENSE.md`). Neue/aktualisierte Laufzeit-Abhängigkeit → `npm run notices` (erzeugt `THIRD-PARTY-NOTICES.md`; `tests/license.test.ts` prüft die Aktualität). Nur Abhängigkeiten mit kompatibler, freizügiger Lizenz (MIT, BSD, Apache-2.0, ISC, OFL) aufnehmen.

## Befehle
- `npm run dev` – Entwicklungsserver (Port 5173, siehe `.claude/launch.json`)
- `npm test` – alle Tests · `npm run build` – Typecheck + statischer Build nach `dist/`

## Konventionen
- Zwei Designs: `src/style.css` = Basis/„Klassisch“, `src/style-modern.css` = „Modern“ (nur Regeln unter `:root[data-design='modern']`). Neue UI-Elemente in beiden Designs und in Hell/Dunkel prüfen. Dunkle Farben nur über `:root[data-theme='dark']` (keine `prefers-color-scheme`-Media-Queries).
- Sicherheit: dynamische Texte in HTML immer mit `escapeHtml`; keine Inline-Skripte/-Event-Handler/`style="…"` im Markup (CSP aus `csp.ts` im Build). Gebauten Stand prüfen: `npm run build`, dann Vorschau „preview“ (Port 4173).
- Barrierefreiheit (N7, WCAG 2.1 AA): Farben nur über Tokens; neue Text-/Flächenfarben müssen ≥ 4,5 : 1 erreichen (`tests/a11y.test.ts` prüft die Tokens), Text auf Akzentflächen mit `--on-accent`; kein `outline: none`; neue Diagramme brauchen `role="img"`-Beschreibung und eine Tabelle in `chartTables()`; Fehler als Text, nicht nur per Farbe.
- UI-Texte Deutsch; Beträge brutto in €; Prozentwerte intern als Anteil (0.3), im Formular als % (`type: 'percent'`).
- Kostenvorzeichen: positiv = Ausgabe, negativ = Einnahme (Zuschuss, Steuerbonus, Kreditauszahlung, Restwert).
