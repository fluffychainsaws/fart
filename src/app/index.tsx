import { createElement, useMemo } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/lib/AppText';
import { makeDemoScript } from '@/lib/demo';
import { InstallPrompt } from '@/lib/InstallPrompt';
import { signupPromoOpen } from '@/lib/promo';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';

const FEATURES = [
  {
    icon: '🎧',
    title: 'Reads with you, not at you',
    desc: 'It listens and answers the moment you finish your line — on your cue, not a countdown timer.',
  },
  {
    icon: '🔊',
    title: 'Natural AI voices',
    desc: 'A distinct, lifelike voice for every character in the scene — no robotic monotone.',
  },
  {
    icon: '📸',
    title: 'Your real sides',
    desc: 'Snap a photo or drop a PDF and it reads your actual script — no retyping, no setup.',
  },
  {
    icon: '🎬',
    title: 'Direct the delivery',
    desc: 'Add notes like “angrier,” “pause here,” or “cut me off,” and the reader adapts.',
  },
  {
    icon: '🎙',
    title: 'Hands-free',
    desc: 'Say “FART start” to roll and “FART restart” to run it back — never touch your phone.',
  },
  {
    icon: '🌐',
    title: 'Anywhere, no install',
    desc: 'Runs in your browser on any device. Add it to your home screen in one tap.',
  },
];

export default function HomeScreen() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const { width } = useWindowDimensions();
  const wideDemo = width >= 700;
  const demoBase = wideDemo ? 'demo-web' : 'demo-phone';
  const promoOpen = signupPromoOpen();

  const tryDemo = async () => {
    const demo = makeDemoScript();
    await import('@/lib/storage').then((m) => m.saveScript(demo));
    router.push({ pathname: '/assign/[id]', params: { id: demo.id } });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {promoOpen && (
        <Pressable
          style={({ pressed }) => [styles.promoBanner, pressed && styles.pressed]}
          onPress={() => router.push('/account')}>
          <Text style={styles.promoText}>
            🎁 Launch offer — get free premium credits on your first plan
          </Text>
          <Text style={styles.promoCta}>See plans →</Text>
        </Pressable>
      )}

      <InstallPrompt />

      {Platform.OS !== 'web' && (
        <Pressable
          style={({ pressed }) => [styles.webBanner, pressed && styles.pressed]}
          onPress={() => Linking.openURL('https://selftapebuddy.com')}>
          <Text style={styles.webBannerText}>🌐 Use FART on the web</Text>
          <Text style={styles.webBannerSubtext}>Full features, no app install needed</Text>
        </Pressable>
      )}

      {/* Hero */}
      <Text style={styles.kicker}>YOUR POCKET SCENE PARTNER</Text>
      <Text style={styles.hero}>Run your lines with a partner who&apos;s always ready.</Text>
      <Text style={styles.subhead}>
        FART reads every other character out loud in a natural voice — and waits for your cue. Snap
        your sides, highlight your lines, and rehearse anywhere.
      </Text>

      {Platform.OS === 'web' && (
        <View style={styles.videoWrap}>
          {createElement(
            'video',
            {
              key: demoBase,
              autoPlay: true,
              loop: true,
              muted: true,
              playsInline: true,
              controls: false,
              preload: 'auto',
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
            createElement('source', { key: 'mp4', src: `/${demoBase}.mp4`, type: 'video/mp4' }),
            createElement('source', { key: 'webm', src: `/${demoBase}.webm`, type: 'video/webm' }),
          )}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.ctaPrimary, pressed && styles.pressed]}
        onPress={tryDemo}>
        <Text style={styles.ctaPrimaryText}>▶ Try the demo scene — free</Text>
      </Pressable>
      <Text style={styles.ctaMicro}>No sign-up. No download. Rehearse in seconds.</Text>

      {/* Value props */}
      <Text style={styles.sectionTitle}>Why actors love it</Text>
      <View style={styles.featureGrid}>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.featureCard}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <View style={styles.featureBody}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Differentiators */}
      <View style={styles.diffCard}>
        <Text style={styles.diffTitle}>Made for the way actors actually rehearse</Text>
        <Text style={styles.diffLine}>✓ No app to download — works on iPhone and Android</Text>
        <Text style={styles.diffLine}>✓ Reads your real sides, not just text you type in</Text>
        <Text style={styles.diffLine}>✓ Waits for your cue instead of guessing with a timer</Text>
        <Text style={styles.diffLine}>✓ Free to start — your first audition is on us</Text>
      </View>

      {/* Bottom CTA */}
      <Pressable
        style={({ pressed }) => [styles.ctaSecondary, pressed && styles.pressed]}
        onPress={() => router.push('/capture')}>
        <Text style={styles.ctaSecondaryText}>Rehearse your own sides →</Text>
      </Pressable>
      <Pressable style={styles.plansLink} onPress={() => router.push('/account')}>
        <Text style={styles.plansLinkText}>See plans &amp; pricing</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 56, maxWidth: 720, width: '100%', alignSelf: 'center' },
    promoBanner: {
      backgroundColor: t.accent,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 14,
      alignItems: 'center',
      ...shadow,
    },
    promoText: { color: '#fff', fontSize: 14, fontWeight: '800', textAlign: 'center', lineHeight: 19 },
    promoCta: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 3, opacity: 0.9 },
    webBanner: {
      backgroundColor: '#e8f5ff',
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 14,
      borderLeftWidth: 4,
      borderLeftColor: '#0066cc',
    },
    webBannerText: { fontSize: 14, fontWeight: '700', color: '#0066cc' },
    webBannerSubtext: { fontSize: 12, color: '#0066cc', marginTop: 2, opacity: 0.8 },
    kicker: {
      fontSize: 12,
      fontWeight: '800',
      color: t.accent,
      letterSpacing: 1.5,
      textAlign: 'center',
      marginTop: 4,
    },
    hero: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '800',
      color: t.ink,
      textAlign: 'center',
      marginTop: 10,
    },
    subhead: {
      fontSize: 16,
      lineHeight: 23,
      color: t.inkSoft,
      textAlign: 'center',
      marginTop: 12,
      maxWidth: 560,
      alignSelf: 'center',
    },
    videoWrap: { alignItems: 'center', marginTop: 22 },
    ctaPrimary: {
      backgroundColor: t.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 22,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.15)',
      maxWidth: 420,
      width: '100%',
      alignSelf: 'center',
      ...shadow,
    },
    ctaPrimaryText: { color: '#fff', fontSize: 17, fontWeight: '800' },
    ctaMicro: { fontSize: 12, color: t.inkSoft, textAlign: 'center', marginTop: 8, fontWeight: '600' },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: t.ink,
      textAlign: 'center',
      marginTop: 40,
      marginBottom: 4,
    },
    featureGrid: { marginTop: 12, gap: 10 },
    featureCard: {
      flexDirection: 'row',
      gap: 12,
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      padding: 16,
      ...shadow,
    },
    featureIcon: { fontSize: 24, marginTop: 1 },
    featureBody: { flex: 1 },
    featureTitle: { fontSize: 15, fontWeight: '800', color: t.ink },
    featureDesc: { fontSize: 13, color: t.inkSoft, lineHeight: 19, marginTop: 3 },
    diffCard: {
      backgroundColor: t.accentSoft,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.accent,
      padding: 18,
      marginTop: 28,
    },
    diffTitle: { fontSize: 16, fontWeight: '800', color: t.accent, marginBottom: 10 },
    diffLine: { fontSize: 14, color: t.ink, lineHeight: 24, fontWeight: '600' },
    ctaSecondary: {
      backgroundColor: t.accentSoft,
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 28,
      borderWidth: 1,
      borderColor: t.border,
      maxWidth: 420,
      width: '100%',
      alignSelf: 'center',
    },
    ctaSecondaryText: { color: t.accent, fontSize: 15, fontWeight: '800' },
    plansLink: { alignItems: 'center', paddingVertical: 14, marginTop: 2 },
    plansLinkText: { fontSize: 14, color: t.inkSoft, fontWeight: '700' },
    pressed: { opacity: 0.7 },
  });
