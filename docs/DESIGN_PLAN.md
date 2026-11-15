# Agent-basierte Annahmen-Verifikation – Detaillierter Plan (AKTUALISIERT)

## Ziel
Quartalweise (manuell lokal) Förderregeln, Gesetze und Marktdaten automatisch gegen offizielle Quellen prüfen und in strukturierter Form (`data/regulations.yaml`) sowie im Code (`src/core/defaults.ts`) aktualisieren. Der Agent erkennt intelligente Mismatches, bewertet Impact, und generiert einen Git-Patch zur Überprüfung vor dem Push.

## Entscheidungen (getroffen)

| Punkt | Entscheidung |
|---|---|
| **Update-Strategie** | Automatisch in YAML + `defaults.ts`, Nutzer reviewt Git-Diff |
| **Fehlerbehandlung** | KfW/§35c/Sondertilgung: Abbruch; Bankzinsen: NICHT überprüft; Preise: Warnung |
| **Schwellwerte** | Satz >0,5 % oder Datum geändert = MAJOR |
| **Quellen-Ausfall** | Kritische Quellen (KfW, § 35c): Abbruch; sekundäre/optional: Warnung |
| **Häufigkeit** | Manuell lokal, vierteljährlich (Jan/Apr/Jul/Okt) |
| **Archivierung** | Letzte 10 Verifikationen in `verificationLog` |
| **User-Setup** | Jeder Nutzer `.env.local` mit `ANTHROPIC_API_KEY` |
| **Git-Workflow** | Feature-Branch `chore/quarterly-assumptions` → PR → Merge |
| **Abdeckung** | 70 % der kritischen Annahmen; Bankzinsen + Modell-Parameter ausgeschlossen |

---

## Architektur

### Neue Dateien
```
wpinvestitionsrechner/
├── data/
│   └── regulations.yaml              # Regelungen + Quellen + Audit-Trail
├── scripts/
│   ├── verify-assumptions.ts         # CLI: npm run verify:assumptions
│   └── assumptions-agent/
│       ├── index.ts                  # Orchestrierung
│       ├── fetcher.ts                # HTTP + Caching
│       ├── parser.ts                 # LLM-Extraktion (Claude)
│       ├── compare.ts                # Diff + Impact-Bewertung
│       └── patcher.ts                # Git-Diffs generieren
├── docs/
│   └── REGULATIONS.md                # Dokumentation
└── .env.example                      # ANTHROPIC_API_KEY (template)
```

### CLI-Workflow beim Nutzer

```bash
# Vorbereitung (1x)
cp .env.example .env.local
# → ANTHROPIC_API_KEY eintragen

# Quartalweise Verifizierung
npm run verify:assumptions

# Output:
#   ✅ KfW 458 Grundförderung: 30 % (verifiziert 2026-11-15)
#   ⚠️  KfW 458 KGB: Degradation ✓
#   ❌ Gas-Preis: 12,2 → 12,8 ct/kWh (MINOR)
#   ❌ KfW Quelle offline → ABBRUCH

git diff data/regulations.yaml
git diff src/core/defaults.ts

# Commit + PR
git add data/regulations.yaml src/core/defaults.ts
git commit -m "chore(assumptions): Q4 2026 update (agent-verified)"
gh pr create --title "chore: Quarterly assumptions update (2026-Q4)"
```

---

## 1. Struktur `data/regulations.yaml`

Schema: Regelungen mit Quellenlinks, aktuellen Werten, Gültigkeitsfenster, Verifikationsdatum.

```yaml
# Beispiel-Struktur (vollständige YAML wird in Phase 1 genau definiert)

funding:
  kfw458:
    grundRate:
      value: 0.30
      description: "Grundförderung für Wärmepumpen (alt)"
      validUntil: "2026-12-31"
      validFrom: null
      criticality: "high"           # ← HOCH (KfW-Richtlinie)
      source:
        url: "https://www.kfw.de/inlandsfoerderung/foerderprodukte/BEG-Einzelmassnahmen-(EM).html"
        reference: "KfW BEG-EM Richtlinie Nr. 8.4.1 c"
      lastVerified: "2026-11-11"
      lastVerifiedBy: "agent"

    # weitere KfW 458 Parameter (grundRateNew, wsbRate, kgbRate, Degradationen, etc.)

  kfw358:
    description: "KfW-Ergänzungskredit 358 für KfW 458 Förderung"
    criticality: "high"
    maxPerUnit: 120000
    incomeLimit: 90000
    # ---- NEUE STRUKTUR: Kreditbedingungen ----
    terms:
      termYears:
        value: 20
        description: "Standard-Laufzeit (wählbar 4–35 Jahre)"
        source:
          url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Foerderprodukte/Einzelmassnahmen-Ergaenzungskredit-Wohngeb%C3%A4ude-(358-359)/"
          reference: "KfW 358 Merkblatt"
        lastVerified: "2026-11-11"
      graceYears:
        value: 1
        description: "Tilgungsfreie Anlaufjahre (1–5 möglich)"
        source:
          reference: "KfW 358 Merkblatt"
      fixedYears:
        value: 10
        description: "Zinsbindungsfrist"
        source:
          reference: "KfW 358 Merkblatt"
    # ---- NEUE STRUKTUR: Sondertilgungsregeln ----
    prepayment:
      minAmount: 5000
      description: "Sondertilgungs-Minimum während Zinsbindung (€)"
      feeAfterFixing: 0.01
      description2: "Vorfälligkeitsentschädigung nach Zinsbindung (max. 1 %)"
      criticality: "medium"         # ← MEDIUM (KfW Merkblatt)
      source:
        url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/Foerderprodukte/Einzelmassnahmen-Ergaenzungskredit-Wohngeb%C3%A4ude-(358-359)/"
        reference: "KfW 358 Merkblatt S. 5"
      lastVerified: "2026-11-11"
      # ← Phase 2: Agent überprüft diese Werte (optional)

  # KfW 359 ähnlich wie 358

tax:
  section35c:
    # wie im Original-Plan definiert
    criticality: "high"

prices:
  gas:
    # wie im Original-Plan definiert
    criticality: "medium"           # ← Marktdaten, teilweise verfügbar

# ---- NEUE STRUKTUR: Bankzinsen (NICHT überprüfbar) ----
financing:
  bankRate:
    value: 0.075
    description: "Bankkredit Zinssatz (Marktpreis, nicht überprüfbar)"
    criticality: "notApplicable"    # ← NICHT Agent-Aufgabe
    updateStrategy: "manual"
    updateFrequency: "6 months"     # Empfehlung
    notes: |
      Dieser Wert ist ein reiner Marktpreis (BBk-Daten, Bausparkassen).
      Der Agent überprüft ihn NICHT automatisch.
      Manuelle Aktualisierung alle 6 Monate oder bei signifikanten Marktänderungen empfohlen.
    source:
      url: "https://www.bundesbank.de"
      reference: "Bundesbank Kreditzinsen Haushalt"
    lastVerified: "2026-11-11"
    lastVerifiedBy: "manual"

  bankTermYears:
    value: 15
    criticality: "notApplicable"
    notes: "Modellannahme, nicht changierend"

  bankGraceYears:
    value: 0
    criticality: "notApplicable"
    notes: "Modellannahme, nicht changierend"

  kfwRate358:
    value: 0.022
    description: "KfW 358 Sollzins (Sekundärquelle, täglich changierend)"
    criticality: "medium"
    updateStrategy: "warn_only"     # Nur Warnung, wenn offline
    source:
      url: "https://hausvoraus.de/kfw-kreditzinsen"
      reference: "hausvoraus.de (Sekundärquelle, nicht offizielle KfW)"
    lastVerified: "2026-11-10"
    lastVerifiedBy: "agent"
    notes: "KfW veröffentlicht tagesaktuelle Zinsen. Dieser Agent nutzt Sekundärquelle und warnt nur bei Ausfällen."

# ---- NEUE STRUKTUR: Technische Richtwerte (optional überprüfbar) ----
technical:
  heatPump:
    jaz:
      value: 3.3
      description: "Jahresarbeitszahl (JAZ) Luft/Wasser-WP im Altbau"
      criticality: "medium"
      updateStrategy: "optional"    # Optional: Fraunhofer ISE jährlich
      source:
        url: "https://www.ise.fraunhofer.de/de/presse-und-medien/news/2024/waermepumpenfeldstest-zwischenergebnisse-bestaetigen-effizienten-betrieb-auch-im-altbau.html"
        reference: "Fraunhofer ISE Feldtest WP-QS im Bestand (2024–2025)"
      lastVerified: "2025"          # Jährlich
      notes: "Wird jährlich aktualisiert. Agent kann Fraunhofer-Website prüfen (optional, Phase 2)."

    pvYield:
      value: 950
      unit: "kWh/kWp/Jahr"
      description: "Typischer PV-Ertrag (Mittelwert Deutschland)"
      criticality: "low"
      updateStrategy: "not_planned"  # Nicht geplant
      source:
        reference: "Schätzung basierend auf regional typical values"
      notes: "Regionale Variation zu groß; nicht automatisch überprüfbar."

  oldHeating:
    boilerEfficiency:
      value: 0.9
      description: "Jahresnutzungsgrad Brennwertkessel (alt)"
      criticality: "low"
      updateStrategy: "not_planned"
      source:
        reference: "Technischer Richtwert (DIN, BAFA)"
      notes: "Industriestandard; sehr stabil."

    replacementBoilerEfficiency:
      value: 0.95
      description: "Jahresnutzungsgrad neuer Brennwertkessel"
      criticality: "low"
      updateStrategy: "not_planned"

  prices:
    oilKwhPerLiter:
      value: 10
      description: "Heizwert Heizöl EL (kWh/Liter)"
      criticality: "low"
      updateStrategy: "not_planned"
      source:
        reference: "DIN 51603-1, BAFA"

    cookingElecFactor:
      value: 0.55
      description: "Effizienzfaktor: Gas-kWh → Strom-kWh (Induktion)"
      criticality: "low"
      updateStrategy: "not_planned"
      source:
        reference: "Schätzung: Gasflamme ~40–55 % Effizienz, Induktion ~80–90 %"

# ---- NEUE STRUKTUR: Energieprofile (nicht changierend) ----
profiles:
  # Diese werden nicht überprüft (physikalische Jahresprofile)
  heatProfile:
    description: "Monatliches Anteil-Profil Wärmebedarf (Jan–Dez), Summe = 1"
    criticality: "none"             # ← Nicht überprüfbar
    updateStrategy: "not_planned"
  dhwProfile:
    description: "Monatliches Anteil-Profil Warmwasser"
    criticality: "none"
  spaceHeatingProfile:
    description: "Monatliches Anteil-Profil Raumwärme (abgeleitet)"
    criticality: "none"

# ---- NEUE STRUKTUR: Modell-Parameter (nicht changierend) ----
general:
  opportunityRate:
    value: 0.02
    description: "Kalkulatorischer Zinssatz für Endwert-Betrachtung"
    criticality: "none"             # Nicht changierend
    updateStrategy: "not_planned"
    notes: "Modellannahme; gehört zur Szenario-Logik, nicht zur Regelwerk."

  costIncrease:
    value: 0.02
    description: "Jährliche Steigerung laufende Kosten (pauschal)"
    criticality: "none"

  investIncrease:
    value: 0.02
    description: "Jährliche Steigerung Investitionskosten"
    criticality: "none"

  residualValue:
    value: true
    description: "Restwert-Gutschrift am Ende des Betrachtungszeitraums"
    criticality: "none"

  vat:
    value: 0.19
    description: "Mehrwertsteuersatz"
    criticality: "low"             # Gesetzlich, aber stabil
    updateStrategy: "not_planned"
    source:
      reference: "§ 12 UStG (aktuell 19 %)"

# ---- PHASE 2 (optional): Validierungsschema ----
# Hinweis: INPUT_VALIDATION (NUMBER_LIMITS) wird separat gepflegt
# Siehe: src/core/validate.ts, docs/REGULATIONS.md

verificationLog:
  - date: "2026-11-11"
    agent: "assumptions-agent/1.0"
    status: "success"
    summary: "Alle Quellen erreichbar, keine kritischen Änderungen"
    changes: 0
    checkpoints:
      - kfw458: "✅ vollständig überprüft"
      - section35c: "✅ vollständig überprüft"
      - prices: "⚠️ BDEW offline, Warnungen ausgegeben"
      - kfwZinsen: "⚠️ Sekundärquelle, nur Warnung"
      - bankZinsen: "⏭️ nicht überprüft (Marktpreis)"
      - technicalValues: "⏭️ nicht überprüft (optional)"
```

---

## 2. Agent-Komponenten

### `scripts/verify-assumptions.ts`

CLI-Einstiegspunkt mit erweiterten Optionen:

```typescript
npm run verify:assumptions [--auto-patch] [--dry-run] [--include-optional]

interface CLIOptions {
  autoPatch: boolean;             // Auto-Patch generieren ohne Bestätigung
  dryRun: boolean;                // Nur Report, keine Änderungen
  verbose: boolean;               // Detaillierte Logs
  includeOptional: boolean;       // Auch optionale Werte prüfen (Phase 2)
  skipSecondary: boolean;         // Sekundärquellen überspringen
}

// Ablauf:
// 1. loadEnv('.env.local') → ANTHROPIC_API_KEY
// 2. loadCurrentRegulations('data/regulations.yaml')
// 3. agent.verify(options) → Report mit Kritikalitäten
// 4. Falls kritisch fehlgeschlagen: exit(1), kein Patch
// 5. Falls Warnungen: in Output zeigen, aber weiterfahren
// 6. Falls Änderungen: Bestätigung erfragen (außer --auto-patch)
// 7. patcher.apply() → Git-Diff sichtbar
// 8. verificationLog aktualisieren
// 9. exit(0)
```

### `scripts/assumptions-agent/index.ts`

Orchestrierung mit Kritikalitäts-Handling:

```typescript
interface VerificationResult {
  timestamp: string;
  checkpoints: {
    [key: string]: {
      status: 'success' | 'warning' | 'failed';
      message: string;
      criticality: 'high' | 'medium' | 'low' | 'notApplicable' | 'none';
    };
  };
  unchanged: RegulationCheckResult[];
  changed: RegulationCheckResult[];
  failed: RegulationCheckResult[];    // Quellen offline
  skipped: RegulationCheckResult[];   // NotApplicable (z. B. Bankzinsen)
  summary: {
    totalChecked: number;
    totalChanged: number;
    totalFailed: number;
    totalSkipped: number;
  };
}

class AssumptionsAgent {
  async verify(regulations: Regulations, options?: CLIOptions): Promise<VerificationResult> {
    const results: VerificationResult = { ... };
    
    for (const [key, regulation] of flattenRegulations(regulations)) {
      // NEUE LOGIK: Kritikalität und updateStrategy prüfen
      if (regulation.criticality === 'none' || regulation.criticality === 'notApplicable') {
        results.skipped.push({ key, reason: `criticality=${regulation.criticality}` });
        continue;
      }

      if (regulation.criticality === 'notApplicable') {
        // Bankzinsen, Marktpreise → nicht überprüfen
        results.skipped.push({ key, reason: 'notApplicable (Marktpreis)' });
        continue;
      }

      if (regulation.updateStrategy === 'not_planned') {
        // Technische Profile, Modell-Parameter → nicht überprüfen
        results.skipped.push({ key, reason: `updateStrategy=not_planned` });
        continue;
      }

      if (regulation.updateStrategy === 'optional' && !options?.includeOptional) {
        // Technische Werte (Phase 2) → nur mit --include-optional
        results.skipped.push({ key, reason: 'optional, use --include-optional' });
        continue;
      }

      try {
        const source = await fetcher.fetch(regulation.source.url);
        const extracted = await parser.extract(source, regulation);
        const check = compare(regulation.value, extracted);
        
        if (check.changed) {
          const impact = assessImpact(regulation.key, check.oldValue, check.newValue, regulation.criticality);
          results.changed.push({ ...check, impact });
        } else {
          results.unchanged.push(check);
        }
      } catch (err) {
        // NEUE LOGIK: Fehlerbehandlung nach Kritikalität
        if (regulation.criticality === 'high') {
          // KfW, § 35c → Abbruch
          results.failed.push({ key, error: err.message, impact: 'critical' });
        } else if (regulation.updateStrategy === 'warn_only') {
          // Sekundärquellen, Bankzinsen → nur Warnung
          results.failed.push({ key, error: err.message, impact: 'warning' });
        }
      }
    }
    
    // Abbruch NUR bei kritischen Quellen
    const criticalFailures = results.failed.filter(f => f.impact === 'critical');
    if (criticalFailures.length > 0) {
      throw new Error(`${criticalFailures.length} kritische Quellen nicht erreichbar:\n${criticalFailures.map(f => f.key).join('\n')}`);
    }
    
    return results;
  }
}
```

### `scripts/assumptions-agent/parser.ts`

Claude-basierte Extraktion (unverändert):

```typescript
class SourceParser {
  async extract(sourceText: string, regulation: Regulation): Promise<ExtractedValue> {
    const prompt = `
Du bist Experte für deutsche Förderregeln und Steuern.
Extrahiere aus dem folgenden Text den Wert für: "${regulation.description}"

Kontext:
- Richtlinie: ${regulation.source.reference}
- Aktuell in unserem System: ${regulation.value}
- Erwartetes Format: ${regulation.valueType}

Text:
${sourceText.slice(0, 4000)}

Antworte als JSON:
{
  "value": <extrahierter Wert>,
  "confidence": <0.0–1.0>,
  "reasoning": "<warum dieser Wert>",
  "changed": <boolean>,
  "notes": "<besonderheiten>"
}
    `;

    const response = await claude.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const extracted = JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '{}');
    
    if (extracted.confidence < 0.7) {
      throw new Error(`Low confidence (${extracted.confidence}) for ${regulation.key}`);
    }

    return extracted;
  }
}
```

### `scripts/assumptions-agent/compare.ts`

Impact-Bewertung mit Kritikalität:

```typescript
function assessImpact(
  key: string,
  oldValue: unknown,
  newValue: unknown,
  criticality?: 'high' | 'medium' | 'low'
): 'critical' | 'major' | 'minor' | 'none' {
  // Grundregel: Datums- oder Satz-Änderung
  if (typeof oldValue === 'string' && typeof newValue === 'string') {
    const isDate = /^\d{4}-\d{2}(-\d{2})?$/.test(oldValue);
    if (isDate) return 'major';
  }

  if (typeof oldValue === 'number' && typeof newValue === 'number') {
    const delta = Math.abs(newValue - oldValue);
    
    // Sätze (0–1)
    if (oldValue <= 1 && oldValue >= 0) {
      if (delta > 0.005) return 'major';    // > 0,5 %
      if (delta > 0.001) return 'minor';    // > 0,1 %
      return 'none';
    }
    
    // Preise oder Beträge
    const pctChange = delta / Math.abs(oldValue);
    if (pctChange > 0.05) return 'minor';   // > 5 %
    return 'none';
  }

  // NEUE LOGIK: Kritikalität kann den Impact hochbewerten
  // Manche hohen Kritikalitäten sollten selbst kleine Änderungen melden
  if (criticality === 'high' && oldValue !== newValue) {
    // Z. B. KfW 458 Deckel: auch 1 € Änderung ist meldepflichtig
    return 'major';
  }

  return 'none';
}
```

### `scripts/assumptions-agent/patcher.ts`

Auto-Patch mit Audit-Trail:

```typescript
class Patcher {
  async apply(
    regulations: Regulations,
    verificationResult: VerificationResult,
    options: { dryRun?: boolean } = {}
  ): Promise<{ yamlPatch: string; defaultsPatch: string }> {
    // 1. regulations.yaml aktualisieren
    const updatedRegulations = deepMerge(regulations, {
      verificationLog: [
        {
          date: new Date().toISOString().split('T')[0],
          agent: 'assumptions-agent/1.0',
          status: verificationResult.failed.filter(f => f.impact === 'critical').length === 0 ? 'success' : 'partial',
          summary: `${verificationResult.summary.totalChanged} Änderungen, ${verificationResult.summary.totalFailed} Fehler, ${verificationResult.summary.totalSkipped} übersprungen`,
          changes: verificationResult.changed.length,
          checkpoints: Object.entries(verificationResult.checkpoints).map(([key, cp]) => ({
            [key]: `${cp.status}${cp.message ? `: ${cp.message}` : ''}`
          })),
        },
        ...regulations.verificationLog,
      ].slice(0, 10),
    });

    const yamlPatch = YAML.stringify(updatedRegulations);

    // 2. defaults.ts aktualisieren (nur kritische Änderungen)
    const defaultsSnippet = generateDefaultsTS(updatedRegulations);
    const defaultsPatch = updateDefaults(defaultsSnippet, options.dryRun);

    if (!options.dryRun) {
      writeFileSync('data/regulations.yaml', yamlPatch);
    }

    return { yamlPatch, defaultsPatch };
  }
}
```

---

## 3. Fehlerbewältigung & Kritikalität

### Abort-Szenarien (Exit 1)

```
❌ ABBRUCH (Exit 1):
  - KfW-Website nicht erreichbar
  - § 35c HTML nicht parsebar
  - Extraktions-Confidence < 70 %
  - Sondertilgungsregeln offline (KfW Merkblatt)
  
  Grund: Diese sind HOCH-Kritikalität und beeinflussen Rechner direkt.
```

### Warnungs-Szenarien (nur Log, kein Abbruch)

```
⚠️ WARNUNG (Exit 0):
  - BDEW-Preisseite offline
  - hausvoraus.de (KfW-Zinsen) offline
  - Fraunhofer ISE nicht erreichbar (optional)
  - Bankzinsen: nicht überprücht (als geplant protokollieren)
  
  Grund: Sekundäre Quellen oder Marktpreise; Rechner läuft auch ohne Update.
```

### Übersprungene Werte (skipped)

```
⏭️ ÜBERSPRUNGEN:
  - Bankzinsen (criticality: notApplicable)
  - Technische Werte mit updateStrategy: not_planned
  - Modell-Parameter (Opportunitätszins, etc.)
  - Energieprofile
  
  Grund: Gehören nicht zum Agent; in Audit-Trail protokolliert.
```

---

## 4. Struktur `regulations.yaml` – Kritikalitäts-Klassifikation

### Kritikalität "high" (Agent prüft, Abbruch bei Fehler)
```
- KfW 458: Grundförderung, Boni, Deckel, Degradationen
- § 35c EStG: Sätze, Limits, Deadline
- KfW 358/359: Maximalbeträge, Grundstruktur
```

### Kritikalität "medium" (Agent prüft, Warnung bei Fehler)
```
- Energiepreise (Gas, Öl, Strom)
- KfW-Kreditbedingungen (Laufzeit, Gnadenjahre, Sondertilgung)
- Sondertilgungsregeln (KfW Merkblatt)
- JAZ, technische Richtwerte (optional)
```

### Kritikalität "low" (informativ, wird übersprungen)
```
- PV-Ertrag (regional zu variabel)
- Kesselnutzungsgrad (Industriestandard)
- Heating-/Cooking-Profile
- Vat, technische Konstanten
```

### Kritikalität "notApplicable" (nicht überprüfbar, wird übersprungen)
```
- Bankzinsen (Marktpreis, BBk)
- KfW-Sekundärquellen-Zinsen (täglich changierend)
- Opportunitätszins, Restwert (Modellannahmen)
```

### Kritikalität "none" (physikalische Konstanten, wird übersprungen)
```
- Energieprofile (Jan–Dez Aufteilung)
- Heizwert-Richtwerte (10 kWh/Liter Öl)
- Effizienzfaktoren (Gas→Strom-Wandlung)
```

---

## 5. Implementierungs-Phasen

### Phase 1: Hochwertige Quellen (HOCH-Kritikalität) — 3–4 Tage
- [x] `data/regulations.yaml` mit KfW 458, § 35c, Energiepreisen, Kritikalitäts-Klassifizierung
- [x] `scripts/verify-assumptions.ts` CLI
- [x] `scripts/assumptions-agent/index.ts` mit Abbruch-Logik
- [x] `scripts/assumptions-agent/fetcher.ts` mit Caching + Retry
- [x] `scripts/assumptions-agent/parser.ts` Claude-Prompts
- [x] `scripts/assumptions-agent/compare.ts` Impact-Bewertung
- [x] `scripts/assumptions-agent/patcher.ts` Git-Diffs
- [x] `.env.example` + `.gitignore` aktualisieren
- [x] `docs/REGULATIONS.md` mit Kritikalitäts-Erklärung

### Phase 2: Mittlere Quellen + Sondertilgung (optional) — 2–3 Tage
- Erweiterung: KfW-Kreditbedingungen (Laufzeit, Sondertilgung, Gebühren) überprüfen
- Erweiterung: Technische Werte (JAZ, PV-Ertrag) optional überprüfen
- Tests mit Mock-Fehlszenarien
- `--include-optional` Flag implementieren

### Phase 3: Nicht-überprüfbare Quellen dokumentieren (Dokumentation) — 1 Tag
- `docs/REGULATIONS.md`: Bankzinsen → manuell, nicht Agent
- `docs/REGULATIONS.md`: Modell-Parameter → nicht changierend
- README für Maintainer: "Was ist Agent-Aufgabe, was nicht?"

### Phase 4: Testing + Release (1–2 Tage)
- Agent lokal mit echten Quellen testen
- Quellen-Ausfallszenarios testen (Mock)
- Audit-Trail prüfen
- Beispiel-Verifikationen dokumentieren
- npm script `verify:assumptions` in `package.json` registrieren

---

## 6. Quellen & deren Handling (Aktualisiert)

| Quelle | Kritikalität | Handling | Fallback |
|---|---|---|---|
| KfW BEG-EM Richtlinie (PDF) | **HIGH** | Abbruch, falls offline | manuell aktualisieren |
| KfW 458 Produktseite (HTML) | **HIGH** | Abbruch, falls offline | manuell aktualisieren |
| § 35c EStG (Bundestag HTML) | **HIGH** | Abbruch, falls offline | manuell aktualisieren |
| KfW 358/359 Merkblatt (PDF) | **MEDIUM** | Warnung, falls offline | manuell aktualisieren (Phase 2) |
| BDEW Energiepreise (HTML) | **MEDIUM** | Warnung, falls offline | alte Werte behalten |
| Destatis (Website) | **MEDIUM** | Warnung, falls offline | alte Werte behalten |
| Fraunhofer ISE JAZ (Website) | **LOW** | Optional überprüfen (Phase 2) | nicht auto-aktualisieren |
| hausvoraus.de (KfW-Zinsen) | **MEDIUM** | Warnung, kein Abbruch (sekundär) | alte Werte behalten |
| **Bundesbank (Bankzinsen)** | **NOT_APPLICABLE** | ❌ **NICHT überprüfen** (Marktpreis) | manuell halbjährlich |
| **Modell-Parameter** | **NONE** | ❌ **NICHT überprüfen** (nicht changierend) | Code-Review |

---

## 7. Known Limitations & Future Work

- **KfW-PDFs:** Parser nutzt PDF-to-Text + LLM; Layout-Änderungen können Extraktion stören
- **Bundestag-HTML:** § 35c ist statischer HTML; Struktur-Änderungen erfordern Prompt-Anpassung
- **Preise:** BDEW hat keine API; HTML-Tabellen sind fragil
- **Bankzinsen:** Nicht überprüfbar (Markdaten); müssen manuell aktualisiert werden

**Mögliche Verbesserungen später:**
- Agent schlägt PR-Body vor (Changelog-Format)
- Automatische Tests: neue Werte ergeben plausible Ergebnisse?
- Benachrichtigungen (Slack/Mail) bei fehlgeschlagenen Verifikationen
- Versionierung in `regulations.yaml` (Diff gegen ältere Einträge)
- Sondertilgungsregeln + Windfall automatisch überprüfen (Phase 2)
- Technische Werte (JAZ, Effizienzfaktoren) periodisch aktualisieren (Phase 2)

---

## 8. Entscheidungsmatrix (Finalisiert)

| Punkt | Entscheidung | Begründung |
|---|---|---|
| **KfW 458 überprüfen?** | ✅ Ja, HOCH | Zentral, Richtlinie-basiert, häufig aktualisiert |
| **§ 35c überprüfen?** | ✅ Ja, HOCH | Zentral, Gesetzes-basiert, stabil aber wichtig |
| **Energiepreise überprüfen?** | ✅ Ja, MEDIUM | Teils verfügbar, wichtig für Ergebnisse |
| **KfW-Zinsen überprüfen?** | ⚠️ Warnung only | Sekundärquelle, täglich changierend |
| **Bankzinsen überprüfen?** | ❌ Nein | Marktpreis, zu variabel, außerhalb Scope |
| **Sondertilgung überprüfen?** | ✅ Phase 2 optional | KfW Merkblatt, wichtig aber nicht zentral |
| **Technische Werte überprüfen?** | ⏭️ Optional (Phase 2) | Weniger häufig aktualisiert, optional |
| **Modell-Parameter überprüfen?** | ❌ Nein | Nicht changierend (Policy, nicht Data) |
| **Input-Validierungsgrenzen?** | ⏭️ Separate Aufgabe | Validation-Schema, nicht Daten-Verifikation |

