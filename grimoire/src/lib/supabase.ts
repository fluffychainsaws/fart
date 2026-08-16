import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The single Supabase client. Nothing outside src/data/ and src/auth/ may
// import this — see scripts/check-isolation.mjs, which fails the build if a
// component reaches for the database directly. Data access goes through the
// repository functions in src/data/, which are the only place that knows how
// campaign scoping is applied.
//
// The anon key is public by design: it grants exactly what Row Level Security
// allows and nothing more. The service role key must never appear in this app.

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key-not-set',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

/** Turns a Supabase/PostgREST error into something worth showing a person. */
export function readableError(error: unknown): string {
  if (!error) return 'Something went wrong.';
  const message = typeof error === 'string' ? error : ((error as { message?: string }).message ?? '');
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials')) return 'That email and password do not match.';
  if (m.includes('email not confirmed')) return 'Confirm your email address first — check your inbox.';
  if (m.includes('already registered')) return 'That email already has an account. Try signing in.';
  if (m.includes('password should be at least')) return 'Passwords need at least 8 characters.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  // A policy refusal reads as an empty result or a 42501; say what it means
  // rather than leaking the policy text.
  if (m.includes('row-level security') || m.includes('42501')) {
    return 'You do not have permission to do that in this campaign.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) return 'Network trouble. Check your connection.';
  return message || 'Something went wrong.';
}
