# N15 – Prüfung nach dem Deployment

- N15 Prüfung nach dem Deployment: Der Build schreibt `version.json` (Version und Commit). Nach jedem Upload prüft der Job `verify` im Deploy-Workflow ohne Secrets die ausgelieferte Seite mit einem echten Browser (`scripts/smoke-test.ts`): richtige Version und Commit, Versionsanzeige, Kennzahlen werden berechnet und reagieren auf Eingaben, Diagramme werden gezeichnet, Quellenhinweis öffnet sich, alle Seiten der Sitemap laden ohne Skript-, Konsolen- oder Ladefehler. Die Besucherstatistik wird dabei blockiert. Fehlschlag → Lauf rot. *(Test: smoke)*
