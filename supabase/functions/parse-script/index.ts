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
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Monthly audition limits per tier — keep in sync with src/lib/subscription.ts
// (TIERS[*].auditionsPerMonth). Infinity means the tier is unlimited and skips
// the counter entirely. Duplicated here because this Deno function can't import
// the app's TypeScript.
const AUDITION_LIMITS: Record<string, number> = {
  free: 1,
  fart: 6,
  fartpro: 14,
  shartstar: Infinity,
};

// 'YYYY-MM' in UTC — the key the audition counter rolls over on.
function monthKey(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Script transcription runs on Haiku 4.5 (~5x cheaper than Opus per the
// pricing) with an automatic one-shot retry on Opus 4.8 if Haiku errors or
// finds no dialogue — see parseScript. Reading already-typed dialogue off a
// clean PDF is OCR-plus-structure, not deep reasoning, so Haiku handles the
// common case; Opus is the safety net for messy scans/photos. Director-note
// interpretation stays on Opus (small volume, more nuanced).
const SCRIPT_MODEL_PRIMARY = 'claude-haiku-4-5';
const SCRIPT_MODEL_FALLBACK = 'claude-opus-4-8';
const DIRECTION_MODEL = 'claude-opus-4-8';

// Per-account monthly ceiling on director-note (Opus) calls — a spend cap so
// one user can't loop this endpoint. Uploads are already bounded by the
// audition quota; this covers the one paid path that isn't. Generous for real
// use (a handful of notes per script); tune here.
const DIRECTION_MONTHLY_LIMIT = 300;

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
  const models = [SCRIPT_MODEL_PRIMARY, SCRIPT_MODEL_FALLBACK];
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 16000,
        // Adaptive thinking is Opus-family only — Haiku 4.5 rejects it (400).
        // Transcription needs no thinking, so Haiku just omits it.
        ...(model.startsWith('claude-opus') ? { thinking: { type: 'adaptive' as const } } : {}),
        output_config: { format: { type: 'json_schema', schema: SCRIPT_SCHEMA } },
        messages: [{ role: 'user', content }],
      });
      return extractScript(response, noun);
    } catch (err) {
      // Last model in the chain failed — give up and let the handler report it.
      if (i === models.length - 1) throw err;
      console.error(`parse on ${model} failed; retrying on ${models[i + 1]}:`, err);
    }
  }
  throw new Error('unreachable');
}

// Charges the upload against the user's quota BEFORE spending any Claude money,
// then parses. If Claude fails, the charge is refunded so a failed upload never
// costs the user an audition or a credit. `admin` is a service-role client (the
// quota RPCs are service_role-only, so the client can't call them directly).
async function gateAndParse(
  admin: SupabaseClient,
  client: Anthropic,
  userId: string,
  useCredit: boolean,
  content: Anthropic.Messages.ContentBlockParam[],
  noun: 'photos' | 'PDF',
): Promise<Response> {
  const { data: profile } = await admin.from('profiles').select('tier').eq('id', userId).single();
  const tier = (profile?.tier as string) ?? 'free';
  const month = monthKey();
  let consumed: 'credit' | 'audition' | 'none' = 'none';

  if (useCredit) {
    const { data: ok } = await admin.rpc('spend_premium_credit_for', { p_user_id: userId });
    if (ok !== true) return json({ error: "You don't have any Audition Credits left." }, 402);
    consumed = 'credit';
  } else {
    const limit = AUDITION_LIMITS[tier] ?? AUDITION_LIMITS.free;
    if (limit !== Infinity) {
      const { data: ok } = await admin.rpc('consume_audition', {
        p_user_id: userId,
        p_month: month,
        p_limit: limit,
      });
      if (ok !== true) {
        return json(
          { error: "You're out of auditions this month — upgrade your plan to keep going." },
          402,
        );
      }
      consumed = 'audition';
    }
  }

  try {
    const result = await parseScript(client, content, noun);
    // Best-effort analytics for the /admin dashboard (service role bypasses RLS).
    await admin.from('usage_events').insert({ user_id: userId, kind: 'audition' });
    return json({ ...result, usedCredit: consumed === 'credit' });
  } catch (err) {
    if (consumed === 'credit') {
      await admin.rpc('increment_premium_credits', { p_user_id: userId, p_amount: 1 });
    } else if (consumed === 'audition') {
      await admin.rpc('refund_audition', { p_user_id: userId, p_month: month });
    }
    throw err; // handled by the outer catch → friendly 502
  }
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

  // Service-role client for the quota RPCs (service_role-only) and the tier
  // read. The auth client above is only for verifying the caller's identity.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const client = new Anthropic({ apiKey });
  const mode = payload.mode;
  const useCredit = Boolean(payload.useCredit);

  try {
    if (mode === 'pdf') {
      const pdf = String(payload.pdf ?? '').replace(/^data:application\/pdf;base64,/, '');
      return await gateAndParse(
        admin,
        client,
        user.id,
        useCredit,
        [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf } },
          { type: 'text', text: scriptInstructions('PDF') },
        ],
        'PDF',
      );
    }

    if (mode === 'photos') {
      const photos = (payload.photos as { base64: string; mimeType: string | null }[]) ?? [];
      return await gateAndParse(
        admin,
        client,
        user.id,
        useCredit,
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
    }

    if (mode === 'direction') {
      // Spend cap: bound director-note calls per user per month.
      const { data: withinLimit } = await admin.rpc('consume_rate_limit', {
        p_user_id: user.id,
        p_kind: 'direction',
        p_month: monthKey(),
        p_amount: 1,
        p_limit: DIRECTION_MONTHLY_LIMIT,
      });
      if (withinLimit !== true) {
        return json({ error: "You've made a lot of director notes this month — try again later." }, 429);
      }
      const note = String(payload.note ?? '').trim();
      const line = (payload.line as { character: string; text: string }) ?? { character: '', text: '' };
      const response = await client.messages.create({
        model: DIRECTION_MODEL,
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
