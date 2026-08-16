# Backend setup

One-time, about ten minutes.

## 1. Create the project

At [supabase.com](https://supabase.com), create a project. Pick a region near
your table; everything else can stay on defaults.

## 2. Run the schema

Open **SQL Editor**, paste the whole of [`schema.sql`](schema.sql), run it.

It is idempotent — safe to re-run after you edit it. That matters, because it is
the only description of the security model, and you will edit it.

What it creates:

- `profiles`, `campaigns`, `campaign_members`, `campaign_invites`
- `characters`, `notes` — Phase 2 features, but their permission rules are here
  so the two visibility patterns are pinned down now
- `ai_threads`, `ai_messages`
- the membership helpers, the invite RPCs, the guard triggers
- Row Level Security policies on every table

## 3. Auth settings

**Authentication → Providers**: email is on by default, which is all Phase 1
needs.

While developing, turn **"Confirm email"** off (Authentication → Sign In / Up) so
test accounts work immediately. Turn it back on before anyone real signs up.

**Authentication → URL Configuration**: set the Site URL to where the app runs
(`http://localhost:5173` in development) so confirmation links land correctly.

## 4. Wire up the app

**Project Settings → API**, then copy into `.env` at the repo root:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<the publishable / anon key>
```

The anon key is public by design — it grants exactly what RLS allows and nothing
more. **The `service_role` key is the secret one; it must never appear in `.env`
or anywhere else the browser can reach.**

Restart the dev server after editing `.env`.

## 5. The AI gateway (optional in Phase 1)

The assistant's edge function needs the Anthropic key as a secret:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai-chat
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
into edge functions automatically — you do not set those yourself.

Get a key at [console.anthropic.com](https://console.anthropic.com). The
function is not called by any Phase 1 screen; deploy it when Phase 4 starts, or
now if you want to exercise the boundary.

---

## Checking that isolation actually works

Worth doing once by hand, because it is the property everything else rests on.

1. Sign up as two users, A and B.
2. As A, create a campaign. Note its id from the URL.
3. As B, create a different campaign, and **do not** join A's.
4. As B, visit `/c/<A's campaign id>`.

You should get "Campaign not found" — the same screen you'd get for an id that
does not exist, because the app genuinely cannot tell the two apart. That is
correct: distinguishing them would confirm the campaign exists.

Then, in the SQL editor (which runs as a superuser and bypasses RLS, so it sees
everything — that is expected there and only there):

```sql
select id, name from public.campaigns;
```

Both campaigns are visible here. Neither user's client can see the other's.

Automated equivalents of this check are Phase 2 — see docs/ARCHITECTURE.md §8.
