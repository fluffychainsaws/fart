import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { isLineComplete, lineWords, matchedWordCount } from './lineMatch';
import { getSpeechRecognitionCtor, type SpeechRecognitionLike } from './webSpeech';

// Voice follow: listens while the rehearsal engine waits on the user's line,
// matches the recognized speech against the script text, and fires
// onComplete the moment the actor finishes — so the reader answers on cue
// instead of on a word-count timer. Listening runs ONLY during the user's
// turn (the mic is off while the reader speaks, so it never hears itself).

// Native speech recognition ships in dev builds via expo-speech-recognition;
// Expo Go and web must never evaluate its native module (same crash class as
// expo-media-library), hence the Platform-guarded lazy require.
function nativeSpeech(): typeof import('expo-speech-recognition') | null {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-speech-recognition');
  } catch {
    return null;
  }
}

export function lineFollowSupported(): boolean {
  return Platform.OS === 'web' ? Boolean(getSpeechRecognitionCtor()) : Boolean(nativeSpeech());
}

// Mic permission must be requested from a direct tap (a real user gesture)
// or the browser's prompt may never reliably appear.
export async function requestLineFollowMic(): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }
  const native = nativeSpeech();
  if (!native) return false;
  try {
    const res = await native.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

export interface LineFollowState {
  listening: boolean;
  progress: number; // 0..1 fraction of the line matched so far
  heard: string; // last few words recognized, for on-screen feedback
}

export function useLineFollow(
  enabled: boolean,
  // The user's line to listen for; null whenever it isn't their turn.
  line: { text: string; key: number } | null,
  onComplete: () => void,
): LineFollowState {
  const [listening, setListening] = useState(false);
  const [progress, setProgress] = useState(0);
  const [heard, setHeard] = useState('');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const text = line?.text ?? null;
  const key = line?.key ?? null;

  useEffect(() => {
    if (!enabled || text == null) {
      setListening(false);
      setProgress(0);
      setHeard('');
      return;
    }

    const words = lineWords(text);
    let done = false;
    let cancelled = false;
    // Recognition sessions auto-end after a few seconds of silence, so the
    // transcript is accumulated across session restarts within this line.
    let accumulated = '';
    let sessionText = '';

    const handleTranscript = (full: string) => {
      if (done || cancelled) return;
      const spoken = lineWords(full);
      setHeard(spoken.slice(-6).join(' '));
      const matched = matchedWordCount(words, spoken);
      setProgress(words.length === 0 ? 1 : matched / words.length);
      if (isLineComplete(words, matched)) {
        done = true;
        onCompleteRef.current();
      }
    };

    let cleanup: () => void;

    if (Platform.OS === 'web') {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return;
      let recognizer: SpeechRecognitionLike | null = null;
      const startListening = () => {
        const rec = new Ctor();
        recognizer = rec;
        rec.lang = 'en-US';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (event) => {
          // A continuous session splits speech into segments; join them all
          // so a line spoken across a breath still matches end to end.
          let s = '';
          for (let i = 0; i < (event.results.length ?? 1); i++) {
            s += ' ' + (event.results[i]?.[0]?.transcript ?? '');
          }
          sessionText = s;
          handleTranscript(accumulated + ' ' + sessionText);
        };
        rec.onend = () => {
          accumulated = (accumulated + ' ' + sessionText).trim();
          sessionText = '';
          // Fresh instance per restart — re-starting an ended one is unreliable.
          if (!cancelled && !done) setTimeout(() => !cancelled && !done && startListening(), 250);
        };
        rec.onerror = () => {};
        try {
          rec.start();
        } catch {
          // already running
        }
      };
      startListening();
      setListening(true);
      cleanup = () => {
        recognizer?.abort();
      };
    } else {
      const native = nativeSpeech();
      if (!native) return;
      const Module = native.ExpoSpeechRecognitionModule;
      const start = () => {
        try {
          Module.start({ lang: 'en-US', interimResults: true, continuous: true });
        } catch {
          // recognizer already running
        }
      };
      const resultSub = Module.addListener('result', (event) => {
        sessionText = event.results?.[0]?.transcript ?? '';
        handleTranscript(accumulated + ' ' + sessionText);
      });
      const endSub = Module.addListener('end', () => {
        accumulated = (accumulated + ' ' + sessionText).trim();
        sessionText = '';
        if (!cancelled && !done) setTimeout(() => !cancelled && !done && start(), 250);
      });
      const errSub = Module.addListener('error', () => {});
      start();
      setListening(true);
      cleanup = () => {
        resultSub.remove();
        endSub.remove();
        errSub.remove();
        try {
          Module.abort();
        } catch {
          // recognizer was not running
        }
      };
    }

    return () => {
      cancelled = true;
      setListening(false);
      cleanup();
    };
  }, [enabled, text, key]);

  return { listening, progress, heard };
}
