import AsyncStorage from '@react-native-async-storage/async-storage';

import { logUsage } from './metrics';
import { getTier, TIERS, type Tier } from './subscription';
import { supabase } from './supabase';
import type { FartScript } from './types';

// Local-only subscription + usage tracking. There is no server yet, so this
// is honest about its limits: the "device id" is a UUID persisted in
// AsyncStorage, which survives app restarts but NOT an app reinstall or a
// second device — real device-level enforcement (to stop free-tier farming)
// needs a backend plus something like phone-number verification. When
// RevenueCat is wired in, `getTier`/`setTier` below are the two functions to
// replace with real entitlement checks; everything else (the monthly
// counter, the gating helpers) stays the same.

const DEVICE_ID_KEY = 'fart.deviceId.v1';
const TIER_KEY = 'fart.tier.v1';
const USAGE_KEY = 'fart.usage.v1';

// Temporary overrides, per explicit request: unlimited auditions and director
// notes for everyone regardless of tier, until told otherwise. Flip back to
// false (or delete) to restore the normal per-tier limits.
const UNLIMITED_AUDITIONS = true;
const UNLIMITED_DIRECTOR_NOTES = true;

export const directorNotesUnlimited = () => UNLIMITED_DIRECTOR_NOTES;

interface UsageRecord {
  month: string; // "YYYY-MM"
  auditionsUsed: number;
}

function newDeviceId(): string {
  return `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

let deviceIdCache: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (deviceIdCache) return deviceIdCache;
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    deviceIdCache = existing;
    return existing;
  }
  const id = newDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  deviceIdCache = id;
  return id;
}

// Signed in: the server's profiles.tier is the truth (RLS stops users from
// editing it — only the billing webhook or the dashboard can). Cached for a
// minute so every screen focus doesn't hit the network. The last confirmed
// server answer is also stored locally with its timestamp: that's the
// offline fallback, and it EXPIRES after a grace window so a cancelled
// subscriber can't keep a paid tier forever by blocking the connection —
// same model as Netflix/Spotify offline entitlements.
const SERVER_TIER_KEY = 'fart.serverTier.v1';
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days unreachable → free

let serverTierCache: { tier: Tier; at: number } | null = null;

async function fetchServerTier(): Promise<Tier | null> {
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) return null;
  if (serverTierCache && Date.now() - serverTierCache.at < 60_000) return serverTierCache.tier;
  const { data, error } = await supabase.from('profiles').select('tier').eq('id', uid).single();
  if (error || !data || !(data.tier in TIERS)) return null;
  const tier = data.tier as Tier;
  serverTierCache = { tier, at: Date.now() };
  await AsyncStorage.setItem(SERVER_TIER_KEY, JSON.stringify(serverTierCache));
  return tier;
}

async function signedIn(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession(); // local read, works offline
  return !!data.session;
}

export async function getCurrentTier(): Promise<Tier> {
  try {
    const server = await fetchServerTier();
    if (server) return server;
  } catch {
    // offline — fall through to the graced local mirror
  }
  if (await signedIn()) {
    try {
      const raw = await AsyncStorage.getItem(SERVER_TIER_KEY);
      if (raw) {
        const { tier, at } = JSON.parse(raw) as { tier: Tier; at: number };
        if (tier in TIERS && Date.now() - at < OFFLINE_GRACE_MS) return tier;
      }
    } catch {
      // corrupt mirror — treat as absent
    }
    return 'free';
  }
  const stored = await AsyncStorage.getItem(TIER_KEY);
  if (stored && stored in TIERS) return stored as Tier;
  return 'free';
}

// Dev-only stand-in for a real purchase flow, used while signed OUT. For
// signed-in users the server tier wins on the next fetch regardless of what
// this writes.
export async function setCurrentTier(tier: Tier): Promise<void> {
  await AsyncStorage.setItem(TIER_KEY, tier);
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function readUsage(): Promise<UsageRecord> {
  const raw = await AsyncStorage.getItem(USAGE_KEY);
  const month = currentMonthKey();
  if (!raw) return { month, auditionsUsed: 0 };
  try {
    const parsed: UsageRecord = JSON.parse(raw);
    if (parsed.month !== month) return { month, auditionsUsed: 0 };
    return parsed;
  } catch {
    return { month, auditionsUsed: 0 };
  }
}

export interface UsageStatus {
  tier: Tier;
  auditionsUsed: number;
  auditionsPerMonth: number;
  auditionsRemaining: number;
  unlimited: boolean;
}

export async function getUsageStatus(): Promise<UsageStatus> {
  const [tier, usage] = await Promise.all([getCurrentTier(), readUsage()]);
  const limit = getTier(tier).auditionsPerMonth;
  return {
    tier,
    auditionsUsed: usage.auditionsUsed,
    auditionsPerMonth: limit,
    auditionsRemaining: UNLIMITED_AUDITIONS ? Infinity : Math.max(0, limit - usage.auditionsUsed),
    unlimited: UNLIMITED_AUDITIONS,
  };
}

export async function canRecordAudition(): Promise<boolean> {
  if (UNLIMITED_AUDITIONS) return true;
  const status = await getUsageStatus();
  return status.auditionsRemaining > 0;
}

// Call once a take actually finishes saving to the camera roll — retries
// during countdown or a cancelled take don't consume the quota.
export async function recordAuditionCompleted(): Promise<void> {
  const usage = await readUsage();
  const next: UsageRecord = { month: currentMonthKey(), auditionsUsed: usage.auditionsUsed + 1 };
  await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(next));
  logUsage('audition');
}

export function directorNoteCount(script: FartScript): number {
  return script.elements.filter((el) => el.type === 'line' && el.delivery?.note).length;
}

export async function canAddDirectorNote(script: FartScript): Promise<boolean> {
  if (UNLIMITED_DIRECTOR_NOTES) return true;
  const tier = await getCurrentTier();
  const limit = getTier(tier).directorNotesPerAudition;
  return directorNoteCount(script) < limit;
}
