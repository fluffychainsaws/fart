import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { getScript, saveScript } from '@/lib/storage';
import { useTheme, type Theme } from '@/lib/theme';
import { charactersIn, myLineCount, type FartScript } from '@/lib/types';

export default function AssignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [script, setScript] = useState<FartScript | null>(null);

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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{script.title}</Text>
        <Text style={styles.question}>Who are you reading for?</Text>
        <View style={styles.chipRow}>
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

      <View style={styles.footer}>
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
        {mineCount > 0 && (
          <Pressable
            style={({ pressed }) => [styles.selfTapeButton, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/selftape/[id]', params: { id: script.id } })}>
            <Text style={styles.selfTapeButtonText}>🎥 Record a self-tape</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) =>
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
  },
  startButtonDisabled: { backgroundColor: t.border },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  selfTapeButton: {
    backgroundColor: t.accentSoft,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
    marginTop: 8,
  },
  selfTapeButtonText: { color: t.accent, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
