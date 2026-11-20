/**
 * Connection to the MCP server wpir-mcp (Förder- und Rechtsdaten, F22.5): minimal JSON-RPC client over HTTP and the
 * checks for the contract between the calculator and the server. The server is stateless and answers with JSON, so a
 * plain POST is enough (no MCP SDK needed here).
 */

/** Tools the assumption checker relies on; a missing one means the server changed incompatibly. */
export const REQUIRED_TOOLS = ['list_topics', 'get_facts', 'list_sources', 'list_keys', 'check_value'] as const;

export interface McpConfig {
  mcpServers?: Record<string, { type?: string; url?: string }>;
}

/** URL of the server "wpir-mcp" from .mcp.json; null if missing or not an http server. */
export function serverUrl(config: unknown): string | null {
  const entry = (config as McpConfig | null)?.mcpServers?.['wpir-mcp'];
  return entry?.type === 'http' && typeof entry.url === 'string' && entry.url.startsWith('https://') ? entry.url : null;
}

/** One JSON-RPC call; returns `result`, throws on HTTP errors, JSON-RPC errors and unreadable answers. */
export async function rpc(url: string, method: string, params?: unknown, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json().catch(() => null)) as { result?: unknown; error?: { message?: string } } | null;
  if (!body) throw new Error('Antwort ist kein JSON');
  if (body.error) throw new Error(`JSON-RPC-Fehler: ${body.error.message ?? 'unbekannt'}`);
  return body.result;
}

/** Calls a tool and parses its JSON text answer. */
export async function callTool(url: string, name: string, args: Record<string, unknown> = {}, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const result = (await rpc(url, 'tools/call', { name, arguments: args }, fetchImpl)) as { isError?: boolean; content?: { text?: string }[] } | undefined;
  const text = result?.content?.[0]?.text;
  if (result?.isError || typeof text !== 'string') throw new Error(`Werkzeug ${name} lieferte einen Fehler: ${text ?? 'keine Antwort'}`);
  return JSON.parse(text);
}

/** Names of the required tools that the server does not offer. */
export function missingTools(result: unknown): string[] {
  const names = new Set(((result as { tools?: { name: string }[] } | null)?.tools ?? []).map((t) => t.name));
  return REQUIRED_TOOLS.filter((t) => !names.has(t));
}

/** Field paths of the server that the calculator does not know (renamed or removed field?). */
export function unknownKeys(serverKeys: readonly string[], calculatorKeys: Iterable<string>): string[] {
  const known = new Set(calculatorKeys);
  return serverKeys.filter((k) => !known.has(k));
}
