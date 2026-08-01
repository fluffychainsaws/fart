import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/lib/AppText';
import { voiceLabel } from '@/lib/cloudVoice';
import { APP_NAME_OPTIONS, APP_NAME_POLL, pollResults, type PollResults } from '@/lib/poll';
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
  uploads: number;
  pages: number;
  tts_chars: number;
}

interface VoiceRow {
  voice: string;
  uses: number;
  chars: number;
}

interface FeedbackRow {
  id: number;
  kind: 'bug' | 'idea' | 'feedback';
  message: string;
  context: string | null;
  created_at: string;
}

const FEEDBACK_LABEL: Record<FeedbackRow['kind'], string> = {
  bug: '🐞 Bug',
  idea: '💡 Idea',
  feedback: '💬 Feedback',
};

export default function AdminScreen() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const [rows, setRows] = useState<TierRow[] | null>(null);
  const [voices, setVoices] = useState<VoiceRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [poll, setPoll] = useState<PollResults>({});
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
      // Recent user feedback — best-effort; a failure just hides the panel.
      supabase.rpc('admin_feedback').then(({ data }) => {
        setFeedback((data as FeedbackRow[]) ?? []);
      });
      // "Help name the app" poll tally — best-effort.
      pollResults(APP_NAME_POLL).then(setPoll);
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
      acc.uploads += r.uploads;
      acc.pages += r.pages;
      return acc;
    },
    { revenue: 0, cost: 0, users: 0, auditions: 0, uploads: 0, pages: 0 },
  );

  const pollTotal = Object.values(poll).reduce((sum, n) => sum + n, 0);

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
            <Text style={styles.cardLine}>
              📤 {r.uploads} upload{r.uploads === 1 ? '' : 's'} · 📄 {r.pages.toLocaleString()} page
              {r.pages === 1 ? '' : 's'} parsed
            </Text>
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
          👥 {totals.users} users · 📤 {totals.uploads} uploads · 📄{' '}
          {totals.pages.toLocaleString()} pages
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

      {pollTotal > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTier}>Name poll</Text>
          <Text style={styles.voiceNote}>
            Votes from the helper bot&apos;s &ldquo;help name the app&rdquo; poll.
          </Text>
          {[...APP_NAME_OPTIONS]
            .sort((a, b) => (poll[b.id] ?? 0) - (poll[a.id] ?? 0))
            .map((opt) => {
              const votes = poll[opt.id] ?? 0;
              const pct = Math.round((votes / pollTotal) * 100);
              return (
                <Text key={opt.id} style={styles.cardLine}>
                  {opt.label} — {votes} vote{votes === 1 ? '' : 's'} · {pct}%
                </Text>
              );
            })}
          <Text style={[styles.cardLine, { fontWeight: '800' }]}>
            Total: {pollTotal} vote{pollTotal === 1 ? '' : 's'}
          </Text>
        </View>
      )}

      {feedback.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTier}>Recent feedback</Text>
          <Text style={styles.voiceNote}>
            Bug reports and ideas sent from the in-app helper, newest first.
          </Text>
          {feedback.map((f) => (
            <View key={f.id} style={styles.feedbackItem}>
              <Text style={styles.feedbackMeta}>
                {FEEDBACK_LABEL[f.kind] ?? f.kind} ·{' '}
                {new Date(f.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              <Text style={styles.feedbackMsg}>{f.message}</Text>
            </View>
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
    feedbackItem: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    feedbackMeta: { fontSize: 12, fontWeight: '700', color: t.accent },
    feedbackMsg: { fontSize: 13, color: t.ink, marginTop: 3, lineHeight: 19 },
  });
