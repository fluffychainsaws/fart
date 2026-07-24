// Launch signup promo — CLIENT-SIDE DISPLAY ONLY.
//
// The actual bonus-credit grant is enforced server-side in
// supabase/functions/stripe-webhook (secrets PROMO_SIGNUP_START /
// PROMO_SIGNUP_END). This file only controls whether the promo is ADVERTISED
// in the app, so keep the dates here in sync with those secrets.
//
// Before launch: leave `start` empty — all promo UI stays hidden.
// On launch day: set `start` (e.g. '2026-08-01'). The window auto-closes 30
// days later unless you set `end` to a later date to extend it.
export const SIGNUP_PROMO = {
  start: '2026-07-24', // ISO date the promo opens. Empty = promo off.
  end: '', // optional ISO close date; defaults to start + 30 days.
  bonusByTier: { fart: 1, fartpro: 2, shartstar: 3 } as Record<string, number>,
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Is the launch promo currently running? Mirrors the webhook's window logic.
export function signupPromoOpen(now = Date.now()): boolean {
  if (!SIGNUP_PROMO.start) return false;
  const start = Date.parse(SIGNUP_PROMO.start);
  if (Number.isNaN(start)) return false;
  const end = SIGNUP_PROMO.end ? Date.parse(SIGNUP_PROMO.end) : start + THIRTY_DAYS_MS;
  if (Number.isNaN(end)) return false;
  return now >= start && now <= end;
}

// Bonus credits advertised for a tier (0 if none).
export function signupBonusFor(tier: string): number {
  return SIGNUP_PROMO.bonusByTier[tier] ?? 0;
}
