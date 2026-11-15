# Quick Start – Assumptions Verification Agent

**Ziel:** Automatische Überprüfung von Förderregeln, Steuern und Energiepreisen

## 5-Minuten Setup

```bash
# 1. API-Key konfigurieren (einmalig)
cp .env.example .env.local
# → ANTHROPIC_API_KEY eintragen von https://console.anthropic.com

# 2. Testen (Report ohne Änderungen)
npm run verify:assumptions -- --dry-run

# 3. Live-Verifizierung (mit Bestätigung)
npm run verify:assumptions

# 4. Automatisch (ohne Bestätigung)
npm run verify:assumptions -- --auto-patch
```

## CLI-Befehle

| Befehl | Effekt |
|---|---|
| `npm run verify:assumptions -- --dry-run` | Report, keine Änderungen |
| `npm run verify:assumptions` | Mit Bestätigung starten |
| `npm run verify:assumptions -- --auto-patch` | Automatisch, ohne Bestätigung |
| `npm run verify:assumptions -- --verbose` | Debug-Ausgaben |
| `npm run verify:assumptions -- --skip-secondary` | Sekundärquellen auslassen |
| `npm run verify:assumptions -- --help` | Hilfe anzeigen |

## Was wird überprüft?

### ✅ HIGH-Kritikalität (Agent STOPPT bei Fehler)
- KfW 458: Grundförderung, Boni, Deckel, Degradationen
- § 35c EStG: Sätze, Limits, Deadline
- KfW 358/359: Maximalbeträge

### ⚠️ MEDIUM-Kritikalität (Agent WARNT bei Fehler)
- Energiepreise: Gas, Öl, Strom, CO₂-Pfad, Bio-Treppe
- KfW-Kreditbedingungen

### ❌ NICHT überprüft
- Bankzinsen (Marktpreis, manuell halten)
- Modell-Parameter (nicht changierend)

## Workflow (vierteljährlich)

```bash
# 1. Verifizierung starten
npm run verify:assumptions -- --dry-run

# 2. Report überprüfen (keine Überraschungen?)
# → Falls OK: weiter mit Step 3

# 3. Auto-Patch generieren
npm run verify:assumptions -- --auto-patch

# 4. Diffs prüfen
git diff data/regulations.yaml
git diff src/core/defaults.ts

# 5. Commit & PR
git add data/regulations.yaml src/core/defaults.ts
git commit -m "chore(assumptions): Quarterly update Q4 2026"
git push -u origin chore/quarterly-assumptions
gh pr create --title "chore: Quarterly assumptions update (2026-Q4)"
```

## Troubleshooting

| Problem | Lösung |
|---|---|
| `ANTHROPIC_API_KEY not found` | `cp .env.example .env.local` und Key eintragen |
| Agent hängt beim API-Call | Normal; Claude braucht Zeit zum Parsing. `Ctrl+C` zum Abbrechen. |
| `git: command not found` | git installieren (oder `gh` nutzen) |
| YAML-Fehler | `npm install js-yaml` und validieren |

## Referenzen

- **Design:** `docs/DESIGN_PLAN.md` (Architektur, 4 Phasen)
- **Implementierung:** `docs/IMPLEMENTATION.md` (Testing, Performance)
- **Regelungen:** `docs/REGULATIONS.md` (Kritikalitäten, Quellen)
- **Anforderungen:** `docs/ANFORDERUNGEN.md` (F22 = Assumptions)

## Phase 2 (geplant)

- [ ] Sondertilgungsregeln automatisch überprüfen
- [ ] Technische Werte (JAZ, Effizienzfaktoren) optional überprüfen
- [ ] Automatische PR-Erstellung (ohne manuellen Commit)
- [ ] Email-Benachrichtigungen bei Änderungen

---

**Status:** Phase 1 ✅ COMPLETE  
**Letzte Verifikation:** (sieh `data/regulations.yaml` → `verificationLog`)
