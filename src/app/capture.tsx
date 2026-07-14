import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { hasApiKey, parseScriptPhotos } from '@/lib/parser';
import { newId, saveScript } from '@/lib/storage';
import { useTheme, type Theme } from '@/lib/theme';

interface Page {
  uri: string;
  base64: string;
  mimeType: string | null;
}

const LOADING_LINES = [
  'Warming up the reader…',
  'Squinting at the small print…',
  'Learning who says what…',
  'Sorting lines from stage directions…',
  'Almost off book…',
];

function LoadingCard() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [i, setI] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setI((n) => (n + 1) % LOADING_LINES.length), 2200);
    return () => clearInterval(timer);
  }, []);
  return (
    <View style={styles.loadingCard}>
      <ActivityIndicator size="large" color={t.accent} />
      <Text style={styles.loadingText}>{LOADING_LINES[i]}</Text>
    </View>
  );
}

export default function CaptureScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addAssets = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const added = (result.assets ?? [])
      .filter((a) => a.base64)
      .map((a) => ({ uri: a.uri, base64: a.base64 as string, mimeType: a.mimeType ?? null }));
    setPages((prev) => [...prev, ...added]);
    setError(null);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('FART needs camera access to snap your script pages.');
      return;
    }
    addAssets(
      await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, base64: true }),
    );
  };

  const pickFromLibrary = async () => {
    addAssets(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        base64: true,
        allowsMultipleSelection: true,
        selectionLimit: 8,
        orderedSelection: true,
      }),
    );
  };

  const removePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
  };

  const createScript = async () => {
    setBusy(true);
    setError(null);
    try {
      const { title, elements } = await parseScriptPhotos(
        pages.map((p) => ({ base64: p.base64, mimeType: p.mimeType })),
      );
      const script = { id: newId(), title, createdAt: Date.now(), myCharacter: null, elements };
      await saveScript(script);
      router.replace({ pathname: '/assign/[id]', params: { id: script.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.blurb}>
        Snap each page of your sides in order (or pull them from your photos). FART turns them into a
        script it can read with you.
      </Text>

      {!hasApiKey() && (
        <View style={styles.keyWarning}>
          <Text style={styles.keyWarningText}>
            🔑 No API key set yet, so FART can't read photos. Add EXPO_PUBLIC_ANTHROPIC_API_KEY to
            the .env file and restart the dev server.
          </Text>
        </View>
      )}

      {busy ? (
        <LoadingCard />
      ) : (
        <>
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [styles.pickButton, pressed && styles.pressed]}
              onPress={takePhoto}>
              <Text style={styles.pickEmoji}>📷</Text>
              <Text style={styles.pickLabel}>Take photo</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.pickButton, pressed && styles.pressed]}
              onPress={pickFromLibrary}>
              <Text style={styles.pickEmoji}>🖼️</Text>
              <Text style={styles.pickLabel}>From photos</Text>
            </Pressable>
          </View>

          {pages.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                {pages.length} page{pages.length === 1 ? '' : 's'} ready
              </Text>
              <View style={styles.thumbGrid}>
                {pages.map((page, i) => (
                  <View key={`${page.uri}-${i}`} style={styles.thumbWrap}>
                    <Image source={{ uri: page.uri }} style={styles.thumb} />
                    <Text style={styles.thumbIndex}>{i + 1}</Text>
                    <Pressable style={styles.thumbRemove} hitSlop={8} onPress={() => removePage(i)}>
                      <Text style={styles.thumbRemoveText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                onPress={createScript}>
                <Text style={styles.primaryButtonText}>✨ Create my script</Text>
              </Pressable>
            </>
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { padding: 20, paddingBottom: 40, maxWidth: 700, width: '100%', alignSelf: 'center' },
  blurb: { fontSize: 15, color: t.inkSoft, lineHeight: 21 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  pickButton: {
    flex: 1,
    backgroundColor: t.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    paddingVertical: 22,
  },
  pickEmoji: { fontSize: 30 },
  pickLabel: { fontSize: 14, fontWeight: '700', color: t.ink, marginTop: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: t.inkSoft, marginTop: 24, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { width: 90 },
  thumb: { width: 90, height: 120, borderRadius: 10, backgroundColor: t.border },
  thumbIndex: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: t.ink,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: t.danger,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  primaryButton: {
    backgroundColor: t.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  loadingCard: {
    backgroundColor: t.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    padding: 36,
    marginTop: 24,
  },
  loadingText: { marginTop: 16, fontSize: 15, fontWeight: '600', color: t.ink },
  error: { color: t.danger, fontSize: 14, marginTop: 16, lineHeight: 20 },
  keyWarning: {
    backgroundColor: t.highlight,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  keyWarningText: { fontSize: 13, color: t.ink, lineHeight: 19 },
  pressed: { opacity: 0.7 },
});
