import { useEffect, useRef, useState } from 'react';

import { loadVoices, speakOnce, stopSpeaking, voiceOptsFor } from './speech';
import type { ScriptElement } from './types';

export type RehearsalStatus = 'idle' | 'playing' | 'waiting' | 'done';

export const RATES = [0.8, 1, 1.2];

export interface RehearsalOptions {
  defaultAutoAdvance?: boolean;
  onDone?: () => void;
}

// The shared line-reading engine behind the rehearsal and self-tape screens.
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
  elementsRef.current = elements;
  onDoneRef.current = options.onDone;

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

    if (el.type === 'direction') {
      if (readDirectionsRef.current) {
        await speakOnce(el.text, { rate: rateRef.current, pitch: 0.95 });
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
    if (d && d.pauseBeforeMs > 0) {
      await new Promise((r) => setTimeout(r, d.pauseBeforeMs));
      if (run !== runId.current) return;
    }
    const voice = voiceOptsFor(el.character);
    await speakOnce(el.text, {
      rate: rateRef.current * (d?.rate ?? 1),
      voice: voice.voice,
      pitch: (voice.pitch ?? 1) * (d?.pitch ?? 1),
    });
    if (run !== runId.current) return;
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
