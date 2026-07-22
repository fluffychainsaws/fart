import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { fromByteArray } from 'base64-js';

import { Text } from '@/lib/AppText';
import { useSession } from '@/lib/auth';
import { openCheckout } from '@/lib/billing';
import { MicIcon } from '@/lib/MicIcon';
import { parseScriptPdf, parseScriptPhotos } from '@/lib/parser';
import { deleteScript, listScripts, newId, refreshScripts, saveScript } from '@/lib/storage';
import { getTier, type Tier } from '@/lib/subscription';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';
import { charactersIn, myLineCount, type FartScript } from '@/lib/types';
import { UpgradeModal } from '@/lib/UpgradeModal';
import { getUsageStatus } from '@/lib/usage';

interface Page {
  uri: string;
  base64: string;
  mimeType: string | null;
}

interface Pdf {
  name: string;
  base64: string;
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
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
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
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const [pages, setPages] = useState<Page[]>([]);
  const [pdf, setPdf] = useState<Pdf | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumCredits, setPremiumCredits] = useState(0);
  const [useCredit, setUseCredit] = useState(false);
  const [tier, setTier] = useState<Tier>('free');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [scripts, setScripts] = useState<FartScript[]>([]);
  const session = useSession();

  useEffect(() => {
    getUsageStatus().then((u) => {
      setPremiumCredits(u.premiumCredits);
      setTier(u.tier);
    });
  }, []);

  // Saved scripts live here now (moved off Home). Local list first, then the
  // account-merged list once sync lands.
  useFocusEffect(
    useCallback(() => {
      listScripts().then(setScripts);
      refreshScripts().then(setScripts);
    }, []),
  );

  const openScript = (script: FartScript) => {
    router.push({ pathname: '/assign/[id]', params: { id: script.id } });
  };

  const confirmDelete = (script: FartScript) => {
    const reload = () => deleteScript(script.id).then(() => listScripts().then(setScripts));
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${script.title}"?`)) reload();
      return;
    }
    Alert.alert('Delete script', `Delete "${script.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: reload },
    ]);
  };

  // Max pages this upload may have: the Audition Credit's cap when spending a
  // credit, otherwise the account tier's. The server enforces the same limit.
  const pageCap = getTier(useCredit && premiumCredits > 0 ? 'daypass' : tier).pagesPerScript;

  const handleUpgrade = (target: Tier) => {
    if (session) openCheckout(target, session.user.id, session.user.email);
    setShowUpgrade(false);
  };

  const addAssets = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const added = (result.assets ?? [])
      .filter((a) => a.base64)
      .map((a) => ({ uri: a.uri, base64: a.base64 as string, mimeType: a.mimeType ?? null }));
    setPdf(null); // a script is either a PDF or a set of photos, not both
    setPages((prev) => {
      const combined = [...prev, ...added];
      if (combined.length > pageCap) {
        setError(
          `Your plan allows up to ${pageCap} page${pageCap === 1 ? '' : 's'} per script. The extra ones weren't added — upgrade for longer scripts.`,
        );
        return combined.slice(0, pageCap);
      }
      setError(null);
      return combined;
    });
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
        selectionLimit: Math.max(1, pageCap - pages.length),
        orderedSelection: true,
      }),
    );
  };

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    try {
      const res = await fetch(asset.uri);
      const bytes = new Uint8Array(await res.arrayBuffer());
      setPages([]); // a script is either a PDF or a set of photos, not both
      setPdf({ name: asset.name, base64: fromByteArray(bytes) });
      setError(null);
    } catch {
      setError("Couldn't read that PDF. Try picking it again.");
    }
  };

  const removePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
  };

  const createScript = async () => {
    setBusy(true);
    setError(null);
    try {
      // Uploading a script IS the audition, quota-wise: it's charged up
      // front (the parse is the costly step) so ending a scene early can't
      // dodge the meter.
      const usage = await getUsageStatus();
      const wantsCredit = useCredit && usage.premiumCredits > 0;
      if (!wantsCredit && usage.auditionsRemaining <= 0) {
        setTier(usage.tier);
        setError("You're out of auditions this month — upgrade your plan to keep going.");
        setShowUpgrade(true);
        return;
      }
      // The edge function enforces the quota / spends the credit server-side
      // (the old client counter was resettable by clearing browser storage),
      // refunds on a failed parse, and reports whether a credit was actually
      // used so we can mark the script premium.
      const parsed = pdf
        ? await parseScriptPdf(pdf.base64, { useCredit: wantsCredit })
        : await parseScriptPhotos(
            pages.map((p) => ({ base64: p.base64, mimeType: p.mimeType })),
            { useCredit: wantsCredit },
          );
      const script = {
        id: newId(),
        title: parsed.title,
        createdAt: Date.now(),
        myCharacter: null,
        elements: parsed.elements,
        ...(parsed.usedCredit ? { premiumCredit: true } : {}),
      };
      await saveScript(script);
      router.replace({ pathname: '/assign/[id]', params: { id: script.id } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Try again.';
      setError(msg);
      // Covers the race where the client pre-check passed but the server (the
      // real gate) rejected the upload as over-quota — or a PDF that turned out
      // to exceed the page cap (counted server-side).
      if (msg.includes('out of auditions') || /allows up to \d+/.test(msg)) setShowUpgrade(true);
    } finally {
      setBusy(false);
    }
  };

  const hasInput = pdf !== null || pages.length > 0;

  return (
    <>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.blurb}>
        Upload your sides as a PDF — most sides already are one, and FART reads the real text
        directly instead of a photo of it. No PDF handy? Snap a photo or pull one from your
        library instead; that works exactly the same.
      </Text>

      {session === null && (
        <View style={styles.keyWarning}>
          <Text style={styles.keyWarningText}>
            🔒 Sign in to upload a script — reading your sides happens on our server so your account
            can keep track of it.
          </Text>
        </View>
      )}

      {busy ? (
        <LoadingCard />
      ) : (
        <>
          <Pressable
            style={({ pressed }) => [styles.pdfButton, pressed && styles.pressed]}
            onPress={pickPdf}>
            <Text style={styles.pdfEmoji}>📄</Text>
            <Text style={styles.pdfLabel}>Upload PDF</Text>
          </Pressable>

          <Text style={styles.orDivider}>or snap it instead</Text>
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

          {pdf && (
            <View style={styles.pdfChip}>
              <Text style={styles.pdfChipEmoji}>📄</Text>
              <Text style={styles.pdfChipName} numberOfLines={1}>
                {pdf.name}
              </Text>
              <Pressable hitSlop={8} onPress={() => setPdf(null)}>
                <Text style={styles.thumbRemoveText}>✕</Text>
              </Pressable>
            </View>
          )}

          {pages.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                {pages.length} / {pageCap} page{pageCap === 1 ? '' : 's'} ready
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
            </>
          )}

          {premiumCredits > 0 && (
            <Pressable
              style={[styles.creditToggle, useCredit && styles.creditToggleOn]}
              onPress={() => setUseCredit((v) => !v)}>
              <Text style={[styles.creditToggleText, useCredit && styles.creditToggleTextOn]}>
                ✨ Use an Audition Credit for this script ({premiumCredits} left)
              </Text>
              <Text style={styles.creditToggleSub}>
                Every voice, hands-free commands, and more director notes — just for this one.
              </Text>
            </Pressable>
          )}

          {hasInput && (
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={createScript}>
              <Text style={styles.primaryButtonText}>✨ Create my script</Text>
            </Pressable>
          )}

          {Platform.OS === 'web' && (
            <Pressable
              style={({ pressed }) => [styles.micTestButton, pressed && styles.pressed]}
              onPress={() => router.push('/mictest')}>
              <MicIcon size={18} />
              <Text style={styles.micTestButtonText}>Test your microphone</Text>
            </Pressable>
          )}

          {scripts.length > 0 && (
            <>
              <Text style={styles.scriptsTitle}>Your scripts</Text>
              {scripts.map((item) => {
                const cast = charactersIn(item.elements);
                const mine = myLineCount(item.elements);
                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.scriptCard, pressed && styles.pressed]}
                    onPress={() => openScript(item)}>
                    <View style={styles.scriptBody}>
                      <Text style={styles.scriptTitle}>{item.title}</Text>
                      <Text style={styles.scriptMeta}>
                        {item.myCharacter
                          ? `You read ${item.myCharacter} · ${mine} lines highlighted`
                          : `Cast: ${cast.join(', ')} · pick your role`}
                      </Text>
                    </View>
                    <Pressable hitSlop={8} onPress={() => confirmDelete(item)}>
                      <Text style={styles.scriptTrash}>🗑️</Text>
                    </Pressable>
                  </Pressable>
                );
              })}
            </>
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
    <UpgradeModal
      visible={showUpgrade}
      currentTier={tier}
      hasCredits={premiumCredits > 0}
      onUpgrade={handleUpgrade}
      onClose={() => setShowUpgrade(false)}
    />
    </>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { padding: 20, paddingBottom: 40, maxWidth: 700, width: '100%', alignSelf: 'center' },
  blurb: { fontSize: 15, color: t.inkSoft, lineHeight: 21 },
  pdfButton: {
    backgroundColor: t.accent,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    paddingVertical: 22,
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    ...shadow,
  },
  pdfEmoji: { fontSize: 24 },
  pdfLabel: { fontSize: 17, fontWeight: '700', color: '#fff' },
  orDivider: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: t.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 10,
  },
  buttonRow: { flexDirection: 'row', gap: 10 },
  pickButton: {
    flex: 1,
    backgroundColor: t.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    paddingVertical: 18,
    ...shadow,
  },
  pickEmoji: { fontSize: 26 },
  pickLabel: { fontSize: 13, fontWeight: '700', color: t.ink, marginTop: 6 },
  pdfChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 20,
    ...shadow,
  },
  pdfChipEmoji: { fontSize: 18 },
  pdfChipName: { flex: 1, fontSize: 14, fontWeight: '600', color: t.ink },
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
  creditToggle: {
    backgroundColor: t.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.border,
    padding: 14,
    marginTop: 20,
  },
  creditToggleOn: { backgroundColor: t.accentSoft, borderColor: t.accent },
  creditToggleText: { fontSize: 14, fontWeight: '700', color: t.ink },
  creditToggleTextOn: { color: t.accent },
  creditToggleSub: { fontSize: 12, color: t.inkSoft, marginTop: 4, lineHeight: 17 },
  primaryButton: {
    backgroundColor: t.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    ...shadow,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  micTestButton: {
    borderRadius: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: t.border,
  },
  micTestButtonText: { color: t.inkSoft, fontSize: 14, fontWeight: '700' },
  scriptsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: t.inkSoft,
    marginTop: 28,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scriptCard: {
    backgroundColor: t.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow,
  },
  scriptBody: { flex: 1, marginRight: 12 },
  scriptTitle: { fontSize: 16, fontWeight: '700', color: t.ink },
  scriptMeta: { fontSize: 13, color: t.inkSoft, marginTop: 4 },
  scriptTrash: { fontSize: 18 },
  loadingCard: {
    backgroundColor: t.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    padding: 36,
    marginTop: 24,
    ...shadow,
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
