import { createElement, useCallback, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Text } from '@/lib/AppText';
import { ClapperIcon } from '@/lib/ClapperIcon';
import { makeDemoScript } from '@/lib/demo';
import { InstallPrompt } from '@/lib/InstallPrompt';
import { saveScript } from '@/lib/storage';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';
import { getUsageStatus } from '@/lib/usage';

export default function HomeScreen() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const { width } = useWindowDimensions();
  const [isPaid, setIsPaid] = useState(false);
  // Show the desktop/web demo on wide screens, the phone demo on narrow ones —
  // matching the docked-menu breakpoint so the video reflects what they see.
  const wideDemo = width >= 700;
  const demoBase = wideDemo ? 'demo-web' : 'demo-phone';

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
      <InstallPrompt />
      <Text style={styles.tagline}>Friendly AI Reader To-Go!</Text>
      <Text style={styles.blurb}>
        Snap a photo of your sides, highlight your lines, and FART reads everyone else&apos;s — so
        you can rehearse anywhere.
      </Text>
      {Platform.OS === 'web' && (
        <View style={styles.videoWrap}>
          {createElement(
            'video',
            {
              // Remount when switching phone/web so the new sources load.
              key: demoBase,
              autoPlay: true,
              loop: true,
              muted: true,
              playsInline: true,
              controls: false,
              preload: 'auto',
              // React's `muted` prop is unreliable for autoplay; set it on the node too.
              ref: (el: HTMLVideoElement | null) => {
                if (el) el.muted = true;
              },
              style: {
                width: '100%',
                maxWidth: wideDemo ? 560 : 300,
                borderRadius: 18,
                display: 'block',
              },
            },
            // mp4 (H.264) first for iOS/Safari; webm fallback for everything else.
            createElement('source', { key: 'mp4', src: `/${demoBase}.mp4`, type: 'video/mp4' }),
            createElement('source', { key: 'webm', src: `/${demoBase}.webm`, type: 'video/webm' }),
          )}
          <Text style={styles.videoCaption}>See how it works</Text>
        </View>
      )}
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
    videoWrap: { alignItems: 'center', marginTop: 18 },
    videoCaption: { fontSize: 12, color: t.inkSoft, marginTop: 6, fontWeight: '600' },
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
