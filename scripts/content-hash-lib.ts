/**
 * Content hash of a build (N12.2): decides whether a deployment changes anything on the webspace.
 *
 * The hash covers every file of dist/ (path and content, hidden files like .htaccess included) except version.json,
 * because that file carries the commit and therefore differs on every build. The build writes the hash into
 * version.json (`contentHash`); the deploy workflow compares it with the hash of the live site and skips the upload
 * if both are equal.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** File with the build information; excluded from the hash. */
export const VERSION_FILE = 'version.json';

/** Relative paths (with "/") of all files below `dir`, sorted. */
export function listFiles(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(dir, rel));
    else out.push(rel);
  }
  return out.sort();
}

/** SHA-256 over path and content of every file except version.json (independent of the order of the file system). */
export function contentHash(dir: string): string {
  const hash = createHash('sha256');
  for (const rel of listFiles(dir)) {
    if (rel === VERSION_FILE) continue;
    const fileHash = createHash('sha256').update(readFileSync(join(dir, rel))).digest('hex');
    hash.update(`${rel}\0${fileHash}\n`);
  }
  return hash.digest('hex');
}

/** `contentHash` of a parsed version.json; null if missing or not a SHA-256 hex string. */
export function hashOf(info: unknown): string | null {
  const value = typeof info === 'object' && info !== null ? (info as Record<string, unknown>).contentHash : undefined;
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) ? value : null;
}

export interface DeployDecision {
  needed: boolean;
  reason: string;
}

/**
 * Deployment needed? Yes if forced (manual run), if the live hash is unknown (live site unreachable, older version.json
 * without hash) or if it differs from the build; no only if both hashes are equal.
 */
export function deployDecision(live: unknown, built: string | null, force = false): DeployDecision {
  if (force) return { needed: true, reason: 'manueller Lauf – es wird immer bereitgestellt' };
  if (!built) return { needed: true, reason: 'Build enthält keinen Inhalts-Hash' };
  const liveHash = hashOf(live);
  if (!liveHash) return { needed: true, reason: 'Hash der Live-Seite unbekannt' };
  if (liveHash !== built) return { needed: true, reason: 'Inhalt von dist/ hat sich gegenüber der Live-Seite geändert' };
  return { needed: false, reason: 'dist/ ist unverändert gegenüber der Live-Seite' };
}
