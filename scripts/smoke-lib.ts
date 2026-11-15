/**
 * Checks after a deployment (N15) – logic without browser and network, used by scripts/smoke-test.ts and tested in
 * tests/smoke.test.ts.
 */

/** Production address (N13); the smoke test can also check another address, e.g. the local preview. */
export const MAIN_URL = 'https://waermepumpen-investitionsrechner.de/';
/** Visitor statistics (N10): blocked during the check so that it does not count as a visit. */
export const ANALYTICS_HOST = 'analytics.chkania.net';

export interface SmokeOptions {
  /** Base address with trailing slash. */
  url: string;
  /** Expected version (default: package.json). */
  version: string;
  /** Expected commit (optional, e.g. in the deploy workflow). */
  commit?: string;
}

/** Ensures a trailing slash so that relative page names can be appended. */
export function baseUrl(url: string): string {
  const u = new URL(url);
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  u.search = '';
  u.hash = '';
  return u.toString();
}

/** Command line: `[url] [--version x.y.z] [--commit sha]`. */
export function parseArgs(argv: string[], packageVersion: string): SmokeOptions {
  let url = MAIN_URL;
  let version = packageVersion;
  let commit: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (!v || v.startsWith('--')) throw new Error(`${a} braucht einen Wert`);
      return v;
    };
    if (a === '--version') version = value();
    else if (a === '--commit') commit = value();
    else if (a.startsWith('--')) throw new Error(`Unbekannte Option ${a}`);
    else url = a;
  }
  return { url: baseUrl(url), version, ...(commit ? { commit } : {}) };
}

/** Compares version.json of the deployed build with the expectation; returns the deviations. */
export function checkVersionInfo(info: unknown, expected: Pick<SmokeOptions, 'version' | 'commit'>): string[] {
  if (!info || typeof info !== 'object') return ['version.json ist kein JSON-Objekt'];
  const { version, commit } = info as { version?: unknown; commit?: unknown };
  const errors: string[] = [];
  if (version !== expected.version) errors.push(`Version ${String(version)} ausgeliefert, erwartet ${expected.version}`);
  if (expected.commit && commit !== expected.commit) errors.push(`Commit ${String(commit)} ausgeliefert, erwartet ${expected.commit}`);
  return errors;
}

/**
 * Pages to check: the addresses from sitemap.xml, moved onto the checked base address (the sitemap always names the
 * main domain). The calculator itself (base address) is checked separately in more detail.
 */
export function sitemapPages(xml: string, base: string): string[] {
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  return locs
    .map((loc) => new URL(new URL(loc).pathname.replace(/^\//, ''), base).toString())
    .filter((u) => u !== base);
}

/** Requests that do not count as an error: the blocked visitor statistics. */
export function isIgnoredUrl(url: string): boolean {
  try {
    return new URL(url).hostname === ANALYTICS_HOST;
  } catch {
    return false;
  }
}
