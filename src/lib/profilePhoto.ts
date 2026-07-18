import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

// Synced across devices when signed in (mirrors storage.ts/sync.ts's
// approach for scripts): last-write-wins via an updatedAt stamp, stored as a
// data URI directly on profiles.photo_url rather than a Storage bucket —
// photos here are small (quality 0.5, cropped square), so a plain column is
// simplest. Signed out, it's still local-only (nowhere to sync to).
const PHOTO_KEY = 'fart.profilePhoto.v2';
const LEGACY_KEY = 'fart.profilePhoto.v1'; // pre-sync format: a bare data URI

interface StoredPhoto {
  uri: string | null;
  updatedAt: number;
}

let currentPhoto: string | null = null;
let currentUpdatedAt = 0;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function getProfilePhoto(): string | null {
  return currentPhoto;
}

async function persist(uri: string | null, updatedAt: number): Promise<void> {
  currentPhoto = uri;
  currentUpdatedAt = updatedAt;
  listeners.forEach((l) => l());
  await AsyncStorage.setItem(PHOTO_KEY, JSON.stringify({ uri, updatedAt } satisfies StoredPhoto));
}

export async function setProfilePhoto(dataUri: string | null): Promise<void> {
  const updatedAt = Date.now();
  await persist(dataUri, updatedAt);
  pushProfilePhoto(dataUri, updatedAt).catch(() => {}); // account mirror; failure never blocks the save
}

// Call once at startup (root layout) to restore the saved photo. Safe to
// call more than once — subsequent calls reuse the first in-flight promise.
export function loadSavedProfilePhoto(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(PHOTO_KEY);
        if (raw) {
          const stored: StoredPhoto = JSON.parse(raw);
          if (stored.uri !== currentPhoto) {
            currentPhoto = stored.uri;
            currentUpdatedAt = stored.updatedAt;
            listeners.forEach((l) => l());
          }
          return;
        }
        const legacy = await AsyncStorage.getItem(LEGACY_KEY);
        if (legacy) {
          await persist(legacy, Date.now());
          await AsyncStorage.removeItem(LEGACY_KEY);
        }
      } catch {
        // corrupt storage — behave as if there's no saved photo
      }
    })();
  }
  return loadPromise;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useProfilePhoto(): string | null {
  loadSavedProfilePhoto();
  return useSyncExternalStore(subscribe, getProfilePhoto, getProfilePhoto);
}

async function userId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function pushProfilePhoto(uri: string | null, updatedAt: number): Promise<void> {
  const uid = await userId();
  if (!uid || !supabase) return;
  await supabase.from('profiles').update({ photo_url: uri, photo_updated_at: updatedAt }).eq('id', uid);
}

// Two-way merge with the account: pulls the newer side down, or pushes a
// local change made while offline/signed-out-on-this-device up. Call on
// sign-in and whenever the profile/drawer is opened, same cadence as the
// tier refresh — no-ops when signed out or unreachable.
export async function refreshProfilePhoto(): Promise<void> {
  const uid = await userId();
  if (!uid || !supabase) return;
  const { data, error } = await supabase
    .from('profiles')
    .select('photo_url, photo_updated_at')
    .eq('id', uid)
    .single();
  if (error || !data) return;
  const remoteUpdatedAt = Number(data.photo_updated_at ?? 0);
  if (remoteUpdatedAt > currentUpdatedAt) {
    await persist((data.photo_url as string | null) ?? null, remoteUpdatedAt);
  } else if (currentUpdatedAt > remoteUpdatedAt) {
    pushProfilePhoto(currentPhoto, currentUpdatedAt).catch(() => {});
  }
}
