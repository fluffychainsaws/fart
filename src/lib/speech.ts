import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import { stopCloudSpeech } from './cloudVoice';
import { rankVoices } from './voiceRank';

// ---- Voice pool ------------------------------------------------------------
// Instead of pitch-shifting one robotic default voice, we pick real voices
// from the device, ranked by quality (see voiceRank.ts): iOS "Enhanced"
// neural voices, Edge's free "(Natural)" neural voices, and Chrome's hosted
// Google voices beat the robotic defaults, and novelty voices are dropped.

let pool: Speech.Voice[] = [];
const assigned = new Map<string, string>(); // character -> voice identifier

export async function loadVoices(): Promise<void> {
  if (pool.length > 0) return;
  try {
    const all = await Speech.getAvailableVoicesAsync();
    if (all.length === 0) return;
    const english = all.filter((v) => v.language?.toLowerCase().startsWith('en'));
    pool = rankVoices(english.length > 0 ? english : all);
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

// Android Chrome ignores the utterance's voice — whatever we pick, it speaks
// with the system default — and phone TTS engines often expose only
// near-identical voices anyway. In that situation, vary pitch per character
// so the cast is still distinguishable; elsewhere, real voice variety exists
// and pitch-shifting would only degrade the good neural voices.
function lowVoiceVariety(): boolean {
  if (pool.length < 2) return true;
  return (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    /android/i.test(navigator.userAgent)
  );
}

// The loaded device-voice pool, for voice-picker UIs. Call loadVoices() first.
export function getVoicePool(): Speech.Voice[] {
  return pool;
}

// Pick a stable, distinct voice per character: hash into the pool, then
// linear-probe past voices other characters already took. An explicit
// override (from the script's voice picker) wins outright.
export function voiceOptsFor(character: string, override?: string): { voice?: string; pitch?: number } {
  if (override) return { voice: override };
  if (pool.length === 0) return { pitch: pitchFor(character) };
  const withVariety = (voice: string) =>
    lowVoiceVariety() ? { voice, pitch: pitchFor(character) } : { voice };
  const existing = assigned.get(character);
  if (existing) return withVariety(existing);
  const taken = new Set(assigned.values());
  let i = hash(character) % pool.length;
  for (let step = 0; step < pool.length && taken.has(pool[i].identifier); step++) {
    i = (i + 1) % pool.length;
  }
  const voice = pool[i].identifier;
  assigned.set(character, voice);
  return withVariety(voice);
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
  stopCloudSpeech();
}
