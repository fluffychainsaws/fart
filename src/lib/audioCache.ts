import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Persists synthesized cloud-voice audio (OpenAI TTS clips) across app
// restarts, so rehearsing the same script on a different day only ever pays
// for each unique line once. Without this, the cache lived only in memory
// and reset on every reload, silently re-billing every replay with no
// ceiling — this bounds cost to roughly one paid synthesis per line, ever,
// capped at MAX_CACHE_BYTES total with oldest-first eviction.
//
// Native: audio is written to a real file at a deterministic path per key
// (Paths.cache/fart-tts-<hash>.mp3), so a fresh launch just checks whether
// that file still exists rather than needing a separate index.
// Web: there's no filesystem, so the audio Blob itself lives in IndexedDB,
// and a fresh blob: URL is minted from it each session.
//
// Both platforms share a small "last used" map in AsyncStorage purely to
// decide eviction order — it's not load-bearing for correctness, just LRU.

const MAX_CACHE_BYTES = 80 * 1024 * 1024; // many scripts' worth, trivial next to device storage
const LRU_KEY = 'fart.audioCacheLru.v1';

function hashKey(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

type Lru = Record<string, number>; // cache key -> lastUsed ms

async function loadLru(): Promise<Lru> {
  try {
    const raw = await AsyncStorage.getItem(LRU_KEY);
    return raw ? (JSON.parse(raw) as Lru) : {};
  } catch {
    return {};
  }
}

async function touch(key: string): Promise<void> {
  const lru = await loadLru();
  lru[key] = Date.now();
  await AsyncStorage.setItem(LRU_KEY, JSON.stringify(lru)).catch(() => {});
}

// ---- Native (real files under Paths.cache) ---------------------------------

function nativeFilename(key: string): string {
  return `fart-tts-${hashKey(key)}.mp3`;
}

async function getNative(key: string): Promise<string | null> {
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  const file = new File(Paths.cache, nativeFilename(key));
  if (!file.exists) return null;
  await touch(key);
  return file.uri;
}

async function evictNative(): Promise<void> {
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  const entries = Paths.cache
    .list()
    .filter((f): f is InstanceType<typeof File> => f instanceof File && f.name.startsWith('fart-tts-'));
  const total = entries.reduce((sum, f) => sum + f.size, 0);
  if (total <= MAX_CACHE_BYTES) return;
  const lru = await loadLru();
  const byAge = [...entries].sort((a, b) => {
    const aKey = a.name.replace(/^fart-tts-|\.mp3$/g, '');
    const bKey = b.name.replace(/^fart-tts-|\.mp3$/g, '');
    return (lru[aKey] ?? 0) - (lru[bKey] ?? 0);
  });
  let remaining = total;
  for (const f of byAge) {
    if (remaining <= MAX_CACHE_BYTES) break;
    try {
      remaining -= f.size;
      f.delete();
    } catch {
      // already gone
    }
  }
}

async function putNative(key: string, dataUri: string): Promise<string> {
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  const file = new File(Paths.cache, nativeFilename(key));
  file.write(base64ToBytes(dataUri.slice(dataUri.indexOf(',') + 1)));
  await touch(key);
  evictNative().catch(() => {}); // best-effort, never blocks playback
  return file.uri;
}

// ---- Web (IndexedDB) --------------------------------------------------------

const DB_NAME = 'fart-audio-cache';
const STORE = 'clips';
const MAX_WEB_ENTRIES = 400; // IndexedDB has no cheap total-size query; cap by count instead

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<Blob | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbAllKeys(db: IDBDatabase): Promise<IDBValidKey[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function evictWeb(db: IDBDatabase): Promise<void> {
  const keys = await idbAllKeys(db);
  if (keys.length <= MAX_WEB_ENTRIES) return;
  const lru = await loadLru();
  const byAge = [...keys].sort((a, b) => (lru[String(a)] ?? 0) - (lru[String(b)] ?? 0));
  for (const key of byAge.slice(0, keys.length - MAX_WEB_ENTRIES)) {
    await idbDelete(db, String(key)).catch(() => {});
  }
}

async function getWeb(key: string): Promise<string | null> {
  const db = await openDb();
  const blob = await idbGet(db, key);
  if (!blob) return null;
  await touch(key);
  return URL.createObjectURL(blob);
}

async function putWeb(key: string, dataUri: string): Promise<string> {
  const blob = await (await fetch(dataUri)).blob();
  const db = await openDb();
  await idbPut(db, key, blob);
  await touch(key);
  evictWeb(db).catch(() => {});
  return URL.createObjectURL(blob);
}

// ---- Public API -------------------------------------------------------------

export async function getCachedAudio(key: string): Promise<string | null> {
  try {
    return Platform.OS === 'web' ? await getWeb(key) : await getNative(key);
  } catch {
    return null;
  }
}

export async function putCachedAudio(key: string, dataUri: string): Promise<string> {
  try {
    return Platform.OS === 'web' ? await putWeb(key, dataUri) : await putNative(key, dataUri);
  } catch {
    return dataUri; // persistence failed — still play this once from the data URI
  }
}
