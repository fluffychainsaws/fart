import { OPENAI_VOICES } from './cloudVoice';

// Tier definitions for FART's subscription model. This is the single source
// of truth for pricing and limits — RevenueCat (or any other billing
// provider) should map its product IDs onto these Tier values rather than
// duplicating the numbers elsewhere.
export type Tier = 'free' | 'fart' | 'fartpro' | 'shartstar';

export interface TierConfig {
  id: Tier;
  name: string;
  priceLabel: string;
  tagline: string;
  auditionsPerMonth: number;
  aiVoiceCount: number;
  directorNotesPerAudition: number;
  voiceCommands: boolean;
  inputAbility: boolean;
}

export const TIERS: Record<Tier, TierConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    priceLabel: 'Free',
    tagline: 'Script upload and the essentials.',
    auditionsPerMonth: 2,
    aiVoiceCount: 0,
    directorNotesPerAudition: 0,
    voiceCommands: false,
    inputAbility: false,
  },
  fart: {
    id: 'fart',
    name: 'FART',
    priceLabel: '$5/mo',
    tagline: 'For actors just getting started.',
    auditionsPerMonth: 10,
    aiVoiceCount: 2,
    directorNotesPerAudition: 1,
    voiceCommands: false,
    inputAbility: true,
  },
  fartpro: {
    id: 'fartpro',
    name: 'FART Pro',
    priceLabel: '$10/mo',
    tagline: 'More auditions, more direction.',
    auditionsPerMonth: 25,
    aiVoiceCount: 4,
    directorNotesPerAudition: 3,
    voiceCommands: false,
    inputAbility: true,
  },
  shartstar: {
    id: 'shartstar',
    name: 'SHART STAR',
    priceLabel: '$25/mo',
    tagline: 'Less than a dollar a day to have a reader always ready!',
    auditionsPerMonth: 75,
    aiVoiceCount: OPENAI_VOICES.length,
    directorNotesPerAudition: 10,
    voiceCommands: true,
    inputAbility: true,
  },
};

export const TIER_ORDER: Tier[] = ['free', 'fart', 'fartpro', 'shartstar'];

export function getTier(id: Tier): TierConfig {
  return TIERS[id];
}
