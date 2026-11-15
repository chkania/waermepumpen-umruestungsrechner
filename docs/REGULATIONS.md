# Regulations & Assumptions Verification

## Überblick

Dieses Dokument erläutert die automatisierte Verifikation von Förderregeln, Steuervergünstigungen und Marktpreisen im WP-Investitionsrechner.

**Quellcode:** `scripts/assumptions-agent/` und `data/regulations.yaml`

---

## Was wird überprüft?

### 🟢 HIGH-Kritikalität (Agent erzwingt Verifikation, Fehler = Abbruch)

Diese Regeln sind zentral für die Berechnung und werden bei Änderung sofort überprüft:

#### KfW 458: Heizungsoptimierung mit Wärmepumpe
- **Grundförderung (Grundförderung):** 30% bis 2026-12-31, dann 15% (+ 15% Wertschöpfungsbonus)
- **Klimageschwindigkeitsbonus (KGB):** 16% initial, Degression um 4% alle 6 Monate ab 2027-02, Ende 2028-08
- **Einkommensbonus:** 40/30/10% je nach Einkommen (≤30k/40k/50k€)
- **Höchstsatz:** 70% (80% für niedrigste Einkommensklasse)
- **Förderfähige Kosten (Cap 1):** 28.000€, dann Degression um 750€ alle 6 Monate bis 22.000€
- **Cap 2–6 Wohneinheiten:** 15.000€
- **Cap ≥7 Wohneinheiten:** 8.000€
- **Quellen:** KfW BEG-EM Richtlinie (offizielle PDF/Website)

#### § 35c EStG: Steuerliche Förderung
- **Förderquote:** 7% (Jahr 1), 7% (Jahr 2), 6% (Jahr 3)
- **Maximale Steuerermäßigung:** 40.000€
- **Maximale förderfähige Kosten:** 200.000€
- **Deadline:** 2029-12-31
- **Mindestalter Gebäude:** 10 Jahre
- **Quelle:** Gesetze-im-Internet (§ 35c EStG)

#### KfW 358/359: Ergänzungskredite
- **Maximale Kreditvergabe:** 120.000€ pro Wohneinheit
- **Einkommenslimit (358):** 90.000€ (zu versteuerndes Einkommen)
- **Quellen:** KfW Merkblätter (offizielle Website)

---

### 🟡 MEDIUM-Kritikalität (Agent prüft, Warnung bei Fehler, kein Abbruch)

Diese Werte sind wichtig, aber nicht kritisch für die Berechnung:

#### Energiepreise
- **Gas:** Durchschnittspreis ct/kWh, Grundgebühr €/Jahr
- **Heizöl:** Preis €/Liter, Heizwert kWh/L
- **Strom:** Haushaltspreis, Spezial-WP-Tarif
- **Quellen:** BDEW Gaspreisanalyse, BDEW Strompreisanalyse, esyoil

#### CO₂-Preise & Förderung
- **BEHG CO₂-Preis-Pfad:** 2026:55€/tCO₂, dann Steigerung
- **EEG-Einspeisevergütung:** ca. 7.7 ct/kWh
- **Biomasse-Treppe (GmoG):** 10–60% ab 2029
- **Quellen:** Umweltbundesamt (UBA), EEG-Verordnung, GmoG

#### KfW Kreditbedingungen (optional)
- **Laufzeit:** 20 Jahre (Standard, 4–35 möglich)
- **Tilgungsfreie Jahre:** 1 (1–5 möglich)
- **Zinsbindung:** 10 Jahre
- **Sondertilgung:** Mind. 5.000€ während Zinsbindung
- **Vorfälligkeitsentschädigung:** max. 1% nach Zinsbindung

---

### 🔵 LOW-Kritikalität (informativ, Agent überprüft nicht automatisch)

Diese Werte sind stabil und gehören nicht zur regelmäßigen Verifikation:

- **Kesselwirkungsgrad:** 90% (alt), 95% (neu)
- **PV-Ertrag:** 950 kWh/kWp/Jahr
- **Kochens Effizienzfaktor:** 0.55 (Gas→Strom)
- **Mehrwertsteuersatz:** 19%

---

### ⚫ notApplicable (Agent überprüft NICHT)

Diese Werte sind Marktpreise oder Modellannahmen und gehören nicht zur Agent-Aufgabe:

#### Bankzinsen
- **Problem:** Täglich changierend, extern bestimmt (Bundesbank, Bausparkassen)
- **Strategie:** Manuell alle 6 Monate aktualisieren (wenn signifikante Marktänderungen)
- **Nicht Agent-Aufgabe**

#### KfW-Sekundärquellen-Zinsen
- **Beispiel:** hausvoraus.de (täglich aktualisiert)
- **Problem:** Nicht offizielle Quelle, fragil
- **Strategie:** Nur Warnung wenn offline, kein Abbruch

#### Modellannahmen
- **Kalkulatorischer Zinssatz:** 2% p.a. (Policy, nicht Data)
- **Energieprofile:** Physikalische Jahresprofile (nicht changierend)
- **Energiepreis-Steigerung:** Annahme (2–3% p.a.), regelmäßig manuell überprüfen

---

## Wie funktioniert die Verifikation?

### Workflow beim Benutzer

```bash
# 1. Setup (einmalig)
cp .env.example .env.local
# → ANTHROPIC_API_KEY eintragen

# 2. Quartalweise Verifikation
npm run verify:assumptions

# 3. Output zeigt Ergebnisse
# ✅ OK: KfW 458 Grundförderung 30%
# ⚠️  CHANGED: Gas-Preis 12.2 → 12.8 ct/kWh (MINOR)
# ❌ FAILED: KfW-Website offline (HIGH) → ABBRUCH

# 4. Bei Änderungen: Bestätigung erfragen
# → Patches in data/regulations.yaml + src/core/defaults.ts

# 5. Review & Commit
git diff data/regulations.yaml
git add data/regulations.yaml src/core/defaults.ts
git commit -m "chore(assumptions): Q4 2026 update (agent-verified)"
```

### Fehlerbehandlung

| Szenario | Kritikalität | Verhalten |
|----------|---|---|
| KfW-Website offline | HIGH | ❌ ABBRUCH (Exit 1) |
| § 35c HTML nicht parsebar | HIGH | ❌ ABBRUCH (Exit 1) |
| Claude Confidence < 70% | HIGH | ❌ ABBRUCH (Exit 1) |
| BDEW-Website offline | MEDIUM | ⚠️ WARNUNG (Exit 0, kein Patch) |
| hausvoraus.de offline | MEDIUM (warn_only) | ⚠️ WARNUNG (Exit 0) |
| Bankzinsen Änderung | notApplicable | ⏭️ ÜBERSPRUNGEN |

### Kritikalitäts-Klassifizierung

```yaml
criticality: "high"
  # Zentral für Rechner, Richtlinie/Gesetz-basiert
  # Fehler → Abbruch
  # Beispiele: KfW 458, § 35c

criticality: "medium"
  # Wichtig für Ergebnisse, aber nicht zentral
  # Fehler → Warnung
  # Beispiele: Energiepreise, CO₂-Pfad

criticality: "low"
  # Informativ, stabil
  # Agent überprücht nicht
  # Beispiele: Kesselwirkungsgrad, PV-Ertrag

criticality: "notApplicable"
  # Marktpreise oder Modellannahmen
  # Agent überprücht NICHT
  # Beispiele: Bankzinsen, Energiepreis-Steigerung

criticality: "none"
  # Physikalische Konstanten
  # Nicht überprüfbar, nicht relevant
  # Beispiele: Energieprofile, Heizwert-Richtwerte
```

---

## Architektur

### Komponenten

```
scripts/assumptions-agent/
├── index.ts              # Haupt-Agent (Orchestrierung)
├── fetcher.ts            # HTTP + Caching
├── parser.ts             # Claude-basierte Extraktion
├── compare.ts            # Diff + Impact-Bewertung
└── patcher.ts            # YAML/TS-Updates + Audit-Trail

scripts/
└── verify-assumptions.ts # CLI-Einstiegspunkt

data/
└── regulations.yaml      # Zentrale Quelle (YAML)

docs/
└── REGULATIONS.md        # Diese Datei
```

### Datenfluss

```
1. CLI parse args → loadEnv() → loadRegulations()
2. AssumptionsAgent.verify(regulations)
3. For each field:
   - Prüfe Kritikalität + updateStrategy
   - Fetch source URL (mit Cache + Retry)
   - Parse mit Claude (LLM-Extraktion)
   - Compare old vs. new
   - Assess impact
4. Patcher.apply()
   - Update regulations.yaml
   - Update src/core/defaults.ts
   - Add verificationLog entry
   - Write files (wenn nicht dryRun)
5. Print report + exit
```

---

## CLI-Optionen

```bash
npm run verify:assumptions [OPTIONS]

--auto-patch          Patch ohne Bestätigung
--dry-run             Zeige Änderungen, schreibe keine Dateien
--verbose             Debug-Ausgaben
--include-optional    Überprüfe auch optionale Werte (Phase 2)
--skip-secondary      Überspringe Sekundärquellen
--help                Diese Nachricht
```

---

## Audit-Trail

Jede Verifikation wird in `regulations.yaml` unter `verificationLog` protokolliert:

```yaml
verificationLog:
  - date: "2026-11-15"
    agent: "assumptions-agent/1.0"
    status: "success"
    summary: "3 Änderungen, 0 Fehler, 25 übersprungen"
    changes: 3
    checkpoints:
      funding.kfw458: "✅ success"
      tax.section35c: "✅ success"
      prices: "⚠️ warning: BDEW offline"
  # ... letzte 10 Einträge
```

---

## Troubleshooting

### ❌ `.env.local not found`
```bash
cp .env.example .env.local
# → Tragen Sie ANTHROPIC_API_KEY ein
```

### ❌ `ANTHROPIC_API_KEY not set`
```bash
# Öffnen Sie .env.local und überprüfen Sie:
ANTHROPIC_API_KEY=sk-ant-v1-...  # muss vorhanden sein
```

### ❌ `regulations.yaml parse error`
```bash
# Überprüfen Sie YAML-Syntax:
npm install -g yaml-lint
yamllint data/regulations.yaml
```

### ⚠️ `Low confidence (0.65) for funding.kfw458.grundRate`
```bash
# Claude konnte den Wert nicht sicher extrahieren
# Handlungsoptionen:
# 1. Quelle überprüfen (ist sie zugänglich?)
# 2. Prompt anpassen (scripts/assumptions-agent/parser.ts)
# 3. Manuell verifizieren + .env.local setzen ANTHROPIC_TRUST=1
```

---

## Nächste Schritte (Phase 2)

- [ ] Optional-Werte überprüfen (JAZ, PV-Ertrag)
- [ ] Sondertilgungsregeln auto-verifizieren
- [ ] Automatische PR-Erstellung mit Changelog
- [ ] Slack/Mail-Benachrichtigungen
- [ ] Versionierung in regulations.yaml

---

## Kontakt & Issues

Wenn Sie Probleme mit der Agent-Verifikation haben, öffnen Sie ein Issue:
- **Titel:** `[Agent] Verification failed: <Komponente>`
- **Description:** Reproduzierungsschritte, Error-Message, Logs

Siehe: `AGENT_SETUP_GUIDE.md` für weitere Informationen.
