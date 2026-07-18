import Anthropic from '@anthropic-ai/sdk';

import type { ScriptElement } from './types';

const MODEL = 'claude-opus-4-8';

export const hasApiKey = () => Boolean(process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY);

export interface ScriptPhoto {
  base64: string;
  mimeType: string | null;
}

type ApiMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
const API_MEDIA_TYPES: ApiMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const toMediaType = (mimeType: string | null): ApiMediaType =>
  API_MEDIA_TYPES.find((t) => t === mimeType) ?? 'image/jpeg';

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

const INSTRUCTIONS = (source: 'photos' | 'PDF') => `These ${source === 'photos' ? 'photos are pages of' : 'pages are'} an acting audition script (sides), in page order.
Transcribe the script faithfully into structured elements:
- "line": one character's complete speech. Keep the character name UPPERCASE exactly as printed (drop trailing markers like (V.O.) or (CONT'D) from the name). Merge a speech that wraps across lines or pages into a single element.
- "direction": scene headings, action/stage directions, and inline actor parentheticals like (beat) or (laughing). Put a parenthetical as its own direction element just before the line it modifies; never leave it inside the line text.
Ignore page numbers, watermarks, and handwritten notes. Preserve the original wording exactly — do not paraphrase.`;

function getApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'No API key set. Put EXPO_PUBLIC_ANTHROPIC_API_KEY in the .env file, then restart the dev server.',
    );
  }
  return apiKey;
}

function extractScript(
  response: Anthropic.Messages.Message,
  emptyErrorNoun: string,
): { title: string; elements: ScriptElement[] } {
  if (response.stop_reason === 'refusal') {
    throw new Error("The reader couldn't process this script. Try a clearer copy.");
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
    throw new Error(`Couldn't find any dialogue in the ${emptyErrorNoun}. Make sure the pages are readable.`);
  }
  return { title: parsed.title?.trim() || 'Untitled sides', elements };
}

export async function parseScriptPhotos(
  photos: ScriptPhoto[],
): Promise<{ title: string; elements: ScriptElement[] }> {
  // Dev-build setup: the key ships with the app bundle, which is fine while
  // this is a personal build. Move this call behind a small server before
  // distributing the app publicly.
  const client = new Anthropic({ apiKey: getApiKey(), dangerouslyAllowBrowser: true });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: SCRIPT_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          ...photos.map((photo) => ({
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: toMediaType(photo.mimeType),
              // Web can hand back a full data URL; the API wants bare base64.
              data: photo.base64.replace(/^data:image\/\w+;base64,/, ''),
            },
          })),
          { type: 'text' as const, text: INSTRUCTIONS('photos') },
        ],
      },
    ],
  });

  return extractScript(response, 'photos');
}

// Reads the PDF as a native document rather than flattening it to images —
// Claude parses the real embedded text/vector content, so this is more
// reliable than a photo for anything but a screenshot of a PDF (which is
// just an image, and still goes through parseScriptPhotos above).
export async function parseScriptPdf(base64: string): Promise<{ title: string; elements: ScriptElement[] }> {
  const client = new Anthropic({ apiKey: getApiKey(), dangerouslyAllowBrowser: true });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: SCRIPT_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: base64.replace(/^data:application\/pdf;base64,/, ''),
            },
          },
          { type: 'text' as const, text: INSTRUCTIONS('PDF') },
        ],
      },
    ],
  });

  return extractScript(response, 'PDF');
}
