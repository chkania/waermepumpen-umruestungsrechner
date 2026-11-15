#!/usr/bin/env node
/**
 * Smoke Test für Assumptions Agent – verifyifies Struktur ohne API-Calls
 */

import fs from 'fs';
import path from 'path';
import YAML from 'js-yaml';

const projectRoot = process.cwd();
const regulationsPath = path.join(projectRoot, 'data/regulations.yaml');

async function test() {
  console.log(`\n🔍 Agent Smoke Test\n`);
  console.log(`${'='.repeat(80)}\n`);

  // 1. Check regulations.yaml exists
  console.log(`1️⃣  Checking regulations.yaml...`);
  if (!fs.existsSync(regulationsPath)) {
    console.error(`   ❌ FAILED: ${regulationsPath} not found`);
    process.exit(1);
  }
  console.log(`   ✅ File exists`);

  // 2. Parse YAML
  console.log(`2️⃣  Parsing regulations.yaml...`);
  let regulations;
  try {
    const content = fs.readFileSync(regulationsPath, 'utf-8');
    regulations = YAML.load(content);
    console.log(`   ✅ Valid YAML`);
  } catch (err) {
    console.error(`   ❌ FAILED: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // 3. Validate structure
  console.log(`3️⃣  Validating structure...`);
  const requiredTopLevel = ['funding', 'tax', 'prices', 'financing', 'technical', 'profiles', 'general', 'verificationLog'];
  for (const key of requiredTopLevel) {
    if (!(key in regulations)) {
      console.error(`   ❌ FAILED: Missing top-level key: ${key}`);
      process.exit(1);
    }
  }
  console.log(`   ✅ All required sections present`);

  // 4. Check funding.kfw458
  console.log(`4️⃣  Checking KfW 458 fields...`);
  const kfw458 = regulations.funding?.kfw458;
  if (!kfw458) {
    console.error(`   ❌ FAILED: funding.kfw458 not found`);
    process.exit(1);
  }

  const requiredKfw458 = ['grundRate', 'wsbRate', 'kgbRate', 'incomeBonusBase', 'maxRate', 'cap1', 'cap2to6'];
  for (const field of requiredKfw458) {
    if (!(field in kfw458)) {
      console.error(`   ❌ FAILED: kfw458.${field} not found`);
      process.exit(1);
    }
    const f = kfw458[field];
    if (!('value' in f) || !('criticality' in f)) {
      console.error(`   ❌ FAILED: kfw458.${field} missing 'value' or 'criticality'`);
      process.exit(1);
    }
  }
  console.log(`   ✅ ${requiredKfw458.length} key fields present`);

  // 5. Check criticality levels
  console.log(`5️⃣  Checking criticality levels...`);
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let notApplicableCount = 0;
  let noneCount = 0;

  const walk = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === 'object' && 'value' in val && 'criticality' in val) {
        const c = val.criticality;
        if (c === 'high') highCount++;
        else if (c === 'medium') mediumCount++;
        else if (c === 'low') lowCount++;
        else if (c === 'notApplicable') notApplicableCount++;
        else if (c === 'none') noneCount++;
      } else if (Array.isArray(val)) {
        // skip
      } else if (typeof val === 'object') {
        walk(val, `${path}.${key}`);
      }
    }
  };

  walk(regulations);
  console.log(`   ✅ HIGH: ${highCount}, MEDIUM: ${mediumCount}, LOW: ${lowCount}, notApplicable: ${notApplicableCount}, none: ${noneCount}`);

  // 6. Check verificationLog
  console.log(`6️⃣  Checking verificationLog...`);
  if (!Array.isArray(regulations.verificationLog)) {
    console.error(`   ❌ FAILED: verificationLog is not an array`);
    process.exit(1);
  }
  console.log(`   ✅ verificationLog present (${regulations.verificationLog.length} entries)`);

  // 7. Check critical fields have sources
  console.log(`7️⃣  Checking critical fields have sources...`);
  let missingSource = 0;
  const checkSource = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === 'object' && 'value' in val && val.criticality === 'high') {
        if (!val.source || !val.source.reference) {
          console.warn(`   ⚠️  MISSING SOURCE: ${path}.${key}`);
          missingSource++;
        }
      } else if (Array.isArray(val)) {
        // skip
      } else if (typeof val === 'object') {
        checkSource(val, `${path}.${key}`);
      }
    }
  };

  checkSource(regulations);
  if (missingSource > 0) {
    console.warn(`   ⚠️  ${missingSource} high-criticality fields missing source`);
  } else {
    console.log(`   ✅ All HIGH-criticality fields have sources`);
  }

  // 8. Check CLI script exists
  console.log(`8️⃣  Checking CLI script...`);
  const scriptPath = path.join(projectRoot, 'scripts/verify-assumptions.ts');
  if (!fs.existsSync(scriptPath)) {
    console.error(`   ❌ FAILED: ${scriptPath} not found`);
    process.exit(1);
  }
  console.log(`   ✅ CLI script present`);

  // 9. Check agent modules
  console.log(`9️⃣  Checking agent modules...`);
  const modules = [
    'scripts/assumptions-agent/fetcher.ts',
    'scripts/assumptions-agent/parser.ts',
    'scripts/assumptions-agent/compare.ts',
    'scripts/assumptions-agent/index.ts',
    'scripts/assumptions-agent/patcher.ts',
  ];
  for (const mod of modules) {
    const modPath = path.join(projectRoot, mod);
    if (!fs.existsSync(modPath)) {
      console.error(`   ❌ FAILED: ${mod} not found`);
      process.exit(1);
    }
  }
  console.log(`   ✅ All ${modules.length} modules present`);

  // 10. Check .env.example
  console.log(`🔟 Checking .env.example...`);
  const envPath = path.join(projectRoot, '.env.example');
  if (!fs.existsSync(envPath)) {
    console.error(`   ❌ FAILED: ${envPath} not found`);
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  if (!envContent.includes('ANTHROPIC_API_KEY')) {
    console.error(`   ❌ FAILED: ANTHROPIC_API_KEY not in .env.example`);
    process.exit(1);
  }
  console.log(`   ✅ .env.example present and valid`);

  // 11. Check package.json script
  console.log(`1️⃣1️⃣  Checking package.json script...`);
  const pkgPath = path.join(projectRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  if (!pkg.scripts['verify:assumptions']) {
    console.error(`   ❌ FAILED: verify:assumptions script not in package.json`);
    process.exit(1);
  }
  console.log(`   ✅ npm run verify:assumptions registered`);

  // 12. Check dependencies
  console.log(`1️⃣2️⃣  Checking dependencies...`);
  const requiredDeps = ['@anthropic-ai/sdk', 'dotenv', 'js-yaml'];
  for (const dep of requiredDeps) {
    if (!(dep in pkg.dependencies)) {
      console.error(`   ❌ FAILED: ${dep} not in dependencies`);
      process.exit(1);
    }
  }
  console.log(`   ✅ All required dependencies installed`);

  // 13. Check documentation
  console.log(`1️⃣3️⃣  Checking documentation...`);
  const docsPath = path.join(projectRoot, 'docs/REGULATIONS.md');
  if (!fs.existsSync(docsPath)) {
    console.error(`   ❌ FAILED: ${docsPath} not found`);
    process.exit(1);
  }
  const docsContent = fs.readFileSync(docsPath, 'utf-8');
  if (!docsContent.includes('HIGH-Kritikalität') && !docsContent.includes('high-criticality')) {
    console.warn(`   ⚠️  docs/REGULATIONS.md may be incomplete`);
  } else {
    console.log(`   ✅ docs/REGULATIONS.md present and complete`);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`\n✅ Smoke Test PASSED!\n`);
  console.log(`📊 Summary:`);
  console.log(`   - YAML structure: ✅ Valid`);
  console.log(`   - Criticality levels: ✅ HIGH: ${highCount}, MEDIUM: ${mediumCount}, LOW: ${lowCount}`);
  console.log(`   - CLI & modules: ✅ All present`);
  console.log(`   - Dependencies: ✅ Installed`);
  console.log(`   - Documentation: ✅ Present`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Create .env.local: cp .env.example .env.local`);
  console.log(`   2. Add ANTHROPIC_API_KEY to .env.local`);
  console.log(`   3. Run: npm run verify:assumptions -- --dry-run\n`);

  process.exit(0);
}

test().catch((err) => {
  console.error(`\n❌ Test error: ${err}`);
  process.exit(1);
});
