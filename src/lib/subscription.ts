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
  // How many premium (OpenAI) voices this tier unlocks — 0 means device
  // voices only. voiceLabel is the marketing copy for the plan card, since
  // "All device voices + 2 premium AI voices" can't be derived from a count.
  aiVoiceCount: number;
  voiceLabel: string;
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
    auditionsPerMonth: 1,
    aiVoiceCount: 0,
    voiceLabel: 'Basic device voice',
    directorNotesPerAudition: 0,
    voiceCommands: false,
    inputAbility: false,
  },
  fart: {
    id: 'fart',
    name: 'FART',
    priceLabel: '$5/mo',
    tagline: 'For actors just getting started.',
    auditionsPerMonth: 6,
    aiVoiceCount: 0,
    voiceLabel: 'All device voices',
    directorNotesPerAudition: 5,
    voiceCommands: false,
    inputAbility: true,
  },
  fartpro: {
    id: 'fartpro',
    name: 'FART Pro',
    priceLabel: '$10/mo',
    tagline: 'More auditions, more direction.',
    auditionsPerMonth: 14,
    aiVoiceCount: 2,
    voiceLabel: 'All device voices + 2 premium AI voices',
    directorNotesPerAudition: 20,
    voiceCommands: false,
    inputAbility: true,
  },
  shartstar: {
    id: 'shartstar',
    name: 'SHART STAR',
    priceLabel: '$25/mo',
    tagline: 'Less than a dollar a day to have a reader always ready!',
    auditionsPerMonth: Infinity,
    aiVoiceCount: OPENAI_VOICES.length,
    voiceLabel: 'All voices + ALL premium voices',
    directorNotesPerAudition: Infinity,
    voiceCommands: true,
    inputAbility: true,
  },
  daypass: {
    id: 'daypass',
    name: 'Audition Credit',
    priceLabel: '$3.99',
    tagline: 'One script, full SHART STAR treatment.',
    auditionsPerMonth: Infinity, // scoped to its own script, not a monthly quota
    aiVoiceCount: OPENAI_VOICES.length,
    voiceLabel: 'All voices + Premium voices',
    directorNotesPerAudition: 10,
    voiceCommands: true,
    inputAbility: true,
  },
};

export const TIER_ORDER: Tier[] = ['free', 'fart', 'fartpro', 'shartstar'];

export function getTier(id: Tier): TierConfig {
  return TIERS[id];
}
