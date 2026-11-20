import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { callTool, missingTools, REQUIRED_TOOLS, rpc, serverUrl, unknownKeys } from '../scripts/mcp-lib.ts';

describe('F22.5 Anbindung an den MCP-Server wpir-mcp', () => {
  it('liest die URL aus .mcp.json, nur https und Typ http', () => {
    expect(serverUrl({ mcpServers: { 'wpir-mcp': { type: 'http', url: 'https://x.vercel.app/mcp' } } })).toBe('https://x.vercel.app/mcp');
    for (const bad of [null, {}, { mcpServers: {} }, { mcpServers: { 'wpir-mcp': { type: 'http', url: 'http://x/mcp' } } }, { mcpServers: { 'wpir-mcp': { type: 'sse', url: 'https://x/mcp' } } }]) {
      expect(serverUrl(bad)).toBeNull();
    }
  });

  it('die .mcp.json des Repos zeigt auf einen https-Endpunkt /mcp', async () => {
    const { readFileSync } = await import('node:fs');
    const url = serverUrl(JSON.parse(readFileSync('.mcp.json', 'utf8')));
    expect(url).toMatch(/^https:\/\/.+\/mcp$/);
  });

  it('erkennt fehlende Werkzeuge', () => {
    expect(missingTools({ tools: REQUIRED_TOOLS.map((name) => ({ name })) })).toEqual([]);
    expect(missingTools({ tools: [{ name: 'list_keys' }] })).toEqual(['list_topics', 'get_facts', 'list_sources', 'check_value']);
    expect(missingTools(null)).toEqual([...REQUIRED_TOOLS]);
  });

  it('erkennt Feldpfade des Servers, die der Rechner nicht kennt', () => {
    expect(unknownKeys(['funding.grundRate', 'funding.alt'], ['funding.grundRate', 'tax.maxBonus'])).toEqual(['funding.alt']);
    expect(unknownKeys([], [])).toEqual([]);
  });
});

describe('F22.5 JSON-RPC-Client gegen einen lokalen Server', () => {
  let http: Server;
  let url: string;
  let mode: 'ok' | 'http500' | 'rpcError' | 'toolError' | 'nojson' = 'ok';

  beforeAll(async () => {
    http = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { method: string; params?: { name: string } };
        if (mode === 'http500') return void res.writeHead(500).end();
        if (mode === 'nojson') return void res.writeHead(200).end('kein json');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (mode === 'rpcError') return void res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Methode unbekannt' } }));
        if (body.method === 'tools/list') return void res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: REQUIRED_TOOLS.map((name) => ({ name })) } }));
        const text = mode === 'toolError' ? 'kaputt' : JSON.stringify({ status: 'gleich', echo: body.params?.name });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { isError: mode === 'toolError', content: [{ type: 'text', text }] } }));
      });
    });
    await new Promise<void>((resolve) => http.listen(0, resolve));
    url = `http://localhost:${(http.address() as AddressInfo).port}/mcp`;
  });
  afterAll(() => new Promise<void>((resolve) => http.close(() => resolve())));

  it('ruft Methoden und Werkzeuge auf', async () => {
    mode = 'ok';
    expect(missingTools(await rpc(url, 'tools/list'))).toEqual([]);
    expect(await callTool(url, 'check_value', { key: 'a', value: 1 })).toEqual({ status: 'gleich', echo: 'check_value' });
  });

  it('meldet HTTP-Fehler, JSON-RPC-Fehler, Werkzeugfehler und unlesbare Antworten', async () => {
    mode = 'http500';
    await expect(rpc(url, 'tools/list')).rejects.toThrow(/HTTP 500/);
    mode = 'nojson';
    await expect(rpc(url, 'tools/list')).rejects.toThrow(/kein JSON/);
    mode = 'rpcError';
    await expect(rpc(url, 'tools/list')).rejects.toThrow(/Methode unbekannt/);
    mode = 'toolError';
    await expect(callTool(url, 'check_value')).rejects.toThrow(/Fehler: kaputt/);
  });
});
