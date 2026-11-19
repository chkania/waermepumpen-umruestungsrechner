# F20 – Einführung beim ersten Besuch

- F20.1 Beim ersten Besuch (keine gespeicherten Eingaben, Einführung noch nie geschlossen) öffnet sich ein modaler Dialog: Zweck des Rechners, Bedienung in drei Schritten (Eingaben links bzw. oben, Ergebnisse rechts bzw. darunter, Varianten sichern), Hinweis auf Berechnung im Browser und fehlende Beratung, Link zur Hilfe. *(Test: ui)*
- F20.2 Schließen per „Los geht’s“, Esc oder Klick neben den Dialog merkt sich der Browser (`localStorage`); danach ist die Einführung über „Mehr“ › „Einführung“ in der Werkzeugleiste erreichbar (F38.1). Barrierefrei als natives `<dialog>` mit Titel, Fokus auf der Hauptschaltfläche. *(Test: ui, help)*

- F20.3 Modale Dialoge (Einführung, Bestätigungen, Empfehlen, Unterstützen, Varianten, Gespeicherte Szenarien – F37.1) haben oben rechts einen Schließen-Button; er bekommt beim Öffnen den Fokus, und der Inhalt bleibt oben (sonst scrollt das Smartphone bei langen Dialogen nach unten). Keine Überschrift mit Fokus, daher kein Fokusrahmen nach dem Tippen (iOS). *(Test: ui)*
