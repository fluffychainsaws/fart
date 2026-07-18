import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// ---- Color palettes ---------------------------------------------------------
// Twelve muted, natural looks. Each overrides the page tint and accent while
// the ink, highlighter, and danger colors stay shared. Light mode tints the
// whole page; dark mode keeps the shared near-black surfaces and swaps the
// accent so text stays readable at night.

export interface Palette {
  id: string;
  name: string;
  light: Pick<Theme, 'bg' | 'accent' | 'accentSoft' | 'border'>;
  dark: Pick<Theme, 'accent' | 'accentSoft'>;
}

export const PALETTES: Palette[] = [
  {
    id: 'meadow',
    name: 'Meadow',
    light: { bg: '#FDF8F1', accent: '#0FA47A', accentSoft: '#E2F5EE', border: '#EDE5D8' },
    dark: { accent: '#2EC59A', accentSoft: '#14352C' },
  },
  {
    id: 'sage',
    name: 'Sage',
    light: { bg: '#F5F7F1', accent: '#5F7355', accentSoft: '#E6ECE0', border: '#DEE4D6' },
    dark: { accent: '#9AB287', accentSoft: '#252E1F' },
  },
  {
    id: 'clay',
    name: 'Clay',
    light: { bg: '#FAF3EF', accent: '#A85D44', accentSoft: '#F3E2DA', border: '#ECDCD2' },
    dark: { accent: '#D0876C', accentSoft: '#38221A' },
  },
  {
    id: 'sand',
    name: 'Sand',
    light: { bg: '#FAF5EB', accent: '#8A6F3E', accentSoft: '#F0E6D2', border: '#EADFC9' },
    dark: { accent: '#C9A56B', accentSoft: '#332A18' },
  },
  {
    id: 'moss',
    name: 'Moss',
    light: { bg: '#F7F7EE', accent: '#6B7238', accentSoft: '#E9EBD6', border: '#E0E2CC' },
    dark: { accent: '#A3AC63', accentSoft: '#292B18' },
  },
  {
    id: 'slate',
    name: 'Slate',
    light: { bg: '#F2F5F8', accent: '#56708C', accentSoft: '#E0E8F0', border: '#D9E1EA' },
    dark: { accent: '#85A3C4', accentSoft: '#1D2632' },
  },
  {
    id: 'rose',
    name: 'Dusty Rose',
    light: { bg: '#FAF2F3', accent: '#A5606E', accentSoft: '#F2DFE2', border: '#ECD8DB' },
    dark: { accent: '#CF8B9A', accentSoft: '#362126' },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    light: { bg: '#F5F4F9', accent: '#71678F', accentSoft: '#E7E4F0', border: '#DFDCEA' },
    dark: { accent: '#A79BC9', accentSoft: '#272233' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    light: { bg: '#F0F6F5', accent: '#3E7C7B', accentSoft: '#DCEBEA', border: '#D5E4E2' },
    dark: { accent: '#6BB3B1', accentSoft: '#182D2C' },
  },
  {
    id: 'taupe',
    name: 'Taupe',
    light: { bg: '#F7F4F1', accent: '#7D6F63', accentSoft: '#EAE4DE', border: '#E3DCD4' },
    dark: { accent: '#B0A092', accentSoft: '#2B2620' },
  },
  {
    id: 'fog',
    name: 'Fog',
    light: { bg: '#F4F5F6', accent: '#66707A', accentSoft: '#E4E7EA', border: '#DDE0E4' },
    dark: { accent: '#9AA6B2', accentSoft: '#232830' },
  },
  {
    id: 'plum',
    name: 'Plum',
    light: { bg: '#F8F3F6', accent: '#7E5A6E', accentSoft: '#EEDFE8', border: '#E7D7E0' },
    dark: { accent: '#B58AA5', accentSoft: '#2E2028' },
  },
];

// Tiny external store so every screen re-renders when the palette changes,
// without threading a context through the whole app.
const PALETTE_KEY = 'fart.palette.v1';
let currentPaletteId = 'meadow';
const listeners = new Set<() => void>();

export function getPaletteId(): string {
  return currentPaletteId;
}

export function setPalette(id: string): void {
  if (!PALETTES.some((p) => p.id === id)) return;
  currentPaletteId = id;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(PALETTE_KEY, id).catch(() => {});
}

// Call once at startup (root layout) to restore the saved choice.
export async function loadSavedPalette(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(PALETTE_KEY);
    if (saved && PALETTES.some((p) => p.id === saved) && saved !== currentPaletteId) {
      currentPaletteId = saved;
      listeners.forEach((l) => l());
    }
  } catch {
    // default palette is fine
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const paletteId = useSyncExternalStore(subscribe, getPaletteId, getPaletteId);
  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];
  return scheme === 'dark' ? { ...dark, ...palette.dark } : { ...light, ...palette.light };
}

// Soft elevation for cards, buttons, and modals — subtle on the cream light
// background, a touch stronger on dark so surfaces still read as lifted.
export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 3,
} as const;

export const cardShadowDark = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.35,
  shadowRadius: 10,
  elevation: 3,
} as const;

export function useCardShadow() {
  return useColorScheme() === 'dark' ? cardShadowDark : cardShadow;
}
