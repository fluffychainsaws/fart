import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Whether the side menu is docked open (vs. the slide-out drawer). Module-level
// with a tiny subscribe hook, same pattern as theme — so the layout and the
// settings toggle stay in sync without prop-drilling. Persisted across launches.
//
// Signed-out visitors are always shown the docked menu regardless of this
// preference (see the layout): the point is that first-time visitors can't miss
// it. The preference only takes effect once someone has an account.

const KEY = 'fart.menuDocked.v1';
let docked = true; // default on
const listeners = new Set<() => void>();

export function getMenuDocked(): boolean {
  return docked;
}

export function setMenuDocked(on: boolean): void {
  docked = on;
  AsyncStorage.setItem(KEY, on ? '1' : '0').catch(() => {});
  listeners.forEach((l) => l());
}

export function loadSavedMenuDocked(): void {
  AsyncStorage.getItem(KEY)
    .then((v) => {
      if (v !== null) {
        docked = v === '1';
        listeners.forEach((l) => l());
      }
    })
    .catch(() => {});
}

export function useMenuDocked(): boolean {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return docked;
}
