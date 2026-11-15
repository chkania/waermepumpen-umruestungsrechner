/**
 * Prints the changelog entries that a deployment brings online (N12.1), as Markdown for the job summary:
 *
 *   node scripts/deploy-changelog.ts [url] [version]   url: live site (default: main domain), version: default package.json
 *
 * Runs in the build job of .github/workflows/deploy.yml (before the deployment is approved). Reads the live version from
 * <url>/version.json (N15); if it cannot be read, only the entry of the new version is shown. Never fails the build.
 */
import { readFileSync } from 'node:fs';
import { deploySummary, liveVersionOf } from './changelog-lib.ts';
import { baseUrl, MAIN_URL } from './smoke-lib.ts';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const url = baseUrl(process.argv[2] || MAIN_URL);
const version = process.argv[3] || pkg.version;

let live: string | null = null;
let error: string | undefined;
try {
  const res = await fetch(new URL(`version.json?t=${Date.now()}`, url), {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.ok) {
    live = liveVersionOf(await res.json().catch(() => null));
    if (!live) error = 'version.json ohne gültige Version';
  } else error = `version.json: HTTP ${res.status}`;
} catch (err) {
  error = `version.json nicht abrufbar: ${(err as Error).message}`;
}
process.stdout.write(deploySummary(changelog, version, live, error));
