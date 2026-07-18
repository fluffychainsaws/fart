import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/lib/AppText';
import { signOut, useSession } from '@/lib/auth';
import { accountsEnabled } from '@/lib/supabase';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';

export default function ProfileScreen() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const session = useSession();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!accountsEnabled ? (
        <View style={styles.card}>
          <Text style={styles.blurb}>
            Accounts aren&apos;t configured in this build. Everything still works — your scripts
            stay saved on this device.
          </Text>
        </View>
      ) : session ? (
        <View style={styles.card}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.email}>{session.user.email}</Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => signOut()}>
            <Text style={styles.buttonText}>Sign out</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.blurb}>Sign in to keep your scripts and plan across devices.</Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => router.push('/login')}>
            <Text style={styles.buttonText}>Sign in / Create account</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 48, maxWidth: 700, width: '100%', alignSelf: 'center' },
    card: {
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      padding: 18,
      ...shadow,
    },
    label: { fontSize: 12, fontWeight: '700', color: t.inkSoft, textTransform: 'uppercase', letterSpacing: 1 },
    email: { fontSize: 16, fontWeight: '700', color: t.ink, marginTop: 4 },
    blurb: { fontSize: 14, color: t.inkSoft, lineHeight: 20 },
    button: {
      backgroundColor: t.accentSoft,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
      marginTop: 14,
      borderWidth: 1,
      borderColor: t.border,
    },
    buttonText: { color: t.accent, fontSize: 14, fontWeight: '700' },
    pressed: { opacity: 0.7 },
  });
