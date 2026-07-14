import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { makeDemoScript } from '@/lib/demo';
import { deleteScript, listScripts, saveScript } from '@/lib/storage';
import { theme } from '@/lib/theme';
import { charactersIn, myLineCount, type FartScript } from '@/lib/types';

export default function HomeScreen() {
  const [scripts, setScripts] = useState<FartScript[]>([]);

  useFocusEffect(
    useCallback(() => {
      listScripts().then(setScripts);
    }, []),
  );

  const openScript = (script: FartScript) => {
    router.push({ pathname: '/assign/[id]', params: { id: script.id } });
  };

  const confirmDelete = (script: FartScript) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${script.title}"?`)) {
        deleteScript(script.id).then(() => listScripts().then(setScripts));
      }
      return;
    }
    Alert.alert('Delete script', `Delete "${script.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteScript(script.id).then(() => listScripts().then(setScripts)),
      },
    ]);
  };

  const tryDemo = async () => {
    const demo = makeDemoScript();
    await saveScript(demo);
    router.push({ pathname: '/assign/[id]', params: { id: demo.id } });
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={scripts}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <Text style={styles.tagline}>Friendly AI Reader To-go</Text>
            <Text style={styles.blurb}>
              Snap a photo of your sides, highlight your lines, and FART reads everyone else&apos;s —
              so you can rehearse anywhere.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={() => router.push('/capture')}>
              <Text style={styles.primaryButtonText}>📸 New script</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              onPress={tryDemo}>
              <Text style={styles.secondaryButtonText}>🎬 Try the demo scene</Text>
            </Pressable>
            {scripts.length > 0 && <Text style={styles.sectionTitle}>Your scripts</Text>}
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No scripts yet. Snap your sides and let FART do the reading.</Text>
        }
        renderItem={({ item }) => {
          const cast = charactersIn(item.elements);
          const mine = myLineCount(item.elements);
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => openScript(item)}>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {item.myCharacter
                    ? `You read ${item.myCharacter} · ${mine} lines highlighted`
                    : `Cast: ${cast.join(', ')} · pick your role`}
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={() => confirmDelete(item)}>
                <Text style={styles.trash}>🗑️</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  listContent: { padding: 20, paddingBottom: 40, maxWidth: 700, width: '100%', alignSelf: 'center' },
  tagline: { fontSize: 15, fontWeight: '700', color: theme.accent, letterSpacing: 0.5 },
  blurb: { fontSize: 15, color: theme.inkSoft, marginTop: 6, lineHeight: 21 },
  primaryButton: {
    backgroundColor: theme.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: theme.accentSoft,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: { color: theme.accent, fontSize: 15, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.inkSoft, marginTop: 28, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  empty: { color: theme.inkSoft, fontSize: 14, marginTop: 28, textAlign: 'center' },
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBody: { flex: 1, marginRight: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.ink },
  cardMeta: { fontSize: 13, color: theme.inkSoft, marginTop: 4 },
  trash: { fontSize: 18 },
  pressed: { opacity: 0.7 },
});
