/**
 * Patcher: Aktualisiere regulations.yaml und defaults.ts mit verifizierten Werten
 * 
 * Features:
 * - YAML-Serialisierung mit verificationLog-Update
 * - Letzte 10 Einträge in Audit-Trail
 * - Dry-Run Option
 * - Git-Diff-ready Output
 */

import * as fs from 'fs';
import * as path from 'path';
import YAML from 'js-yaml';
import type { VerificationResult } from './index';

export interface PatcherOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

export interface PatchOutput {
  yamlPatched: string;
  defaultsPatched: string;
  filesWritten: boolean;
  yamlPath: string;
  defaultsPath: string;
}



/**
 * Finde und aktualisiere einen verschachtelten Wert in einem Objekt
 */
function setNestedValue(obj: any, keyPath: string, value: any): void {
  const parts = keyPath.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  if (current[lastPart] && typeof current[lastPart] === 'object' && 'value' in current[lastPart]) {
    // Ersetze nur den 'value' eines Fields
    current[lastPart].value = value;
    current[lastPart].lastVerified = new Date().toISOString().split('T')[0];
  } else {
    // Setze direkt
    current[lastPart] = value;
  }
}

export class Patcher {
  async apply(
    regulations: Record<string, any>,
    verificationResult: VerificationResult,
    options: PatcherOptions = {}
  ): Promise<PatchOutput> {
    const { dryRun = false, verbose = false } = options;

    if (verbose) {
      console.log('[Patcher] Applying patches...');
      console.log(`  - Changed: ${verificationResult.changed.length}`);
      console.log(`  - Failed: ${verificationResult.failed.length}`);
      console.log(`  - Skipped: ${verificationResult.skipped.length}`);
    }

    // 1. regulations.yaml aktualisieren
    let updatedRegulations = { ...regulations };

    // Wende Änderungen an
    for (const change of verificationResult.changed) {
      setNestedValue(updatedRegulations, change.key, change.newValue);
    }

    // Audit-Trail aktualisieren
    const verificationLog = Array.isArray(updatedRegulations.verificationLog)
      ? [...updatedRegulations.verificationLog]
      : [];

    const criticalFailures = verificationResult.failed.filter(
      (f) => f.criticality === 'high'
    );

    const logEntry = {
      date: new Date().toISOString().split('T')[0],
      agent: 'assumptions-agent/1.0',
      status: criticalFailures.length === 0 ? 'success' : 'partial',
      summary: `${verificationResult.summary.totalChanged} Änderungen, ${verificationResult.summary.totalFailed} Fehler, ${verificationResult.summary.totalSkipped} übersprungen`,
      changes: verificationResult.changed.length,
      checkpoints: Object.entries(verificationResult.checkpoints)
        .map(([key, cp]) => ({
          [key]: `${cp.status}${cp.message ? `: ${cp.message}` : ''}`,
        }))
        .reduce((a, b) => ({ ...a, ...b }), {}),
    };

    verificationLog.unshift(logEntry);
    updatedRegulations.verificationLog = verificationLog.slice(0, 10); // Letzte 10

    // YAML serialisieren
    const yamlPatched = YAML.dump(updatedRegulations, {
      lineWidth: 120,
      indent: 2,
    });

    if (verbose) {
      console.log('[Patcher] YAML prepared');
    }

    // 2. defaults.ts aktualisieren (nur kritische Änderungen)
    let defaultsPatched = '';
    try {
      const defaultsPath = path.join(process.cwd(), 'src/core/defaults.ts');
      if (fs.existsSync(defaultsPath)) {
        let defaultsContent = fs.readFileSync(defaultsPath, 'utf-8');

        // Aktualisiere FUNDING_SOURCE_DATE
        const newDate = new Date().toISOString().split('T')[0];
        defaultsContent = defaultsContent.replace(
          /export const FUNDING_SOURCE_DATE = '[^']*'/,
          `export const FUNDING_SOURCE_DATE = '${newDate}'`
        );

        // Aktualisiere FUNDING_PARAMS (wenn vorhanden)
        // Dies ist eine vereinfachte Version – eine echte Implementierung müde AST-Parser nutzen
        for (const change of verificationResult.changed) {
          if (change.key.startsWith('funding.') || change.key.startsWith('tax.') || change.key.startsWith('prices.')) {
            // Snippet für Update (würde normalerweise besser via AST-Parser laufen)
            const fieldName = change.key.split('.').pop();
            if (fieldName && typeof change.newValue === 'number') {
              const pattern = new RegExp(
                `(${fieldName}\\s*:\\s*)([\\d.]+)`,
                'g'
              );
              defaultsContent = defaultsContent.replace(pattern, `$1${change.newValue}`);
            }
          }
        }

        defaultsPatched = defaultsContent;
      }
    } catch (err) {
      if (verbose) {
        console.warn('[Patcher] Warning: Could not update defaults.ts:', err instanceof Error ? err.message : String(err));
      }
    }

    // 3. Dateien schreiben (wenn nicht dryRun)
    const yamlPath = path.join(process.cwd(), 'data/regulations.yaml');
    const defaultsPath = path.join(process.cwd(), 'src/core/defaults.ts');
    let filesWritten = false;

    if (!dryRun) {
      try {
        fs.writeFileSync(yamlPath, yamlPatched, 'utf-8');
        if (verbose) {
          console.log(`[Patcher] Written: ${yamlPath}`);
        }

        if (defaultsPatched) {
          fs.writeFileSync(defaultsPath, defaultsPatched, 'utf-8');
          if (verbose) {
            console.log(`[Patcher] Written: ${defaultsPath}`);
          }
        }

        filesWritten = true;
      } catch (err) {
        throw new Error(
          `Fehler beim Schreiben der Dateien: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    } else {
      if (verbose) {
        console.log('[Patcher] Dry-run: No files written');
      }
    }

    return {
      yamlPatched,
      defaultsPatched,
      filesWritten,
      yamlPath,
      defaultsPath,
    };
  }
}

export const globalPatcher = new Patcher();
