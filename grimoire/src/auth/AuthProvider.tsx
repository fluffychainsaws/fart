import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, readableError } from '@/lib/supabase';
import { getMyProfile } from '@/data/profiles';
import type { Profile } from '@/domain/types';

// Session state for the whole app. The session is a short-lived JWT plus a
// refresh token held by supabase-js; this provider only mirrors it into React
// and hangs the user's profile row off it.
//
// Note what is NOT here: anything about campaigns. Identity is global, but
// authority is always per-campaign and lives in CampaignProvider. Keeping the
// two apart is what stops "I am a DM" from becoming a property of the person
// rather than of their seat at one particular table.

type AuthValue = {
  status: 'loading' | 'signed-in' | 'signed-out';
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, displayName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    getMyProfile(userId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        // A missing profile is not fatal — the signup trigger may not have run
        // yet on a brand-new account. Screens fall back to the email address.
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const value = useMemo<AuthValue>(
    () => ({
      status: !ready ? 'loading' : session ? 'signed-in' : 'signed-out',
      session,
      user: session?.user ?? null,
      profile,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        return error ? readableError(error) : null;
      },
      async signUp(email, password, displayName) {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          // Read by handle_new_user() when it seeds the profile row.
          options: { data: { display_name: displayName.trim() } },
        });
        return error ? readableError(error) : null;
      },
      async signOut() {
        await supabase.auth.signOut();
      },
      async reloadProfile() {
        if (!userId) return;
        setProfile(await getMyProfile(userId).catch(() => null));
      },
    }),
    [ready, session, profile, userId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The name to show for the signed-in user, however incomplete their setup is. */
export function useMyName(): string {
  const { profile, user } = useAuth();
  return profile?.display_name ?? user?.email?.split('@')[0] ?? 'Adventurer';
}
