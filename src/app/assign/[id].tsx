import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { getScript, saveScript } from '@/lib/storage';
import { theme } from '@/lib/theme';
import { charactersIn, myLineCount, type FartScript } from '@/lib/types';

export default function AssignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingBottom: 120, maxWidth: 700, width: '100%', alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: theme.ink },
  question: { fontSize: 15, fontWeight: '700', color: theme.ink, marginTop: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipSelected: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipText: { fontSize: 14, fontWeight: '700', color: theme.ink },
  chipTextSelected: { color: '#fff' },
  hint: { fontSize: 13, color: theme.inkSoft, marginTop: 14, lineHeight: 19 },
  scriptCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginTop: 16,
  },
  direction: {
    fontSize: 13,
    fontStyle: 'italic',
    color: theme.inkSoft,
    marginVertical: 8,
    lineHeight: 19,
  },
  line: { borderRadius: 10, padding: 10, marginVertical: 2 },
  lineMine: {
    backgroundColor: theme.highlight,
    borderWidth: 1,
    borderColor: theme.highlightBorder,
  },
  lineCharacter: { fontSize: 12, fontWeight: '800', color: theme.accent, letterSpacing: 0.5 },
  lineText: { fontSize: 15, color: theme.ink, marginTop: 2, lineHeight: 21 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: theme.bg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  startButton: {
    backgroundColor: theme.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  startButtonDisabled: { backgroundColor: theme.border },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
