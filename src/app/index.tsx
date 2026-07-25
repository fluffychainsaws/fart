import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Linking, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/lib/AppText';
import { makeDemoScript } from '@/lib/demo';
import { InstallPrompt } from '@/lib/InstallPrompt';
import { signupPromoOpen } from '@/lib/promo';
import { useCardShadow, useEffectiveScheme, useTheme, type Theme } from '@/lib/theme';

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
  const scheme = useEffectiveScheme();
  const { width } = useWindowDimensions();
  // Phone-width browsers: the landscape clip gets cropped to a heavy zoom when
  // it "covers" the tall page, so on phones we fit the whole frame instead.
  const isPhone = width < 700;
  // The fitted band is full-width at the clip's 16:9 ratio; push the content
  // (offer banner + hero) below it so they don't overlap the video.
  const bandInset = isPhone ? Math.round(width * (9 / 16)) + 12 : 20;
  const styles = useMemo(
    () => makeStyles(t, shadow, scheme, isPhone, bandInset),
    [t, shadow, scheme, isPhone, bandInset],
  );
  const promoOpen = signupPromoOpen();

  // Respect "reduce motion": pause the backdrop video (a static first frame
  // still gives the page depth) for users who opt out of animation.
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  useEffect(() => {
    const v = bgVideoRef.current;
    if (!v) return;
    if (reduceMotion) v.pause();
    else void v.play().catch(() => {});
  }, [reduceMotion]);

  // Slow attention-grabbing pulse for the launch banner.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!promoOpen) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [promoOpen, pulse]);

  const tryDemo = async () => {
    const demo = makeDemoScript();
    await import('@/lib/storage').then((m) => m.saveScript(demo));
    router.push({ pathname: '/assign/[id]', params: { id: demo.id } });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Ambient backdrop (web only). Absolutely positioned to span the full
          page height so it scrolls WITH the content, layered behind it via a
          readability scrim so the hero copy stays legible. */}
      {Platform.OS === 'web' && (
        <>
          {createElement(
            'video',
            {
              key: 'home-bg',
              autoPlay: !reduceMotion,
              loop: true,
              muted: true,
              playsInline: true,
              controls: false,
              preload: 'auto',
              'aria-hidden': true,
              ref: (el: HTMLVideoElement | null) => {
                bgVideoRef.current = el;
                if (el) el.muted = true;
              },
              style: {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                // Phones: show the whole frame (smaller, uncropped) anchored to
                // the top. Wider screens keep the full-bleed cover.
                objectFit: isPhone ? 'contain' : 'cover',
                objectPosition: isPhone ? 'center top' : 'center',
                zIndex: 0,
                pointerEvents: 'none',
              },
            },
            // mp4 first for Safari; webm for browsers without H.264.
            createElement('source', { key: 'mp4', src: '/home-bg.mp4', type: 'video/mp4' }),
            createElement('source', { key: 'webm', src: '/home-bg.webm', type: 'video/webm' }),
          )}
          <View style={styles.bgScrim} pointerEvents="none" />
        </>
      )}

      <View style={styles.layer}>
      {promoOpen && (
        <Animated.View style={{ opacity: pulse }}>
          <Pressable
            style={({ pressed }) => [styles.promoBanner, pressed && styles.pressed]}
            onPress={() => router.push('/account')}>
            <Text style={styles.promoText}>
              🎁 Launch offer — get free premium credits on your first plan
            </Text>
            <Text style={styles.promoCta}>See plans →</Text>
          </Pressable>
        </Animated.View>
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
      <Text style={styles.hero}>
        Do your friends suck and not have enough time for you?! Well guess what — FART is here for
        you!
      </Text>
      <Text style={styles.subhead}>
        We have changed the game of AI reading to a whole new level! We offer the highest quality
        voices. Hands-free commands, so you can keep acting without delay. We give you the ability to
        improv and still have a human-like response from our reader, F.A.R.T.
      </Text>


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
      </View>
    </ScrollView>
  );
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

const makeStyles = (
  t: Theme,
  shadow: ReturnType<typeof useCardShadow>,
  scheme: 'light' | 'dark',
  isPhone: boolean,
  bandInset: number,
) => {
  const [r, g, b] = hexToRgb(t.bg);
  // Scrim over the backdrop video so hero copy stays legible. A touch lighter in
  // dark mode (video shows through more) and heavier in light mode where dark
  // text needs the contrast. On phones the video is a small top band with
  // little copy over it, so we lighten the scrim to let that frame read.
  const scrimAlpha = isPhone ? 0.55 : scheme === 'dark' ? 0.72 : 0.82;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    // Full-width scroll container that also acts as the positioning context for
    // the absolutely-positioned backdrop, so the video spans the whole page.
    content: { width: '100%', position: 'relative' },
    // Tint sitting between the backdrop video and the page content. Spans the
    // full page height (absolute) so it scrolls together with the video.
    bgScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: `rgba(${r},${g},${b},${scrimAlpha})`,
      zIndex: 0,
    },
    // Everything the user reads/taps lives here, lifted above the backdrop and
    // carrying the page's width constraint / padding.
    layer: {
      position: 'relative',
      zIndex: 1,
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      paddingHorizontal: 20,
      // On phones this clears the fitted video band above; on wider screens the
      // content overlaps the full-bleed cover as intended.
      paddingTop: bandInset,
      paddingBottom: 56,
    },
    promoBanner: {
      backgroundColor: '#DC2626',
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
};
