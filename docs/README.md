# Dokumentation – Wärmepumpen-Investitionsrechner

Überblick aller Dokumentationsdateien für das Projekt.

## 📋 Nutzerdokumentation

| Datei | Inhalt | Für wen? |
|---|---|---|
| **QUICKSTART.md** | 5-Min Setup, CLI-Befehle, Workflow | Alle Nutzer |
| **BENUTZERHANDBUCH.md** | Funktionsbeschreibung, Anleitung | End-User |
| **ANFORDERUNGEN.md** | Funktionale Anforderungen (F1–F30) | Entwickler, Product Owner |

## 🤖 Agent-Dokumentation (Phase 1)

| Datei | Inhalt | Zweck |
|---|---|---|
| **REGULATIONS.md** | Überprüfte Regelungen, Kritikalitäten, Fehlerbehandlung | Agent-Betrieb |
| **QUICKSTART.md** | Quick Start für Agent | Erste Schritte |
| **DESIGN_PLAN.md** | Vollständiger Plan, Architektur, 4 Phasen | Design-Referenz |
| **IMPLEMENTATION.md** | Technischer Report: Testing, Performance, Debugging | Entwicklung Phase 2+ |

## 🔒 Rechtliches & Projekt

| Datei | Inhalt |
|---|---|
| **DATENSCHUTZ.md** | Datenschutzerklärung |
| **IMPRESSUM.md** | Impressum & Kontakt |
| **DEPLOYMENT.md** | Deployment-Anleitung |

## 🚀 Schnelleinstieg

**Erstes Mal?**
1. Lese: **QUICKSTART.md** (5 Min)
2. Starte: `npm run verify:assumptions -- --dry-run`
3. Fragen? → Siehe **REGULATIONS.md**

**Developer?**
1. Lese: **ANFORDERUNGEN.md** (F22 = Assumptions)
2. Lese: **DESIGN_PLAN.md** (Architektur)
3. Lese: **IMPLEMENTATION.md** (Tech Details)
4. Sieh: `scripts/assumptions-agent/` (Code)

**Phase 2 Planung?**
1. Lese: **DESIGN_PLAN.md** Abschnitt 6–8 (Phase 2–4)
2. Starte Issue/PR mit Labels `agent-phase2`

---

**Hauptprojekt-Doku:** Siehe `../README.md`
