# Wärmepumpen-Investitionsrechner

SPA (Vite + TypeScript, ohne UI-Framework, Chart.js) zur Wirtschaftlichkeitsrechnung Gas/Öl → Wärmepumpe.

## Vor jeder Änderung
1. `docs/ANFORDERUNGEN.md` lesen – verbindliche Anforderungen (IDs E*, F*, N*), Annahmen (A*) und Änderungsprotokoll.
2. `npm test` muss vorher und nachher grün sein (Regressionsschutz).
3. Neue/geänderte Anforderung → Dokument aktualisieren (ID, Test-Verweis, Änderungsprotokoll) und Test ergänzen.
4. Ändert sich ein Ergebnis bewusst, schlägt `tests/regression.test.ts` fehl → prüfen, dann `npm test -- -u` und im Änderungsprotokoll begründen.

## Struktur
- `src/core/` – reiner Rechenkern ohne DOM (monatliche Simulation):
  - `defaults.ts` – alle Förder-/Preis-/Steuerannahmen (einzige Stelle für Konditionen)
  - `sources.ts` – Herkunft jedes Standardwerts (Popover „i“); bei Änderung eines Defaults mitpflegen, neues Feld braucht Eintrag (Test erzwingt das)
  - `prices.ts` (Energiepreise, CO₂-Pfad, Bio-Treppe), `funding.ts` (KfW 458, 358/359), `tax.ts` (§ 35c), `loan.ts` (Annuitätendarlehen)
  - `simulation.ts` (Szenarien ref/kfw/tax, Amortisation), `compare.ts` (Installationszeitpunkte), `events.ts` (wichtige Ereignisse & Hinweise, F10), `tariff.ts` (Stromtarifvergleich, F13), `serialize.ts` (localStorage/Link/JSON)
- `src/ui/` – `fields.ts` (deklarative Formularfelder; neues Eingabefeld = Eintrag hier + in `types.ts`/`defaults.ts`), `app.ts`, `charts.ts`
- `tests/` – Vitest; `ui.test.ts` läuft mit happy-dom; `helpers.ts` fixiert den Stichtag 2026-11-11 und feste Testpreise (`pinPrices`/`neutral`). Markt-Defaults aktualisieren → nur Regressions-Snapshots ändern sich (`npm test -- -u`, im Änderungsprotokoll begründen).

## Befehle
- `npm run dev` – Entwicklungsserver (Port 5173, siehe `.claude/launch.json`)
- `npm test` – alle Tests · `npm run build` – Typecheck + statischer Build nach `dist/`

## Konventionen
- Zwei Designs: `src/style.css` = Basis/„Klassisch“, `src/style-modern.css` = „Modern“ (nur Regeln unter `:root[data-design='modern']`). Neue UI-Elemente in beiden Designs und in Hell/Dunkel prüfen. Dunkle Farben nur über `:root[data-theme='dark']` (keine `prefers-color-scheme`-Media-Queries).
- UI-Texte Deutsch; Beträge brutto in €; Prozentwerte intern als Anteil (0.3), im Formular als % (`type: 'percent'`).
- Kostenvorzeichen: positiv = Ausgabe, negativ = Einnahme (Zuschuss, Steuerbonus, Kreditauszahlung, Restwert).
