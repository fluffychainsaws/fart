# Accounts (Supabase) — LIVE

The live project is `bojaiebacqsqewmxwuih` (fart on supabase.com). Its URL and
publishable key are baked into `src/lib/supabase.ts` (env vars override them),
so accounts are on everywhere by default.

The publishable key is fine to ship — it can only do what the RLS policies
allow. The **service_role** key in the same dashboard is the dangerous one:
never put it in the app or the repo.

## Dashboard checklist (once, in supabase.com → project `fart`)

1. **Schema** — open **SQL Editor**, paste all of `supabase/schema.sql`, **Run**.
   Creates the `profiles` and `scripts` tables, locks them with Row Level
   Security, and auto-creates a profile row on signup. Safe to re-run any
   time — and MUST be re-run after pulling schema changes (e.g. the tier-name
   fix and the scripts table added for account sync).
2. **Auth settings** — **Authentication → Sign In / Up**: leave **Confirm
   email** ON; set minimum password length to **8**.
3. **Redirects** — **Authentication → URL Configuration**: set Site URL to
   `https://selftapebuddy.com` and add the same URL to **Redirect URLs**
   (confirmation + reset links land there).

## Billing (Stripe) — when ready to charge

The app opens Stripe **Payment Links** in the browser (no app-store cut), and
a Supabase Edge Function flips `profiles.tier` when Stripe reports a payment.

1. Create a Stripe account (stripe.com), then in **Product catalog** create
   three recurring products matching the app's plans: FART $5/mo,
   FART PRO $10/mo, SHART STAR $25/mo. Note each price's ID (`price_...`).
2. Also create a fourth product for the **Day Pass**: a one-time (not
   recurring) $2.99 price. It grants a permanent `premium_credits` credit
   instead of changing tier — see the `daypass` pseudo-tier in
   `src/lib/subscription.ts`.
3. For each of the four products create a **Payment Link** (Stripe dashboard
   → Payment Links). Paste the four URLs into `PAYMENT_LINKS` in
   `src/lib/billing.ts` (`fart`, `fartpro`, `shartstar`, `daypass`).
4. Deploy the webhook (needs the [Supabase CLI](https://supabase.com/docs/guides/cli),
   one-time):
   ```
   supabase login
   supabase link --project-ref bojaiebacqsqewmxwuih
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... \
     PRICE_FART=price_... PRICE_FARTPRO=price_... PRICE_SHARTSTAR=price_... \
     PRICE_DAYPASS=price_...
   ```
5. In Stripe → **Developers → Webhooks**, add an endpoint pointing at
   `https://bojaiebacqsqewmxwuih.supabase.co/functions/v1/stripe-webhook`
   listening to `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy its signing secret into
   `STRIPE_WEBHOOK_SECRET` above.

Test the loop with Stripe's test mode (test-mode payment links + `sk_test_`
keys) before flipping to live keys.

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
