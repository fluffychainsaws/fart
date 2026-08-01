import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/lib/AppText';
import {
  APP_NAME_OPTIONS,
  APP_NAME_POLL,
  castVote,
  pollResults,
  votedOptionFor,
  type PollResults,
} from '@/lib/poll';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';

// "Help name the app" community poll, opened from the side menu. Shows the name
// shortlist as tappable options; once you vote (or if you already have) it flips
// to a live results view with a bar per option. Tallies come from the public
// poll_results() RPC — see src/lib/poll.ts. Modal-only: the menu owns the link
// that toggles `visible`.
export function NamePollModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);

  const [results, setResults] = useState<PollResults>({});
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);

  // Load the tally + any prior vote each time the poll opens.
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    (async () => {
      const [voted, res] = await Promise.all([votedOptionFor(APP_NAME_POLL), pollResults(APP_NAME_POLL)]);
      if (!alive) return;
      setVotedFor(voted);
      setResults(res);
    })();
    return () => {
      alive = false;
    };
  }, [visible]);

  const vote = async (optionId: string) => {
    if (votedFor || voting) return;
    setVoting(true);
    const ok = await castVote(APP_NAME_POLL, optionId);
    if (ok) {
      setVotedFor(optionId);
      setResults(await pollResults(APP_NAME_POLL));
    }
    setVoting(false);
  };

  const totalVotes = Object.values(results).reduce((sum, n) => sum + n, 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.panelWrap} pointerEvents="box-none">
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>📊</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Help name the app</Text>
              <Text style={styles.headerSub}>Your vote helps us pick 💛</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <Text style={styles.intro}>🎭 Which name do you like best?</Text>
            {APP_NAME_OPTIONS.map((opt) => {
              const votes = results[opt.id] ?? 0;
              const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
              const mine = votedFor === opt.id;
              if (votedFor) {
                return (
                  <View key={opt.id} style={styles.resultRow}>
                    <View style={[styles.bar, { width: `${pct}%` }, mine && styles.barMine]} />
                    <View style={styles.resultContent}>
                      <Text style={styles.resultLabel}>
                        {opt.label}
                        {mine ? '  ✓' : ''}
                      </Text>
                      <Text style={styles.resultPct}>{pct}%</Text>
                    </View>
                  </View>
                );
              }
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => vote(opt.id)}
                  disabled={voting}
                  style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.optionText}>{opt.label}</Text>
                </Pressable>
              );
            })}
            {votedFor ? (
              <Text style={styles.tally}>
                Thanks for voting! 💛 {totalVotes} vote{totalVotes === 1 ? '' : 's'} so far.
              </Text>
            ) : (
              <Text style={styles.tally}>Tap your favorite — you’ll see the results after you vote.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    panelWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
    panel: {
      width: '100%',
      maxWidth: 400,
      maxHeight: '80%',
      backgroundColor: t.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.border,
      overflow: 'hidden',
      ...shadow,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      backgroundColor: t.accentSoft,
    },
    headerEmoji: { fontSize: 26 },
    headerTitle: { fontSize: 16, fontWeight: '800', color: t.ink },
    headerSub: { fontSize: 12, color: t.inkSoft, marginTop: 1 },
    closeBtn: { padding: 4 },
    closeText: { fontSize: 18, color: t.inkSoft, fontWeight: '700' },

    body: { flexGrow: 0 },
    bodyContent: { padding: 14, gap: 12 },
    intro: { color: t.ink, fontSize: 14, lineHeight: 20 },

    option: {
      borderWidth: 1,
      borderColor: t.accent,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      backgroundColor: t.card,
    },
    optionText: { color: t.ink, fontSize: 15, fontWeight: '700' },
    resultRow: {
      position: 'relative',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.bg,
      overflow: 'hidden',
      height: 46,
      justifyContent: 'center',
    },
    bar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: t.accentSoft,
    },
    barMine: { backgroundColor: t.accent, opacity: 0.35 },
    resultContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
    },
    resultLabel: { color: t.ink, fontSize: 14, fontWeight: '700', flexShrink: 1 },
    resultPct: { color: t.ink, fontSize: 14, fontWeight: '800', marginLeft: 8 },
    tally: { color: t.inkSoft, fontSize: 13, textAlign: 'center', marginTop: 2 },
  });
