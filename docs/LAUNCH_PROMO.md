# Launch signup promo — deploy checklist

The promo grants **one-time bonus Audition Credits** the first time a user buys a
paid tier, during a launch window. It never expires once granted, fires at most
once per user ever, and is off until you set a start date.

**Bonus amounts:** FART (`$5`) → **1**, FART Pro (`$10`) → **2**, Shart Star (`$25`) → **3**.

There are two independent switches — both must be set:

| Layer | Controls | Where |
| --- | --- | --- |
| **Server** (authoritative — actually grants credits) | `PROMO_SIGNUP_START`, `PROMO_SIGNUP_END` secrets | `stripe-webhook` function |
| **Client** (advertising only — banner + badges) | `start`, `end` in `src/lib/promo.ts` | pushed to the site |

Keep the dates the same in both. If they ever drift, the worst case is the banner
showing a day off — the real grant is always governed by the server.

---

## Before launch day (one-time setup)

- [ ] **Run the schema.** Supabase → SQL Editor → paste all of `supabase/schema.sql`
      → Run. (Safe to re-run; adds `profiles.signup_bonus_granted`, the
      `grant_signup_bonus()` function, and locks it to service-role.)
- [ ] **Redeploy the webhook** with the promo code. Either:
      - Dashboard: Edge Functions → `stripe-webhook` → paste
        `supabase/functions/stripe-webhook/index.ts` → Deploy (JWT verification
        stays **off** for this function), **or**
      - CLI: `supabase functions deploy stripe-webhook --no-verify-jwt`
- [ ] **Confirm existing secrets are still set** (unchanged): `STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET`, `PRICE_FART`, `PRICE_FARTPRO`, `PRICE_SHARTSTAR`,
      `PRICE_DAYPASS`.
- [ ] **(Optional) confirm the bonus amounts** match your intent in two places —
      they must agree:
      - `SIGNUP_BONUS_BY_TIER` in `supabase/functions/stripe-webhook/index.ts`
      - `bonusByTier` in `src/lib/promo.ts`

## Dry run in Stripe test mode (do this before going live)

- [ ] Temporarily set `PROMO_SIGNUP_START` to today (test project / test secret).
- [ ] Test-mode checkout for **FART** → confirm the account gains **+1** credit
      (Account page "Audition Credits", or `profiles.premium_credits`).
- [ ] **Idempotency:** in Stripe → Webhooks, **resend** that same
      `checkout.session.completed` event → confirm credits **do not** increase.
- [ ] **One-time:** have the same test user buy again (or upgrade) → confirm **no**
      additional bonus (`signup_bonus_granted` is already `true`).
- [ ] Buy **FART Pro** with a fresh test user → **+2**; **Shart Star** → **+3**.
- [ ] Clear the temporary test secret when done.

## Launch day (turn it on)

- [ ] **Server:** set the secret `PROMO_SIGNUP_START` = launch date, e.g.
      `2026-08-01`. Leave `PROMO_SIGNUP_END` unset to auto-close 30 days later,
      or set it to a specific close date.
      - Dashboard: Project Settings → Edge Functions → Secrets, **or**
      - CLI: `supabase secrets set PROMO_SIGNUP_START=2026-08-01`
- [ ] **Client:** edit `src/lib/promo.ts` → set `start` (and `end` if you set the
      server end) to the **same** dates. Commit + push (deploys via GitHub Pages).
- [ ] **Verify live:** open selftapebuddy.com/account → the "🎁 Launch bonus"
      banner shows and each paid tier shows its bonus line. (Hard-refresh if the
      page is cached.)
- [ ] Do one real (or test-mode) purchase to confirm the credit lands.

## Extending the window

- [ ] **Server:** set `PROMO_SIGNUP_END` to the new later date.
- [ ] **Client:** set `end` in `src/lib/promo.ts` to match; push.

## Ending the promo

Nothing urgent required — it auto-closes at `PROMO_SIGNUP_END` (or start + 30
days). To end early or clean up afterward:

- [ ] **Server:** set `PROMO_SIGNUP_END` to a past date (or unset
      `PROMO_SIGNUP_START`) so no further grants happen.
- [ ] **Client:** set `start` back to `''` in `src/lib/promo.ts` and push, so the
      banner/badges disappear.
- [ ] Credits already granted **stay** — they never expire. That's intended.

## Notes / gotchas

- Bonus credits still ride under the existing per-user monthly TTS cost caps, so a
  worst-case user can't turn them into a runaway bill.
- The bonus only fires on a **paid tier** purchase, not on the one-off Audition
  Credit (day pass).
- If someone was already on a paid tier before launch, they won't retroactively
  get the bonus — it fires on the checkout event during the window. (If you want
  to comp early adopters, grant credits manually.)
