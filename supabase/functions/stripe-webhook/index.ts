// Stripe webhook -> profiles.tier / profiles.premium_credits. Deploy with:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets (supabase secrets set KEY=value):
//   STRIPE_WEBHOOK_SECRET  - from the Stripe webhook endpoint config
//   PRICE_FART, PRICE_FARTPRO, PRICE_SHARTSTAR - Stripe price IDs per tier
//   PRICE_DAYPASS - Stripe price ID for the one-time Day Pass credit
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// This is the ONLY place tiers get upgraded: checkout.session.completed sets
// the paid tier, customer.subscription.deleted drops back to free. The
// client_reference_id on the checkout session is the Supabase user id
// (attached by src/lib/billing.ts when opening the payment link). The Day
// Pass is a separate one-time price on the same checkout.session.completed
// event — it grants a premium_credits credit instead of changing tier, and
// is deduped against Stripe's at-least-once delivery via day_pass_purchases.

import Stripe from 'npm:stripe@18';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2025-06-30.basil',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function tierForPrice(priceId: string | undefined): string | null {
  if (!priceId) return null;
  if (priceId === Deno.env.get('PRICE_FART')) return 'fart';
  if (priceId === Deno.env.get('PRICE_FARTPRO')) return 'fartpro';
  if (priceId === Deno.env.get('PRICE_SHARTSTAR')) return 'shartstar';
  return null;
}

function isDayPassPrice(priceId: string | undefined): boolean {
  return !!priceId && priceId === Deno.env.get('PRICE_DAYPASS');
}

async function setTier(userId: string, tier: string) {
  const { error } = await supabase.from('profiles').update({ tier }).eq('id', userId);
  if (error) throw new Error(`profiles update failed: ${error.message}`);
}

async function grantDayPassCredit(userId: string, sessionId: string) {
  // The insert is the idempotency guard: a duplicate delivery for the same
  // checkout session hits the primary key and is silently skipped.
  const { error: insertError } = await supabase
    .from('day_pass_purchases')
    .insert({ session_id: sessionId, user_id: userId });
  if (insertError) {
    if (insertError.code === '23505') return; // already redeemed this session
    throw new Error(`day_pass_purchases insert failed: ${insertError.message}`);
  }
  const { error } = await supabase.rpc('increment_premium_credits', {
    p_user_id: userId,
    p_amount: 1,
  });
  if (error) throw new Error(`increment_premium_credits failed: ${error.message}`);
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!signature || !secret) return new Response('missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, secret);
  } catch {
    return new Response('bad signature', { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (!userId) return new Response('no client_reference_id', { status: 200 });
      const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
      const priceId = items.data[0]?.price?.id;
      if (isDayPassPrice(priceId)) {
        await grantDayPassCredit(userId, session.id);
      } else {
        const tier = tierForPrice(priceId);
        if (tier) {
          await setTier(userId, tier);
          // Remember the mapping so subscription cancellations can find the user.
          if (session.customer) {
            await stripe.customers.update(session.customer as string, {
              metadata: { supabase_user_id: userId },
            });
          }
        }
      }
    } else if (
      event.type === 'customer.subscription.deleted' ||
      (event.type === 'customer.subscription.updated' &&
        (event.data.object as Stripe.Subscription).status === 'canceled')
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const customer = await stripe.customers.retrieve(sub.customer as string);
      const userId = !customer.deleted ? customer.metadata?.supabase_user_id : undefined;
      if (userId) await setTier(userId, 'free');
    }
  } catch (err) {
    console.error(err);
    return new Response('handler error', { status: 500 }); // Stripe will retry
  }

  return new Response('ok', { status: 200 });
});
