import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Local-only for now (device-scoped, like the palette/color-mode choice) —
// stored as a data URI so it needs no server-side storage bucket. Could
// move to Supabase Storage later for cross-device sync, alongside script
// sync, once accounts need it.
const PHOTO_KEY = 'fart.profilePhoto.v1';

let currentPhoto: string | null = null;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function getProfilePhoto(): string | null {
  return currentPhoto;
}

export async function setProfilePhoto(dataUri: string | null): Promise<void> {
  currentPhoto = dataUri;
  listeners.forEach((l) => l());
  if (dataUri) await AsyncStorage.setItem(PHOTO_KEY, dataUri);
  else await AsyncStorage.removeItem(PHOTO_KEY);
}

// Call once at startup (root layout) to restore the saved photo. Safe to
// call more than once — subsequent calls reuse the first in-flight promise.
export function loadSavedProfilePhoto(): Promise<void> {
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(PHOTO_KEY)
      .then((saved) => {
        if (saved !== currentPhoto) {
          currentPhoto = saved;
          listeners.forEach((l) => l());
        }
      })
      .catch(() => {});
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
