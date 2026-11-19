---
name: feature
description: Neue Funktion von der Anforderung bis zum PR über die Agentenkette Anforderung → Anforderungs-Review → Implementierung → Code-Review → QA.
disable-model-invocation: true
---

Du steuerst die Agentenkette für die Eingabe des Nutzers (Argumente dieses Aufrufs). Subagenten können keine weiteren Agenten starten; jede Übergabe läuft über dich. Gib jedem Agenten die vollständigen Texte mit, die er braucht – er kennt diese Unterhaltung nicht. Melde dem Nutzer nach jeder Stufe in ein bis zwei Sätzen, wo die Kette steht.

## 1. Branch

`git fetch origin`. Ist das Arbeitsverzeichnis sauber, neuen Branch `feat/<kurzname>` von `origin/main` anlegen. Sonst den Nutzer fragen, ob die offenen Änderungen dazugehören.

## 2. Anforderung – `requirements-author` (Haiku)

Starte ihn mit der Eingabe des Nutzers im Wortlaut. Bei `STATUS: RÜCKFRAGEN`: die offenen Punkte per AskUserQuestion stellen und die Antworten per SendMessage an denselben Agenten geben. Wiederholen bis `STATUS: FERTIG`.

## 3. Anforderungs-Review – `requirements-reviewer` (Opus)

Übergib die fertige Anforderung samt „Hinweise für das Review“. Rückfragen wie in Schritt 2 behandeln, danach per SendMessage an den Reviewer zurück. Ergebnis ist die **geprüfte Anforderung**; zeige sie dem Nutzer und mach weiter.

## 4. Implementierung – `implementer` (Opus)

Übergib die geprüfte Anforderung. Den Agenten für die Schleifen unten per SendMessage fortsetzen, damit er seinen Kontext behält.

## 5. Code-Review – `code-reviewer` (Opus)

Übergib die geprüfte Anforderung und den Bericht des Implementierers. Bei `STATUS: ÄNDERUNGEN`: Befunde an den `implementer`, danach neues Code-Review. Nach zwei Durchgängen mit weiterhin hohen Befunden: anhalten und dem Nutzer die Befunde vorlegen.

## 6. QA – `qa` (Opus)

Übergib die geprüfte Anforderung. Bei `STATUS: MÄNGEL`: Mängel an den `implementer`, dann Schritt 5 und 6 erneut. Nach drei Durchgängen ohne Freigabe: anhalten und dem Nutzer die Mängel vorlegen.

## 7. Nach der Freigabe

Erst bei `STATUS: FREIGABE`:
1. Commit nach Conventional Commits, Beschreibung deutsch aus Nutzersicht (`CONTRIBUTING.md`).
2. Den Nutzer fragen, ob jetzt gepusht und der PR erstellt werden soll (Push nur auf seinen Wunsch, Workflow in der Memory „evening-push-workflow“). Bei Ja: Zeitstempel der ungepushten Commits auf jetzt setzen, pushen, PR mit Zusammenfassung, Ergebnisänderungen und QA-Tabelle erstellen.

Abschlussbericht an den Nutzer: geprüfte Anforderung (IDs), Durchgänge je Stufe, QA-Ergebnis, Commit bzw. PR-Link.
