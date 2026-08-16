# Grimoire — Roadmap

Phases, not a schedule. Each one ends with something usable, and each inherits
the isolation and permission machinery built in Phase 1 rather than reinventing
it.

---

## Phase 1 — Foundation ✅

**Goal: a campaign you can create, invite people to, and trust.**

- Accounts (email + password), profiles, display names
- Campaigns: create, edit, archive, transfer, delete
- Membership: roles, role changes, removal, leaving
- Invitations: coded links, expiry, use limits, revocation, redemption
- The permission model, mirrored client-side for rendering
- Campaign isolation: RLS, composite keys, immutable `campaign_id`, namespaced
  caches, a build-time check
- The AI gateway: membership-verified, campaign-scoped, key held server-side
- Design tokens, component kit, campaign shell

Deliberately not built: any campaign content feature. Their tables and
permission rules exist; their pages explain what is coming.

---

## Phase 2 — Characters and notes

**Goal: the two things a player opens every session.**

- Character sheets for 5e: abilities, skills, saves, HP, conditions, inventory,
  spell slots. Structured columns rather than a jsonb blob, because Phase 4
  needs to reason over them.
- Level-up flow, and a rules reference behind it
- Personal notes with the three visibility levels already defined
- A character's page as the player's home inside a campaign

Also in this phase, paying down Phase 1's two acknowledged gaps:

- generated database types (`supabase gen types typescript`)
- **runtime RLS tests** — a seeded database and two signed-in clients, asserting
  that a member of campaign A gets zero rows from campaign B on every table

---

## Phase 3 — The world

**Goal: the DM's side of the screen.**

- Lore: NPCs, factions, locations, items — each shared or DM-only, with
  "reveal to the party" as a single logged action
- Session journal: shared recaps plus the DM's parallel private log
- Linking: a journal entry references an NPC; an NPC references a location.
  Every link is a composite foreign key carrying `campaign_id`, so a
  cross-campaign reference stays unrepresentable
- Search across everything the viewer is allowed to see
- A campaign timeline

---

## Phase 4 — The assistant

**Goal: the reason to use this instead of a wiki.**

The gateway from Phase 1 gets its retrieval layer:

- Context assembly from lore, journals and sheets — scoped to the campaign and
  filtered by the caller's visibility, so a player's answer can never be built
  from DM-only material
- Streaming replies
- DM tools: generate an NPC that fits the region, improvise a shop's stock,
  summarise last session into a recap the party can read
- Player tools: "what do we know about the Vistani?", answered from what the
  party has actually discovered
- Rules lookup with citations
- Per-user quota, enforced in the database, consumed before the model call and
  refunded on failure

---

## Phase 5 — At the table

**Goal: run a session inside the app.**

- Live session mode over Supabase Realtime, channels keyed per campaign
- Initiative tracker, HP and conditions, shared to the party
- Dice with a visible log, so a natural 20 is witnessed
- Encounter builder with difficulty maths
- Handouts the DM reveals mid-session

---

## Phase 6 — Polish and scale

- Import from D&D Beyond, export everything a table owns
- Homebrew: custom items, spells, monsters, subclasses
- Mobile layouts for the screens people use while playing
- Public campaign pages, opt-in, per campaign
- Accessibility pass: keyboard paths, screen-reader labels, motion preferences

---

## Standing rules

Things that apply to every phase, so they never become someone's Phase 7:

1. **New table ⇒ `campaign_id`, RLS, `unique (campaign_id, id)`, freeze
   trigger.** All four, at creation, or the isolation invariant has a hole.
2. **New capability ⇒ a policy first, a UI mirror second.** A capability with no
   server-side counterpart is a bug.
3. **New AI feature ⇒ retrieval through the caller's own client.** No service-
   role reads on the retrieval path, ever.
4. **New query ⇒ inside `src/data/`, filtered by `campaign_id`.** The build
   check enforces this; do not weaken it to get around a special case.
