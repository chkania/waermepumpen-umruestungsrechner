#!/usr/bin/env node
/**
 * CLI: verify-assumptions
 * 
 * Quartalweise Verifikation aller Regulations-Werte
 * 
 * Benutzung:
 *   npm run verify:assumptions [--auto-patch] [--dry-run] [--verbose] [--include-optional] [--skip-secondary]
 * 
 * Exit Codes:
 *   0: Erfolgreich
 *   1: Kritische Fehler (Quellen offline, etc.)
 *   2: Konfigurationsfehler (.env.local, etc.)
 */

import * as fs from 'fs';
import * as path from 'path';
import YAML from 'js-yaml';
import * as dotenv from 'dotenv';
import { AssumptionsAgent, type CLIOptions, type VerificationResult } from './assumptions-agent/index';
import { Patcher } from './assumptions-agent/patcher';

// ============================================================================
// Konfiguration & Helpers
// ============================================================================

const projectRoot = process.cwd();
const envLocalPath = path.join(projectRoot, '.env.local');
const regulationsPath = path.join(projectRoot, 'data/regulations.yaml');

/**
 * Parse CLI-Argumente
 */
function parseArgs(): CLIOptions & { help?: boolean } {
  const args = process.argv.slice(2);
  return {
    autoPatch: args.includes('--auto-patch'),
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
    includeOptional: args.includes('--include-optional'),
    skipSecondary: args.includes('--skip-secondary'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

/**
 * Laden Sie .env.local oder erstellen Sie einen Hinweis
 */
function loadEnv(): string | null {
  if (!fs.existsSync(envLocalPath)) {
    console.error(`❌ .env.local nicht gefunden!`);
    console.error(`\n📋 Bitte folgen Sie diesen Schritten:\n`);
    console.error(`   1. Kopieren Sie .env.example zu .env.local:\n`);
    console.error(`      cp .env.example .env.local\n`);
    console.error(`   2. Öffnen Sie .env.local und tragen Sie Ihren ANTHROPIC_API_KEY ein:\n`);
    console.error(`      ANTHROPIC_API_KEY=sk-...\n`);
    console.error(`   3. Speichern Sie die Datei und versuchen Sie es erneut.\n`);
    return null;
  }

  try {
    dotenv.config({ path: envLocalPath });
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error(`❌ ANTHROPIC_API_KEY in .env.local nicht gesetzt!`);
      console.error(`\n📋 Bitte öffnen Sie .env.local und tragen Sie Ihren API-Key ein:\n`);
      console.error(`   ANTHROPIC_API_KEY=sk-...\n`);
      return null;
    }

    return apiKey;
  } catch (err) {
    console.error(
      `❌ Fehler beim Laden von .env.local: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

/**
 * Laden Sie regulations.yaml
 */
function loadRegulations(): Record<string, any> | null {
  if (!fs.existsSync(regulationsPath)) {
    console.error(`❌ data/regulations.yaml nicht gefunden!`);
    console.error(`\n   Bitte führen Sie zuerst Phase 1 aus.`);
    return null;
  }

  try {
    const content = fs.readFileSync(regulationsPath, 'utf-8');
    const regulations = YAML.load(content) as Record<string, any>;
    return regulations;
  } catch (err) {
    console.error(
      `❌ Fehler beim Parsen von regulations.yaml: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

/**
 * Geben Sie den Report aus
 */
function printReport(result: VerificationResult): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`VERIFICATION REPORT – ${result.timestamp}`);
  console.log(`${'='.repeat(80)}\n`);

  console.log(`📊 Summary:`);
  console.log(`   Total Checked:  ${result.summary.totalChecked}`);
  console.log(`   Changed:        ${result.summary.totalChanged}`);
  console.log(`   Failed:         ${result.summary.totalFailed}`);
  console.log(`   Skipped:        ${result.summary.totalSkipped}\n`);

  if (result.unchanged.length > 0) {
    console.log(`✅ Unchanged (${result.unchanged.length}):`);
    for (const item of result.unchanged.slice(0, 5)) {
      console.log(`   - ${item.description}`);
    }
    if (result.unchanged.length > 5) {
      console.log(`   ... and ${result.unchanged.length - 5} more`);
    }
    console.log();
  }

  if (result.changed.length > 0) {
    console.log(`⚠️  Changed (${result.changed.length}):`);
    for (const item of result.changed) {
      console.log(
        `   - ${item.description}\n     ${item.oldValue} → ${item.newValue} (${item.impact})`
      );
    }
    console.log();
  }

  if (result.failed.length > 0) {
    console.log(`❌ Failed (${result.failed.length}):`);
    for (const item of result.failed) {
      console.log(`   - ${item.description}`);
      console.log(`     Error: ${item.error}`);
    }
    console.log();
  }

  if (Object.keys(result.checkpoints).length > 0) {
    console.log(`📋 Checkpoints:`);
    for (const [key, cp] of Object.entries(result.checkpoints)) {
      const icon = cp.status === 'success' ? '✅' : cp.status === 'warning' ? '⚠️ ' : '❌';
      console.log(`   ${icon} ${key}: ${cp.status}`);
      if (cp.message) {
        console.log(`      ${cp.message}`);
      }
    }
    console.log();
  }

  console.log(`${'='.repeat(80)}\n`);
}

/**
 * Confirm user input
 */
async function confirmPatch(): Promise<boolean> {
  if (process.argv.includes('--auto-patch')) {
    return true;
  }

  return new Promise((resolve) => {
    console.log(`\n⚠️  Apply these changes? (y/N)`);
    process.stdout.write('> ');

    const stdin = process.stdin;
    stdin.once('data', (data) => {
      const answer = data.toString().trim().toLowerCase();
      resolve(answer === 'y' || answer === 'yes');
    });
  });
}

/**
 * Hilfe-Text
 */
function showHelp(): void {
  console.log(`
Usage: npm run verify:assumptions [OPTIONS]

Options:
  --auto-patch        Automatically patch without confirmation
  --dry-run           Show changes but don't write files
  --verbose           Show debug output
  --include-optional  Also verify optional values (experimental)
  --skip-secondary    Skip secondary sources (warn_only)
  --help, -h          Show this message

Examples:
  npm run verify:assumptions --dry-run
  npm run verify:assumptions --auto-patch --verbose
  npm run verify:assumptions --skip-secondary
  `);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log(`\n🔍 Verifying assumptions...\n`);

  // 1. Umgebung prüfen
  const apiKey = loadEnv();
  if (!apiKey) {
    process.exit(2);
  }

  // 2. regulations.yaml laden
  const regulations = loadRegulations();
  if (!regulations) {
    process.exit(2);
  }

  // 3. Agent ausführen
  let result: VerificationResult;
  try {
    const agent = new AssumptionsAgent();
    result = await agent.verify(regulations, options);
  } catch (err) {
    console.error(
      `\n❌ Verification failed:\n${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }

  // 4. Report ausgeben
  printReport(result);

  // 5. Bei Fehlern: exit 1 (schon oben gehandhabt)
  // Bei Änderungen: Patch anbieten
  if (result.changed.length === 0) {
    console.log(`✅ No changes detected. All values match.`);
    process.exit(0);
  }

  // 6. Bestätigung erfragen (außer --auto-patch)
  const shouldPatch = options.autoPatch || (await confirmPatch());

  if (!shouldPatch) {
    console.log(`⏭️  Skipped patching.`);
    process.exit(0);
  }

  // 7. Patcher anwenden
  try {
    const patcher = new Patcher();
    const patchOutput = await patcher.apply(regulations, result, {
      dryRun: options.dryRun,
      verbose: options.verbose,
    });

    if (patchOutput.filesWritten) {
      console.log(`\n✅ Files updated:`);
      console.log(`   ${patchOutput.yamlPath}`);
      if (patchOutput.defaultsPatched) {
        console.log(`   ${patchOutput.defaultsPath}`);
      }
      console.log(`\n💡 Next steps:`);
      console.log(`   git diff data/regulations.yaml`);
      console.log(`   git diff src/core/defaults.ts`);
      console.log(`   git add data/regulations.yaml src/core/defaults.ts`);
      console.log(`   git commit -m "chore(assumptions): Q4 2026 update (agent-verified)"`);
      console.log(`   gh pr create --title "chore: Quarterly assumptions update (2026-Q4)"\n`);
    } else {
      console.log(`\n📋 Dry-run mode: No files written.\n`);
    }

    process.exit(0);
  } catch (err) {
    console.error(
      `\n❌ Patching failed:\n${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
}

// Run
console.log('🚀 Starting assumptions verification agent...');
main().catch((err) => {
  console.error(`Unexpected error: ${err}`);
  process.exit(1);
});
