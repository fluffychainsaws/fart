import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

// Thin wrapper over Supabase Auth so screens never import the client
// directly. Every function returns a friendly error string (or null on
// success) instead of throwing, so screens can just show the message.

const SITE_URL = 'https://selftapebuddy.com';

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'Check your inbox and confirm your email first.';
  if (m.includes('user already registered')) return 'That email already has an account. Try signing in.';
  if (m.includes('password should be at least')) return 'Password needs at least 8 characters.';
  if (m.includes('rate limit') || m.includes('too many requests'))
    return 'Too many attempts — wait a minute and try again.';
  if (m.includes('fetch') || m.includes('network')) return 'Network trouble. Check your connection.';
  return message;
}

export async function signUp(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Accounts are not configured yet.';
  const { error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: SITE_URL },
  });
  return error ? friendly(error.message) : null;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Accounts are not configured yet.';
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  return error ? friendly(error.message) : null;
}

export async function signOut(): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.auth.signOut();
  return error ? friendly(error.message) : null;
}

export async function requestPasswordReset(email: string): Promise<string | null> {
  if (!supabase) return 'Accounts are not configured yet.';
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: SITE_URL,
  });
  return error ? friendly(error.message) : null;
}

// Live session state. `undefined` while loading, `null` signed out.
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(
    supabase ? undefined : null,
  );

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return session;
}
