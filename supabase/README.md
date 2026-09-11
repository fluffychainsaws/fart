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

## Script reading (Claude) — required to parse scripts

Uploading a PDF/photo and turning it into a script calls Claude. That call
runs **server-side**, in the `parse-script` Edge Function, so the Anthropic key
stays a secret — an `EXPO_PUBLIC_*` key would be inlined into the public web
bundle and could be lifted by anyone. Smart director notes go through the same
function. Without this deployed, script uploads fail with a friendly error and
director notes fall back to keyword matching.

1. Deploy the function (JWT verification stays ON — parsing is gated to
   signed-in users so the key can't be abused anonymously):
   ```
   supabase functions deploy parse-script
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
   (Or paste `supabase/functions/parse-script/index.ts` via the dashboard's
   Edge Functions editor and set the secret under **Edge Functions → Secrets**.)
2. That's it — the client calls it through the Supabase URL already baked into
   the app. Parsing requires the user to be **signed in**.

## Billing (Stripe) — when ready to charge

The app opens Stripe **Payment Links** in the browser (no app-store cut), and
a Supabase Edge Function flips `profiles.tier` when Stripe reports a payment.

1. Create a Stripe account (stripe.com), then in **Product catalog** create
   three recurring products matching the app's plans: FART $5/mo,
   FART PRO $10/mo, SHART STAR $25/mo. Note each price's ID (`price_...`).
2. Also create a fourth product for the **Audition Credit**: a one-time (not
   recurring) $3.99 price. It grants a permanent `premium_credits` credit
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

## Content Security Policy

The web app ships a CSP in a `<meta>` tag in `src/app/+html.tsx`, because
GitHub Pages can't send response headers. It's what stops an injected script
from reading the session token out of `localStorage`.

**The policy pins two inline scripts by SHA-256 hash.** If you edit the inline
script in `+html.tsx`, its hash changes and the browser silently refuses to run
it — the install prompt and the anti-clickjacking frame guard both stop
working. After any edit to it:

```bash
npx expo export --platform web
python3 - <<'PY'
import re, hashlib, base64
h = open('dist/index.html').read()
for b in re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', h, re.S):
    print("'sha256-" + base64.b64encode(hashlib.sha256(b.encode()).digest()).decode() + "'")
PY
```

Paste the two values into the `script-src` list in `+html.tsx`.

The same applies when Expo is upgraded: its one-line hydration script is the
second hash, and a new Expo version can change it. If the app renders but feels
inert after an upgrade, check the browser console for a CSP refusal first.

Two things a meta-tag policy can't do — `frame-ancestors` (hence the frame
guard in script) and report-only mode. Putting a proxy such as Cloudflare in
front of Pages would let you send real headers, add HSTS, and trial changes in
report-only mode first.

### Verify after deploying
The optional neural voices load their ONNX runtime from jsdelivr and model
weights from HuggingFace, so those hosts are allowed in `script-src` and
`connect-src`. Turn neural voices on once after a deploy and confirm a line
still speaks — that's the one path the policy could plausibly break.

## What's deliberately NOT wired yet
- The app doesn't sync scripts or read the server-side tier yet — that's the
  next step once accounts are live.
- Billing (Stripe) that flips `profiles.tier` via webhook.
