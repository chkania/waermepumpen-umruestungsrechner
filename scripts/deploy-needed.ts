/**
 * Decides whether a deployment is needed (N12.2) and writes `changed=true|false` to $GITHUB_OUTPUT plus a note to the
 * job summary:
 *
 *   node scripts/deploy-needed.ts [url] [dist-dir]   url: live site (default: main domain), dist-dir: default dist
 *
 * Environment FORCE=true (manual run) always deploys. Runs in the build job of .github/workflows/deploy.yml.
 * Never fails: if anything is unclear, it deploys.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deployDecision, hashOf, VERSION_FILE } from './content-hash-lib.ts';
import { baseUrl, MAIN_URL } from './smoke-lib.ts';

const url = baseUrl(process.argv[2] || MAIN_URL);
const dir = process.argv[3] || 'dist';
const force = process.env.FORCE === 'true';

let built: string | null = null;
try {
  built = hashOf(JSON.parse(readFileSync(join(dir, VERSION_FILE), 'utf8')));
} catch {
  built = null;
}

let live: unknown = null;
try {
  const res = await fetch(new URL(`${VERSION_FILE}?t=${Date.now()}`, url), {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.ok) live = await res.json().catch(() => null);
} catch {
  live = null;
}

const { needed, reason } = deployDecision(live, built, force);
const summary = needed ? `### Deployment nötig\n${reason}.\n` : `### Kein Deployment\n${reason} (Hash ${String(built).slice(0, 12)}…).\n`;
console.log(summary);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${needed}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
