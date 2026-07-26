import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Text } from '@/lib/AppText';
import { GuidedTour } from '@/lib/GuidedTour';
import { getScript, saveScript } from '@/lib/storage';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';
import { charactersIn, myLineCount, type FartScript } from '@/lib/types';

export default function AssignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const [script, setScript] = useState<FartScript | null>(null);

  // Robot intro: point at the character picker, then the start button. Auto-runs
  // on the first visit (which for new users is the demo scene).
  const chipRowRef = useRef<View>(null);
  const startRef = useRef<View>(null);
  const [tourVisible, setTourVisible] = useState(false);
  const [scrollTick, setScrollTick] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let alive = true;
    AsyncStorage.getItem('fart.assignTourSeen.v1').then((seen) => {
      if (alive && !seen) setTimeout(() => alive && setTourVisible(true), 700);
    });
    return () => {
      alive = false;
    };
  }, []);
  const endTour = () => {
    setTourVisible(false);
    AsyncStorage.setItem('fart.assignTourSeen.v1', '1').catch(() => {});
  };

  useFocusEffect(
    useCallback(() => {
      getScript(id).then(setScript);
    }, [id]),
  );

  if (!script) return <View style={styles.screen} />;

  const characters = charactersIn(script.elements);
  const mineCount = myLineCount(script.elements);

  const update = (next: FartScript) => {
    setScript(next);
    saveScript(next);
  };

  const pickCharacter = (name: string) => {
    update({
      ...script,
      myCharacter: name,
      elements: script.elements.map((el) =>
        el.type === 'line' ? { ...el, mine: el.character === name } : el,
      ),
    });
  };

  const toggleLine = (index: number) => {
    update({
      ...script,
      elements: script.elements.map((el, i) =>
        i === index && el.type === 'line' ? { ...el, mine: !el.mine } : el,
      ),
    });
  };

  const tourSteps = [
    {
      ref: chipRowRef,
      text: '👋 First, pick who you’re reading for — tap your character and I’ll read everyone else.',
    },
    {
      ref: startRef,
      text: '✨ Then hit “Start rehearsing” and let’s run the scene together!',
    },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}
        onScroll={tourVisible ? () => setScrollTick((n) => n + 1) : undefined}>
        <Text style={styles.title}>{script.title}</Text>
        <Text style={styles.question}>Who are you reading for?</Text>
        <View ref={chipRowRef} style={styles.chipRow}>
          {characters.map((name) => {
            const selected = script.myCharacter === name;
            return (
              <Pressable
                key={name}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => pickCharacter(name)}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {selected ? '🎭 ' : ''}
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>
          Your lines get the yellow highlighter. Tap any line to highlight or un-highlight it.
        </Text>

        <View style={styles.scriptCard}>
          {script.elements.map((el, i) =>
            el.type === 'direction' ? (
              <Text key={i} style={styles.direction}>
                {el.text}
              </Text>
            ) : (
              <Pressable
                key={i}
                style={[styles.line, el.mine && styles.lineMine]}
                onPress={() => toggleLine(i)}>
                <Text style={styles.lineCharacter}>{el.character}</Text>
                <Text style={styles.lineText}>{el.text}</Text>
              </Pressable>
            ),
          )}
        </View>
      </ScrollView>

      <View ref={startRef} style={styles.footer}>
        <Pressable
          disabled={mineCount === 0}
          style={({ pressed }) => [
            styles.startButton,
            mineCount === 0 && styles.startButtonDisabled,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push({ pathname: '/rehearse/[id]', params: { id: script.id } })}>
          <Text style={styles.startButtonText}>
            {mineCount === 0 ? 'Highlight your lines to start' : `▶ Start rehearsing (${mineCount} lines)`}
          </Text>
        </Pressable>
      </View>

      {Platform.OS === 'web' && (
        <GuidedTour
          stepRefs={tourSteps.map((s) => s.ref)}
          texts={tourSteps.map((s) => s.text)}
          visible={tourVisible}
          onDone={endTour}
          scrollTick={scrollTick}
        />
      )}
    </View>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { padding: 20, paddingBottom: 120, maxWidth: 700, width: '100%', alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: t.ink },
  question: { fontSize: 15, fontWeight: '700', color: t.ink, marginTop: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipSelected: { backgroundColor: t.accent, borderColor: t.accent },
  chipText: { fontSize: 14, fontWeight: '700', color: t.ink },
  chipTextSelected: { color: '#fff' },
  hint: { fontSize: 13, color: t.inkSoft, marginTop: 14, lineHeight: 19 },
  scriptCard: {
    backgroundColor: t.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    padding: 16,
    marginTop: 16,
    ...shadow,
  },
  direction: {
    fontSize: 13,
    fontStyle: 'italic',
    color: t.inkSoft,
    marginVertical: 8,
    lineHeight: 19,
  },
  line: { borderRadius: 10, padding: 10, marginVertical: 2 },
  lineMine: {
    backgroundColor: t.highlight,
    borderWidth: 1,
    borderColor: t.highlightBorder,
  },
  lineCharacter: { fontSize: 12, fontWeight: '800', color: t.accent, letterSpacing: 0.5 },
  lineText: { fontSize: 15, color: t.ink, marginTop: 2, lineHeight: 21 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: t.bg,
    borderTopWidth: 1,
    borderTopColor: t.border,
  },
  startButton: {
    backgroundColor: t.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
    ...shadow,
  },
  startButtonDisabled: { backgroundColor: t.border },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
