import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Text } from '@/lib/AppText';
import { makeDemoScript } from '@/lib/demo';
import { deleteScript, listScripts, refreshScripts, saveScript } from '@/lib/storage';
import { getTier } from '@/lib/subscription';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';
import { charactersIn, myLineCount, type FartScript } from '@/lib/types';
import { getUsageStatus, type UsageStatus } from '@/lib/usage';

export default function HomeScreen() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const [scripts, setScripts] = useState<FartScript[]>([]);
  const [usage, setUsage] = useState<UsageStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Local list immediately, then the account-merged list when sync lands.
      listScripts().then(setScripts);
      refreshScripts().then(setScripts);
      getUsageStatus().then(setUsage);
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
            <Text style={styles.tagline}>Friendly Ai reader To-go!</Text>
            <Text style={styles.blurb}>
              Snap a photo of your sides, highlight your lines, and FART reads everyone else&apos;s —
              so you can rehearse anywhere.
            </Text>
            {Platform.OS !== 'web' && (
              <Pressable
                style={({ pressed }) => [styles.webBanner, pressed && styles.pressed]}
                onPress={() => Linking.openURL('https://fluffychainsaws.github.io/fart')}>
                <Text style={styles.webBannerText}>🌐 Use FART on the web</Text>
                <Text style={styles.webBannerSubtext}>Full features, no app install needed</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.planPill, pressed && styles.pressed]}
              onPress={() => router.push('/account')}>
              <Text style={styles.planPillText}>
                {usage
                  ? `${getTier(usage.tier).name} · ${usage.unlimited ? 'Unlimited auditions' : `${usage.auditionsUsed}/${usage.auditionsPerMonth} auditions`}`
                  : 'Your plan'}
              </Text>
              <Text style={styles.planPillArrow}>›</Text>
            </Pressable>
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
            {Platform.OS === 'web' && (
              <Pressable
                style={({ pressed }) => [styles.micTestButton, pressed && styles.pressed]}
                onPress={() => router.push('/mictest')}>
                <Text style={styles.micTestButtonText}>🎙 Test your microphone</Text>
              </Pressable>
            )}
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

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    listContent: { padding: 20, paddingBottom: 40, maxWidth: 700, width: '100%', alignSelf: 'center' },
    tagline: { fontSize: 15, fontWeight: '700', color: t.accent, letterSpacing: 0.5, textAlign: 'center' },
    blurb: { fontSize: 15, color: t.inkSoft, marginTop: 6, lineHeight: 21 },
    webBanner: {
      backgroundColor: '#e8f5ff',
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginTop: 14,
      borderLeftWidth: 4,
      borderLeftColor: '#0066cc',
    },
    webBannerText: { fontSize: 14, fontWeight: '700', color: '#0066cc' },
    webBannerSubtext: { fontSize: 12, color: '#0066cc', marginTop: 2, opacity: 0.8 },
    planPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginTop: 14,
    },
    planPillText: { fontSize: 13, fontWeight: '700', color: t.ink },
    planPillArrow: { fontSize: 16, color: t.inkSoft },
    primaryButton: {
      backgroundColor: t.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 20,
      ...shadow,
    },
    primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    secondaryButton: {
      backgroundColor: t.accentSoft,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 10,
    },
    secondaryButtonText: { color: t.accent, fontSize: 15, fontWeight: '700' },
    micTestButton: {
      borderRadius: 16,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 10,
      borderWidth: 1,
      borderColor: t.border,
    },
    micTestButtonText: { color: t.inkSoft, fontSize: 14, fontWeight: '700' },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: t.inkSoft, marginTop: 28, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
    empty: { color: t.inkSoft, fontSize: 14, marginTop: 28, textAlign: 'center' },
    card: {
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
    cardBody: { flex: 1, marginRight: 12 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: t.ink },
    cardMeta: { fontSize: 13, color: t.inkSoft, marginTop: 4 },
    trash: { fontSize: 18 },
    pressed: { opacity: 0.7 },
  });
