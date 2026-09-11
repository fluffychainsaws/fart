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

// Only our own web origins may call this from a browser. Native apps don't send
// an Origin header and aren't subject to CORS, so they're unaffected. Requests
// from an unlisted origin get the primary domain back, which the browser then
// refuses to match — the effect of the old '*' but without inviting every site.
const PRIMARY_ORIGIN = 'https://selftapebuddy.com';
const ALLOWED_ORIGINS = new Set([
  PRIMARY_ORIGIN,
  'https://www.selftapebuddy.com',
  'http://localhost:8081', // expo web dev server
  'http://localhost:19006', // older expo web dev port
]);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : PRIMARY_ORIGIN,
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const json = (body: unknown, status = 200, cors: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  const CORS = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, CORS);

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
  if (authError || !user) return json({ error: 'unauthorized' }, 401, CORS);

  // Service role can delete the auth user; the DB rows cascade from there.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error(deleteError);
    return json({ error: 'Could not delete the account. Try again.' }, 500, CORS);
  }

  return json({ ok: true }, 200, CORS);
});
