# Grimoire — Architecture

*Phase 1 design. Written to be argued with; revise it when reality disagrees.*

---

## 1. What this is

A browser-based D&D campaign manager, aiming at the convenience of D&D Beyond
with an AI that actually knows your world.

One account. Any number of campaigns. Each campaign is a sealed world.

That last sentence is the whole architecture. Everything below is either a
consequence of it or a decision about how to keep it true as features arrive.

### The shape of the product

A user can:

- create an account, and belong to many campaigns at once
- start a campaign, becoming its owner and Dungeon Master
- invite people, at a role they choose
- join someone else's campaign with a code
- keep characters, private notes and journals inside a campaign
- see shared campaign material according to their role
- ask Claude about the campaign, and get answers drawn from that campaign only

### What Phase 1 delivers

Accounts, campaigns, membership, invitations, permissions, and the AI gateway —
plus the isolation machinery that all future features will inherit. Characters,
notes, journals and lore have their tables and their permission rules defined,
but no feature surface yet; their pages say what is coming and why.

---

## 2. Campaign isolation

> A row that belongs to campaign A must be unreachable — unreadable and
> unwritable — from campaign B, no matter what the client sends.

Accidental cross-campaign leakage is the failure this product cannot have. A
player seeing another table's plot twist is not a bug report, it is a ruined
surprise that cannot be un-ruined. So isolation is not a rule the application
code follows carefully; it is a property the database enforces, backed up by
two mechanical checks that fail the build.

### 2.1 The database is the boundary

Every campaign-scoped table has four properties:

| # | Property | Enforced by |
|---|---|---|
| 1 | A `NOT NULL campaign_id` | Column definition |
| 2 | Every policy derives from membership in *that* campaign | RLS policies + `is_campaign_member()` / `campaign_role()` |
| 3 | `unique (campaign_id, id)`, so references carry the campaign | Composite foreign keys |
| 4 | `campaign_id` is immutable | `freeze_campaign_id()` trigger |

Property 3 is the one that is easy to skip and expensive to retrofit. Because
`ai_threads` is unique on `(campaign_id, id)`, `ai_messages` references it with
a **composite** foreign key carrying `campaign_id` — so a message belonging to
one campaign but hanging off another campaign's thread is not merely forbidden,
it is not representable. Every table added later should do the same.

Row Level Security is enabled on every table. A table added without policies
therefore returns nothing at all: the system fails closed.

### 2.2 The helper functions, and why they are `security definer`

Policies on `campaign_members` need to ask "is the caller a member?" — which
means querying `campaign_members`, which re-enters the policy, which recurses
forever. The escape is a `security definer` function that runs with the owner's
rights and so reads the table without re-entering RLS:

```sql
is_campaign_member(campaign) → boolean
campaign_role(campaign)      → 'dm' | 'player' | 'observer' | null
is_campaign_dm(campaign)     → boolean
is_campaign_owner(campaign)  → boolean
shares_campaign_with(user)   → boolean
```

Each takes a campaign and answers **only about the caller**, so none of them can
be used to probe someone else's membership. `shares_campaign_with()` is the one
function that reasons across campaigns, and it exists for exactly one purpose:
letting you see the display name of a person at your table. It leaks no campaign
identity, only "yes, you two share a table somewhere".

### 2.3 The client half

The client cannot grant itself access — but it can display the wrong thing, or
send an unscoped query that silently returns nothing and renders as "no notes
yet". Three habits prevent that:

**One campaign id, from the URL.** Every campaign screen lives under
`/c/:campaignId` and reads the id from `CampaignProvider`, never from a prop or
a module variable. There is exactly one answer to "which world am I in?".

**Namespaced cache keys.** Every campaign-scoped React Query key begins
`['campaign', campaignId, …]` and is built in `src/data/keys.ts`, nowhere else.
On entering a campaign, the provider evicts every other campaign's cached data
outright — a refetch when switching worlds is a fair price for the guarantee.

**A closed data layer.** Only `src/data/` may touch the Supabase client, and
every function there takes `campaignId` first and filters on it.

### 2.4 The checks that fail the build

- `npm run check:isolation` — reads the scoped-table list out of
  `src/data/scoped.ts`, then asserts that no component queries Supabase
  directly and that every query against a scoped table mentions `campaign_id`.
- `src/schema.test.ts` — parses `supabase/schema.sql` and asserts RLS is enabled
  on every table it creates, that every scoped table has a not-null
  `campaign_id`, that the `my_campaigns` view is `security_invoker`, and that
  joining still has no client INSERT policy.
- `assertCampaignId()` — refuses a malformed id at runtime, where a URL
  parameter of unknown provenance enters the data layer.

None of these are the security boundary. They are the tripwires that catch a
mistake in the hour it is made rather than the month it ships.

---

## 3. Permissions

### 3.1 Roles

Three, deliberately few:

| Role | What it means |
|---|---|
| `dm` | Runs the game. Sees DM-only material, invites, manages the table. |
| `player` | Plays. Owns characters, keeps private notes, sees shared lore. |
| `observer` | Reads shared material. No characters, no posting. |

Plus one thing that is *not* a role: the **owner**, recorded on
`campaigns.owner_id`. The owner is always a DM, and additionally holds the
powers that must never be delegable by accident — delete the campaign, transfer
it, and mint or revoke another DM.

A co-DM is just a second `dm`. There is no separate role for it, because in
practice the difference between "DM" and "co-DM" is social, not technical.

### 3.2 Capabilities

`src/domain/roles.ts` holds one table mapping capability → allowed roles (+ an
owner-only flag), and every entry names the policy or trigger that actually
enforces it:

```ts
'invites.createDm': {
  roles: ['dm'],
  ownerOnly: true,
  enforcedBy: 'policy "dms create invites" (role <> dm or is_campaign_owner)',
}
```

The client uses `can(viewer, capability)` to decide what to render. It is a
mirror, not a gate. The naming convention keeps the two honest: **a capability
with no server-side counterpart is a UI affordance for an operation the database
will refuse, which is a bug.**

### 3.3 Things a policy cannot say

A row-level policy restricts which *rows* you may write, never which *columns*.
Four rules therefore live in triggers:

- the owner's membership row is immutable — nobody demotes or removes them
- only the owner may promote or demote a DM
- nobody may edit their own role
- ownership transfers only to an existing DM of that campaign

This is worth stating loudly because relying on a policy's `with check` for a
column restriction is a classic and quiet mistake.

### 3.4 Content visibility

Two patterns, and every future feature should pick one rather than invent a
third:

- **Owned-and-shared** (`characters`): belongs to one member, visible to the
  table, editable by its owner and by DMs.
- **Private-by-default** (`notes`): `private` → author only, `dm` → author and
  DMs, `campaign` → everyone at the table.

A private note is private *from the DM as well*. That is the point of the
feature, and the read policy says so explicitly.

---

## 4. Joining a campaign

Joining is deliberately **not** "insert yourself into `campaign_members`".

A prospective member can read neither the campaign nor the roster, so there is
no client path into a campaign at all. `campaign_members` has no INSERT policy.
The entire handshake runs through two `security definer` functions:

- `preview_invite(code)` → campaign name, offered role, inviter's name, validity.
  Nothing else. This is the "Sam invited you to Ravenloft — Join?" screen, and
  it is the only thing a non-member can learn about a campaign.
- `redeem_invite(code)` → validates, inserts the membership, increments the use
  count, returns the campaign id. It locks the invite row `for update`, so two
  people racing for the last seat of a limited invite cannot both win.

Invite codes are minted by `generate_invite_code()` in the database, from an
alphabet with the read-aloud ambiguities removed (no `0`/`O`, `1`/`I`/`L`,
`5`/`S`, `8`/`B`) — codes get read across a table out loud.

The upshot: **every join leaves an invite record behind.** Even a DM cannot add
someone silently, which is why the members page has no "add person" button.

---

## 5. AI integration

The assistant is the reason to build this rather than use a wiki, and it is also
the single most likely place for a leak, because it works by pulling material
out of a database and putting it into a prompt.

### 5.1 The rule

> The model is never shown anything the caller could not read for themselves.

Not "we instruct it not to reveal DM secrets" — it is never given them. That
turns prompt injection from a data-breach risk into a nuisance: the worst case
is the assistant misbehaving with material the user already had.

### 5.2 How the gateway enforces it

Every call goes through the `ai-chat` edge function, which:

1. reads the caller's JWT and resolves the user;
2. calls `campaign_role(campaignId)` — a forged campaign id returns null and
   stops here;
3. loads the thread and takes the **perspective from the stored row**, not from
   the request body, so it cannot be escalated by editing JSON;
4. assembles context using a client authenticated **as the caller**, so RLS
   filters retrieval exactly as it filters the screens;
5. calls Claude with a system prompt scoped to that campaign;
6. writes the transcript with the service role, because a transcript the browser
   can forge is not a record of anything.

The Anthropic key is a Supabase secret and never reaches the browser.

### 5.3 Perspectives

A thread is opened as `player` or `dm`, and the insert policy refuses a
`dm` thread to a non-DM. The perspective decides how much of the world the
retrieval step may see. Phase 4 fills that step in; the function marks the exact
spot and the two properties any addition must preserve — scoped to this
campaign, visible to this caller.

### 5.4 Model choice

`claude-opus-5` for the assistant: the work is reasoning over a body of campaign
material, which is where it earns its cost. Cheaper models are the right call
for the mechanical jobs later phases add — summarising a session log, tagging
lore entries — and the gateway is the natural place to route by task.

---

## 6. Stack

| Layer | Choice | Why |
|---|---|---|
| UI | React 19 + Vite + TypeScript | Web-first; the app is a dense desktop tool (tables, sidebars, split panes) and plain CSS beats a cross-platform abstraction here |
| Routing | React Router 7 | Campaign scope is expressed as a route (`/c/:campaignId`), which is what makes "one campaign id, from the URL" true |
| Server state | TanStack Query 5 | Multi-user data that goes stale; namespaced keys give per-campaign eviction for free |
| Styling | CSS with design tokens | No build dependency; a per-campaign accent later is a token swap |
| Backend | Supabase (Postgres, Auth, RLS, Edge Functions) | RLS *is* the isolation model. Getting this from the database rather than a hand-written service layer is the single biggest structural win available |
| AI | Claude via a Supabase Edge Function | Key stays secret; retrieval happens where RLS applies |

### Why not a hand-written API server

A conventional Node API would put isolation in application code — one forgotten
`WHERE campaign_id = ?` from a leak, and no mechanism that catches it. RLS moves
the check to the row, where it cannot be forgotten, and applies it identically
to the browser, the edge function, and any future integration.

The cost is real: policies are harder to read than middleware, and they need
their own tests. That is a trade worth making for exactly one product property —
this one.

### Deployment

Static frontend on any host (Netlify, Vercel, Pages) with SPA rewrites; Supabase
hosts the database and functions. No server to operate.

---

## 7. Layout

```
grimoire/
├── docs/
│   ├── ARCHITECTURE.md      this file
│   └── ROADMAP.md           what lands in which phase
├── supabase/
│   ├── schema.sql           tables, policies, triggers, RPCs — the boundary
│   ├── README.md            one-time project setup
│   └── functions/ai-chat/   the Claude gateway
├── scripts/
│   └── check-isolation.mjs  build-time isolation check
└── src/
    ├── domain/     roles + capabilities, row types      (no I/O)
    ├── data/       the only code that touches Supabase  (scoped by campaign)
    ├── auth/       session + profile
    ├── campaign/   campaign scope, viewer, capability gates
    ├── routes/     screens; campaign screens under routes/campaign/
    ├── ui/         the component kit
    └── styles/     tokens + stylesheet
```

The dependency rule is one-directional: `routes` → `campaign`/`auth` → `data` →
`domain`. Nothing in `domain` imports anything; nothing outside `data` imports
Supabase.

---

## 8. Decisions worth revisiting

Honest list of things chosen quickly, and what would change them.

**Types are hand-written.** `src/domain/types.ts` mirrors the schema by hand.
Phase 2 should generate them with `supabase gen types typescript` and delete the
duplication — the risk is silent drift between the two.

**RLS policies have no runtime tests.** `schema.test.ts` parses SQL text; it
proves structure, not behaviour. Phase 2 should add pgTAP or a seeded database
driven by two signed-in clients, asserting that campaign A's member gets zero
rows from campaign B. This is the largest gap in Phase 1.

**No realtime.** Members and invites are polled via React Query. A live session
tracker (initiative, HP, dice) needs Supabase Realtime channels, keyed per
campaign so subscriptions carry the same isolation as queries.

**Ownership is a single account.** If that account is abandoned, the campaign is
stuck. A DM-majority transfer, or an admin escape hatch, is worth designing
before a real table hits it.

**Content tables are thin.** `characters.data` and `notes.body` are a jsonb blob
and a text column. Fine for now; a real 5e sheet wants structure, and structure
is what the assistant will want to reason over.

**No rate limiting on the assistant.** Claude calls cost money and the gateway
will happily spend it. Before any public launch: a per-user monthly quota
enforced in the database, consumed before the model call and refunded on
failure.
