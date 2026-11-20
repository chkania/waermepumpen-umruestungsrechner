/**
 * Checks the connection to the MCP server wpir-mcp and the contract with the calculator (F22.5):
 *
 *   node scripts/mcp-check.ts [url]   url: default from .mcp.json
 *
 * 1. the server answers and offers all required tools,
 * 2. every field path it has a reference value for exists in the calculator (src/core/sources.ts),
 * 3. check_value works (round trip with a reference value of the server itself).
 * Exit code 1 on any problem. Needs network; not part of `npm test`.
 */
import { readFileSync } from 'node:fs';
import { DEFAULT_SOURCES } from '../src/core/sources.ts';
import { callTool, missingTools, rpc, serverUrl, unknownKeys } from './mcp-lib.ts';

const config = JSON.parse(readFileSync(new URL('../.mcp.json', import.meta.url), 'utf8')) as unknown;
const url = process.argv[2] || serverUrl(config);
if (!url) {
  console.error('Keine https-URL für "wpir-mcp" in .mcp.json und keine als Argument.');
  process.exit(1);
}

const problems: string[] = [];
try {
  console.log(`Server: ${url}`);
  const missing = missingTools(await rpc(url, 'tools/list'));
  if (missing.length) problems.push(`Werkzeuge fehlen: ${missing.join(', ')}`);
  else console.log('✓ alle Werkzeuge vorhanden');

  const keys = (await callTool(url, 'list_keys')) as string[];
  const unknown = unknownKeys(keys, Object.keys(DEFAULT_SOURCES));
  if (unknown.length) problems.push(`Feldpfade des Servers im Rechner unbekannt: ${unknown.join(', ')}`);
  else console.log(`✓ ${keys.length} Feldpfade, alle im Rechner bekannt`);

  const sample = keys[0];
  const fact = (await callTool(url, 'get_facts', { key: sample })) as { refs: Record<string, number | string | boolean> }[];
  const check = (await callTool(url, 'check_value', { key: sample, value: fact[0].refs[sample] })) as { status: string };
  if (check.status !== 'gleich') problems.push(`check_value für ${sample} lieferte "${check.status}" statt "gleich"`);
  else console.log(`✓ check_value (${sample}) funktioniert`);
} catch (error) {
  problems.push(`Server nicht erreichbar oder Antwort unbrauchbar: ${(error as Error).message}`);
}

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
