/**
 * SourceParser: Claude-basierte Extraktion von Werten aus HTML/Text
 * 
 * Nutzt Claude API (claude-3-5-sonnet-20241022) zur intelligenten Extraktion
 * von Regulations-Werten mit Confidence-Bewertung.
 */

import { Anthropic } from '@anthropic-ai/sdk';

export interface Regulation {
  key: string;
  description: string;
  value: unknown;
  valueType?: 'number' | 'string' | 'date' | 'boolean';
  source: {
    reference: string;
    url?: string;
  };
}

export interface ExtractedValue {
  value: unknown;
  confidence: number; // 0.0 - 1.0
  reasoning: string;
  changed: boolean;
  notes?: string;
}

export class SourceParser {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async extract(
    sourceText: string,
    regulation: Regulation
  ): Promise<ExtractedValue> {
    // Text auf max 4000 Zeichen begrenzen (API-Limits)
    const textSlice = sourceText.slice(0, 4000);

    const prompt = `Du bist Experte für deutsche Förderregeln, Steuern und Energiepreise.
Extrahiere aus dem folgenden Text den aktuellen Wert für: "${regulation.description}"

Kontext:
- Richtlinie: ${regulation.source.reference}
- Aktuell in unserem System: ${JSON.stringify(regulation.value)}
- Erwartetes Format: ${regulation.valueType || 'any'}

Text zum Analysieren:
---
${textSlice}
---

Antworte als gültiges JSON (keine Markdown-Blöcke, nur JSON):
{
  "value": <extrahierter Wert (type-korrekt: number, string, boolean, etc.)>,
  "confidence": <0.0–1.0 (wie sicher bin ich, dass dieser Wert korrekt ist?)>,
  "reasoning": "<kurze Begründung, warum dieser Wert>",
  "changed": <boolean (hat sich der Wert geändert?)>,
  "notes": "<optionale Besonderheiten oder Kontext>"
}

Wichtig:
- Confidence < 0.7 bedeutet: unsicher, wahrscheinlich nicht vorhanden
- value muss vom korrekten Typ sein (number, string, boolean, etc.)
- Wenn nicht findbar: value=null, confidence=0`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      if (response.content[0].type !== 'text') {
        throw new Error('Unerwarteter Response-Typ von Claude');
      }

      const text = response.content[0].text;

      // Parse JSON (mit Fehlertoleranz)
      let extracted: Partial<ExtractedValue>;
      try {
        // Entferne mögliche Markdown-Blöcke
        const jsonText = text.replace(/```json\n?|\n?```/g, '').trim();
        extracted = JSON.parse(jsonText);
      } catch (parseErr) {
        throw new Error(
          `Claude-Response ist kein gültiges JSON:\n${text}\n\nFehler: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
        );
      }

      // Validierung
      if (!('confidence' in extracted) || !('reasoning' in extracted)) {
        throw new Error('Fehlende Felder in Claude-Response (confidence, reasoning)');
      }

      const confidence = Number(extracted.confidence) || 0;
      const changed = extracted.changed ?? regulation.value !== extracted.value;

      return {
        value: extracted.value,
        confidence,
        reasoning: String(extracted.reasoning),
        changed,
        notes: extracted.notes ? String(extracted.notes) : undefined,
      };
    } catch (err) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error(`Claude-Fehler: ${String(err)}`);
    }
  }
}

export const globalParser = new SourceParser();
