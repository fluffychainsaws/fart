import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/lib/AppText';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';
import {
  FREE_VOICES,
  PREMIUM_VOICES,
  SAMPLE_LINE,
  voiceSampleSrc,
  type VoiceGroup,
  type VoiceSample,
} from '@/lib/voiceSamples';

// "Hear the voices of F.A.R.T." — plays the pre-recorded per-voice clips. Web
// only (uses a DOM Audio element); gate on SAMPLES_READY at the call site.
export function VoiceSampler() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new window.Audio();
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const toggle = (id: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingId === id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.pause();
    audio.src = voiceSampleSrc(id);
    audio.currentTime = 0;
    setPlayingId(id);
    audio.play().catch(() => setPlayingId(null));
  };

  const Pill = ({ v }: { v: VoiceSample }) => {
    const on = playingId === v.id;
    return (
      <Pressable
        onPress={() => toggle(v.id)}
        style={({ pressed }) => [styles.pill, on && styles.pillOn, pressed && styles.pressed]}>
        <Text style={[styles.pillIcon, on && styles.pillTextOn]}>{on ? '⏸' : '▶'}</Text>
        <Text style={[styles.pillText, on && styles.pillTextOn]}>{v.name}</Text>
      </Pressable>
    );
  };

  const Group = ({ group }: { group: VoiceGroup }) => (
    <>
      <Text style={styles.genderLabel}>Female</Text>
      <View style={styles.pillRow}>
        {group.female.map((v) => (
          <Pill key={v.id} v={v} />
        ))}
      </View>
      <Text style={styles.genderLabel}>Male</Text>
      <View style={styles.pillRow}>
        {group.male.map((v) => (
          <Pill key={v.id} v={v} />
        ))}
      </View>
    </>
  );

  return (
    <View style={styles.section}>
      <Text style={styles.title}>🔊 Hear the voices of F.A.R.T.</Text>
      <Text style={styles.line}>“{SAMPLE_LINE}”</Text>

      <View style={styles.card}>
        <Text style={styles.tierLabel}>Free voices</Text>
        <Group group={FREE_VOICES} />
      </View>

      <View style={[styles.card, styles.cardPremium]}>
        <Text style={styles.tierLabel}>✨ Premium voices</Text>
        <Group group={PREMIUM_VOICES} />
      </View>
    </View>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    section: { marginTop: 40 },
    title: { fontSize: 20, fontWeight: '800', color: t.ink, textAlign: 'center' },
    line: {
      fontSize: 14,
      fontStyle: 'italic',
      color: t.inkSoft,
      textAlign: 'center',
      marginTop: 6,
      marginBottom: 16,
      maxWidth: 460,
      alignSelf: 'center',
    },
    card: {
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      padding: 16,
      marginTop: 12,
      ...shadow,
    },
    cardPremium: { borderColor: t.accent, backgroundColor: t.accentSoft },
    tierLabel: {
      fontSize: 13,
      fontWeight: '800',
      color: t.accent,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
    genderLabel: { fontSize: 12, fontWeight: '700', color: t.inkSoft, marginTop: 10, marginBottom: 6 },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: t.bg,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      paddingVertical: 9,
      paddingHorizontal: 14,
    },
    pillOn: { backgroundColor: t.accent, borderColor: t.accent },
    pillIcon: { fontSize: 12, color: t.accent, fontWeight: '900' },
    pillText: { fontSize: 14, fontWeight: '700', color: t.ink },
    pillTextOn: { color: '#fff' },
    pressed: { opacity: 0.7 },
  });
