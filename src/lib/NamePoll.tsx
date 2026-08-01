import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/lib/AppText';
import { APP_NAME_OPTIONS, APP_NAME_POLL, castVote, votedOptionFor } from '@/lib/poll';
import { useTheme, type Theme } from '@/lib/theme';

// "Help name the app" community poll, rendered inline in the side menu. Before
// voting it shows the name shortlist as tappable rows; once you vote (or if you
// already have) it collapses to a compact "Thank you for voting!" line. Results
// stay hidden for now — we'll surface the tally once there's enough traction to
// make it worth showing. Votes still land in Supabase; the owner sees the
// running count in /admin in the meantime.
export function NamePoll() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [ready, setReady] = useState(false);

  // Check whether this device has already voted, so we know which state to show.
  useEffect(() => {
    let alive = true;
    votedOptionFor(APP_NAME_POLL).then((voted) => {
      if (!alive) return;
      setVotedFor(voted);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const vote = async (optionId: string) => {
    if (votedFor || voting) return;
    setVoting(true);
    const ok = await castVote(APP_NAME_POLL, optionId);
    if (ok) setVotedFor(optionId);
    setVoting(false);
  };

  // Hold off until we know whether the user has voted, to avoid a flash of the
  // options for someone who already voted.
  if (!ready) return null;

  if (votedFor) {
    return (
      <View style={styles.box}>
        <Text style={styles.thanksText}>🗳️ Thank you for voting! 💛</Text>
      </View>
    );
  }

  return (
    <View style={styles.box}>
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
    box: {
      marginHorizontal: 8,
      marginVertical: 6,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.bg,
    },
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
      borderRadius: 9,
      paddingVertical: 6,
      paddingHorizontal: 9,
      marginBottom: 5,
      backgroundColor: t.card,
    },
    optionText: { color: t.ink, fontSize: 12, fontWeight: '700' },

    thanksText: { color: t.accent, fontSize: 12, fontWeight: '800' },

    pressed: { opacity: 0.7 },
  });
