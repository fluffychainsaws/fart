import Anthropic from '@anthropic-ai/sdk';

import { hasApiKey } from './parser';
import type { Delivery } from './types';

const MODEL = 'claude-opus-4-8';

const NO_CHANGE: Omit<Delivery, 'note'> = {
  rate: 1,
  pitch: 1,
  pauseBeforeMs: 0,
  pauseAfterMs: 0,
  cutoff: false,
};

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

// Turn a natural-language director's note into delivery parameters.
// Uses Claude when a key is configured; otherwise the keyword fallback.
export async function interpretDirection(
  note: string,
  line: { character: string; text: string },
): Promise<Delivery> {
  const trimmed = note.trim();
  if (!hasApiKey()) return { note: trimmed, ...keywordDelivery(trimmed) };

  try {
    const client = new Anthropic({
      apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY,
      dangerouslyAllowBrowser: true,
    });
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
"${trimmed}"`,
        },
      ],
    });
    const block = response.content.find((b) => b.type === 'text');
    if (block?.type !== 'text') throw new Error('empty response');
    const params = JSON.parse(block.text) as Omit<Delivery, 'note'>;
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
