import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/lib/AppText';
import { useSession } from '@/lib/auth';
import { billingConfigured, openCheckout } from '@/lib/billing';
import { getTier, TIER_ORDER, type Tier } from '@/lib/subscription';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';
import { getUsageStatus, setCurrentTier, type UsageStatus } from '@/lib/usage';

export default function AccountScreen() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const [status, setStatus] = useState<UsageStatus | null>(null);
  const session = useSession();

  const refresh = useCallback(() => {
    getUsageStatus().then(setStatus);
  }, []);

  useFocusEffect(refresh);

  const switchTier = async (tier: Tier) => {
    // Dev-only: stands in for a real purchase until RevenueCat is wired up.
    await setCurrentTier(tier);
    refresh();
  };

  const confirmSwitch = (tier: Tier) => {
    // Signed in: the server owns the tier, so switching means real checkout.
    if (session) {
      if (tier === 'free' || !openCheckout(tier, session.user.id, session.user.email)) {
        const msg =
          tier === 'free'
            ? 'To downgrade, cancel your subscription from the receipt email — your plan drops to Free automatically.'
            : 'Checkout for this plan isn’t open yet — hang tight!';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Plans', msg);
      }
      return;
    }
    const name = getTier(tier).name;
    if (Platform.OS === 'web') {
      if (window.confirm(`Switch to ${name}? (dev-only — no real payment yet)`)) switchTier(tier);
      return;
    }
    Alert.alert(name, `Switch to ${name}? This is a dev-only stand-in — no real payment yet.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Switch', onPress: () => switchTier(tier) },
    ]);
  };

  if (!status) return <View style={styles.screen} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.usageCard}>
        <View style={styles.usageHeader}>
          <Text style={styles.usageTier}>{getTier(status.tier).name}</Text>
          {status.tier !== 'free' && (
            <Pressable hitSlop={8} onPress={() => confirmSwitch('free')}>
              <Text style={styles.cancelLink}>Cancel plan</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.usageCount}>
          {status.unlimited
            ? `${status.auditionsUsed} auditions this month · Unlimited`
            : `${status.auditionsUsed} / ${status.auditionsPerMonth} auditions used this month`}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${
                  status.unlimited || status.auditionsPerMonth === 0
                    ? 100
                    : Math.min(100, (status.auditionsUsed / status.auditionsPerMonth) * 100)
                }%`,
              },
            ]}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Plans</Text>
      {TIER_ORDER.map((id) => {
        const tier = getTier(id);
        const active = tier.id === status.tier;
        return (
          <View key={id} style={[styles.planCard, active && styles.planCardActive]}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{tier.name}</Text>
              <Text style={styles.planPrice}>{tier.priceLabel}</Text>
            </View>
            <Text style={styles.planTagline}>{tier.tagline}</Text>
            <View style={styles.planFeatures}>
              <Text style={styles.planFeature}>🎬 {tier.auditionsPerMonth} auditions/month</Text>
              <Text style={styles.planFeature}>
                🔊{' '}
                {tier.aiVoiceCount === 0
                  ? 'Basic device voice'
                  : `${tier.aiVoiceCount}${tier.id === 'shartstar' ? '+' : ''} AI voices`}
              </Text>
              <Text style={styles.planFeature}>
                📝{' '}
                {tier.directorNotesPerAudition === 0
                  ? 'No director notes'
                  : tier.directorNotesPerAudition === Infinity
                    ? 'Unlimited director notes'
                    : `${tier.directorNotesPerAudition} director notes/audition`}
              </Text>
              {tier.voiceCommands && <Text style={styles.planFeature}>🎙 Hands-free voice commands</Text>}
            </View>
            <Pressable
              disabled={active}
              style={({ pressed }) => [
                styles.planButton,
                active && styles.planButtonActive,
                pressed && !active && styles.pressed,
              ]}
              onPress={() => confirmSwitch(id)}>
              <Text style={[styles.planButtonText, active && styles.planButtonTextActive]}>
                {active ? 'Current plan' : `Switch to ${tier.name}`}
              </Text>
            </Pressable>
          </View>
        );
      })}
      <Text style={styles.devNote}>
        {session
          ? billingConfigured()
            ? 'Payments are handled securely by Stripe. Your plan updates within a minute of checkout.'
            : 'Your plan is tied to your account. Paid checkout opens soon.'
          : 'Signed out: plan switching is a local stand-in. Sign in to keep a real plan.'}
      </Text>
    </ScrollView>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 48, maxWidth: 700, width: '100%', alignSelf: 'center' },
    usageCard: {
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      padding: 18,
      ...shadow,
    },
    usageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    usageTier: { fontSize: 13, fontWeight: '800', color: t.accent, letterSpacing: 0.5, textTransform: 'uppercase' },
    cancelLink: { fontSize: 12, fontWeight: '700', color: '#d64545' },
    usageCount: { fontSize: 16, fontWeight: '700', color: t.ink, marginTop: 6 },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: t.accentSoft,
      marginTop: 12,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: t.accent, borderRadius: 4 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: t.inkSoft,
      marginTop: 28,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    planCard: {
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      padding: 16,
      marginBottom: 12,
      ...shadow,
    },
    planCardActive: { borderColor: t.accent, borderWidth: 2 },
    planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    planName: { fontSize: 17, fontWeight: '800', color: t.ink },
    planPrice: { fontSize: 15, fontWeight: '700', color: t.accent },
    planTagline: { fontSize: 13, color: t.inkSoft, marginTop: 4 },
    planFeatures: { marginTop: 12, gap: 4 },
    planFeature: { fontSize: 13, color: t.ink },
    planButton: {
      backgroundColor: t.accent,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 14,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.15)',
    },
    planButtonActive: { backgroundColor: t.accentSoft, borderColor: t.border },
    planButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    planButtonTextActive: { color: t.accent },
    devNote: { fontSize: 12, color: t.inkSoft, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
    pressed: { opacity: 0.7 },
  });
