import * as Speech from 'expo-speech';

// ---- Voice pool ------------------------------------------------------------
// Instead of pitch-shifting one robotic default voice, we pick real voices
// from the device. iOS ships neural "Enhanced" voices and Android's Google
// TTS voices are far more natural than the default — we prefer those, and
// give every character a distinct voice from the pool.

let pool: Speech.Voice[] = [];
const assigned = new Map<string, string>(); // character -> voice identifier

export async function loadVoices(): Promise<void> {
  if (pool.length > 0) return;
  try {
    const all = await Speech.getAvailableVoicesAsync();
    if (all.length === 0) return;
    const english = all.filter((v) => v.language?.toLowerCase().startsWith('en'));
    const candidates = english.length > 0 ? english : all;
    const enhanced = candidates.filter((v) => v.quality === Speech.VoiceQuality.Enhanced);
    // Enhanced-only when we have enough for variety; otherwise mix in the rest,
    // enhanced first so solo characters still get the best voice.
    pool = (enhanced.length >= 2 ? enhanced : [...enhanced, ...candidates.filter((v) => v.quality !== Speech.VoiceQuality.Enhanced)])
      .slice()
      .sort((a, b) => a.identifier.localeCompare(b.identifier));
  } catch {
    pool = []; // fall back to pitch variation
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Deterministic per-character pitch — the fallback when no voices are available.
export function pitchFor(character: string): number {
  return 0.85 + (hash(character) % 7) * 0.05; // 0.85 .. 1.15
}

// Pick a stable, distinct voice per character: hash into the pool, then
// linear-probe past voices other characters already took.
export function voiceOptsFor(character: string): { voice?: string; pitch?: number } {
  if (pool.length === 0) return { pitch: pitchFor(character) };
  const existing = assigned.get(character);
  if (existing) return { voice: existing };
  const taken = new Set(assigned.values());
  let i = hash(character) % pool.length;
  for (let step = 0; step < pool.length && taken.has(pool[i].identifier); step++) {
    i = (i + 1) % pool.length;
  }
  const voice = pool[i].identifier;
  assigned.set(character, voice);
  return { voice };
}

// ---- Speaking --------------------------------------------------------------

// Resolves when the utterance ends, errors, or is stopped. A generous timeout
// backstops platforms where onDone never fires (some web browsers).
export function speakOnce(
  text: string,
  opts: { rate?: number; pitch?: number; voice?: string } = {},
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve();
      }
    };
    const words = text.trim().split(/\s+/).length;
    const timer = setTimeout(finish, 4000 + (words * 800) / (opts.rate ?? 1));
    try {
      Speech.speak(text, {
        rate: opts.rate,
        pitch: opts.pitch,
        voice: opts.voice,
        onDone: finish,
        onStopped: finish,
        onError: finish,
      });
    } catch {
      finish();
    }
  });
}

export function stopSpeaking() {
  Speech.stop();
}
