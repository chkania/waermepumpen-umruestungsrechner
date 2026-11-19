# Laufbuch der Agentenkette `/feature`

Je Lauf ein Abschnitt, neueste unten. Der Skill `feature` hängt ihn nach Schritt 7 an; `/feature-retro` wertet das Laufbuch aus. Tokens und Dauer aus den Abschluss-Meldungen der Agenten (Summe aller Durchgänge), gerundet.

Felder:
- **Stufen:** je Stufe Modell, Durchgänge, Tokens, Dauer.
- **Spät gefunden:** Befunde, die erst in einer späteren Stufe auffielen – mit der Stufe, die sie hätte verhindern können.
- **Nutzer:** Rückfragen und Eingriffe.
- **Notiz:** Besonderheiten des Laufs (z. B. Prozessänderungen danach).

## 2026-11-19 – F37 Gespeicherte Szenarien (PR #62)

- Stufen:
  - Anforderung (Haiku): 2 Durchgänge, 105 k, 3 min
  - Anforderungs-Review (Opus): 2 Durchgänge, 90 k, 5 min
  - Umsetzung (Haiku): 4 Runden, 385 k, 18 min
  - Code-Review (Opus): 2 Durchgänge (beide OK, nur geringe Befunde), 100 k, 4 min
  - QA (Opus): 2 Durchgänge (1. Mängel), 95 k, 8 min
- Spät gefunden:
  - Code-Review: Lesefehler des Speichers konnte beim Speichern alle Einträge ersetzen → Umsetzung.
  - Code-Review: Invariante „lesbar ⇒ Import wirft nicht“ ohne Test → Umsetzung.
  - QA: 13 Zeilen / 11 Verzweigungen in `app.ts` ohne Test, A14-Teil ohne Test → Umsetzung.
  - QA: Bundle +5,2 % ohne Begründung → Umsetzung.
  - Anforderungs-Review: 15 Befunde (u. a. Warnfenster vor Abrufen, F22.4, Datenschutz, Grenzfälle) → Anforderung.
- Nutzer: 6 Rückfragen (Anforderung), 2 (Review), 1 Push-Entscheidung.
- Notiz: Lauf vor der Verschlankung. Danach: gezielte Tests, Review nur am Diff/Delta, QA mit einem Coverage-Lauf und Basis-Messung, Sonnet für Code-Review und QA, geringe Befunde gebündelt, Berichte ≤ 30 Zeilen.
