import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

// Natural "ChatGPT" voices via OpenAI's TTS API (gpt-4o-mini-tts). Optional:
// activates when EXPO_PUBLIC_OPENAI_API_KEY is set, and every call falls back
// to device speech on failure so rehearsal never stalls. The model takes
// plain-English acting instructions, so director notes become real delivery.

const OPENAI_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
] as const;

const NARRATOR_VOICE = 'sage';

export const hasCloudVoice = () => Boolean(process.env.EXPO_PUBLIC_OPENAI_API_KEY);

let enabled = true;
export const cloudVoiceActive = () => enabled && hasCloudVoice();
export const setCloudVoiceEnabled = (on: boolean) => {
  enabled = on;
};

const assigned = new Map<string, string>(); // character -> voice name

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function voiceFor(character: string): string {
  const existing = assigned.get(character);
  if (existing) return existing;
  const taken = new Set(assigned.values());
  let i = hash(character) % OPENAI_VOICES.length;
  for (let step = 0; step < OPENAI_VOICES.length && taken.has(OPENAI_VOICES[i]); step++) {
    i = (i + 1) % OPENAI_VOICES.length;
  }
  assigned.set(character, OPENAI_VOICES[i]);
  return OPENAI_VOICES[i];
}

export function buildInstructions(opts: {
  character?: string;
  note?: string;
  rate?: number;
}): string {
  const parts: string[] = [];
  if (opts.character) {
    parts.push(
      `You are a scene reader running lines for an actor's audition, playing ${opts.character}. Deliver the line naturally, like a real scene partner.`,
    );
  } else {
    parts.push('You are narrating stage directions: neutral, soft, unobtrusive.');
  }
  if (opts.note) parts.push(`Director's note for this line: ${opts.note}.`);
  const rate = opts.rate ?? 1;
  if (rate > 1.05) parts.push('Speak at a brisk pace.');
  if (rate < 0.95) parts.push('Speak slowly and deliberately.');
  return parts.join(' ');
}

// ---- Synthesis with caching -------------------------------------------------

const uriCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function synthesize(text: string, voice: string, instructions: string): Promise<string> {
  const key = `${voice}|${hash(instructions)}|${hash(text)}-${text.length}`;
  const cached = uriCache.get(key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
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
    if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
    const dataUri = await blobToDataUri(await res.blob());
    let uri = dataUri;
    if (Platform.OS !== 'web') {
      // Native players are happier with real files than giant data URIs.
      // Lazy require: expo-file-system's native module must never be
      // evaluated in a web bundle (same crash class as expo-media-library).
      const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
      const file = new File(Paths.cache, `fart-tts-${hash(key)}.mp3`);
      file.write(base64ToBytes(dataUri.slice(dataUri.indexOf(',') + 1)));
      uri = file.uri;
    }
    uriCache.set(key, uri);
    return uri;
  })();

  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

// Fire-and-forget: warm the cache for an upcoming line so playback is seamless.
export function prefetchCloudLine(opts: {
  text: string;
  character?: string;
  note?: string;
  rate?: number;
}) {
  if (!cloudVoiceActive()) return;
  const voice = opts.character ? voiceFor(opts.character) : NARRATOR_VOICE;
  synthesize(opts.text, voice, buildInstructions(opts)).catch(() => {});
}

// ---- Playback ---------------------------------------------------------------

let audioModeSet = false;
let currentPlayer: AudioPlayer | null = null;
let currentFinish: (() => void) | null = null;

export function stopCloudSpeech() {
  const player = currentPlayer;
  currentPlayer = null;
  if (player) {
    try {
      player.remove();
    } catch {
      // already released
    }
  }
  currentFinish?.();
  currentFinish = null;
}

// Speaks via OpenAI TTS. Resolves true when done, false when synthesis or
// playback failed (caller should fall back to device speech).
export async function speakCloud(opts: {
  text: string;
  character?: string;
  note?: string;
  rate?: number;
}): Promise<boolean> {
  try {
    const voice = opts.character ? voiceFor(opts.character) : NARRATOR_VOICE;
    const uri = await synthesize(opts.text, voice, buildInstructions(opts));
    if (!audioModeSet) {
      audioModeSet = true;
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    }
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (currentFinish === finish) currentFinish = null;
        resolve();
      };
      currentFinish = finish;
      const words = opts.text.trim().split(/\s+/).length;
      const timer = setTimeout(finish, 8000 + words * 900);
      const player = createAudioPlayer({ uri });
      currentPlayer = player;
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          if (currentPlayer === player) {
            currentPlayer = null;
            try {
              player.remove();
            } catch {
              // already released
            }
          }
          finish();
        }
      });
      player.play();
    });
    return true;
  } catch {
    return false;
  }
}
