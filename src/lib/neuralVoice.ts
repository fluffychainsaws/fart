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
  id: string; // app-level id used in "neural:<id>" (usually the kokoro voice id)
  label: string;
  // Derived voices: synthesize with `base`, then play back `pitchShift`×
  // faster without pitch correction. Generation is slowed by the same factor,
  // so tempo lands back at normal while the voice sits higher — which is how
  // the young voices are made (Kokoro has no child voices of its own).
  base?: string;
  pitchShift?: number;
}

// Every English voice Kokoro ships (28), plus two derived young voices.
// Each voice is a small (~500KB) add-on fetched on first use — the model
// download covers them all, so listing everything costs nothing.
export const NEURAL_VOICES: NeuralVoiceOption[] = [
  // American female
  { id: 'af_heart', label: 'Heart · American female' },
  { id: 'af_sarah', label: 'Sarah · American female' },
  { id: 'af_aoede', label: 'Aoede · American female' },
  { id: 'af_kore', label: 'Kore · American female' },
  { id: 'af_nova', label: 'Nova · American female' },
  { id: 'af_jessica', label: 'Jessica · American female' },
  { id: 'af_sky', label: 'Sky · American female' },
  // American male
  { id: 'am_michael', label: 'Michael · American male' },
  { id: 'am_fenrir', label: 'Fenrir · American male' },
  { id: 'am_puck', label: 'Puck · American male' },
  { id: 'am_echo', label: 'Echo · American male' },
  { id: 'am_eric', label: 'Eric · American male' },
  { id: 'am_onyx', label: 'Onyx · American male (deep)' },
  // British female
  { id: 'bf_emma', label: 'Emma · British female' },
  { id: 'bf_isabella', label: 'Isabella · British female' },
  // British male
  { id: 'bm_george', label: 'George · British male' },
  { id: 'bm_fable', label: 'Fable · British male' },
  { id: 'bm_lewis', label: 'Lewis · British male' },
  { id: 'bm_daniel', label: 'Daniel · British male' },
] as const;

const voiceOption = (id: string): NeuralVoiceOption =>
  NEURAL_VOICES.find((v) => v.id === id) ?? { id, label: id };

const NARRATOR_VOICE = 'af_sarah'; // soft, unobtrusive for stage directions

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
  // Auto-casting draws only from the strongest voices; the weaker ones and
  // the derived young voices stay explicit picks in the full list.
  const AUTO_CAST = new Set([
    'af_heart',
    'af_sarah',
    'am_michael',
    'am_fenrir',
    'am_puck',
    'bf_emma',
    'bf_isabella',
    'bm_george',
    'bm_fable',
  ]);
  const autoPool = NEURAL_VOICES.filter((v) => AUTO_CAST.has(v.id));
  const taken = new Set(assigned.values());
  let i = hash(character) % autoPool.length;
  for (let step = 0; step < autoPool.length && taken.has(autoPool[i].id); step++) {
    i = (i + 1) % autoPool.length;
  }
  assigned.set(character, autoPool[i].id);
  return autoPool[i].id;
}

// ---- Synthesis with caching ------------------------------------------------

const uriCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
// Serialize synthesis: two concurrent wasm inferences would crawl on phones.
let queue: Promise<unknown> = Promise.resolve();

function synthesize(text: string, voiceId: string, speed: number): Promise<string> {
  const key = `${voiceId}|${speed}|${hash(text)}-${text.length}`;
  const cached = uriCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(key);
  if (pending) return pending;

  const opt = voiceOption(voiceId);
  const job = queue.then(async () => {
    const stillCached = uriCache.get(key);
    if (stillCached) return stillCached;
    if (!engine) throw new Error('engine not loaded');
    // Derived voices generate slower by the pitchShift factor; the faster
    // pitched-up playback brings the tempo back to normal.
    const audio = await engine.generate(text, {
      voice: opt.base ?? opt.id,
      speed: speed / (opt.pitchShift ?? 1),
    });
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
let currentSource: AudioBufferSourceNode | null = null;
let playbackCtx: AudioContext | null = null;
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
  const source = currentSource;
  currentSource = null;
  if (source) {
    try {
      source.stop();
    } catch {
      // already stopped
    }
  }
  currentFinish?.();
  currentFinish = null;
}

// Derived voices play through Web Audio: a raised playbackRate shifts pitch
// and speed together, which — paired with the slowed generation above — nets
// out to normal tempo at a higher, younger-sounding pitch.
async function playPitchShifted(uri: string, shift: number, finish: () => void): Promise<void> {
  const Ctx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  playbackCtx = playbackCtx ?? new Ctx();
  const res = await fetch(uri);
  const buffer = await playbackCtx.decodeAudioData(await res.arrayBuffer());
  const source = playbackCtx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = shift;
  source.onended = () => {
    if (currentSource === source) currentSource = null;
    finish();
  };
  source.connect(playbackCtx.destination);
  currentSource = source;
  source.start();
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
    const pitchShift = voiceOption(voice).pitchShift;
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
      if (pitchShift) {
        playPitchShifted(uri, pitchShift, finish).catch(finish);
        return;
      }
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
