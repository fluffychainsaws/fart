import { Linking, Platform } from 'react-native';

import type { Tier } from './subscription';

// Web checkout via Stripe Payment Links — no in-app purchase, no 30% store
// cut. Each paid tier (plus the one-time Audition Credit) gets a Payment Link
// created in the Stripe dashboard (see supabase/README.md, "Billing"); paste
// the URLs here. While a link is blank its tier just isn't purchasable yet
// and the UI says so. 'daypass' shares this same URL-open + webhook-flip
// mechanism as the subscriptions — the webhook just credits instead of
// setting tier for that one price.
const PAYMENT_LINKS: Record<Exclude<Tier, 'free'>, string> = {
  fart: 'https://buy.stripe.com/6oUdRa3TrbvvgmP3P2a7C00',
  fartpro: 'https://buy.stripe.com/eVq7sM2Pn9nn9Yr85ia7C01',
  shartstar: 'https://buy.stripe.com/bJe9AU2Pn5773A32KYa7C02',
  daypass: 'https://buy.stripe.com/fZu8wQahP1UV2vZ85ia7C03',
};

export function checkoutUrl(tier: Tier): string | null {
  if (tier === 'free') return null;
  return PAYMENT_LINKS[tier] || null;
}

export function billingConfigured(): boolean {
  return Object.values(PAYMENT_LINKS).some(Boolean);
}

// Open Stripe checkout for a tier. client_reference_id carries the Supabase
// user id through checkout so the webhook knows whose tier to flip;
// prefilled_email keeps the two accounts matched up.
export function openCheckout(tier: Tier, userId: string, email?: string | null): boolean {
  const base = checkoutUrl(tier);
  if (!base) return false;
  const url = `${base}?client_reference_id=${encodeURIComponent(userId)}${
    email ? `&prefilled_email=${encodeURIComponent(email)}` : ''
  }`;
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url).catch(() => {});
  return true;
}
