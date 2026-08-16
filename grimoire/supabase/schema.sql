-- ============================================================================
-- Grimoire — database schema (Phase 1: accounts, campaigns, membership)
--
-- Paste this whole file into the Supabase SQL editor (or `supabase db push`).
-- It is idempotent: safe to re-run after edits.
--
-- THE ONE RULE THIS FILE EXISTS TO ENFORCE
-- ----------------------------------------
-- Every campaign is a sealed world. A row that belongs to campaign A must be
-- unreachable — unreadable and unwritable — from campaign B, no matter what
-- the client sends. That is enforced here, in Postgres, by Row Level Security.
-- The React app's checks are convenience only; this file is the real boundary.
--
-- The invariant has four mechanical parts:
--   1. Every campaign-scoped table has a NOT NULL `campaign_id`.
--   2. Every policy on such a table derives from membership in THAT campaign,
--      via the helper functions below. No policy references a user's other
--      campaigns.
--   3. Every campaign-scoped table has `unique (campaign_id, id)`, so any
--      table that points at it uses a COMPOSITE foreign key carrying
--      campaign_id. A cross-campaign reference then fails at the constraint
--      level — it is not merely "not allowed", it is not representable.
--   4. `campaign_id` is immutable: a trigger rejects any UPDATE that moves a
--      row between campaigns.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- SECTION 1 — Accounts
-- ============================================================================

-- One row per user. Supabase Auth owns credentials in its private auth.users
-- table; nothing password-shaped ever lives here.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Adventurer',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_display_name_length;
alter table public.profiles
  add constraint profiles_display_name_length
  check (char_length(display_name) between 1 and 60);

-- Keeps `updated_at` honest without trusting the client's clock.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create a profile on signup, seeding the display name from whatever the
-- signup form put in user metadata (falls back to the email's local part).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Adventurer'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- SECTION 2 — Campaigns and membership
-- ============================================================================

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  -- Points at profiles, not auth.users: PostgREST can only embed a related
  -- row when a foreign key names the table being embedded, and every screen
  -- that lists people needs their display name. profiles.id is itself a
  -- reference to auth.users, so deletion still cascades from the account.
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  tagline text,
  description text,
  -- Which ruleset the campaign runs. Kept as free text (not an enum) so
  -- supporting a new system is a data change, not a migration.
  game_system text not null default 'dnd5e',
  -- Per-campaign feature flags and AI preferences. Lives as jsonb so campaign
  -- settings can evolve without a migration; nothing security-relevant goes
  -- here (permissions are columns and policies, never settings).
  settings jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_name_length check (char_length(name) between 1 and 120)
);

-- Roles, most privileged first:
--   dm       — runs the game. Sees DM-only content, invites, manages members.
--   player   — plays. Owns characters, keeps private notes, sees shared lore.
--   observer — reads shared content only. No characters, no writes.
-- The campaign's OWNER is additionally recorded on campaigns.owner_id and is
-- always a 'dm'. Owner-only powers (delete, transfer, promote/demote DMs) are
-- checked against owner_id, not against role.
create table if not exists public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'player',
  joined_at timestamptz not null default now(),
  invited_by uuid references public.profiles (id) on delete set null,
  primary key (campaign_id, user_id),
  constraint campaign_members_role_check check (role in ('dm', 'player', 'observer'))
);

create index if not exists campaign_members_user_idx
  on public.campaign_members (user_id);

-- ---------------------------------------------------------------------------
-- Membership helpers.
--
-- These are SECURITY DEFINER on purpose. A policy on campaign_members that
-- itself queries campaign_members would recurse forever; a definer function
-- runs with the owner's rights, so it reads the table without re-entering RLS.
-- Each one is parameterised by campaign and answers only about the CALLER, so
-- it cannot be used to probe anyone else's membership.
--
-- `stable` lets the planner call them once per query rather than per row.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_role(p_campaign uuid)
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.campaign_members
  where campaign_id = p_campaign and user_id = auth.uid();
$$;

create or replace function public.is_campaign_member(p_campaign uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = p_campaign and user_id = auth.uid()
  );
$$;

create or replace function public.is_campaign_dm(p_campaign uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = p_campaign and user_id = auth.uid() and role = 'dm'
  );
$$;

create or replace function public.is_campaign_owner(p_campaign uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.campaigns
    where id = p_campaign and owner_id = auth.uid()
  );
$$;

-- True when the caller and p_user sit in at least one campaign together. This
-- is the ONLY function that reasons across campaigns, and it exists for a
-- single purpose: letting you see the display name of someone at your table.
-- It leaks no campaign identity — just "yes, you two share a table somewhere".
create or replace function public.shares_campaign_with(p_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_members mine
    join public.campaign_members theirs using (campaign_id)
    where mine.user_id = auth.uid() and theirs.user_id = p_user
  );
$$;

grant execute on function public.campaign_role(uuid) to authenticated;
grant execute on function public.is_campaign_member(uuid) to authenticated;
grant execute on function public.is_campaign_dm(uuid) to authenticated;
grant execute on function public.is_campaign_owner(uuid) to authenticated;
grant execute on function public.shares_campaign_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Creating a campaign enrolls its creator as DM, in the same transaction.
-- Without this the creator would insert a campaign they cannot then read.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_campaign()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.campaign_members (campaign_id, user_id, role)
  values (new.id, new.owner_id, 'dm')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_campaign_created on public.campaigns;
create trigger on_campaign_created
  after insert on public.campaigns
  for each row execute function public.handle_new_campaign();

drop trigger if exists campaigns_touch on public.campaigns;
create trigger campaigns_touch before update on public.campaigns
  for each row execute function public.touch_updated_at();

-- A row-level policy can restrict WHICH ROWS a user may update, but not WHICH
-- COLUMNS. Ownership transfer is therefore guarded here: any DM may edit the
-- campaign, but only the current owner may hand it to someone else, and only
-- to an existing DM.
create or replace function public.guard_campaign_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    if not public.is_campaign_owner(old.id) then
      raise exception 'only the campaign owner can transfer ownership';
    end if;
    if not exists (
      select 1 from public.campaign_members
      where campaign_id = old.id and user_id = new.owner_id and role = 'dm'
    ) then
      raise exception 'ownership can only be transferred to a DM of this campaign';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists campaigns_guard on public.campaigns;
create trigger campaigns_guard before update on public.campaigns
  for each row execute function public.guard_campaign_update();

-- Membership rules that policies cannot express:
--   * the owner's own membership is immutable (nobody demotes or removes them)
--   * only the owner may mint or revoke another DM
--   * a member may never edit their own role (no self-promotion)
create or replace function public.guard_member_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.campaigns
    where id = coalesce(old.campaign_id, new.campaign_id);

  if tg_op = 'UPDATE' then
    if new.campaign_id is distinct from old.campaign_id
       or new.user_id is distinct from old.user_id then
      raise exception 'a membership cannot be moved between campaigns or users';
    end if;
    if old.user_id = v_owner and new.role is distinct from old.role then
      raise exception 'the campaign owner''s role cannot be changed';
    end if;
    if new.role is distinct from old.role then
      if new.user_id = auth.uid() then
        raise exception 'you cannot change your own role';
      end if;
      if (new.role = 'dm' or old.role = 'dm') and auth.uid() is distinct from v_owner then
        raise exception 'only the campaign owner can promote or demote a DM';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' and old.user_id = v_owner then
    raise exception 'the campaign owner cannot leave or be removed; transfer ownership first';
  end if;

  return case tg_op when 'DELETE' then old else new end;
end;
$$;

drop trigger if exists campaign_members_guard on public.campaign_members;
create trigger campaign_members_guard
  before update or delete on public.campaign_members
  for each row execute function public.guard_member_update();

-- ============================================================================
-- SECTION 3 — Invitations
--
-- Joining is deliberately NOT "insert yourself into campaign_members". A
-- prospective member can neither read the campaign nor write the membership
-- table, so the whole handshake runs through redeem_invite() below, which is
-- the single audited doorway into a campaign.
-- ============================================================================

-- Codes are minted here, not by the client: a browser that picks its own code
-- can pick a guessable one. The alphabet drops the characters people misread
-- when an invite gets read aloud across a table (0/O, 1/I/L, 5/S, 8/B).
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ACDEFGHJKMNPQRTUVWXY2346789';
  candidate text;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.campaign_invites where code = candidate);
  end loop;
  return candidate;
end;
$$;

create table if not exists public.campaign_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- Short, human-shareable, unique. Always upper case (see the check below), so
  -- a code typed in lower case still matches after the RPCs upper() it.
  code text not null unique default public.generate_invite_code(),
  -- The role the invitee lands in. A DM invite is owner-only to create.
  role text not null default 'player',
  created_by uuid not null references public.profiles (id) on delete cascade,
  label text,
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint campaign_invites_role_check check (role in ('dm', 'player', 'observer')),
  constraint campaign_invites_max_uses_check check (max_uses is null or max_uses > 0),
  constraint campaign_invites_code_format check (code = upper(code) and char_length(code) between 6 and 24)
);

create index if not exists campaign_invites_campaign_idx
  on public.campaign_invites (campaign_id);

-- Re-running this file after the table already exists would otherwise leave the
-- old (missing) default in place.
alter table public.campaign_invites
  alter column code set default public.generate_invite_code();

-- Look at an invite without joining: the "You've been invited to Ravenloft by
-- Sam — Join?" screen. Runs as definer because the caller is by definition not
-- yet a member. It returns the campaign's name and the inviter's display name
-- and NOTHING ELSE — no id list, no member roster, no world content.
create or replace function public.preview_invite(p_code text)
returns table (campaign_name text, invited_role text, invited_by text, is_valid boolean, reason text)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_invite public.campaign_invites%rowtype;
  v_campaign public.campaigns%rowtype;
begin
  select * into v_invite from public.campaign_invites where code = upper(trim(p_code));
  if not found then
    return query select null::text, null::text, null::text, false, 'unknown_code';
    return;
  end if;

  select * into v_campaign from public.campaigns where id = v_invite.campaign_id;

  return query
  select
    v_campaign.name,
    v_invite.role,
    (select display_name from public.profiles where id = v_invite.created_by),
    case
      when v_invite.revoked_at is not null then false
      when v_invite.expires_at is not null and v_invite.expires_at < now() then false
      when v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then false
      when v_campaign.archived_at is not null then false
      else true
    end,
    case
      when v_invite.revoked_at is not null then 'revoked'
      when v_invite.expires_at is not null and v_invite.expires_at < now() then 'expired'
      when v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then 'used_up'
      when v_campaign.archived_at is not null then 'archived'
      else 'ok'
    end;
end;
$$;

-- Redeem an invite. Returns the campaign id on success so the client can route
-- straight into it. Idempotent for someone who is already a member: they get
-- the id back and the invite is not consumed.
create or replace function public.redeem_invite(p_code text)
returns table (campaign_id uuid, joined boolean, reason text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_invite public.campaign_invites%rowtype;
  v_archived timestamptz;
begin
  if auth.uid() is null then
    return query select null::uuid, false, 'not_signed_in';
    return;
  end if;

  -- Lock the invite row so two people racing on the last seat of a
  -- max_uses invite cannot both pass the check.
  select * into v_invite from public.campaign_invites
    where code = upper(trim(p_code)) for update;

  if not found then
    return query select null::uuid, false, 'unknown_code'; return;
  end if;
  if v_invite.revoked_at is not null then
    return query select null::uuid, false, 'revoked'; return;
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    return query select null::uuid, false, 'expired'; return;
  end if;

  select archived_at into v_archived from public.campaigns where id = v_invite.campaign_id;
  if v_archived is not null then
    return query select null::uuid, false, 'archived'; return;
  end if;

  if exists (
    select 1 from public.campaign_members
    where campaign_members.campaign_id = v_invite.campaign_id
      and user_id = auth.uid()
  ) then
    return query select v_invite.campaign_id, false, 'already_member'; return;
  end if;

  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    return query select null::uuid, false, 'used_up'; return;
  end if;

  insert into public.campaign_members (campaign_id, user_id, role, invited_by)
  values (v_invite.campaign_id, auth.uid(), v_invite.role, v_invite.created_by);

  update public.campaign_invites
    set use_count = use_count + 1
    where id = v_invite.id;

  return query select v_invite.campaign_id, true, 'ok';
end;
$$;

grant execute on function public.preview_invite(text) to authenticated, anon;
grant execute on function public.redeem_invite(text) to authenticated;

-- ============================================================================
-- SECTION 4 — Campaign content (Phase 1 shapes; features land in Phase 2)
--
-- These two tables are here to pin down the two visibility patterns every
-- future feature will reuse:
--   * characters — owned by a player, shared with the table
--   * notes      — private by default, optionally shared with the DM or table
-- Their columns are intentionally thin (a jsonb blob plus the fields policies
-- need). Phase 2 gives them real structure.
-- ============================================================================

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  -- 'campaign' = the table can see it; 'private' = owner and DMs only.
  visibility text not null default 'campaign',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint characters_visibility_check check (visibility in ('campaign', 'private')),
  -- Part 3 of the isolation invariant: this is what lets other tables point at
  -- a character with a campaign-carrying composite foreign key.
  unique (campaign_id, id)
);

create index if not exists characters_campaign_idx
  on public.characters (campaign_id, owner_id);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Untitled',
  body text not null default '',
  -- 'private'  — author only (the DM cannot read it either)
  -- 'dm'       — author and the DMs
  -- 'campaign' — everyone at the table
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_visibility_check check (visibility in ('private', 'dm', 'campaign')),
  unique (campaign_id, id)
);

create index if not exists notes_campaign_author_idx
  on public.notes (campaign_id, author_id);

drop trigger if exists characters_touch on public.characters;
create trigger characters_touch before update on public.characters
  for each row execute function public.touch_updated_at();

drop trigger if exists notes_touch on public.notes;
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- SECTION 5 — AI conversations
--
-- Threads are campaign-scoped and private to the person who opened them: an
-- assistant conversation is working material, not shared lore. Messages carry
-- campaign_id even though it is derivable from the thread — see part 3 of the
-- invariant. The composite FK below makes a message that belongs to one
-- campaign but hangs off another campaign's thread impossible to insert.
-- ============================================================================

create table if not exists public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'New conversation',
  -- The lens the assistant answers through, which decides how much of the
  -- world it is allowed to see. Never inferred from the prompt.
  perspective text not null default 'player',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_threads_perspective_check check (perspective in ('dm', 'player')),
  unique (campaign_id, id)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  thread_id uuid not null,
  role text not null,
  content text not null,
  -- Token counts, model id, and which context sources were used. Populated by
  -- the ai-chat edge function; useful for cost display and for auditing what
  -- the model was shown.
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_messages_role_check check (role in ('user', 'assistant')),
  constraint ai_messages_thread_fk
    foreign key (campaign_id, thread_id)
    references public.ai_threads (campaign_id, id) on delete cascade
);

create index if not exists ai_messages_thread_idx
  on public.ai_messages (campaign_id, thread_id, created_at);

drop trigger if exists ai_threads_touch on public.ai_threads;
create trigger ai_threads_touch before update on public.ai_threads
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- SECTION 6 — campaign_id is immutable
--
-- Part 4 of the invariant. Nothing may be teleported from one world to
-- another; moving content between campaigns is a copy operation performed by
-- a feature that explicitly re-creates the row, never an UPDATE.
-- ============================================================================

create or replace function public.freeze_campaign_id()
returns trigger
language plpgsql
as $$
begin
  if new.campaign_id is distinct from old.campaign_id then
    raise exception 'campaign_id is immutable on %', tg_table_name;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['characters', 'notes', 'ai_threads', 'ai_messages', 'campaign_invites']
  loop
    execute format('drop trigger if exists freeze_campaign_id on public.%I', t);
    execute format(
      'create trigger freeze_campaign_id before update on public.%I
         for each row execute function public.freeze_campaign_id()', t);
  end loop;
end;
$$;

-- ============================================================================
-- SECTION 7 — Row Level Security
--
-- Enabled on every table. With RLS on and no matching policy, the answer is
-- "no row" — so a table added later without policies fails closed, which is
-- the behaviour we want.
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.campaigns         enable row level security;
alter table public.campaign_members  enable row level security;
alter table public.campaign_invites  enable row level security;
alter table public.characters        enable row level security;
alter table public.notes             enable row level security;
alter table public.ai_threads        enable row level security;
alter table public.ai_messages       enable row level security;

-- --- profiles ---------------------------------------------------------------

drop policy if exists "read own or tablemate profile" on public.profiles;
create policy "read own or tablemate profile"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_campaign_with(id));

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No insert policy: profiles are created by the signup trigger, not clients.
-- No delete policy: deleting an account is an auth-level operation.

-- --- campaigns --------------------------------------------------------------

drop policy if exists "read campaigns you belong to" on public.campaigns;
create policy "read campaigns you belong to"
  on public.campaigns for select to authenticated
  using (public.is_campaign_member(id));

drop policy if exists "create your own campaign" on public.campaigns;
create policy "create your own campaign"
  on public.campaigns for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "dms edit the campaign" on public.campaigns;
create policy "dms edit the campaign"
  on public.campaigns for update to authenticated
  using (public.is_campaign_dm(id))
  with check (public.is_campaign_dm(id));

drop policy if exists "owner deletes the campaign" on public.campaigns;
create policy "owner deletes the campaign"
  on public.campaigns for delete to authenticated
  using (owner_id = auth.uid());

-- --- campaign_members -------------------------------------------------------

drop policy if exists "read the roster of your campaigns" on public.campaign_members;
create policy "read the roster of your campaigns"
  on public.campaign_members for select to authenticated
  using (public.is_campaign_member(campaign_id));

-- Deliberately no INSERT policy. Every join goes through redeem_invite(),
-- which is the audited doorway; a DM adding someone directly would bypass the
-- invite record.

drop policy if exists "dms adjust roles" on public.campaign_members;
create policy "dms adjust roles"
  on public.campaign_members for update to authenticated
  using (public.is_campaign_dm(campaign_id))
  with check (public.is_campaign_dm(campaign_id));

drop policy if exists "leave, or be removed by a dm" on public.campaign_members;
create policy "leave, or be removed by a dm"
  on public.campaign_members for delete to authenticated
  using (user_id = auth.uid() or public.is_campaign_dm(campaign_id));

-- --- campaign_invites -------------------------------------------------------
-- Invitees never SELECT this table; they go through preview_invite/redeem_invite.

drop policy if exists "dms read invites" on public.campaign_invites;
create policy "dms read invites"
  on public.campaign_invites for select to authenticated
  using (public.is_campaign_dm(campaign_id));

drop policy if exists "dms create invites" on public.campaign_invites;
create policy "dms create invites"
  on public.campaign_invites for insert to authenticated
  with check (
    public.is_campaign_dm(campaign_id)
    and created_by = auth.uid()
    -- Only the owner can mint an invite that hands out a DM seat.
    and (role <> 'dm' or public.is_campaign_owner(campaign_id))
  );

drop policy if exists "dms revoke invites" on public.campaign_invites;
create policy "dms revoke invites"
  on public.campaign_invites for update to authenticated
  using (public.is_campaign_dm(campaign_id))
  with check (public.is_campaign_dm(campaign_id));

drop policy if exists "dms delete invites" on public.campaign_invites;
create policy "dms delete invites"
  on public.campaign_invites for delete to authenticated
  using (public.is_campaign_dm(campaign_id));

-- --- characters -------------------------------------------------------------

drop policy if exists "read characters in your campaign" on public.characters;
create policy "read characters in your campaign"
  on public.characters for select to authenticated
  using (
    public.is_campaign_member(campaign_id)
    and (
      owner_id = auth.uid()
      or visibility = 'campaign'
      or public.is_campaign_dm(campaign_id)
    )
  );

drop policy if exists "players create their own characters" on public.characters;
create policy "players create their own characters"
  on public.characters for insert to authenticated
  with check (
    owner_id = auth.uid()
    and public.campaign_role(campaign_id) in ('dm', 'player')
  );

drop policy if exists "owner or dm edits a character" on public.characters;
create policy "owner or dm edits a character"
  on public.characters for update to authenticated
  using (owner_id = auth.uid() or public.is_campaign_dm(campaign_id))
  with check (owner_id = auth.uid() or public.is_campaign_dm(campaign_id));

drop policy if exists "owner or dm deletes a character" on public.characters;
create policy "owner or dm deletes a character"
  on public.characters for delete to authenticated
  using (owner_id = auth.uid() or public.is_campaign_dm(campaign_id));

-- --- notes ------------------------------------------------------------------
-- A private note is private from the DM too. That is the point of the feature.

drop policy if exists "read notes shared with you" on public.notes;
create policy "read notes shared with you"
  on public.notes for select to authenticated
  using (
    public.is_campaign_member(campaign_id)
    and (
      author_id = auth.uid()
      or visibility = 'campaign'
      or (visibility = 'dm' and public.is_campaign_dm(campaign_id))
    )
  );

drop policy if exists "write your own notes" on public.notes;
create policy "write your own notes"
  on public.notes for insert to authenticated
  with check (author_id = auth.uid() and public.is_campaign_member(campaign_id));

drop policy if exists "edit your own notes" on public.notes;
create policy "edit your own notes"
  on public.notes for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "delete your own notes" on public.notes;
create policy "delete your own notes"
  on public.notes for delete to authenticated
  using (author_id = auth.uid());

-- --- ai_threads / ai_messages ----------------------------------------------

drop policy if exists "read your own threads" on public.ai_threads;
create policy "read your own threads"
  on public.ai_threads for select to authenticated
  using (owner_id = auth.uid() and public.is_campaign_member(campaign_id));

drop policy if exists "open your own threads" on public.ai_threads;
create policy "open your own threads"
  on public.ai_threads for insert to authenticated
  with check (
    owner_id = auth.uid()
    and public.is_campaign_member(campaign_id)
    -- You cannot open a DM-perspective thread in a campaign where you are not
    -- a DM. This is the first gate on what the assistant may retrieve.
    and (perspective <> 'dm' or public.is_campaign_dm(campaign_id))
  );

drop policy if exists "rename your own threads" on public.ai_threads;
create policy "rename your own threads"
  on public.ai_threads for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (perspective <> 'dm' or public.is_campaign_dm(campaign_id)));

drop policy if exists "delete your own threads" on public.ai_threads;
create policy "delete your own threads"
  on public.ai_threads for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "read messages in your threads" on public.ai_messages;
create policy "read messages in your threads"
  on public.ai_messages for select to authenticated
  using (
    exists (
      select 1 from public.ai_threads t
      where t.id = ai_messages.thread_id
        and t.campaign_id = ai_messages.campaign_id
        and t.owner_id = auth.uid()
    )
  );

-- Messages are written by the ai-chat edge function (service role), so no
-- client INSERT policy: the transcript is a record of what the model was
-- actually asked and answered, and must not be forgeable from the browser.

-- ============================================================================
-- SECTION 8 — Convenience view
--
-- security_invoker makes the view run under the CALLER's policies rather than
-- the view owner's — without it, a view is a hole straight through RLS.
-- ============================================================================

create or replace view public.my_campaigns
with (security_invoker = true) as
select
  c.id,
  c.name,
  c.tagline,
  c.game_system,
  c.archived_at,
  c.created_at,
  c.updated_at,
  c.owner_id,
  m.role as my_role,
  m.joined_at,
  (select count(*) from public.campaign_members mm where mm.campaign_id = c.id) as member_count
from public.campaigns c
join public.campaign_members m on m.campaign_id = c.id and m.user_id = auth.uid();

grant select on public.my_campaigns to authenticated;

-- ============================================================================
-- SECTION 9 — Hardening
-- ============================================================================

-- Anonymous visitors get nothing but the invite preview (granted above).
revoke all on all tables in schema public from anon;

-- Belt and braces against a future table being added without RLS: this does
-- not enable RLS for you, it just documents the expectation loudly in one
-- place. Run it after any migration; it should return zero rows.
--
--   select tablename from pg_tables
--   where schemaname = 'public'
--     and tablename not in (select tablename from pg_tables t
--       join pg_class c on c.relname = t.tablename where c.relrowsecurity);
