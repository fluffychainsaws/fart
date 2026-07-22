import AsyncStorage from '@react-native-async-storage/async-storage';

import { pushDelete, pushScript, syncScripts } from './sync';
import type { FartScript } from './types';

const KEY = 'fart.scripts.v1';

export async function listScripts(): Promise<FartScript[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const scripts: FartScript[] = JSON.parse(raw);
    return scripts.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function getScript(id: string): Promise<FartScript | null> {
  const scripts = await listScripts();
  return scripts.find((s) => s.id === id) ?? null;
}

export async function saveScript(script: FartScript): Promise<void> {
  const stamped: FartScript = { ...script, updatedAt: Date.now() };
  const scripts = await listScripts();
  const next = [stamped, ...scripts.filter((s) => s.id !== script.id)];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  pushScript(stamped).catch(() => {}); // account mirror; failure never blocks the save
}

export async function deleteScript(id: string): Promise<void> {
  const scripts = await listScripts();
  await AsyncStorage.setItem(KEY, JSON.stringify(scripts.filter((s) => s.id !== id)));
  pushDelete(id).catch(() => {});
}

// Full two-way merge with the account. Call from screens on focus; returns
// the fresh list either way so callers can just setState with it.
export async function refreshScripts(): Promise<FartScript[]> {
  const local = await listScripts();
  try {
    const { merged, changed } = await syncScripts(local);
    if (changed) {
      await AsyncStorage.setItem(KEY, JSON.stringify(merged));
      return merged.sort((a, b) => b.createdAt - a.createdAt);
    }
  } catch {
    // offline or signed out — local list is the truth
  }
  return local;
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Library housekeeping. Free accounts keep a rolling window — scripts older than
// FREE_SCRIPT_TTL_DAYS are auto-removed so the free library stays fresh each
// month (upgrade to keep a lasting library). Paid accounts keep up to
// PAID_LIBRARY_CAP scripts, oldest rolling off. Deletions go through
// deleteScript so they mirror to the account (tombstoned) too. Returns the
// remaining list, newest first.
export const FREE_SCRIPT_TTL_DAYS = 30;
export const PAID_LIBRARY_CAP = 20;

export async function maintainLibrary(opts: {
  ttlDays?: number;
  maxCount?: number;
}): Promise<FartScript[]> {
  let scripts = await listScripts();

  if (opts.ttlDays != null) {
    const cutoff = Date.now() - opts.ttlDays * 24 * 60 * 60 * 1000;
    const expired = scripts.filter((s) => s.createdAt < cutoff);
    for (const s of expired) await deleteScript(s.id);
    scripts = scripts.filter((s) => s.createdAt >= cutoff);
  }

  if (opts.maxCount != null && scripts.length > opts.maxCount) {
    const sorted = [...scripts].sort((a, b) => b.createdAt - a.createdAt);
    for (const s of sorted.slice(opts.maxCount)) await deleteScript(s.id);
    scripts = sorted.slice(0, opts.maxCount);
  }

  return scripts.sort((a, b) => b.createdAt - a.createdAt);
}
