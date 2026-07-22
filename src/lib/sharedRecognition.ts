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
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (event) => emit({ type: 'result', results: event.results });
  rec.onend = () => {
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

// Force a fresh recognition session, discarding the transcript accumulated so
// far. "Listen for my lines" calls this when the user's turn begins so words
// picked up earlier (e.g. while voice commands were already listening) don't
// count toward matching the new line. No-op when nothing is listening — the
// next subscriber will start clean anyway.
export function resetRecognitionSession() {
  if (stopped) return;
  const rec = recognizer;
  recognizer = null;
  try {
    if (rec) {
      // Detach so this intentional abort neither restarts itself (onend) nor
      // surfaces as an 'aborted' failure to subscribers (onerror).
      rec.onend = null;
      rec.onerror = null;
      rec.abort();
    }
  } catch {
    // already stopped
  }
  // Small gap lets the aborted instance release before a new one starts,
  // avoiding the browser's "recognition already started" error.
  scheduleRestart(150);
}
