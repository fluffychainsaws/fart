import { useEffect, useRef, useState } from 'react';

import { cloudVoiceActive, prefetchCloudLine, speakCloud } from './cloudVoice';
import { deliveredText } from './director';
import { neuralVoiceActive, prefetchNeuralLine, speakNeural } from './neuralVoice';
import { loadVoices, speakOnce, stopSpeaking, voiceOptsFor } from './speech';
import type { ScriptElement } from './types';

export type RehearsalStatus = 'idle' | 'playing' | 'waiting' | 'done';

export const RATES = [0.8, 1, 1.2];

export interface RehearsalOptions {
  defaultAutoAdvance?: boolean;
  onDone?: () => void;
  // Per-character voice choices ("openai:coral" / "device:<id>") from the script.
  voices?: Record<string, string>;
  // Gates cloud (OpenAI) voice playback by subscription tier — false forces
  // device voices even when a cloud API key is configured. Defaults to true.
  cloudVoiceAllowed?: boolean;
}

const cloudVoiceOf = (voices: Record<string, string> | undefined, character: string) => {
  const v = voices?.[character];
  return v?.startsWith('openai:') ? v.slice('openai:'.length) : undefined;
};

const neuralVoiceOf = (voices: Record<string, string> | undefined, character: string) => {
  const v = voices?.[character];
  return v?.startsWith('neural:') ? v.slice('neural:'.length) : undefined;
};

const deviceVoiceOf = (voices: Record<string, string> | undefined, character: string) => {
  const v = voices?.[character];
  return v?.startsWith('device:') ? v.slice('device:'.length) : undefined;
};

// The line-reading engine behind the rehearsal screen.
// It walks the elements: speaks other characters' lines, skips or reads stage
// directions, and stops (or auto-continues) on the user's highlighted lines.
export function useRehearsal(elements: ScriptElement[], options: RehearsalOptions = {}) {
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState<RehearsalStatus>('idle');
  const [rate, setRate] = useState(1);
  const [readDirections, setReadDirections] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(options.defaultAutoAdvance ?? false);

  // The engine lives in async callbacks, so it reads refs, not state.
  // Bumping runId cancels any in-flight step chain.
  const runId = useRef(0);
  const idxRef = useRef(0);
  const rateRef = useRef(1);
  const readDirectionsRef = useRef(false);
  const autoAdvanceRef = useRef(options.defaultAutoAdvance ?? false);
  const elementsRef = useRef<ScriptElement[]>(elements);
  const onDoneRef = useRef(options.onDone);
  const voicesRef = useRef(options.voices);
  const cloudAllowedRef = useRef(options.cloudVoiceAllowed ?? true);
  elementsRef.current = elements;
  onDoneRef.current = options.onDone;
  voicesRef.current = options.voices;
  cloudAllowedRef.current = options.cloudVoiceAllowed ?? true;

  const cloudAllowed = () => cloudVoiceActive() && cloudAllowedRef.current;

  useEffect(() => {
    loadVoices();
    return () => {
      runId.current++;
      stopSpeaking();
    };
  }, []);

  const setPosition = (i: number) => {
    idxRef.current = i;
    setIdx(i);
  };

  async function step(i: number, run: number): Promise<void> {
    if (run !== runId.current) return;
    const els = elementsRef.current;
    if (i >= els.length) {
      setStatus('done');
      onDoneRef.current?.();
      return;
    }
    setPosition(i);
    const el = els[i];

    // Warm the voice cache for the next reader line so it starts instantly,
    // even while the user is still saying their own line. Prefetching matters
    // most for neural voices — in-browser synthesis takes real time on phones.
    const upcoming = els.slice(i + 1).find((e) => e.type === 'line' && !e.mine);
    if (upcoming?.type === 'line') {
      const upcomingText = deliveredText(upcoming.text, upcoming.delivery);
      if (cloudAllowed()) {
        prefetchCloudLine({
          text: upcomingText,
          character: upcoming.character,
          note: upcoming.delivery?.note,
          rate: rateRef.current * (upcoming.delivery?.rate ?? 1),
          voice: cloudVoiceOf(voicesRef.current, upcoming.character),
        });
      } else if (neuralVoiceActive() && !deviceVoiceOf(voicesRef.current, upcoming.character)) {
        prefetchNeuralLine({
          text: upcomingText,
          character: upcoming.character,
          rate: rateRef.current * (upcoming.delivery?.rate ?? 1),
          voice: neuralVoiceOf(voicesRef.current, upcoming.character),
        });
      }
    }

    if (el.type === 'direction') {
      if (readDirectionsRef.current) {
        // Directions are read with a free voice (local neural if available,
        // otherwise the device voice) so they never spend premium TTS.
        let spoken =
          neuralVoiceActive() && (await speakNeural({ text: el.text, rate: rateRef.current }));
        if (!spoken && run === runId.current) {
          await speakOnce(el.text, { rate: rateRef.current, pitch: 0.95 });
        }
      }
      if (run === runId.current) return step(i + 1, run);
      return;
    }

    if (el.mine) {
      setStatus('waiting');
      // If the next reader line is directed to cut the user off, barge in
      // partway through their line — even when auto-continue is off.
      const nextLine = els.slice(i + 1).find((e) => e.type === 'line' && !e.mine);
      const cutoff = nextLine?.type === 'line' && nextLine.delivery?.cutoff;
      if (autoAdvanceRef.current || cutoff) {
        const estimate = Math.max(1800, el.text.trim().split(/\s+/).length * 380);
        const ms = cutoff ? Math.max(1000, estimate * 0.45) : estimate;
        await new Promise((r) => setTimeout(r, ms));
        if (run === runId.current) {
          setStatus('playing');
          return step(i + 1, run);
        }
      }
      return;
    }

    const d = el.delivery;
    // A "change line to …" note swaps the spoken words; the element's own text
    // is preserved so removing the note restores it.
    const lineText = deliveredText(el.text, d);
    if (d && d.pauseBeforeMs > 0) {
      await new Promise((r) => setTimeout(r, d.pauseBeforeMs));
      if (run !== runId.current) return;
    }
    const lineRate = rateRef.current * (d?.rate ?? 1);
    let spoken =
      cloudAllowed() &&
      (await speakCloud({
        text: lineText,
        character: el.character,
        note: d?.note,
        rate: lineRate,
        voice: cloudVoiceOf(voicesRef.current, el.character),
      }));
    if (run !== runId.current) return;
    // Neural voices step in unless the user explicitly picked a device voice
    // for this character.
    if (!spoken && !deviceVoiceOf(voicesRef.current, el.character)) {
      spoken =
        neuralVoiceActive() &&
        (await speakNeural({
          text: lineText,
          character: el.character,
          rate: lineRate,
          voice: neuralVoiceOf(voicesRef.current, el.character),
        }));
      if (run !== runId.current) return;
    }
    if (!spoken) {
      const voice = voiceOptsFor(el.character, deviceVoiceOf(voicesRef.current, el.character));
      await speakOnce(lineText, {
        rate: lineRate,
        voice: voice.voice,
        pitch: (voice.pitch ?? 1) * (d?.pitch ?? 1),
      });
      if (run !== runId.current) return;
    }
    if (d && d.pauseAfterMs > 0) {
      await new Promise((r) => setTimeout(r, d.pauseAfterMs));
      if (run !== runId.current) return;
    }
    return step(i + 1, run);
  }

  const play = (from?: number) => {
    runId.current++;
    stopSpeaking();
    const start = from ?? idxRef.current;
    setPosition(start);
    setStatus('playing');
    step(start, runId.current);
  };

  const pause = () => {
    runId.current++;
    stopSpeaking();
    setStatus('idle');
  };

  const continueMyLine = () => {
    runId.current++;
    stopSpeaking();
    setStatus('playing');
    step(idxRef.current + 1, runId.current);
  };

  const restart = () => {
    pause();
    setPosition(0);
  };

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rateRef.current) + 1) % RATES.length];
    rateRef.current = next;
    setRate(next);
  };

  const toggleDirections = () => {
    readDirectionsRef.current = !readDirectionsRef.current;
    setReadDirections(readDirectionsRef.current);
  };

  const toggleAuto = () => {
    autoAdvanceRef.current = !autoAdvanceRef.current;
    setAutoAdvance(autoAdvanceRef.current);
  };

  return {
    idx,
    status,
    rate,
    readDirections,
    autoAdvance,
    play,
    pause,
    continueMyLine,
    restart,
    cycleRate,
    toggleDirections,
    toggleAuto,
  };
}
