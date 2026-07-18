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
  {
    id: 'mutedPink',
    name: 'Muted Pink',
    light: { bg: '#FBF3F5', accent: '#C97B94', accentSoft: '#F5E2E8', border: '#F0DEE3' },
    dark: { accent: '#E29FB3', accentSoft: '#3A2129' },
  },
  {
    id: 'hotPink',
    name: 'Hot Pink',
    light: { bg: '#FFF0F6', accent: '#E5399C', accentSoft: '#FCE1EF', border: '#F7D3E6' },
    dark: { accent: '#FF7AC6', accentSoft: '#401B33' },
  },
  {
    id: 'mutedYellow',
    name: 'Muted Yellow',
    light: { bg: '#FCF8EC', accent: '#C9A227', accentSoft: '#F5EACB', border: '#EFE2BE' },
    dark: { accent: '#E0C158', accentSoft: '#3A3018' },
  },
  {
    id: 'mutedOrange',
    name: 'Muted Orange',
    light: { bg: '#FCF3EC', accent: '#D97D45', accentSoft: '#F5E1D2', border: '#EFDBC8' },
    dark: { accent: '#E8A06F', accentSoft: '#3A2618' },
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    light: { bg: '#FBF2FA', accent: '#C46FC2', accentSoft: '#F3E3F2', border: '#EDD9EC' },
    dark: { accent: '#D89AD6', accentSoft: '#362138' },
  },
  {
    id: 'coral',
    name: 'Coral',
    light: { bg: '#FDF2EF', accent: '#E06B5C', accentSoft: '#FBE2DD', border: '#F5D7D0' },
    dark: { accent: '#EF9184', accentSoft: '#3C201C' },
  },
];

// Tiny external store so every screen re-renders when the palette or color
// mode changes, without threading a context through the whole app.
const PALETTE_KEY = 'fart.palette.v1';
const COLOR_MODE_KEY = 'fart.colorMode.v1';
let currentPaletteId = 'meadow';
export type ColorMode = 'system' | 'light' | 'dark';
let currentColorMode: ColorMode = 'system';
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

export function getColorMode(): ColorMode {
  return currentColorMode;
}

export function setColorMode(mode: ColorMode): void {
  currentColorMode = mode;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(COLOR_MODE_KEY, mode).catch(() => {});
}

// Call once at startup (root layout) to restore the saved choices.
export async function loadSavedPalette(): Promise<void> {
  try {
    const [savedPalette, savedMode] = await Promise.all([
      AsyncStorage.getItem(PALETTE_KEY),
      AsyncStorage.getItem(COLOR_MODE_KEY),
    ]);
    let changed = false;
    if (savedPalette && PALETTES.some((p) => p.id === savedPalette) && savedPalette !== currentPaletteId) {
      currentPaletteId = savedPalette;
      changed = true;
    }
    if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
      if (savedMode !== currentColorMode) {
        currentColorMode = savedMode;
        changed = true;
      }
    }
    if (changed) listeners.forEach((l) => l());
  } catch {
    // defaults are fine
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Resolves the color mode override against the OS preference.
export function useEffectiveScheme(): 'light' | 'dark' {
  const systemScheme = useColorScheme();
  const mode = useSyncExternalStore(subscribe, getColorMode, getColorMode);
  if (mode === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
  return mode;
}

export function useTheme(): Theme {
  const scheme = useEffectiveScheme();
  const paletteId = useSyncExternalStore(subscribe, getPaletteId, getPaletteId);
  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];
  const merged = scheme === 'dark' ? { ...dark, ...palette.dark } : { ...light, ...palette.light };
  // Borders track whichever accent is currently selected — a translucent
  // wash of the accent itself, rather than a fixed per-palette hex, so
  // every bordered surface visibly follows a palette switch.
  return { ...merged, border: merged.accent + (scheme === 'dark' ? '55' : '40') };
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
  return useEffectiveScheme() === 'dark' ? cardShadowDark : cardShadow;
}
