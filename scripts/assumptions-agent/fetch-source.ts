/**
 * Downloads a source for the pre-check of the assumptions (F22.3): HTML becomes plain text, a PDF stays binary
 * (sent to the model as a document). Retries with backoff; fetch and sleep are injectable for tests.
 */
import { Buffer } from 'node:buffer';
import { htmlToText } from './lib';

export type Source = { kind: 'text'; text: string } | { kind: 'pdf'; base64: string };

export interface FetchSourceOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  attempts?: number;
  timeoutMs?: number;
}

const USER_AGENT = 'Waermepumpen-Investitionsrechner-Annahmenpruefung (+https://github.com/chkania/waermepumpen-umruestungsrechner)';

export async function fetchSource(url: string, opts: FetchSourceOptions = {}): Promise<Source> {
  const { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), attempts = 3, timeoutMs = 30_000 } = opts;
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) await sleep(1000 * 2 ** (attempt - 2));
    try {
      const res = await fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/pdf;q=0.9,*/*;q=0.5' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        if (res.status < 500 && res.status !== 429) break; // client errors do not get better on retry
        continue;
      }
      const type = res.headers.get('content-type') ?? '';
      if (type.includes('pdf') || /\.pdf(\?|$)/i.test(url)) {
        return { kind: 'pdf', base64: Buffer.from(await res.arrayBuffer()).toString('base64') };
      }
      const body = await res.text();
      const text = type.includes('html') || /^\s*</.test(body) ? htmlToText(body) : body.trim();
      if (!text) throw new Error('Seite enthält keinen Text');
      return { kind: 'text', text };
    } catch (err) {
      lastError = (err as Error).name === 'TimeoutError' ? `keine Antwort nach ${timeoutMs / 1000} s` : (err as Error).message;
    }
  }
  throw new Error(`nicht abrufbar (${lastError})`);
}
