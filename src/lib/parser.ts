import Anthropic from '@anthropic-ai/sdk';

import type { ScriptElement } from './types';

const MODEL = 'claude-opus-4-8';

// Structured-output schema: the API guarantees the response is valid JSON
// matching this shape, so no fragile "please reply with JSON" parsing.
const SCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description:
        'Title of the scene or project as printed on the sides. Invent a short descriptive title if none is visible.',
    },
    elements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['line', 'direction'] },
          character: {
            type: 'string',
            description: 'Speaker name in UPPERCASE for line elements. Empty string for directions.',
          },
          text: { type: 'string' },
        },
        required: ['type', 'character', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'elements'],
  additionalProperties: false,
};

const INSTRUCTIONS = `These photos are pages of an acting audition script (sides), in page order.
Transcribe the script faithfully into structured elements:
- "line": one character's complete speech. Keep the character name UPPERCASE exactly as printed (drop trailing markers like (V.O.) or (CONT'D) from the name). Merge a speech that wraps across lines or pages into a single element.
- "direction": scene headings, action/stage directions, and inline actor parentheticals like (beat) or (laughing). Put a parenthetical as its own direction element just before the line it modifies; never leave it inside the line text.
Ignore page numbers, watermarks, and handwritten notes. Preserve the original wording exactly — do not paraphrase.`;

export async function parseScriptPhotos(
  base64Jpegs: string[],
): Promise<{ title: string; elements: ScriptElement[] }> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'No API key set. Put EXPO_PUBLIC_ANTHROPIC_API_KEY in the .env file, then restart the dev server.',
    );
  }

  // Dev-build setup: the key ships with the app bundle, which is fine while
  // this is a personal build. Move this call behind a small server before
  // distributing the app publicly.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: SCRIPT_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          ...base64Jpegs.map((data) => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data },
          })),
          { type: 'text' as const, text: INSTRUCTIONS },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error("The reader couldn't process this script. Try a clearer photo.");
  }
  const textBlock = response.content.find((b) => b.type === 'text');
  if (textBlock?.type !== 'text') {
    throw new Error('The reader came back empty-handed. Try again.');
  }

  const parsed = JSON.parse(textBlock.text) as {
    title: string;
    elements: { type: string; character: string; text: string }[];
  };
  const elements: ScriptElement[] = parsed.elements
    .filter((el) => el.text.trim().length > 0)
    .map((el) =>
      el.type === 'line' && el.character.trim()
        ? { type: 'line', character: el.character.trim().toUpperCase(), text: el.text.trim() }
        : { type: 'direction', text: el.text.trim() },
    );

  if (!elements.some((el) => el.type === 'line')) {
    throw new Error("Couldn't find any dialogue in the photos. Make sure the pages are readable.");
  }
  return { title: parsed.title?.trim() || 'Untitled sides', elements };
}
