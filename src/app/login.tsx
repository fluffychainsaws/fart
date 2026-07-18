import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/lib/AppText';
import { requestPasswordReset, signIn, signUp } from '@/lib/auth';
import { accountsEnabled } from '@/lib/supabase';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';

type Mode = 'signin' | 'signup' | 'reset';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (mode !== 'reset' && password.length < 8) {
      setError('Password needs at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        const err = await signIn(email, password);
        if (err) setError(err);
        else router.back();
      } else if (mode === 'signup') {
        const err = await signUp(email, password);
        if (err) setError(err);
        else setNotice('Almost there — check your inbox and click the confirmation link, then sign in.');
      } else {
        const err = await requestPasswordReset(email);
        if (err) setError(err);
        else setNotice('If that email has an account, a reset link is on its way.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (!accountsEnabled) {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <Text style={styles.title}>Accounts coming soon</Text>
          <Text style={styles.blurb}>
            This build isn&apos;t connected to the accounts server yet. Everything still works —
            your scripts stay saved on this device.
          </Text>
        </View>
      </View>
    );
  }

  const titles: Record<Mode, string> = {
    signin: 'Welcome back',
    signup: 'Create your account',
    reset: 'Reset your password',
  };
  const buttons: Record<Mode, string> = {
    signin: 'Sign in',
    signup: 'Sign up',
    reset: 'Send reset link',
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{titles[mode]}</Text>
      {mode === 'signup' && (
        <Text style={styles.blurb}>
          Your scripts and plan will follow you across devices. We only ever store a scrambled
          (hashed) version of your password — nobody can read it, including us.
        </Text>
      )}

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={t.inkSoft}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        editable={!busy}
      />

      {mode !== 'reset' && (
        <>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={t.inkSoft}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            editable={!busy}
            onSubmitEditing={submit}
          />
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}

      <Pressable
        style={({ pressed }) => [styles.primaryButton, (pressed || busy) && styles.pressed]}
        disabled={busy}
        onPress={submit}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>{buttons[mode]}</Text>
        )}
      </Pressable>

      {mode === 'signin' && (
        <>
          <Pressable onPress={() => { setMode('signup'); setError(null); setNotice(null); }}>
            <Text style={styles.link}>New here? Create an account</Text>
          </Pressable>
          <Pressable onPress={() => { setMode('reset'); setError(null); setNotice(null); }}>
            <Text style={styles.link}>Forgot your password?</Text>
          </Pressable>
        </>
      )}
      {mode !== 'signin' && (
        <Pressable onPress={() => { setMode('signin'); setError(null); setNotice(null); }}>
          <Text style={styles.link}>Back to sign in</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 48, maxWidth: 480, width: '100%', alignSelf: 'center' },
    title: { fontSize: 22, fontWeight: '800', color: t.ink, marginTop: 8 },
    blurb: { fontSize: 14, color: t.inkSoft, marginTop: 8, lineHeight: 20 },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: t.inkSoft,
      marginTop: 18,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    input: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      fontSize: 16,
      color: t.ink,
      ...shadow,
    },
    error: { color: '#c0392b', fontSize: 13, marginTop: 12, fontWeight: '600' },
    notice: { color: t.accent, fontSize: 13, marginTop: 12, fontWeight: '600', lineHeight: 19 },
    primaryButton: {
      backgroundColor: t.accent,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 20,
      ...shadow,
    },
    primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    link: { color: t.accent, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 16 },
    pressed: { opacity: 0.7 },
  });
