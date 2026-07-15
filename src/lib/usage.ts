import AsyncStorage from '@react-native-async-storage/async-storage';

import { getTier, TIERS, type Tier } from './subscription';
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

export async function getCurrentTier(): Promise<Tier> {
  const stored = await AsyncStorage.getItem(TIER_KEY);
  if (stored && stored in TIERS) return stored as Tier;
  return 'free';
}

// Dev-only stand-in for a real purchase flow. Once RevenueCat is wired up,
// this should only be called from its purchase-success / restore callbacks.
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
}

export async function getUsageStatus(): Promise<UsageStatus> {
  const [tier, usage] = await Promise.all([getCurrentTier(), readUsage()]);
  const limit = getTier(tier).auditionsPerMonth;
  return {
    tier,
    auditionsUsed: usage.auditionsUsed,
    auditionsPerMonth: limit,
    auditionsRemaining: Math.max(0, limit - usage.auditionsUsed),
  };
}

export async function canRecordAudition(): Promise<boolean> {
  const status = await getUsageStatus();
  return status.auditionsRemaining > 0;
}

// Call once a take actually finishes saving to the camera roll — retries
// during countdown or a cancelled take don't consume the quota.
export async function recordAuditionCompleted(): Promise<void> {
  const usage = await readUsage();
  const next: UsageRecord = { month: currentMonthKey(), auditionsUsed: usage.auditionsUsed + 1 };
  await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(next));
}

export function directorNoteCount(script: FartScript): number {
  return script.elements.filter((el) => el.type === 'line' && el.delivery?.note).length;
}

export async function canAddDirectorNote(script: FartScript): Promise<boolean> {
  const tier = await getCurrentTier();
  const limit = getTier(tier).directorNotesPerAudition;
  return directorNoteCount(script) < limit;
}
