// Generates THIRD-PARTY-NOTICES.md from the license files of the runtime dependencies (package.json → dependencies).
// Usage: npm run notices  (after changes to dependencies; tests/license.test.ts checks that it is up to date)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const parts = [
  '# Lizenzen von Drittanbietern',
  '',
  'Der Wärmepumpen-Umrüstungsrechner enthält im ausgelieferten Build die folgenden Bibliotheken und Schriften. Sie stehen unter ihren eigenen Lizenzen (nicht unter der PolyForm-Noncommercial-Lizenz des Rechners); die Lizenztexte folgen unverändert.',
  '',
];
for (const name of Object.keys(pkg.dependencies).sort()) {
  const dir = join(root, 'node_modules', name);
  const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const file = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].map((f) => join(dir, f)).find(existsSync);
  if (!file) throw new Error(`Keine Lizenzdatei für ${name}`);
  const home = typeof meta.repository === 'string' ? meta.repository : meta.repository?.url ?? meta.homepage ?? '';
  parts.push(`## ${name} ${meta.version}`, '', `Lizenz: ${meta.license}${home ? ` · ${home.replace(/^git\+/, '').replace(/\.git$/, '')}` : ''}`, '', '```text', readFileSync(file, 'utf8').trim(), '```', '');
}
writeFileSync(join(root, 'THIRD-PARTY-NOTICES.md'), parts.join('\n'));
console.log('THIRD-PARTY-NOTICES.md geschrieben');
