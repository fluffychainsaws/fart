// Server-side premium-voice (TTS) proxy. Holds the provider key so it never
// ships in the browser bundle — same reason parse-script exists (an
// EXPO_PUBLIC_ key is readable by anyone who opens the page). Which provider
// runs is chosen by the VOICE_PROVIDER secret, so switching from ChatGPT to
// ElevenLabs is a one-value flip with no app redeploy.
//
// Deploy with Verify JWT OFF (the function checks the caller itself). Secrets:
//   VOICE_PROVIDER      - 'openai' (default) or 'elevenlabs'
//   OPENAI_API_KEY      - platform.openai.com key (openai provider)
//   ELEVENLABS_API_KEY  - elevenlabs.io key (elevenlabs provider)
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically (service role is used for the per-user monthly spend cap).

import { createClient } from 'npm:@supabase/supabase-js@2';

// Per-account monthly ceiling on synthesized characters — a spend cap so one
// user can't loop this endpoint and run up the TTS bill. Generous enough that
// real use (even unlimited-audition SHART STAR) won't hit it; tune here.
const TTS_MONTHLY_CHAR_LIMIT = 200_000;

// 'YYYY-MM' in UTC — the key the monthly meter rolls over on.
function monthKey(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`;
}

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

// ChatGPT voices — the app sends these slot names (alloy, coral, …) as-is.
async function synthOpenAI(text: string, voice: string, instructions: string): Promise<Uint8Array> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY') ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice,
      input: text,
      instructions,
      response_format: 'mp3',
    }),
  });
  if (!res.ok) throw new Error(`openai tts ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// Maps the app's OpenAI-style voice slot names to ElevenLabs voice IDs, so the
// app keeps ONE naming scheme across providers and only this table changes when
// we switch. These are ElevenLabs' long-standing premade voices (available to
// every account). Swap any for a voice from your own library by pasting its ID.
const ELEVEN_VOICE_MAP: Record<string, string> = {
  alloy: 'EXAVITQu4vr4xnSDxMaL', // Sarah — soft female
  ash: 'pNInz6obpgDQGcFmaJgB', // Adam — deep male
  ballad: 'XB0fDUnXU5powFXDhCwa', // Charlotte — female
  coral: '21m00Tcm4TlvDq8ikWAM', // Rachel — calm female
  echo: 'ErXwobaYiN019PkySvjV', // Antoni — male
  fable: 'JBFqnCBsd6RMkjVDRZzb', // George — warm British male
  nova: 'AZnzlk1XvdvUeBnXmlld', // Domi — strong female
  onyx: '2EiwWnXFnvU5JabPnv8n', // Clyde — gravelly male
  sage: 'IKne3meq5aSn9XLyUdCD', // Charlie — Australian male
  shimmer: 'pFZP5JQG7iQjIQuC4Bku', // Lily — female
  verse: 'N2lVS1w4EtoT3dr4eOWO', // Callum — male
};
const ELEVEN_DEFAULT_VOICE = 'EXAVITQu4vr4xnSDxMaL'; // ElevenLabs "Sarah"

async function elevenCall(voiceId: string, text: string): Promise<Uint8Array> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY') ?? '',
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    // multilingual_v2 has no "instructions" field — delivery comes from the
    // voice itself, so the director note isn't sent (prepending it would make
    // the voice read the note aloud).
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  });
  if (!res.ok) throw new Error(`elevenlabs tts ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// Tries the mapped voice; if that specific voice isn't available on the account
// (bad/deprecated ID), retries with the default so the user still hears
// ElevenLabs rather than dropping to the robotic device fallback.
async function synthElevenLabs(text: string, voice: string): Promise<Uint8Array> {
  const voiceId = ELEVEN_VOICE_MAP[voice] ?? ELEVEN_DEFAULT_VOICE;
  try {
    return await elevenCall(voiceId, text);
  } catch (err) {
    if (voiceId !== ELEVEN_DEFAULT_VOICE) return elevenCall(ELEVEN_DEFAULT_VOICE, text);
    throw err;
  }
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000; // avoid String.fromCharCode arg-count limits on big buffers
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // Signed-in users only — the anon key is public, so we validate the token and
  // reject anonymous callers (keeps the paid TTS key from being abused).
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
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }

  // Cap input so one call can't run up a huge bill — script lines are short.
  const text = String(payload.text ?? '').slice(0, 2000);
  const voice = String(payload.voice ?? 'coral');
  const instructions = String(payload.instructions ?? '');
  if (!text.trim()) return json({ error: 'no text' }, 400);

  // Per-user monthly spend cap. The RPC is service_role-only, so use a
  // service-role client (the auth client above only verifies identity).
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: withinLimit } = await admin.rpc('consume_rate_limit', {
    p_user_id: user.id,
    p_kind: 'tts_chars',
    p_month: monthKey(),
    p_amount: text.length,
    p_limit: TTS_MONTHLY_CHAR_LIMIT,
  });
  if (withinLimit !== true) {
    return json({ error: "You've hit this month's premium-voice limit." }, 429);
  }

  const provider = (Deno.env.get('VOICE_PROVIDER') ?? 'openai').toLowerCase();
  try {
    const audio =
      provider === 'elevenlabs'
        ? await synthElevenLabs(text, voice)
        : await synthOpenAI(text, voice, instructions);
    return json({ audio: toBase64(audio), format: 'mp3' });
  } catch (err) {
    console.error(err);
    return json({ error: 'synthesis failed' }, 502);
  }
});
