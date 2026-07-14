import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const scripts = await listScripts();
  const next = [script, ...scripts.filter((s) => s.id !== script.id)];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function deleteScript(id: string): Promise<void> {
  const scripts = await listScripts();
  await AsyncStorage.setItem(KEY, JSON.stringify(scripts.filter((s) => s.id !== id)));
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
