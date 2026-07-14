import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { getScript } from '@/lib/storage';
import { useTheme, type Theme } from '@/lib/theme';
import type { FartScript } from '@/lib/types';
import { useRehearsal } from '@/lib/useRehearsal';

export default function RehearseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [script, setScript] = useState<FartScript | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<number, number>>({});

  const engine = useRehearsal(script?.elements ?? []);
  const { idx, status } = engine;

  useEffect(() => {
    getScript(id).then(setScript);
  }, [id]);

  useEffect(() => {
    const y = positions.current[idx];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 160), animated: true });
  }, [idx]);

  if (!script) return <View style={styles.screen} />;

  const current = script.elements[idx];
  const playing = status === 'playing' || status === 'waiting';

  return (
    <View style={styles.screen}>
      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
          onPress={() => (playing ? engine.pause() : engine.play(status === 'done' ? 0 : undefined))}>
          <Text style={styles.playButtonText}>
            {playing ? '⏸ Pause' : status === 'done' ? '↻ Run it back' : '▶ Play'}
          </Text>
        </Pressable>
        <Pressable style={styles.smallButton} onPress={engine.restart}>
          <Text style={styles.smallButtonText}>⏮</Text>
        </Pressable>
        <Pressable style={styles.smallButton} onPress={engine.cycleRate}>
          <Text style={styles.smallButtonText}>{engine.rate}x</Text>
        </Pressable>
      </View>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, engine.readDirections && styles.toggleOn]}
          onPress={engine.toggleDirections}>
          <Text style={[styles.toggleText, engine.readDirections && styles.toggleTextOn]}>
            🎬 Read directions
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, engine.autoAdvance && styles.toggleOn]}
          onPress={engine.toggleAuto}>
          <Text style={[styles.toggleText, engine.autoAdvance && styles.toggleTextOn]}>
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
              onPress={() => engine.play(i)}>
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
            onPress={engine.continueMyLine}>
            <Text style={styles.continueButtonText}>Said it — continue ▶</Text>
          </Pressable>
        </View>
      )}

      {status === 'done' && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>🎉 Scene complete!</Text>
          <Pressable
            style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
            onPress={() => engine.play(0)}>
            <Text style={styles.continueButtonText}>↻ Run it back</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
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
      backgroundColor: t.accent,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
    },
    playButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    smallButton: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    smallButtonText: { fontSize: 15, fontWeight: '700', color: t.ink },
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
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    toggleOn: { backgroundColor: t.accentSoft, borderColor: t.accent },
    toggleText: { fontSize: 12, fontWeight: '700', color: t.inkSoft },
    toggleTextOn: { color: t.accent },
    script: { flex: 1, marginTop: 6 },
    scriptContent: { padding: 20, paddingBottom: 160, maxWidth: 700, width: '100%', alignSelf: 'center' },
    direction: {
      fontSize: 13,
      fontStyle: 'italic',
      color: t.inkSoft,
      marginVertical: 8,
      lineHeight: 19,
      paddingHorizontal: 10,
    },
    currentDirection: { color: t.accent },
    line: {
      borderRadius: 12,
      padding: 12,
      marginVertical: 3,
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: t.card,
    },
    lineMine: { backgroundColor: t.highlight },
    currentLine: { borderColor: t.accent },
    lineCharacter: { fontSize: 12, fontWeight: '800', color: t.accent, letterSpacing: 0.5 },
    lineText: { fontSize: 15, color: t.ink, marginTop: 2, lineHeight: 21 },
    tapHint: { fontSize: 12, color: t.inkSoft, textAlign: 'center', marginTop: 16 },
    banner: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.card,
      borderTopWidth: 1,
      borderTopColor: t.border,
      padding: 16,
      paddingBottom: 28,
      alignItems: 'center',
    },
    bannerTitle: { fontSize: 17, fontWeight: '800', color: t.ink },
    continueButton: {
      backgroundColor: t.accent,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 32,
      marginTop: 10,
    },
    continueButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    pressed: { opacity: 0.7 },
  });
