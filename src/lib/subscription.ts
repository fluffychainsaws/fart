import { OPENAI_VOICES } from './cloudVoice';

// Tier definitions for FART's subscription model. This is the single source
// of truth for pricing and limits — RevenueCat (or any other billing
// provider) should map its product IDs onto these Tier values rather than
// duplicating the numbers elsewhere.
// 'daypass' isn't a subscribable plan (it's excluded from TIER_ORDER) — it's a
// pseudo-tier used to describe the feature set a spent Audition Credit grants
// a single script, regardless of the account's actual subscription tier.
export type Tier = 'free' | 'fart' | 'fartpro' | 'shartstar' | 'daypass';

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
    directorNotesPerAudition: 5,
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
    directorNotesPerAudition: 20,
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
    directorNotesPerAudition: Infinity,
    voiceCommands: true,
    inputAbility: true,
  },
  daypass: {
    id: 'daypass',
    name: 'Audition Credit',
    priceLabel: '$2.99',
    tagline: 'One script, full SHART STAR treatment.',
    auditionsPerMonth: Infinity, // scoped to its own script, not a monthly quota
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
