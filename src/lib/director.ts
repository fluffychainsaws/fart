import { invokeParseProxy } from './parser';
import { supabase } from './supabase';
import type { Delivery } from './types';

const NO_CHANGE: Omit<Delivery, 'note'> = {
  rate: 1,
  pitch: 1,
  pauseBeforeMs: 0,
  pauseAfterMs: 0,
  cutoff: false,
};

// Keyword fallback when there's no API key (or the call fails): covers the
// common notes so the feature still works offline.
export function keywordDelivery(note: string): Omit<Delivery, 'note'> {
  const n = note.toLowerCase();
  const d = { ...NO_CHANGE };
  if (/(angr|mad|furious|yell|shout|aggress)/.test(n)) {
    d.rate = 1.18;
    d.pitch = 0.92;
  } else if (/(sad|soft|gentle|tender|tired|somber|quiet|whisper)/.test(n)) {
    d.rate = 0.85;
    d.pitch = 0.96;
  } else if (/(excited|happy|energetic|upbeat|thrilled|panick|frantic)/.test(n)) {
    d.rate = 1.2;
    d.pitch = 1.12;
  } else if (/(menac|threat|cold|creepy|sinister)/.test(n)) {
    d.rate = 0.9;
    d.pitch = 0.85;
  }
  if (/(slower|slow down|drag|drawn out)/.test(n)) d.rate = Math.min(d.rate, 0.8);
  if (/(faster|speed up|quick|rapid|rush)/.test(n)) d.rate = Math.max(d.rate, 1.25);
  const before = n.match(/(?:pause|wait|beat)[^.]*?(\d+(?:\.\d+)?)\s*(?:sec|second|s\b)/);
  if (before) d.pauseBeforeMs = Math.min(10000, Math.round(parseFloat(before[1]) * 1000));
  else if (/(pause|beat|wait) (?:before|first)|long pause|dramatic pause/.test(n)) d.pauseBeforeMs = 1500;
  if (/(pause|wait|beat|linger) after|let it (?:hang|land|sit)/.test(n)) d.pauseAfterMs = 1500;
  if (/(cut me off|cuts? me|interrupt|talk over|barge|jump in|don'?t let me finish)/.test(n)) {
    d.cutoff = true;
  }
  return d;
}

// Turn a natural-language director's note into delivery parameters. Uses
// Claude (via the server proxy) for a signed-in user; otherwise — signed out,
// offline, or on any error — the keyword fallback, so the feature always works.
export async function interpretDirection(
  note: string,
  line: { character: string; text: string },
): Promise<Delivery> {
  const trimmed = note.trim();

  // Signed out → no server call to make; the keyword fallback still covers the
  // common notes. (Avoids a doomed round-trip the proxy would 401 anyway.)
  let signedIn = false;
  try {
    signedIn = supabase ? Boolean((await supabase.auth.getSession()).data.session) : false;
  } catch {
    signedIn = false;
  }
  if (!signedIn) return { note: trimmed, ...keywordDelivery(trimmed) };

  try {
    const params = await invokeParseProxy<Omit<Delivery, 'note'>>({
      mode: 'direction',
      note: trimmed,
      line,
    });
    return {
      note: trimmed,
      rate: clamp(params.rate, 0.5, 2),
      pitch: clamp(params.pitch, 0.6, 1.5),
      pauseBeforeMs: clamp(params.pauseBeforeMs, 0, 10000),
      pauseAfterMs: clamp(params.pauseAfterMs, 0, 10000),
      cutoff: Boolean(params.cutoff),
    };
  } catch {
    return { note: trimmed, ...keywordDelivery(trimmed) };
  }
}

const clamp = (n: number, lo: number, hi: number) =>
  Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo === 0 ? 0 : 1;
