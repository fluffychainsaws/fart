import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/lib/AppText';
import {
  type ColorMode,
  getColorMode,
  getPaletteId,
  PALETTES,
  setColorMode,
  setPalette,
  useCardShadow,
  useTheme,
  type Theme,
} from '@/lib/theme';

const MODES: { id: ColorMode; label: string }[] = [
  { id: 'system', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const activeMode = getColorMode();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Color mode</Text>
      <View style={styles.modeRow}>
        {MODES.map((m) => {
          const active = m.id === activeMode;
          return (
            <Pressable
              key={m.id}
              style={({ pressed }) => [
                styles.modeButton,
                active && styles.modeButtonActive,
                pressed && styles.pressed,
              ]}
              onPress={() => setColorMode(m.id)}>
              <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Appearance</Text>
      <View style={styles.paletteCard}>
        <View style={styles.paletteGrid}>
          {PALETTES.map((p) => {
            const selected = p.id === getPaletteId();
            return (
              <Pressable
                key={p.id}
                style={styles.paletteItem}
                onPress={() => setPalette(p.id)}
                accessibilityLabel={`${p.name} color theme`}>
                <View style={[styles.swatchRing, selected && { borderColor: p.light.accent }]}>
                  <View style={[styles.swatch, { backgroundColor: p.light.accent }]} />
                </View>
                <Text style={[styles.swatchName, selected && styles.swatchNameActive]}>{p.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 48, maxWidth: 700, width: '100%', alignSelf: 'center' },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: t.inkSoft,
      marginTop: 8,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    modeRow: {
      flexDirection: 'row',
      backgroundColor: t.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      padding: 4,
      ...shadow,
    },
    modeButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    modeButtonActive: { backgroundColor: t.accentSoft },
    modeButtonText: { fontSize: 14, fontWeight: '700', color: t.inkSoft },
    modeButtonTextActive: { color: t.accent },
    paletteCard: {
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      ...shadow,
    },
    paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    paletteItem: { width: '16%', minWidth: 52, alignItems: 'center', marginVertical: 8 },
    swatchRing: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 3,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatch: { width: 28, height: 28, borderRadius: 14 },
    swatchName: { fontSize: 10, color: t.inkSoft, marginTop: 4, textAlign: 'center' },
    swatchNameActive: { color: t.ink, fontWeight: '700' },
    pressed: { opacity: 0.7 },
  });
