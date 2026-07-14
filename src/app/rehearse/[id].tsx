import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { pitchFor, speakOnce, stopSpeaking } from '@/lib/speech';
import { getScript } from '@/lib/storage';
import { theme } from '@/lib/theme';
import type { FartScript, ScriptElement } from '@/lib/types';

type Status = 'idle' | 'playing' | 'waiting' | 'done';

const RATES = [0.8, 1, 1.2];

export default function RehearseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [script, setScript] = useState<FartScript | null>(null);
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [rate, setRate] = useState(1);
  const [readDirections, setReadDirections] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);

  // The engine lives in async callbacks, so it reads refs, not state.
  // Bumping runId cancels any in-flight step chain.
  const runId = useRef(0);
  const idxRef = useRef(0);
  const rateRef = useRef(1);
  const readDirectionsRef = useRef(false);
  const autoAdvanceRef = useRef(false);
  const elementsRef = useRef<ScriptElement[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<number, number>>({});

  useEffect(() => {
    getScript(id).then((s) => {
      setScript(s);
      elementsRef.current = s?.elements ?? [];
    });
  }, [id]);

  useEffect(
    () => () => {
      runId.current++;
      stopSpeaking();
    },
    [],
  );

  useEffect(() => {
    const y = positions.current[idx];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 160), animated: true });
  }, [idx]);

  const setPosition = (i: number) => {
    idxRef.current = i;
    setIdx(i);
  };

  async function step(i: number, run: number): Promise<void> {
    if (run !== runId.current) return;
    const elements = elementsRef.current;
    if (i >= elements.length) {
      setStatus('done');
      return;
    }
    setPosition(i);
    const el = elements[i];

    if (el.type === 'direction') {
      if (readDirectionsRef.current) {
        await speakOnce(el.text, { rate: rateRef.current, pitch: 0.95 });
      }
      if (run === runId.current) return step(i + 1, run);
      return;
    }

    if (el.mine) {
      setStatus('waiting');
      if (autoAdvanceRef.current) {
        const ms = Math.max(1800, el.text.trim().split(/\s+/).length * 380);
        await new Promise((r) => setTimeout(r, ms));
        if (run === runId.current) {
          setStatus('playing');
          return step(i + 1, run);
        }
      }
      return;
    }

    await speakOnce(el.text, { rate: rateRef.current, pitch: pitchFor(el.character) });
    if (run === runId.current) return step(i + 1, run);
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

  if (!script) return <View style={styles.screen} />;

  const current = script.elements[idx];
  const playing = status === 'playing' || status === 'waiting';

  return (
    <View style={styles.screen}>
      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
          onPress={() => (playing ? pause() : play(status === 'done' ? 0 : undefined))}>
          <Text style={styles.playButtonText}>
            {playing ? '⏸ Pause' : status === 'done' ? '↻ Run it back' : '▶ Play'}
          </Text>
        </Pressable>
        <Pressable style={styles.smallButton} onPress={restart}>
          <Text style={styles.smallButtonText}>⏮</Text>
        </Pressable>
        <Pressable style={styles.smallButton} onPress={cycleRate}>
          <Text style={styles.smallButtonText}>{rate}x</Text>
        </Pressable>
      </View>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, readDirections && styles.toggleOn]}
          onPress={toggleDirections}>
          <Text style={[styles.toggleText, readDirections && styles.toggleTextOn]}>
            🎬 Read directions
          </Text>
        </Pressable>
        <Pressable style={[styles.toggle, autoAdvance && styles.toggleOn]} onPress={toggleAuto}>
          <Text style={[styles.toggleText, autoAdvance && styles.toggleTextOn]}>
            ⏱ Auto-continue my lines
          </Text>
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} style={styles.script} contentContainerStyle={styles.scriptContent}>
        {script.elements.map((el, i) => {
          const isCurrent = i === idx && status !== 'idle';
          return (
            <Pressable
              key={i}
              onLayout={(e) => {
                positions.current[i] = e.nativeEvent.layout.y;
              }}
              onPress={() => play(i)}>
              {el.type === 'direction' ? (
                <Text style={[styles.direction, isCurrent && styles.currentDirection]}>{el.text}</Text>
              ) : (
                <View style={[styles.line, el.mine && styles.lineMine, isCurrent && styles.currentLine]}>
                  <Text style={styles.lineCharacter}>
                    {el.character}
                    {el.mine ? '  ← you' : ''}
                  </Text>
                  <Text style={styles.lineText}>{el.text}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
        <Text style={styles.tapHint}>Tap any line to play from there.</Text>
      </ScrollView>

      {status === 'waiting' && current?.type === 'line' && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>🫵 Your line, {current.character}!</Text>
          <Pressable
            style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
            onPress={continueMyLine}>
            <Text style={styles.continueButtonText}>Said it — continue ▶</Text>
          </Pressable>
        </View>
      )}

      {status === 'done' && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>🎉 Scene complete!</Text>
          <Pressable
            style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
            onPress={() => play(0)}>
            <Text style={styles.continueButtonText}>↻ Run it back</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  controls: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  playButton: {
    flex: 1,
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  playButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  smallButton: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  smallButtonText: { fontSize: 15, fontWeight: '700', color: theme.ink },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  toggle: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  toggleOn: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
  toggleText: { fontSize: 12, fontWeight: '700', color: theme.inkSoft },
  toggleTextOn: { color: theme.accent },
  script: { flex: 1, marginTop: 6 },
  scriptContent: { padding: 20, paddingBottom: 160, maxWidth: 700, width: '100%', alignSelf: 'center' },
  direction: {
    fontSize: 13,
    fontStyle: 'italic',
    color: theme.inkSoft,
    marginVertical: 8,
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  currentDirection: { color: theme.accent },
  line: {
    borderRadius: 12,
    padding: 12,
    marginVertical: 3,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: theme.card,
  },
  lineMine: { backgroundColor: theme.highlight },
  currentLine: { borderColor: theme.accent },
  lineCharacter: { fontSize: 12, fontWeight: '800', color: theme.accent, letterSpacing: 0.5 },
  lineText: { fontSize: 15, color: theme.ink, marginTop: 2, lineHeight: 21 },
  tapHint: { fontSize: 12, color: theme.inkSoft, textAlign: 'center', marginTop: 16 },
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    padding: 16,
    paddingBottom: 28,
    alignItems: 'center',
  },
  bannerTitle: { fontSize: 17, fontWeight: '800', color: theme.ink },
  continueButton: {
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 32,
    marginTop: 10,
  },
  continueButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
