/**
 * AssumptionsAgent: Hauptorchestrator für die Verifikation aller Regulations-Werte
 * 
 * Ablauf:
 * 1. Für jedes Feld in regulations.yaml prüfen
 * 2. Kritikalität und updateStrategy beachten
 * 3. Quelle abrufen (Fetcher)
 * 4. Wert extrahieren (Parser)
 * 5. Vergleichen und Impact bewerten
 * 6. Ergebnisse sammeln
 * 7. Kritische Fehler abbrechen, Warnungen nur melden
 */

import { SourceFetcher } from './fetcher';
import { SourceParser, type Regulation } from './parser';
import { compare, assessImpact, type Impact } from './compare';

export interface CLIOptions {
  autoPatch?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  includeOptional?: boolean;
  skipSecondary?: boolean;
}

export interface RegulationCheckResult {
  key: string;
  description: string;
  oldValue: unknown;
  newValue?: unknown;
  changed: boolean;
  impact?: Impact;
  error?: string;
  criticality: string;
  confidence?: number;
  reasoning?: string;
}

export interface VerificationCheckpoint {
  status: 'success' | 'warning' | 'failed';
  message: string;
  criticality: 'high' | 'medium' | 'low' | 'notApplicable' | 'none';
}

export interface VerificationResult {
  timestamp: string;
  checkpoints: Record<string, VerificationCheckpoint>;
  unchanged: RegulationCheckResult[];
  changed: RegulationCheckResult[];
  failed: RegulationCheckResult[];
  skipped: RegulationCheckResult[];
  summary: {
    totalChecked: number;
    totalChanged: number;
    totalFailed: number;
    totalSkipped: number;
  };
}

interface RegulationField {
  key: string;
  value: unknown;
  description?: string;
  criticality?: string;
  updateStrategy?: string;
  source?: {
    url?: string;
    reference?: string;
  };
}

export class AssumptionsAgent {
  private fetcher: SourceFetcher;
  private parser: SourceParser;

  constructor(fetcher?: SourceFetcher, parser?: SourceParser) {
    this.fetcher = fetcher || new SourceFetcher();
    this.parser = parser || new SourceParser();
  }

  /**
   * Flatten regulations.yaml zu Array von [key, field] Paaren
   * z.B. ['funding.kfw458.grundRate', {...}]
   */
  private flattenRegulations(regulations: Record<string, any>): Array<[string, RegulationField]> {
    const result: Array<[string, RegulationField]> = [];

    const walk = (obj: any, prefix: string = '') => {
      if (!obj || typeof obj !== 'object') return;

      for (const [key, val] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (val === null || typeof val !== 'object') {
          continue;
        }

        // Prüfe, ob es ein Feld mit 'value' ist
        if ('value' in val && 'description' in val) {
          result.push([
            fullKey,
            {
              key: fullKey,
              value: (val as any).value,
              description: (val as any).description,
              criticality: (val as any).criticality,
              updateStrategy: (val as any).updateStrategy,
              source: (val as any).source,
            },
          ]);
        } else if (Array.isArray(val)) {
          // Skip arrays (verificationLog, etc.)
          continue;
        } else {
          // Rekursiv weiter
          walk(val, fullKey);
        }
      }
    };

    walk(regulations);
    return result;
  }

  async verify(
    regulations: Record<string, any>,
    options: CLIOptions = {}
  ): Promise<VerificationResult> {
    const result: VerificationResult = {
      timestamp: new Date().toISOString(),
      checkpoints: {},
      unchanged: [],
      changed: [],
      failed: [],
      skipped: [],
      summary: {
        totalChecked: 0,
        totalChanged: 0,
        totalFailed: 0,
        totalSkipped: 0,
      },
    };

    const fields = this.flattenRegulations(regulations);
    if (options.verbose) {
      console.log(`[Agent] Verifying ${fields.length} regulation fields...`);
    }

    for (const [key, field] of fields) {
      try {
        // Kritikalität prüfen
        if (
          field.criticality === 'none' ||
          field.criticality === 'notApplicable'
        ) {
          result.skipped.push({
            key,
            description: field.description || key,
            oldValue: field.value,
            changed: false,
            criticality: field.criticality,
          });
          result.summary.totalSkipped++;
          if (options.verbose) {
            console.log(`[Agent] ⏭️  Skipped ${key} (criticality=${field.criticality})`);
          }
          continue;
        }

        // updateStrategy prüfen
        if (field.updateStrategy === 'not_planned') {
          result.skipped.push({
            key,
            description: field.description || key,
            oldValue: field.value,
            changed: false,
            criticality: field.criticality || 'unknown',
          });
          result.summary.totalSkipped++;
          if (options.verbose) {
            console.log(`[Agent] ⏭️  Skipped ${key} (updateStrategy=not_planned)`);
          }
          continue;
        }

        // Optional-Werte nur mit Flag
        if (
          field.updateStrategy === 'optional' &&
          !options?.includeOptional
        ) {
          result.skipped.push({
            key,
            description: field.description || key,
            oldValue: field.value,
            changed: false,
            criticality: field.criticality || 'unknown',
          });
          result.summary.totalSkipped++;
          if (options.verbose) {
            console.log(`[Agent] ⏭️  Skipped ${key} (optional, use --include-optional)`);
          }
          continue;
        }

        // Warnung-only Quellen mit skipSecondary überspringen
        if (
          options?.skipSecondary &&
          field.updateStrategy === 'warn_only'
        ) {
          result.skipped.push({
            key,
            description: field.description || key,
            oldValue: field.value,
            changed: false,
            criticality: field.criticality || 'unknown',
          });
          result.summary.totalSkipped++;
          if (options.verbose) {
            console.log(`[Agent] ⏭️  Skipped ${key} (secondary source, --skip-secondary)`);
          }
          continue;
        }

        // Quelle vorhanden?
        if (!field.source?.url) {
          if (options.verbose) {
            console.log(`[Agent] ⏭️  Skipped ${key} (no source URL)`);
          }
          result.skipped.push({
            key,
            description: field.description || key,
            oldValue: field.value,
            changed: false,
            criticality: field.criticality || 'unknown',
          });
          result.summary.totalSkipped++;
          continue;
        }

        // Fetch + Parse + Compare
        if (options.verbose) {
          console.log(`[Agent] Checking ${key}...`);
        }

        const source = await this.fetcher.fetch(field.source.url);
        const regulation: Regulation = {
          key,
          description: field.description || key,
          value: field.value,
          source: {
            reference: field.source?.reference || '',
            url: field.source?.url,
          },
        };

        const extracted = await this.parser.extract(source, regulation);

        if (extracted.confidence < 0.7) {
          throw new Error(
            `Low confidence (${extracted.confidence.toFixed(2)}) for ${key}`
          );
        }

        const comparisonResult = compare(field.value, extracted.value);
        const impact = assessImpact(
          key,
          field.value,
          extracted.value,
          field.criticality as any
        );

        const checkResult: RegulationCheckResult = {
          key,
          description: field.description || key,
          oldValue: field.value,
          newValue: extracted.value,
          changed: comparisonResult.changed,
          impact,
          criticality: field.criticality || 'unknown',
          confidence: extracted.confidence,
          reasoning: extracted.reasoning,
        };

        if (comparisonResult.changed) {
          result.changed.push(checkResult);
          result.summary.totalChanged++;
          console.log(
            `[Agent] ⚠️  CHANGED: ${key}\n         ${field.value} → ${extracted.value} (${impact})`
          );
        } else {
          result.unchanged.push(checkResult);
          if (options.verbose) {
            console.log(`[Agent] ✅ OK: ${key}`);
          }
        }

        result.summary.totalChecked++;

        // Checkpoint aktualisieren
        const categoryKey = key.split('.')[0];
        if (!result.checkpoints[categoryKey]) {
          result.checkpoints[categoryKey] = {
            status: 'success',
            message: '',
            criticality: field.criticality as any,
          };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        const checkResult: RegulationCheckResult = {
          key,
          description: field.description || key,
          oldValue: field.value,
          changed: false,
          error: errorMsg,
          criticality: field.criticality || 'unknown',
        };

        result.failed.push(checkResult);
        result.summary.totalFailed++;

        // Fehlerbehandlung nach Kritikalität
        if (field.criticality === 'high') {
          // HIGH: Abbruch dokumentieren
          const categoryKey = key.split('.')[0];
          if (!result.checkpoints[categoryKey]) {
            result.checkpoints[categoryKey] = {
              status: 'failed',
              message: errorMsg,
              criticality: 'high',
            };
          } else {
            result.checkpoints[categoryKey].status = 'failed';
            result.checkpoints[categoryKey].message = errorMsg;
          }
          console.error(`[Agent] ❌ FAILED (HIGH): ${key}\n         ${errorMsg}`);
        } else if (field.updateStrategy === 'warn_only') {
          // Warnung nur
          console.warn(`[Agent] ⚠️  WARNING: ${key}\n         ${errorMsg}`);
        } else {
          console.warn(`[Agent] ⚠️  FAILED: ${key}\n         ${errorMsg}`);
        }
      }
    }

    // Prüfe auf kritische Fehler
    const criticalFailures = result.failed.filter(
      (f) => f.criticality === 'high'
    );

    if (criticalFailures.length > 0) {
      throw new Error(
        `${criticalFailures.length} kritische Quellen nicht erreichbar:\n${criticalFailures
          .map((f) => `- ${f.key}: ${f.error}`)
          .join('\n')}`
      );
    }

    return result;
  }
}

export const globalAgent = new AssumptionsAgent();
