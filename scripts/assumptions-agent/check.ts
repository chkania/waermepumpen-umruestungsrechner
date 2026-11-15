/**
 * Runs the pre-check of the assumptions (F22.3) for all source groups: download, ask the model, verify the quotes.
 * Download and model request are injected, so the flow is testable without network and API.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Source } from './fetch-source';
import { ANSWER_SCHEMA, buildTask, checkFindings, parseAnswer, SYSTEM_PROMPT, type CheckedItem, type FailedGroup, type SourceGroup } from './lib';

export const MODEL = 'claude-opus-5-5';
/** Larger pages are reported as an error instead of being cut off silently. */
export const MAX_SOURCE_CHARS = 600_000;

export type AskFn = (group: SourceGroup, source: Source) => Promise<string>;

export interface CheckDeps {
  fetchSource: (url: string) => Promise<Source>;
  ask: AskFn;
  log?: (msg: string) => void;
}

export async function checkGroups(groups: readonly SourceGroup[], deps: CheckDeps): Promise<{ checked: CheckedItem[]; failed: FailedGroup[] }> {
  const checked: CheckedItem[] = [];
  const failed: FailedGroup[] = [];
  for (const [i, group] of groups.entries()) {
    deps.log?.(`[${i + 1}/${groups.length}] ${group.url} (${group.items.length} Wert(e))`);
    try {
      const source = await deps.fetchSource(group.url);
      if (source.kind === 'text' && source.text.length > MAX_SOURCE_CHARS) {
        throw new Error(`Quelle zu groß (${source.text.length.toLocaleString('de-DE')} Zeichen)`);
      }
      const findings = parseAnswer(await deps.ask(group, source), group);
      checked.push(...checkFindings(group, findings, source.kind === 'text' ? source.text : null));
    } catch (err) {
      failed.push({ url: group.url, items: group.items, error: (err as Error).message });
    }
  }
  return { checked, failed };
}

/** Model request for one source: the source as a document block, the values as task, the answer as JSON (schema). */
export function claudeAsk(client: Anthropic): AskFn {
  return async (group, source) => {
    const document: Anthropic.Beta.BetaRequestDocumentBlock =
      source.kind === 'pdf'
        ? { type: 'document', title: group.url, source: { type: 'base64', media_type: 'application/pdf', data: source.base64 } }
        : { type: 'document', title: group.url, source: { type: 'text', media_type: 'text/plain', data: source.text } };
    const message = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 16000,
        // a declined request is answered by a fallback model instead of failing
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: [document, { type: 'text', text: buildTask(group) }] }],
      })
      .finalMessage();
    if (message.stop_reason === 'refusal') throw new Error('Modell hat die Anfrage abgelehnt');
    if (message.stop_reason === 'max_tokens') throw new Error('Antwort abgeschnitten (max_tokens)');
    const text = message.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') throw new Error('Antwort ohne Text');
    return text.text;
  };
}
