// Stripe webhook -> profiles.tier. Deploy with:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets (supabase secrets set KEY=value):
//   STRIPE_WEBHOOK_SECRET  - from the Stripe webhook endpoint config
//   PRICE_FART, PRICE_FARTPRO, PRICE_SHARTSTAR - Stripe price IDs per tier
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// This is the ONLY place tiers get upgraded: checkout.session.completed sets
// the paid tier, customer.subscription.deleted drops back to free. The
// client_reference_id on the checkout session is the Supabase user id
// (attached by src/lib/billing.ts when opening the payment link).

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

async function setTier(userId: string, tier: string) {
  const { error } = await supabase.from('profiles').update({ tier }).eq('id', userId);
  if (error) throw new Error(`profiles update failed: ${error.message}`);
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
      const tier = tierForPrice(items.data[0]?.price?.id);
      if (tier) {
        await setTier(userId, tier);
        // Remember the mapping so subscription cancellations can find the user.
        if (session.customer) {
          await stripe.customers.update(session.customer as string, {
            metadata: { supabase_user_id: userId },
          });
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
