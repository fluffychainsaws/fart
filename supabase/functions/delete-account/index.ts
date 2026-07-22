// Account deletion. A user can only delete THEIR OWN account: the function
// verifies the caller's token, then uses the service role to remove that auth
// user. Deleting the auth.users row cascades to everything in supabase/
// schema.sql (profiles, scripts, usage_events, day_pass_purchases, rate_limits
// all reference auth.users (id) on delete cascade), so their data is wiped in
// one shot.
//
// Deploy with Verify JWT ON:
//   supabase functions deploy delete-account
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // Identify the caller from their own token — never trust an id in the body.
  const authHeader = req.headers.get('Authorization') ?? '';
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  // Service role can delete the auth user; the DB rows cascade from there.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error(deleteError);
    return json({ error: 'Could not delete the account. Try again.' }, 500);
  }

  return json({ ok: true });
});
