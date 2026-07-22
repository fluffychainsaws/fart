import { useCallback, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Text } from '@/lib/AppText';
import { ClapperIcon } from '@/lib/ClapperIcon';
import { makeDemoScript } from '@/lib/demo';
import { saveScript } from '@/lib/storage';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';
import { getUsageStatus } from '@/lib/usage';

export default function HomeScreen() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const [isPaid, setIsPaid] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getUsageStatus().then((status) => setIsPaid(status.tier !== 'free'));
    }, []),
  );

  const tryDemo = async () => {
    const demo = makeDemoScript();
    await saveScript(demo);
    router.push({ pathname: '/assign/[id]', params: { id: demo.id } });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.tagline}>Friendly AI Reader To-Go!</Text>
      <Text style={styles.blurb}>
        Snap a photo of your sides, highlight your lines, and FART reads everyone else&apos;s — so
        you can rehearse anywhere.
      </Text>
      {Platform.OS !== 'web' && (
        <Pressable
          style={({ pressed }) => [styles.webBanner, pressed && styles.pressed]}
          onPress={() => Linking.openURL('https://selftapebuddy.com')}>
          <Text style={styles.webBannerText}>🌐 Use FART on the web</Text>
          <Text style={styles.webBannerSubtext}>Full features, no app install needed</Text>
        </Pressable>
      )}
      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        onPress={() => router.push('/capture')}>
        <ClapperIcon size={20} />
        <Text style={styles.primaryButtonText}>New script</Text>
      </Pressable>
      {!isPaid && (
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={tryDemo}>
          <Text style={styles.secondaryButtonText}>🎬 Try the demo scene</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 40, maxWidth: 700, width: '100%', alignSelf: 'center' },
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
    primaryButton: {
      backgroundColor: t.accent,
      borderRadius: 16,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 20,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.15)',
      ...shadow,
    },
    primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    secondaryButton: {
      backgroundColor: t.accentSoft,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 10,
      borderWidth: 1,
      borderColor: t.border,
    },
    secondaryButtonText: { color: t.accent, fontSize: 15, fontWeight: '700' },
    pressed: { opacity: 0.7 },
  });
