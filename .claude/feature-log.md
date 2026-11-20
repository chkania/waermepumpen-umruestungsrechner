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

## 2026-11-19 – F38 Werkzeugleiste mit Menüs

- Stufen:
  - Anforderung (Haiku): 2 Durchgänge, 105 k, 3 min
  - Anforderungs-Review (Opus): 1 Durchgang (2 Runden), 84 k, 4 min
  - Umsetzung (Haiku): 3 Runden, 350 k, 13 min
  - Code-Review (Sonnet): 2 Durchgänge (1. Änderungen), 60 k, 2 min
  - QA (Sonnet): 1 Durchgang (Freigabe, mit Browserprüfung), 40 k, 2 min
- Spät gefunden:
  - Code-Review: neue CSS-Regel wirkte auf die Doku-Seiten (Leiste in eigener Zeile) → Umsetzung (Abgrenzung stand in der Anforderung).
  - Code-Review: `box-shadow` am Menüpanel trotz „ohne Schatten“ → Umsetzung.
  - Code-Review: Fokusrückgabe-Tests (Warnfenster, Export, Dateiauswahl-cancel) fehlten → Umsetzung.
  - Anforderungs-Review: 10 Befunde (zwei Dialogtexte mit altem Ort, Fokus bei abgeschaltetem Hinweis, CSS-Selektoren, Layout „darunter“) → Anforderung.
- Nutzer: 2 Rückfragen (Anforderung), 0 im Review.
- Notiz: erster Lauf nach der Verschlankung. Weniger Durchgänge und Tokens als F37 (Umsetzung 350 k statt 385 k, QA 40 k statt 95 k, Code-Review 60 k statt 100 k); die QA-Mängel aus F37 (Testlücken, Bundle-Begründung) traten nicht mehr auf.

## 2026-11-20 – F39 Weg zum Angebot und zur Förderung

- Stufen:
  - Anforderung (Haiku): 2 Durchgänge, 132 k, 5 min
  - Anforderungs-Review (Opus): 1 Durchgang (2 Runden), 128 k, 6 min
  - Umsetzung (Haiku): 3 Runden, 318 k, 11 min (Tests/Build durch Bash-Sperre nur teilweise selbst ausgeführt, Hauptsitzung übernahm)
  - Code-Review (Sonnet): 3 Durchgänge (1. und 2. Änderungen), ≈ 170 k, 3 min
  - QA (Sonnet): 1 Durchgang (Freigabe, mit Browser: 400 px, Druck, ohne JS), ≈ 60 k, 6 min
- Spät gefunden:
  - Anforderungs-Review: Reihenfolge der Förderschritte stimmte nicht mit dem Merkblatt (BzA → Vertrag → Antrag) → Anforderung (Merkblatt nicht gelesen, A16 als Lücke offen gelassen).
  - Anforderungs-Review: Dokumentseiten druckten leer (Druckregel) → Anforderung.
  - Code-Review: dieselbe Förderreihenfolge in ANGEBOT.md erneut falsch, kein Reihenfolge-Test → Umsetzung.
  - Code-Review: Leerzeichen im Seitenfuß, Aussage zum Link-Inhalt ohne Fundstelle → Umsetzung.
  - Code-Review: Druckfix im Dunkelmodus erzeugte neuen hohen Fehler (geerbte Textfarbe) → Umsetzung; nur im echten Browser nachprüfbar.
- Nutzer: 4 Rückfragen (Anforderung), 2 Zwischenfreigaben, 0 im Review.
- Notiz: Neue Freigaben (Kurzfassung, geprüfte Anforderung) vor Umsetzung eingehalten. Bash-Sperren behinderten den Implementierer; Muster zum Prüfen für die Retro: Haiku-Umsetzer ohne eigenen Testlauf.
