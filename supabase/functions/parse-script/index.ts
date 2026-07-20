// Server-side Claude proxy for script parsing and smart director notes.
// Deploy with (JWT verification ON — do NOT pass --no-verify-jwt):
//   supabase functions deploy parse-script
// Secret (supabase secrets set KEY=value):
//   ANTHROPIC_API_KEY - your Claude key (console.anthropic.com)
// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically.
//
// Why this exists: EXPO_PUBLIC_* env vars are inlined into the public web
// bundle, so a client-side Anthropic key would ship to every visitor's
// browser where it could be lifted and run up the bill. Keeping the key here
// — on the server — is the fix. The browser sends the PDF / photos / note;
// this function calls Claude and returns only the structured result.
//
// Access is gated on a real signed-in user (not just a valid JWT): the anon
// key is public, so verifying the JWT alone wouldn't stop anyone from
// hammering this endpoint with the bundled key. Requiring an authenticated
// account means abuse can be traced to — and cut off at — a user.

import Anthropic from 'npm:@anthropic-ai/sdk@0.111';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = 'claude-opus-4-8';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// --- Script transcription (pdf / photos) -----------------------------------

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

const scriptInstructions = (source: 'photos' | 'PDF') =>
  `These ${source === 'photos' ? 'photos are pages of' : 'pages are'} an acting audition script (sides), in page order.
Transcribe the script faithfully into structured elements:
- "line": one character's complete speech. Keep the character name UPPERCASE exactly as printed (drop trailing markers like (V.O.) or (CONT'D) from the name). Merge a speech that wraps across lines or pages into a single element.
- "direction": scene headings, action/stage directions, and inline actor parentheticals like (beat) or (laughing). Put a parenthetical as its own direction element just before the line it modifies; never leave it inside the line text.
Ignore page numbers, watermarks, and handwritten notes. Preserve the original wording exactly — do not paraphrase.`;

type ApiMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
const API_MEDIA_TYPES: ApiMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const toMediaType = (mimeType: string | null | undefined): ApiMediaType =>
  API_MEDIA_TYPES.find((t) => t === mimeType) ?? 'image/jpeg';

interface Element {
  type: 'line' | 'direction';
  character?: string;
  text: string;
}

// Throws user-facing Error messages (surfaced to the client as { error }).
function extractScript(
  response: Anthropic.Messages.Message,
  emptyErrorNoun: string,
): { title: string; elements: Element[] } {
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
  const elements: Element[] = parsed.elements
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

// --- Director notes ---------------------------------------------------------

const DELIVERY_SCHEMA = {
  type: 'object',
  properties: {
    rate: {
      type: 'number',
      description:
        'Speaking-speed multiplier, 0.5–2. Angry/excited/urgent ≈ 1.1–1.3; sad/tired/thoughtful ≈ 0.75–0.9; 1 = unchanged.',
    },
    pitch: {
      type: 'number',
      description:
        'Voice-pitch multiplier, 0.6–1.5. Angry/menacing slightly lower ≈ 0.9; excited/panicked higher ≈ 1.1–1.2; 1 = unchanged.',
    },
    pauseBeforeMs: {
      type: 'number',
      description: 'Silence in milliseconds before the line starts, 0–10000. "Pause 2 seconds first" → 2000.',
    },
    pauseAfterMs: {
      type: 'number',
      description: 'Silence in milliseconds after the line ends, 0–10000.',
    },
    cutoff: {
      type: 'boolean',
      description:
        'True when the reader should interrupt — start this line before the user finishes their previous line ("cut me off", "talk over me", "interrupt me").',
    },
  },
  required: ['rate', 'pitch', 'pauseBeforeMs', 'pauseAfterMs', 'cutoff'],
  additionalProperties: false,
};

async function parseScript(
  client: Anthropic,
  content: Anthropic.Messages.ContentBlockParam[],
  noun: 'photos' | 'PDF',
) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: SCRIPT_SCHEMA } },
    messages: [{ role: 'user', content }],
  });
  return extractScript(response, noun);
}

// --- Handler ----------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // Require a real signed-in user. The anon key is public, so we validate the
  // caller's token against Supabase Auth and reject anything without a user.
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'Sign in to upload scripts.' }, 401);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Script reading is temporarily unavailable.' }, 503);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }

  const client = new Anthropic({ apiKey });
  const mode = payload.mode;

  try {
    if (mode === 'pdf') {
      const pdf = String(payload.pdf ?? '').replace(/^data:application\/pdf;base64,/, '');
      const result = await parseScript(
        client,
        [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf } },
          { type: 'text', text: scriptInstructions('PDF') },
        ],
        'PDF',
      );
      return json(result);
    }

    if (mode === 'photos') {
      const photos = (payload.photos as { base64: string; mimeType: string | null }[]) ?? [];
      const result = await parseScript(
        client,
        [
          ...photos.map((photo) => ({
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: toMediaType(photo.mimeType),
              data: photo.base64.replace(/^data:image\/\w+;base64,/, ''),
            },
          })),
          { type: 'text', text: scriptInstructions('photos') },
        ],
        'photos',
      );
      return json(result);
    }

    if (mode === 'direction') {
      const note = String(payload.note ?? '').trim();
      const line = (payload.line as { character: string; text: string }) ?? { character: '', text: '' };
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        output_config: { format: { type: 'json_schema', schema: DELIVERY_SCHEMA } },
        messages: [
          {
            role: 'user',
            content: `You are compiling an actor's director-note into text-to-speech delivery parameters for an AI scene reader. The reader cannot truly act, so approximate emotion with speed and pitch, and be conservative — small changes read better than big ones. Use the parameter defaults (rate 1, pitch 1, pauses 0, cutoff false) for anything the note doesn't ask for.

The reader is about to say this line as ${line.character}:
"${line.text}"

The actor's note for this line:
"${note}"`,
          },
        ],
      });
      const block = response.content.find((b) => b.type === 'text');
      if (block?.type !== 'text') return json({ error: 'empty response' }, 502);
      return json(JSON.parse(block.text));
    }

    return json({ error: 'unknown mode' }, 400);
  } catch (err) {
    // extractScript throws user-safe messages; Claude/network errors don't, so
    // log the raw cause and return a generic note for those.
    console.error(err);
    const message =
      err instanceof Error && !(err instanceof Anthropic.APIError)
        ? err.message
        : 'The reader is having trouble right now. Try again in a moment.';
    return json({ error: message }, 502);
  }
});
