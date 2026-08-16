# Grimoire

A browser-based D&D campaign manager with Claude built in — the convenience of
D&D Beyond, plus an AI that actually knows your world.

One account, any number of campaigns. **Each campaign is a sealed world:**
nothing from one table can surface at another.

> **Status: Phase 1.** Accounts, campaigns, invitations, permissions and the AI
> gateway are built. Characters, notes, journals, lore and the assistant's
> retrieval layer are designed but not implemented — see
> [docs/ROADMAP.md](docs/ROADMAP.md).

---

## Run it

```bash
npm install
cp .env.example .env      # then fill in your Supabase project's URL and anon key
npm run dev
```

Without a backend configured the app renders a setup screen instead of a broken
login form. Backend setup is [supabase/README.md](supabase/README.md) — roughly:
create a project, run `supabase/schema.sql` in the SQL editor, paste two values
into `.env`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | Typecheck and build |
| `npm test` | Permission, cache-key and schema tests |
| `npm run check:isolation` | Fails if any query escapes campaign scope |
| `npm run verify` | All of the above |

## How it is put together

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before adding a feature — in
particular §2 (isolation) and §3 (permissions). The short version:

- **Postgres is the security boundary.** Row Level Security decides what every
  client can see, so the rule cannot be forgotten in application code.
- **Roles are per-campaign, not per-user.** You are a DM at one table and a
  player at another; authority never travels between them.
- **Joining goes through an invite.** There is no client path into a campaign —
  even a DM cannot add someone silently.
- **The assistant is never shown what you could not read yourself.** Retrieval
  runs server-side under your own credentials.

```
src/domain/     roles + capabilities, row types      (no I/O)
src/data/       the only code that touches Supabase  (scoped by campaign)
src/campaign/   campaign scope, viewer, capability gates
src/routes/     screens
supabase/       schema.sql — the actual boundary — and the AI gateway
```

## Four rules for new code

1. New table ⇒ `campaign_id`, RLS enabled, `unique (campaign_id, id)`, freeze trigger.
2. New capability ⇒ a policy first, a UI mirror second.
3. New AI feature ⇒ retrieval through the caller's own client, never service-role.
4. New query ⇒ inside `src/data/`, filtered by `campaign_id`.

## Licence

Not yet chosen. D&D content referenced by the app belongs to Wizards of the
Coast; anything from the SRD is used under the Open Gaming Licence.
