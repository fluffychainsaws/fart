# Accounts (Supabase) — LIVE

The live project is `bojaiebacqsqewmxwuih` (fart on supabase.com). Its URL and
publishable key are baked into `src/lib/supabase.ts` (env vars override them),
so accounts are on everywhere by default.

The publishable key is fine to ship — it can only do what the RLS policies
allow. The **service_role** key in the same dashboard is the dangerous one:
never put it in the app or the repo.

## Dashboard checklist (once, in supabase.com → project `fart`)

1. **Schema** — open **SQL Editor**, paste all of `supabase/schema.sql`, **Run**.
   Creates the `profiles` table, locks it with Row Level Security, and
   auto-creates a profile row on signup. Safe to re-run any time.
2. **Auth settings** — **Authentication → Sign In / Up**: leave **Confirm
   email** ON; set minimum password length to **8**.
3. **Redirects** — **Authentication → URL Configuration**: set Site URL to
   `https://fluffychainsaws.github.io/fart` and add the same URL to
   **Redirect URLs** (confirmation + reset links land there).

## How the accounts are protected
- **Passwords** are bcrypt-hashed by Supabase before storage; nobody
  (including you) can read them back.
- **Sessions** are short-lived JWTs with auto-refresh, stored on-device;
  the password itself is never kept.
- **Email confirmation** blocks signups with someone else's address.
- **Rate limiting** on login/signup/reset endpoints blunts brute-force and
  spam attempts (Supabase default).
- **Row Level Security** means even a modified client can only read/write
  the signed-in user's own rows — and the tier column can't be self-upgraded
  (see the update policy in `schema.sql`).

## What's deliberately NOT wired yet
- The app doesn't sync scripts or read the server-side tier yet — that's the
  next step once accounts are live.
- Billing (Stripe) that flips `profiles.tier` via webhook.
