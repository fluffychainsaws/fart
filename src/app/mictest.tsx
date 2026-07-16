import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/lib/AppText';
import { useTheme, type Theme } from '@/lib/theme';

// The mic-level meter uses the Web Audio API, which only exists in a
// browser — this diagnostic is web-only for now. On native, use the
// self-tape screen's own "Allow access" flow to grant mic permission.
export default function MicTestScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={styles.screen}>
      <Text style={styles.emoji}>🎙</Text>
      <Text style={styles.title}>Mic test is web-only</Text>
      <Text style={styles.text}>
        Open the website version of FART to run the microphone level test. On this device, self-tape
        mode already asks for microphone access directly when you start it.
      </Text>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emoji: { fontSize: 44 },
    title: { fontSize: 20, fontWeight: '800', color: t.ink, marginTop: 12 },
    text: { fontSize: 15, color: t.inkSoft, textAlign: 'center', lineHeight: 22, marginTop: 8, maxWidth: 420 },
  });
