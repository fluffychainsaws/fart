import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

// Free neural voices that run inside the browser (Kokoro-82M via kokoro-js /
// onnxruntime). Unlike speechSynthesis — which Android Chrome breaks by
// ignoring voice selection — the app synthesizes the audio itself and plays
// it like any sound file, so the same natural voices work on every device.
// The model (~90MB, one-time, cached by the browser) downloads from the
// HuggingFace CDN the first time the user enables it.

const ENABLED_KEY = 'fart.neuralVoice.v1';
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
// Metro can't bundle onnxruntime-web (its internals use dynamic-import syntax
// the bundler rejects), so the self-contained ESM build of kokoro-js is
// imported straight from the CDN at runtime, web only. The Function
// indirection hides the import() from the bundler.
const KOKORO_CDN = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const importFromCdn = new Function('s', 'return import(s)') as (s: string) => Promise<KokoroModule>;

export interface NeuralVoiceOption {
  id: string; // kokoro voice id, e.g. "af_heart"
  label: string;
}

// Curated subset of Kokoro's voices — the strongest of each accent/gender.
export const NEURAL_VOICES: NeuralVoiceOption[] = [
  { id: 'af_heart', label: 'Heart · American female' },
  { id: 'af_bella', label: 'Bella · American female' },
  { id: 'af_nicole', label: 'Nicole · American female (soft)' },
  { id: 'af_sarah', label: 'Sarah · American female' },
  { id: 'am_michael', label: 'Michael · American male' },
  { id: 'am_adam', label: 'Adam · American male' },
  { id: 'am_puck', label: 'Puck · American male' },
  { id: 'bf_emma', label: 'Emma · British female' },
  { id: 'bf_alice', label: 'Alice · British female' },
  { id: 'bm_george', label: 'George · British male' },
  { id: 'bm_daniel', label: 'Daniel · British male' },
] as const;

const NARRATOR_VOICE = 'af_nicole'; // soft, unobtrusive for stage directions

type EngineState = 'off' | 'loading' | 'ready' | 'error';

interface KokoroEngine {
  generate(text: string, options: { voice?: string; speed?: number }): Promise<{ toBlob(): Blob }>;
}

interface KokoroModule {
  KokoroTTS: {
    from_pretrained(
      modelId: string,
      options: {
        dtype: string;
        device: string;
        progress_callback?: (info: {
          status?: string;
          file?: string;
          loaded?: number;
          total?: number;
        }) => void;
      },
    ): Promise<KokoroEngine>;
  };
}

let engine: KokoroEngine | null = null;
let state: EngineState = 'off';
let loadPromise: Promise<boolean> | null = null;
let progressPct = 0;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

export function subscribeNeuralVoice(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const neuralVoiceSupported = () => Platform.OS === 'web';
export const neuralVoiceState = (): EngineState => state;
export const neuralVoiceProgress = () => progressPct;
export const neuralVoiceActive = () => state === 'ready';

export async function wasNeuralEnabled(): Promise<boolean> {
  if (!neuralVoiceSupported()) return false;
  return (await AsyncStorage.getItem(ENABLED_KEY)) === '1';
}

export async function disableNeuralVoice(): Promise<void> {
  state = 'off';
  engine = null;
  loadPromise = null;
  await AsyncStorage.setItem(ENABLED_KEY, '0');
  notify();
}

export function enableNeuralVoice(): Promise<boolean> {
  if (!neuralVoiceSupported()) return Promise.resolve(false);
  if (state === 'ready') return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  state = 'loading';
  progressPct = 0;
  notify();

  loadPromise = (async () => {
    try {
      // Test seam: sandboxed CI can't reach the HuggingFace CDN, so browser
      // tests may inject a stub engine here. Harmless in production.
      const fake = (globalThis as Record<string, unknown>).__fakeNeuralEngine;
      if (fake) {
        engine = fake as KokoroEngine;
      } else {
        const { KokoroTTS } = await importFromCdn(KOKORO_CDN);
        const webgpu = Boolean((navigator as unknown as { gpu?: unknown }).gpu);
        engine = await KokoroTTS.from_pretrained(MODEL_ID, {
          dtype: webgpu ? 'fp32' : 'q8',
          device: webgpu ? 'webgpu' : 'wasm',
          progress_callback: (info) => {
            if (info.status !== 'progress' || !info.total) return;
            // Track the largest file (the model itself) so the bar is honest.
            if (info.total < 10_000_000) return;
            progressPct = Math.round(((info.loaded ?? 0) / info.total) * 100);
            notify();
          },
        });
      }
      state = 'ready';
      progressPct = 100;
      await AsyncStorage.setItem(ENABLED_KEY, '1');
      notify();
      return true;
    } catch {
      state = 'error';
      loadPromise = null;
      notify();
      return false;
    }
  })();
  return loadPromise;
}

// If the user enabled neural voices before, warm the engine on app entry —
// the model comes from browser cache, so this is quick after the first time.
export async function resumeNeuralVoiceIfEnabled(): Promise<void> {
  if (state !== 'off') return;
  if (await wasNeuralEnabled()) void enableNeuralVoice();
}

// ---- Per-character voice assignment (mirrors cloudVoice.ts) ---------------

const assigned = new Map<string, string>();

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function voiceFor(character: string): string {
  const existing = assigned.get(character);
  if (existing) return existing;
  const taken = new Set(assigned.values());
  let i = hash(character) % NEURAL_VOICES.length;
  for (let step = 0; step < NEURAL_VOICES.length && taken.has(NEURAL_VOICES[i].id); step++) {
    i = (i + 1) % NEURAL_VOICES.length;
  }
  assigned.set(character, NEURAL_VOICES[i].id);
  return NEURAL_VOICES[i].id;
}

// ---- Synthesis with caching ------------------------------------------------

const uriCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
// Serialize synthesis: two concurrent wasm inferences would crawl on phones.
let queue: Promise<unknown> = Promise.resolve();

function synthesize(text: string, voice: string, speed: number): Promise<string> {
  const key = `${voice}|${speed}|${hash(text)}-${text.length}`;
  const cached = uriCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = queue.then(async () => {
    const stillCached = uriCache.get(key);
    if (stillCached) return stillCached;
    if (!engine) throw new Error('engine not loaded');
    const audio = await engine.generate(text, { voice, speed });
    const uri = URL.createObjectURL(audio.toBlob());
    uriCache.set(key, uri);
    return uri;
  });
  queue = job.catch(() => {});
  inflight.set(key, job);
  job.finally(() => inflight.delete(key)).catch(() => {});
  return job;
}

const clampSpeed = (rate?: number) => Math.min(1.5, Math.max(0.6, rate ?? 1));

// Fire-and-forget: warm the cache for an upcoming line so playback is seamless.
export function prefetchNeuralLine(opts: { text: string; character?: string; rate?: number; voice?: string }) {
  if (!neuralVoiceActive()) return;
  const voice = opts.voice ?? (opts.character ? voiceFor(opts.character) : NARRATOR_VOICE);
  synthesize(opts.text, voice, clampSpeed(opts.rate)).catch(() => {});
}

// ---- Playback (same pattern as cloudVoice.ts) ------------------------------

let audioModeSet = false;
let currentPlayer: AudioPlayer | null = null;
let currentFinish: (() => void) | null = null;

export function stopNeuralSpeech() {
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

// Resolves true when done, false when synthesis/playback failed (caller
// should fall back to device speech).
export async function speakNeural(opts: {
  text: string;
  character?: string;
  rate?: number;
  voice?: string;
}): Promise<boolean> {
  if (!neuralVoiceActive()) return false;
  try {
    const voice = opts.voice ?? (opts.character ? voiceFor(opts.character) : NARRATOR_VOICE);
    const uri = await synthesize(opts.text, voice, clampSpeed(opts.rate));
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
