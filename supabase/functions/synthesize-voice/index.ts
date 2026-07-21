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
// SUPABASE_URL / SUPABASE_ANON_KEY are injected automatically.

import { createClient } from 'npm:@supabase/supabase-js@2';

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
// we switch. Fill these with real ElevenLabs voice IDs during the ElevenLabs
// week; until then everything falls back to ELEVEN_DEFAULT_VOICE.
const ELEVEN_VOICE_MAP: Record<string, string> = {
  // alloy: '...', ash: '...', ballad: '...', coral: '...', echo: '...',
  // fable: '...', nova: '...', onyx: '...', sage: '...', shimmer: '...', verse: '...',
};
const ELEVEN_DEFAULT_VOICE = 'EXAVITQu4vr4xnSDxMaL'; // ElevenLabs "Sarah"

// ElevenLabs multilingual — instructions aren't a native field, so the acting
// note is prepended as a lightweight cue.
async function synthElevenLabs(text: string, voice: string, instructions: string): Promise<Uint8Array> {
  const voiceId = ELEVEN_VOICE_MAP[voice] ?? ELEVEN_DEFAULT_VOICE;
  const input = instructions ? `[${instructions}] ${text}` : text;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY') ?? '',
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({ text: input, model_id: 'eleven_multilingual_v2' }),
  });
  if (!res.ok) throw new Error(`elevenlabs tts ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
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

  const provider = (Deno.env.get('VOICE_PROVIDER') ?? 'openai').toLowerCase();
  try {
    const audio =
      provider === 'elevenlabs'
        ? await synthElevenLabs(text, voice, instructions)
        : await synthOpenAI(text, voice, instructions);
    return json({ audio: toBase64(audio), format: 'mp3' });
  } catch (err) {
    console.error(err);
    return json({ error: 'synthesis failed' }, 502);
  }
});
