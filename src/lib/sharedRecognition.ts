import { getSpeechRecognitionCtor, type SpeechRecognitionLike } from './webSpeech';

// One shared Web Speech recognizer for the whole app. The browser allows only
// ONE active SpeechRecognition at a time, so "Listen for my lines" and "Voice
// commands" — which each used to spin up their own — knocked each other out
// (hence the old "one recognizer at a time" mutual exclusion). This owns a
// single recognizer and fans its events out to every subscriber, so both
// features can run at once: the reader can still answer on cue while "FART
// cut" is available to restart after a flub.
//
// Web-only. Native speech recognition (expo-speech-recognition) has no such
// single-instance limit and voice commands are web-only, so the native paths
// keep their own per-feature recognizers.

type ResultsLike = { length: number } & {
  [i: number]: { [j: number]: { transcript: string } };
};

export type RecognitionEvent =
  | { type: 'result'; results: ResultsLike }
  | { type: 'sessionEnd' }
  | { type: 'error'; error: string };

type Listener = (event: RecognitionEvent) => void;

const listeners = new Set<Listener>();
let recognizer: SpeechRecognitionLike | null = null;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = true;
// How many result segments the LIVE session has emitted. A consumer starting
// mid-session (e.g. "Listen for my lines" when the user's turn begins while
// voice commands already had the mic open) snapshots this so words heard before
// its turn don't count — a software baseline that replaces the old audio
// restart, which fired iOS's mic-listening tone an extra time each line.
let liveResultsLen = 0;
export const currentResultsLength = () => liveResultsLen;

function emit(event: RecognitionEvent) {
  // Iterate a copy so a listener that unsubscribes mid-dispatch can't cause
  // another to be skipped.
  for (const listener of [...listeners]) listener(event);
}

function scheduleRestart(delay: number) {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (!stopped && listeners.size > 0) startRecognizer();
  }, delay);
}

function startRecognizer() {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return;
  const rec = new Ctor();
  recognizer = rec;
  liveResultsLen = 0; // fresh session starts with an empty transcript
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (event) => {
    liveResultsLen = event.results.length;
    emit({ type: 'result', results: event.results });
  };
  rec.onend = () => {
    liveResultsLen = 0;
    emit({ type: 'sessionEnd' });
    // Recognition sessions auto-end after a few seconds of silence; keep the
    // one shared recognizer alive as long as anyone is still listening.
    if (!stopped && listeners.size > 0) scheduleRestart(300);
  };
  rec.onerror = (event) => emit({ type: 'error', error: event.error });
  try {
    rec.start();
  } catch {
    // already running
  }
}

function stopRecognizer() {
  stopped = true;
  liveResultsLen = 0;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  const rec = recognizer;
  recognizer = null;
  try {
    if (rec) {
      // Detach first so this intentional abort doesn't emit onend/onerror
      // ('aborted') to subscribers as if the mic had failed.
      rec.onend = null;
      rec.onerror = null;
      rec.abort();
    }
  } catch {
    // already stopped
  }
}

// Subscribe to the shared recognizer. Starts it on the first subscriber and
// stops it when the last one leaves (ref-counted). Returns an unsubscribe fn.
export function subscribeRecognition(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    stopped = false;
    startRecognizer();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopRecognizer();
  };
}
