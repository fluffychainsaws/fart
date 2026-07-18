import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Accounts backend. Until the env vars are set (see supabase/README.md for
// the one-time project setup) the client is null and the app behaves exactly
// as before: everything local, no login surface.
//
// The anon key is safe to ship in the bundle — it only grants what Row Level
// Security policies allow, and every table in supabase/schema.sql is locked
// to `auth.uid() = user_id`. Real secrets (service role key) never go in the
// client.

// The live project. Baked in as defaults (env vars still override) because
// this pair is public by design — it ships in the bundle either way, and Row
// Level Security is what actually guards the data. Same model as Firebase
// client config.
const LIVE_URL = 'https://bojaiebacqsqewmxwuih.supabase.co';
const LIVE_ANON_KEY = 'sb_publishable_wQXxgoZaTUOAW1KjJCq-YA_UoY98hLi';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || LIVE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || LIVE_ANON_KEY;

// The web build is statically pre-rendered in Node, where localStorage (which
// AsyncStorage wraps on web) doesn't exist — and the client eagerly restores
// its session from storage on creation. No-op until a real window shows up.
const inSSR = Platform.OS === 'web' && typeof window === 'undefined';
const storage = {
  getItem: (key: string) => (inSSR ? Promise.resolve(null) : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) =>
    inSSR ? Promise.resolve() : AsyncStorage.setItem(key, value),
  removeItem: (key: string) => (inSSR ? Promise.resolve() : AsyncStorage.removeItem(key)),
};

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          // AsyncStorage maps to localStorage on web, so one adapter works
          // everywhere. Sessions are a JWT + refresh token, not the password.
          storage,
          autoRefreshToken: true,
          persistSession: true,
          // Email confirmation + password-reset links land on the web app
          // with tokens in the URL; only the web build should parse them.
          detectSessionInUrl: Platform.OS === 'web' && !inSSR,
        },
      })
    : null;

export const accountsEnabled = supabase !== null;
