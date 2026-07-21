import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/lib/AppText';
import { voiceLabel } from '@/lib/cloudVoice';
import { getTier, TIER_ORDER, type Tier } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';

// Owner-only monthly cost analysis. The data comes from the
// admin_usage_summary() SQL function, which refuses any caller whose
// profile isn't flagged is_admin — so this screen simply shows the error
// for everyone else.

// gpt-4o-mini-tts ≈ $0.015/min ≈ 900 chars of speech per minute.
const TTS_COST_PER_CHAR = 0.015 / 900;

// 'daypass' never appears here — profiles.tier's DB check constraint doesn't
// allow it (it's a script-scoped pseudo-tier, not a stored account tier) —
// but TypeScript still wants the Record exhaustive.
const TIER_PRICE: Record<Tier, number> = { free: 0, fart: 5, fartpro: 10, shartstar: 25, daypass: 0 };

interface TierRow {
  tier: Tier;
  users: number;
  active_users: number;
  auditions: number;
  tts_chars: number;
}

interface VoiceRow {
  voice: string;
  uses: number;
  chars: number;
}

export default function AdminScreen() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const [rows, setRows] = useState<TierRow[] | null>(null);
  const [voices, setVoices] = useState<VoiceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!supabase) {
        setError('Accounts backend not configured.');
        return;
      }
      supabase.rpc('admin_usage_summary').then(({ data, error: err }) => {
        if (err) setError(err.message.includes('not authorized') ? 'This page is for the site owner.' : err.message);
        else setRows((data as TierRow[]) ?? []);
      });
      // Voice popularity — best-effort; a failure just hides the panel.
      supabase.rpc('admin_voice_usage').then(({ data }) => {
        setVoices((data as VoiceRow[]) ?? []);
      });
    }, []),
  );

  const month = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  if (error) {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <Text style={styles.title}>Monthly analysis</Text>
          <Text style={styles.error}>{error}</Text>
        </View>
      </View>
    );
  }
  if (!rows) return <View style={styles.screen} />;

  const byTier = new Map(rows.map((r) => [r.tier, r]));
  const ordered = TIER_ORDER.map((id) => byTier.get(id)).filter(Boolean) as TierRow[];
  const totals = ordered.reduce(
    (acc, r) => {
      acc.revenue += r.users * TIER_PRICE[r.tier];
      acc.cost += r.tts_chars * TTS_COST_PER_CHAR;
      acc.users += r.users;
      acc.auditions += r.auditions;
      return acc;
    },
    { revenue: 0, cost: 0, users: 0, auditions: 0 },
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Monthly analysis — {month}</Text>
      <Text style={styles.blurb}>
        Voice cost is estimated from synthesized characters at OpenAI&apos;s gpt-4o-mini-tts rate.
        Revenue assumes every user on a paid tier pays full price (cancellations mid-month not
        counted). Neural (Kokoro) voices cost $0 and don&apos;t appear here.
      </Text>

      {ordered.map((r) => {
        const revenue = r.users * TIER_PRICE[r.tier];
        const cost = r.tts_chars * TTS_COST_PER_CHAR;
        return (
          <View key={r.tier} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTier}>{getTier(r.tier).name}</Text>
              <Text style={styles.cardRevenue}>
                ${revenue.toFixed(2)} in − ${cost.toFixed(2)} out
              </Text>
            </View>
            <Text style={styles.cardLine}>
              👤 {r.users} user{r.users === 1 ? '' : 's'} ({r.active_users} active this month)
            </Text>
            <Text style={styles.cardLine}>🎬 {r.auditions} auditions completed</Text>
            <Text style={styles.cardLine}>
              🔊 {r.tts_chars.toLocaleString()} TTS characters ≈ ${cost.toFixed(2)} voice spend
            </Text>
          </View>
        );
      })}

      <View style={[styles.card, styles.totalCard]}>
        <Text style={styles.cardTier}>Total</Text>
        <Text style={styles.cardLine}>
          💰 ${totals.revenue.toFixed(2)} est. revenue · ${totals.cost.toFixed(2)} voice cost ·{' '}
          {totals.revenue > 0
            ? `${Math.round(((totals.revenue - totals.cost) / totals.revenue) * 100)}% margin`
            : 'no revenue yet'}
        </Text>
        <Text style={styles.cardLine}>
          👥 {totals.users} users · 🎬 {totals.auditions} auditions
        </Text>
      </View>

      {voices.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTier}>Top voices</Text>
          <Text style={styles.voiceNote}>
            By number of synthesized lines this month (cached replays aren&apos;t re-counted).
          </Text>
          {[...voices]
            .sort((a, b) => b.uses - a.uses)
            .map((v, i) => (
              <Text key={v.voice} style={styles.cardLine}>
                {i + 1}. {voiceLabel(v.voice)} — {v.uses.toLocaleString()} line
                {v.uses === 1 ? '' : 's'} · {v.chars.toLocaleString()} chars
              </Text>
            ))}
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 48, maxWidth: 700, width: '100%', alignSelf: 'center' },
    title: { fontSize: 20, fontWeight: '800', color: t.ink, marginTop: 8 },
    blurb: { fontSize: 13, color: t.inkSoft, marginTop: 8, lineHeight: 19 },
    error: { fontSize: 14, color: t.inkSoft, marginTop: 16 },
    card: {
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      padding: 16,
      marginTop: 12,
      ...shadow,
    },
    totalCard: { borderColor: t.accent, borderWidth: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTier: { fontSize: 15, fontWeight: '800', color: t.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
    cardRevenue: { fontSize: 13, fontWeight: '700', color: t.ink },
    cardLine: { fontSize: 13, color: t.ink, marginTop: 6 },
    voiceNote: { fontSize: 12, color: t.inkSoft, marginTop: 4, marginBottom: 4, lineHeight: 17 },
  });
