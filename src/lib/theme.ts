import { useColorScheme } from 'react-native';

export const light = {
  bg: '#FDF8F1',
  card: '#FFFFFF',
  ink: '#2B2B33',
  inkSoft: '#6E6E7A',
  accent: '#0FA47A',
  accentSoft: '#E2F5EE',
  // The classic yellow highlighter actors use to mark their lines on paper sides.
  highlight: '#FFE9A3',
  highlightBorder: '#F0CE5A',
  danger: '#D96C5F',
  border: '#EDE5D8',
} as const;

export const dark = {
  bg: '#16151A',
  card: '#211F27',
  ink: '#EDEAF2',
  inkSoft: '#9C98A8',
  accent: '#2EC59A',
  accentSoft: '#14352C',
  // Same highlighter idea, dimmed so it reads as marked-up paper at night.
  highlight: '#4A3F14',
  highlightBorder: '#7A6820',
  danger: '#E58B7F',
  border: '#332F3C',
} as const;

export type Theme = { [K in keyof typeof light]: string };

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
