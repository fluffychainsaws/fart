import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/lib/AppText';
import {
  APP_NAME_OPTIONS,
  APP_NAME_POLL,
  castVote,
  pollResults,
  votedOptionFor,
  type PollResults,
} from '@/lib/poll';
import { useTheme, type Theme } from '@/lib/theme';

// "Help name the app" community poll, rendered inline in the side menu. Before
// voting it shows the name shortlist as tappable rows; once you vote (or if you
// already have) it collapses to a compact "Thank you for voting!" line that can
// be tapped to peek the live results. Tallies come from the public
// poll_results() RPC — see src/lib/poll.ts.
export function NamePoll() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [results, setResults] = useState<PollResults>({});
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);

  // Load the tally + any prior vote once, so we know which state to render.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [voted, res] = await Promise.all([votedOptionFor(APP_NAME_POLL), pollResults(APP_NAME_POLL)]);
      if (!alive) return;
      setVotedFor(voted);
      setResults(res);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  // Hold off until we know whether the user has voted, to avoid a flash of the
  // options for someone who already voted.
  if (!ready) return null;

  if (votedFor) {
    return (
      <View style={styles.wrap}>
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          style={({ pressed }) => [styles.thanksRow, pressed && styles.pressed]}>
          <Text style={styles.thanksText}>🗳️ Thank you for voting! 💛</Text>
          <Text style={styles.caret}>{expanded ? '▾' : '▸'}</Text>
        </Pressable>
        {expanded && (
          <View style={styles.results}>
            {APP_NAME_OPTIONS.map((opt) => {
              const votes = results[opt.id] ?? 0;
              const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
              const mine = votedFor === opt.id;
              return (
                <View key={opt.id} style={styles.resultRow}>
                  <View style={[styles.bar, { width: `${pct}%` }, mine && styles.barMine]} />
                  <View style={styles.resultContent}>
                    <Text style={styles.resultLabel} numberOfLines={1}>
                      {opt.label}
                      {mine ? '  ✓' : ''}
                    </Text>
                    <Text style={styles.resultPct}>{pct}%</Text>
                  </View>
                </View>
              );
            })}
            <Text style={styles.tally}>
              {totalVotes} vote{totalVotes === 1 ? '' : 's'} so far
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>📊 Help name the app</Text>
      {APP_NAME_OPTIONS.map((opt) => (
        <Pressable
          key={opt.id}
          onPress={() => vote(opt.id)}
          disabled={voting}
          style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
          <Text style={styles.optionText} numberOfLines={1}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 10, marginTop: 4, marginBottom: 4 },
    title: {
      fontSize: 11,
      fontWeight: '800',
      color: t.accent,
      letterSpacing: 0.3,
      marginBottom: 8,
    },
    option: {
      borderWidth: 1,
      borderColor: t.accent,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      marginBottom: 6,
      backgroundColor: t.card,
    },
    optionText: { color: t.ink, fontSize: 13, fontWeight: '700' },

    thanksRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: t.accentSoft,
    },
    thanksText: { color: t.accent, fontSize: 13, fontWeight: '800', flexShrink: 1 },
    caret: { color: t.accent, fontSize: 12, fontWeight: '800', marginLeft: 6 },

    results: { marginTop: 8, gap: 6 },
    resultRow: {
      position: 'relative',
      height: 30,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.bg,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    bar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: t.accentSoft },
    barMine: { backgroundColor: t.accent, opacity: 0.35 },
    resultContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    resultLabel: { color: t.ink, fontSize: 12, fontWeight: '700', flexShrink: 1 },
    resultPct: { color: t.ink, fontSize: 12, fontWeight: '800', marginLeft: 6 },
    tally: { color: t.inkSoft, fontSize: 11, paddingHorizontal: 2 },

    pressed: { opacity: 0.7 },
  });
