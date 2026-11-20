# Prüfliste für Anforderungen

Gemeinsame Referenz für die Agenten `requirements-author` und `requirements-reviewer` des Plugins `chk-sdlc`. Eine Anforderung ist **vollständig**, wenn jeder Punkt beantwortet oder ausdrücklich als „betrifft nicht“ markiert ist, und **konsistent**, wenn nichts davon `docs/anforderungen/` (E*, F*, N*, A*) oder sich selbst widerspricht.

## Format der Anforderung

```
# <Titel aus Nutzersicht>
Ziel: <wer will was, warum – 1–3 Sätze>
IDs: <neue/geänderte IDs, nächste freie Nummer aus dem Index docs/anforderungen/README.md, z. B. F37, F13.8>
## Anforderungen
- <ID> <eine prüfbare Aussage je Punkt>
## Akzeptanzkriterien
- <beobachtbar oder per Test prüfbar, mit konkreten Werten/Beispielen>
## Betroffene Bereiche
- <Bereich>: <was sich ändert> (je Punkt der Liste unten; „betrifft nicht“ weglassen)
## Annahmen
- <A-ID oder Text>: <Annahme + Quelle>
## Abgrenzung
- <was ausdrücklich nicht dazugehört>
## Offene Punkte
- <nur, was der Nutzer entscheiden muss; leer = fertig>
```

## Prüfpunkte

0. **Rahmen:** Die Anforderung ist durch die „Leitplanken für neue Anforderungen“ in `docs/anforderungen/produktbeschreibung.md` gedeckt.
1. **Prüfbarkeit:** Jedes Akzeptanzkriterium ist ohne Interpretation als erfüllt/nicht erfüllt entscheidbar (Werte, Grenzfälle, Beispiel).
2. **Konsistenz mit dem Bestand:** keine Doppelung oder Widerspruch zu bestehenden IDs; betroffene bestehende IDs genannt; Begriffe wie in UI und Handbuch.
3. **Rechenkern:** Wirkung je Szenario (ref/kfw/tax), Vorzeichen (positiv = Ausgabe), Zeitpunkt (Monat), Preissteigerung ja/nein, Wirkung auf Amortisation, Vergleich der Installationszeitpunkte, monatliche Belastung (F36). Ergebnisänderung beim Default-Szenario benannt (Regressions-Snapshots).
4. **Eingaben:** Feld, Einheit, Default mit Herkunft (`sources.ts`), Grenzen (`validate.ts`), Sichtbarkeit; geänderter Default → `default-history.ts`.
5. **Daten & Formate:** localStorage, Link (`#z=`), JSON-Export/-Import; ältere Daten bleiben lesbar oder Breaking Change ist benannt (Major).
6. **Ausgaben:** Ergebnisbereiche, Rechenweg (F32), KI-Export (F35), Bericht/Druck, Ereignisse & Hinweise (F10).
7. **Grenzfälle & Fehler:** leer, 0, Maximalwerte, ungültige/fehlende Daten, Speicher voll oder nicht verfügbar; Fehlermeldung als Text.
8. **Barrierefreiheit & Darstellung:** Vorgaben aus N7 und `CLAUDE.md` (Konventionen) erfüllt; Hell und Dunkel, Breite 400 px.
9. **Datenschutz & Sicherheit:** Vorgaben aus N6, N10, N11 und `CLAUDE.md` (Sicherheit); neue Datenverarbeitung → Datenschutzerklärung und CSP.
10. **Dokumentation:** Pflegeregeln in `docs/anforderungen/README.md`, Handbuch-Abschnitt, Commit-Typ nach `CONTRIBUTING.md`.
11. **Sprache:** Konventionen in `CLAUDE.md` (Sprache, Ansprache, Beträge).
