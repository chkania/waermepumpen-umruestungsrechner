# Wärmepumpen-Investitionsrechner

Rechnet den Umstieg von einer Gas- oder Ölheizung auf eine Wärmepumpe durch – mit steigenden Energie- und CO₂-Preisen,
KfW-Heizungsförderung (458), Ergänzungskredit (358/359), Bankkredit, Steuerbonus (§ 35c EStG) und einem Vergleich
verschiedener Umrüstzeitpunkte.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Regressionstests
npm run build    # statische Dateien in dist/ (z. B. für GitHub Pages)
```

Veröffentlichung auf einem Webspace per SSH: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Bedienung: [docs/BENUTZERHANDBUCH.md](docs/BENUTZERHANDBUCH.md) – im Browser unter `hilfe.html` bzw. über „Hilfe“ im Rechner.

Anforderungen, Annahmen und Quellen: [docs/ANFORDERUNGEN.md](docs/ANFORDERUNGEN.md).

Die aktuelle Version und alle Änderungen stehen in [CHANGELOG.md](CHANGELOG.md) (im Browser: `changelog.html`). Versionierung nach [Semantic Versioning](https://semver.org/lang/de/), automatisch aus den Commit-Nachrichten – Ablauf und Commit-Format in [CONTRIBUTING.md](CONTRIBUTING.md).

Keine Finanz-, Steuer- oder Förderberatung; alle Angaben ohne Gewähr.

## Mitmachen

Förderprogramme, Energiepreise und Steuerregeln ändern sich laufend – der Rechner lebt davon, dass Menschen mit Erfahrung, Fachwissen oder einfach einem wachen Blick ihn aktuell halten. Mach mit, jeder Beitrag zählt:

- **Melde Fehler oder veraltete Annahmen** – über das Formular [Fehler oder veralteter Wert](https://github.com/chkania/waermepumpen-umruestungsrechner/issues/new?template=bug_report.yml), am besten mit Quelle.
- **Bring deine Ideen ein** – fehlende Szenarien, unklare Erklärungen, bessere Darstellungen.
- **Entwickle mit** – Rechenlogik, Texte, Tests, Barrierefreiheit. Ablauf, Commit-Format und Konventionen findest du in [CONTRIBUTING.md](CONTRIBUTING.md); `CLAUDE.md` und `docs/ANFORDERUNGEN.md` beschreiben Struktur und Anforderungen.

Auch kleine Beiträge wie ein korrigierter Tippfehler oder eine geprüfte Quelle helfen – schön, wenn du dabei bist!

## Lizenz

Copyright © 2026 Christoph Kania. Veröffentlicht unter der [PolyForm Noncommercial License 1.0.0](LICENSE.md) (im Browser: `lizenz.html`):
Nutzung, Änderung und Weitergabe sind für **nicht-kommerzielle Zwecke** kostenfrei erlaubt (private Nutzung,
Forschung, Bildung, gemeinnützige Organisationen, Behörden). Für kommerzielle Nutzung ist eine gesonderte
Vereinbarung nötig. Hinweis: Das ist eine „Source available“-Lizenz, keine Open-Source-Lizenz im Sinne der OSI.

Enthaltene Bibliotheken und Schriften stehen unter eigenen Lizenzen (MIT, SIL OFL 1.1), siehe
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) (im Browser: `lizenzen-drittanbieter.html`) – nach Änderungen an den Abhängigkeiten mit `npm run notices` neu erzeugen.
