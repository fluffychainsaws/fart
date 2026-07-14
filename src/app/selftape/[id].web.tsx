import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '@/lib/theme';

// Web build of the self-tape route: expo-camera can't record video in a
// browser and expo-media-library has no web module at all, so this fallback
// keeps those native imports out of the web bundle entirely.
export default function SelfTapeScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={styles.screen}>
      <Text style={styles.emoji}>🎥</Text>
      <Text style={styles.title}>Self-tape needs your phone</Text>
      <Text style={styles.text}>
        Open FART on your phone (Expo Go) to record a take with the camera, your script, and the
        reader all running together.
      </Text>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emoji: { fontSize: 44 },
    title: { fontSize: 20, fontWeight: '800', color: t.ink, marginTop: 12 },
    text: {
      fontSize: 15,
      color: t.inkSoft,
      textAlign: 'center',
      lineHeight: 22,
      marginTop: 8,
      maxWidth: 420,
    },
  });
