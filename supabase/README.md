# Setting up accounts (Supabase) — one-time, ~5 minutes

The app ships with accounts **dormant**: until the two env vars below exist,
there's no login surface and everything stays on-device like before.

## 1. Create the project
1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign up (free).
2. **New project** → name it `fart`, pick a strong database password (save it
   somewhere — you rarely need it again), choose the region closest to your users.
3. Wait ~2 minutes for it to provision.

## 2. Run the schema
1. In the dashboard, open **SQL Editor**.
2. Paste the whole contents of `supabase/schema.sql` and click **Run**.
   This creates the `profiles` table, locks it down with Row Level Security,
   and auto-creates a profile row on every signup.

## 3. Configure auth
In **Authentication → Sign In / Up**:
- Email provider is on by default — leave **Confirm email** ON (stops people
  signing up with emails they don't own).
- Set minimum password length to **8**.

In **Authentication → URL Configuration**:
- Site URL: `https://fluffychainsaws.github.io/fart`
- Add the same URL to **Redirect URLs** (confirmation + reset links land there).

## 4. Wire the app
1. In **Project Settings → API**, copy the **Project URL** and the
   **anon public** key.
2. Put them in `.env` locally:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
3. For the live site, add both as **Actions secrets** in the GitHub repo
   (Settings → Secrets and variables → Actions) and expose them in
   `.github/workflows/deploy-pages.yml`'s build env.

The anon key is fine to ship publicly — it can only do what the RLS policies
allow. The **service_role** key on the same page is the dangerous one: never
put it in the app or the repo.

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
