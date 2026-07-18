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
