/**
 * Adds the content hash of the build to dist/version.json (N12.2), last step of `npm run build`:
 *
 *   node scripts/content-hash.ts [dist-dir]   default: dist
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentHash, VERSION_FILE } from './content-hash-lib.ts';

const dir = process.argv[2] || 'dist';
const file = join(dir, VERSION_FILE);
const info = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
info.contentHash = contentHash(dir);
writeFileSync(file, `${JSON.stringify(info, null, 2)}\n`);
console.log(`contentHash ${String(info.contentHash).slice(0, 12)}…`);
