import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import type { FartScript } from './types';

// Account sync for scripts. Local-first: the app always reads and writes
// AsyncStorage, and this module mirrors changes to the `scripts` table when
// someone is signed in. Merging is last-write-wins per script, using the
// updatedAt stamp (createdAt for scripts saved before stamps existed).
//
// Deletions use a small local tombstone list so a full sync doesn't
// resurrect a script whose remote delete hasn't landed yet. A script deleted
// on device A disappears from device B on B's next full sync because A also
// deletes the remote row.

const TOMBSTONE_KEY = 'fart.deletedScripts.v1';

const stamp = (s: FartScript) => s.updatedAt ?? s.createdAt;

async function readTombstones(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(TOMBSTONE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function writeTombstones(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(TOMBSTONE_KEY, JSON.stringify(ids.slice(-200)));
}

async function userId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// Mirror one script to the account. Fire-and-forget from saveScript — sync
// failures never block the local save.
export async function pushScript(script: FartScript): Promise<void> {
  const uid = await userId();
  if (!uid || !supabase) return;
  await supabase
    .from('scripts')
    .upsert({ user_id: uid, id: script.id, data: script, updated_at: stamp(script) });
}

export async function pushDelete(id: string): Promise<void> {
  const tombstones = await readTombstones();
  if (!tombstones.includes(id)) await writeTombstones([...tombstones, id]);
  const uid = await userId();
  if (!uid || !supabase) return;
  const { error } = await supabase.from('scripts').delete().eq('user_id', uid).eq('id', id);
  if (!error) await writeTombstones((await readTombstones()).filter((t) => t !== id));
}

export interface SyncResult {
  merged: FartScript[];
  changed: boolean;
}

// Two-way merge between the given local scripts and the account. Returns the
// merged list; the caller persists it locally. No-op (changed: false) when
// signed out or unreachable.
export async function syncScripts(local: FartScript[]): Promise<SyncResult> {
  const uid = await userId();
  if (!uid || !supabase) return { merged: local, changed: false };

  const { data: rows, error } = await supabase
    .from('scripts')
    .select('id, data, updated_at')
    .eq('user_id', uid);
  if (error || !rows) return { merged: local, changed: false };

  const tombstones = await readTombstones();
  // Retry remote deletes that failed while offline.
  for (const dead of tombstones) {
    if (rows.some((r) => r.id === dead)) await pushDelete(dead);
  }

  const localById = new Map(local.map((s) => [s.id, s]));
  const merged: FartScript[] = [...local];
  const toPush: FartScript[] = [];
  let changed = false;

  for (const row of rows) {
    if (tombstones.includes(row.id)) continue;
    const remote = row.data as FartScript;
    const mine = localById.get(row.id);
    if (!mine) {
      merged.push(remote);
      changed = true;
    } else if (Number(row.updated_at) > stamp(mine)) {
      merged[merged.indexOf(mine)] = remote;
      changed = true;
    } else if (stamp(mine) > Number(row.updated_at)) {
      toPush.push(mine);
    }
  }
  for (const s of local) {
    if (!rows.some((r) => r.id === s.id)) toPush.push(s);
  }

  if (toPush.length && supabase) {
    await supabase
      .from('scripts')
      .upsert(toPush.map((s) => ({ user_id: uid, id: s.id, data: s, updated_at: stamp(s) })));
  }

  return { merged, changed };
}
