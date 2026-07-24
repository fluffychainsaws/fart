import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/lib/AppText';
import { signupBonusFor, signupPromoOpen } from '@/lib/promo';
import { getTier, TIER_ORDER, type Tier } from '@/lib/subscription';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';

const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;

// The differentiators a blocked user is missing, kept short so the sheet fits
// a phone without feeling like a spec sheet.
function benefits(id: Tier): string[] {
  const t = getTier(id);
  const lines: string[] = [
    t.auditionsPerMonth === Infinity ? 'Unlimited auditions' : `${t.auditionsPerMonth} auditions/month`,
    `Up to ${t.pagesPerScript} pages per script`,
    t.voiceLabel,
  ];
  if (t.directorNotesPerAudition === Infinity) lines.push('Unlimited director notes');
  else if (t.directorNotesPerAudition > 0)
    lines.push(`${t.directorNotesPerAudition} director notes/audition`);
  if (t.voiceCommands) lines.push('Hands-free voice commands');
  return lines;
}

// Upsell sheet shown the moment a user runs out of auditions. Only offers tiers
// ABOVE their current one (a maxed FART user sees FART Pro + SHART STAR, a free
// user sees all three), so it never pitches the plan they already have.
export function UpgradeModal({
  visible,
  currentTier,
  hasCredits,
  onUpgrade,
  onClose,
}: {
  visible: boolean;
  currentTier: Tier;
  hasCredits: boolean;
  onUpgrade: (tier: Tier) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const upgrades = TIER_ORDER.filter(
    (id) => TIER_ORDER.indexOf(id) > TIER_ORDER.indexOf(currentTier),
  );
  const promoOpen = signupPromoOpen();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner press swallows taps so tapping the sheet doesn't dismiss it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.grabber} />
            <Text style={styles.title}>🎬 You're out of auditions this month</Text>
            <Text style={styles.subtitle}>Upgrade to keep rehearsing — cancel anytime.</Text>

            {promoOpen && (
              <View style={styles.promoBanner}>
                <Text style={styles.promoText}>
                  🎁 Launch bonus — join now and get free premium credits on your first plan.
                </Text>
              </View>
            )}

            {upgrades.map((id) => {
              const tier = getTier(id);
              const featured = id === 'shartstar';
              const bonus = promoOpen ? signupBonusFor(id) : 0;
              return (
                <Pressable
                  key={id}
                  style={({ pressed }) => [
                    styles.card,
                    featured && styles.cardFeatured,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => onUpgrade(id)}>
                  {featured && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>BEST VALUE</Text>
                    </View>
                  )}
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName}>{tier.name}</Text>
                    <Text style={styles.cardPrice}>{tier.priceLabel}</Text>
                  </View>
                  {benefits(id).map((b) => (
                    <Text key={b} style={styles.cardBenefit}>
                      ✓ {b}
                    </Text>
                  ))}
                  {bonus > 0 && (
                    <Text style={styles.cardBonus}>
                      🎁 Launch bonus: {plural(bonus, 'free premium credit')}
                    </Text>
                  )}
                  <View style={[styles.cta, featured && styles.ctaFeatured]}>
                    <Text style={[styles.ctaText, featured && styles.ctaTextFeatured]}>
                      Upgrade to {tier.name}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {hasCredits && (
              <Text style={styles.creditHint}>
                ✨ Have an Audition Credit? Close this and toggle it above to unlock just this
                script.
              </Text>
            )}

            <Pressable hitSlop={8} onPress={onClose} style={styles.later}>
              <Text style={styles.laterText}>Maybe later</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '92%',
    },
    content: {
      padding: 20,
      paddingBottom: 28,
      maxWidth: 560,
      width: '100%',
      alignSelf: 'center',
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.border,
      marginBottom: 14,
    },
    title: { fontSize: 20, fontWeight: '800', color: t.ink, textAlign: 'center' },
    subtitle: {
      fontSize: 14,
      color: t.inkSoft,
      textAlign: 'center',
      marginTop: 6,
      marginBottom: 18,
    },
    card: {
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      padding: 16,
      marginBottom: 12,
      ...shadow,
    },
    cardFeatured: { borderColor: t.accent, borderWidth: 2 },
    badge: {
      position: 'absolute',
      top: -9,
      right: 16,
      backgroundColor: t.accent,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 8,
    },
    cardName: { fontSize: 17, fontWeight: '800', color: t.ink },
    cardPrice: { fontSize: 16, fontWeight: '700', color: t.accent },
    cardBenefit: { fontSize: 13, color: t.inkSoft, lineHeight: 21 },
    cardBonus: { fontSize: 13, color: t.accent, fontWeight: '800', marginTop: 6, lineHeight: 19 },
    promoBanner: {
      backgroundColor: t.accentSoft,
      borderWidth: 1,
      borderColor: t.accent,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 14,
    },
    promoText: { fontSize: 13, color: t.accent, fontWeight: '700', textAlign: 'center', lineHeight: 18 },
    cta: {
      marginTop: 12,
      backgroundColor: t.accentSoft,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
    },
    ctaFeatured: { backgroundColor: t.accent },
    ctaText: { fontSize: 14, fontWeight: '700', color: t.accent },
    ctaTextFeatured: { color: '#fff' },
    creditHint: {
      fontSize: 12,
      color: t.inkSoft,
      textAlign: 'center',
      marginTop: 2,
      marginBottom: 2,
      lineHeight: 18,
    },
    later: { alignItems: 'center', paddingVertical: 14, marginTop: 2 },
    laterText: { fontSize: 15, fontWeight: '600', color: t.inkSoft },
    pressed: { opacity: 0.85 },
  });
