import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

// Drop-in replacement for RN's <Text> that maps each style's fontWeight to
// the matching Inter weight loaded in _layout.tsx. RN's Text has no
// defaultProps merging in this version, and nearly every Text in the app
// already sets an explicit style, so a global default font never reaches
// them — this reads the flattened style's fontWeight at render time instead,
// which means any existing or future style gets the right Inter file
// without having to hand-annotate fontFamily everywhere.
const WEIGHT_FONT: Record<string, string> = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_800ExtraBold',
};

export function Text({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const weight = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  const fontFamily = WEIGHT_FONT[weight] ?? 'Inter_400Regular';
  return <RNText {...props} style={[{ fontFamily }, style]} />;
}
