-- FART accounts schema. Paste this whole file into the Supabase dashboard
-- SQL Editor (or run `supabase db push`) once, right after creating the
-- project. Safe to re-run.
--
-- Passwords never appear here: Supabase Auth stores only bcrypt hashes in
-- its own private auth.users table. This schema is the app-facing data.

-- One row per user, created automatically on signup. The tier lives here so
-- the server — not device storage — is the source of truth for what a user
-- has paid for.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  tier text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tier names must match the app's Tier type (src/lib/subscription.ts).
-- Constraint managed by name so re-running this file updates it in place.
alter table public.profiles drop constraint if exists profiles_tier_check;
alter table public.profiles
  add constraint profiles_tier_check check (tier in ('free', 'fart', 'fartpro', 'shartstar'));

-- Row Level Security: without a matching policy, nobody can touch a row.
-- These policies mean a signed-in user can only ever see and edit their own
-- profile — enforced by Postgres itself, no matter what the client sends.
alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and tier = (select tier from public.profiles where id = auth.uid()));
-- Note the check: users can update their profile but NOT their own tier —
-- tier changes must come from the server (billing webhook / dashboard),
-- otherwise anyone could grant themselves SHART STAR from the console.

-- Auto-create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Synced scripts: one JSONB row per script per user. The whole script (title,
-- elements, voice picks, director notes) lives in `data`, so the script shape
-- can evolve in the app without database migrations.
create table if not exists public.scripts (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at bigint not null, -- ms since epoch, same clock the app uses
  primary key (user_id, id)
);

alter table public.scripts enable row level security;

drop policy if exists "read own scripts" on public.scripts;
create policy "read own scripts"
  on public.scripts for select
  using (auth.uid() = user_id);

drop policy if exists "insert own scripts" on public.scripts;
create policy "insert own scripts"
  on public.scripts for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own scripts" on public.scripts;
create policy "update own scripts"
  on public.scripts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own scripts" on public.scripts;
create policy "delete own scripts"
  on public.scripts for delete
  using (auth.uid() = user_id);

-- Profile photo, synced across devices. Stored as a data URI (not Storage
-- bucket + file) to match the rest of this schema's "just a column" approach
-- — photos here are small (picked at quality 0.5, cropped square). Merge is
-- last-write-wins via photo_updated_at, same idea as scripts' updated_at.
alter table public.profiles add column if not exists photo_url text;
alter table public.profiles add column if not exists photo_updated_at bigint not null default 0;

-- Audition Credit: a one-time $3.99 purchase grants one permanent credit
-- (never expires), spent one-per-script to give that script SHART STAR-level
-- features (see the 'daypass' pseudo-tier in src/lib/subscription.ts). Unlike
-- tier changes, crediting isn't naturally idempotent — a duplicate webhook
-- delivery for the same Stripe checkout session must not grant twice, hence
-- day_pass_purchases as a dedupe ledger keyed by the session id.
alter table public.profiles add column if not exists premium_credits integer not null default 0;

create table if not exists public.day_pass_purchases (
  session_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.day_pass_purchases enable row level security;
-- No client policies: only the webhook (service role, which bypasses RLS)
-- and the dashboard ever touch this table.

-- Atomically spends one credit for the calling user, in a single UPDATE so
-- concurrent spends can't both succeed against the same last credit. Returns
-- whether a credit was actually available and spent.
create or replace function public.spend_premium_credit()
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  updated_rows integer;
begin
  update public.profiles set premium_credits = premium_credits - 1
  where id = auth.uid() and premium_credits > 0;
  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

grant execute on function public.spend_premium_credit() to authenticated;

-- Called only by the stripe-webhook edge function (service role) after it
-- inserts into day_pass_purchases — that insert is what makes granting
-- idempotent against Stripe's at-least-once webhook delivery, so this
-- function itself doesn't need to re-check anything.
create or replace function public.increment_premium_credits(p_user_id uuid, p_amount integer)
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles set premium_credits = premium_credits + p_amount where id = p_user_id;
$$;

grant execute on function public.increment_premium_credits(uuid, integer) to service_role;

-- Server-enforced monthly audition quota. The count lives HERE, not in device
-- storage, so it can't be reset by clearing the browser / going incognito, and
-- can't be faked by a modified client. The parse-script edge function is the
-- sole caller: it consumes one per upload before spending any Claude money,
-- refunds on parse failure, and rejects once the tier's monthly limit is hit.
-- auditions_month rolls the counter over at the start of each month ('YYYY-MM',
-- UTC — matches the edge function's clock).
alter table public.profiles add column if not exists auditions_month text;
alter table public.profiles add column if not exists auditions_used integer not null default 0;

-- Atomically consume one audition if under p_limit, resetting the counter when
-- the stored month differs from p_month. The two updates run in one function
-- call (one transaction), and Postgres row-locks serialize concurrent calls for
-- the same user, so a burst of requests can't race past the limit. Returns
-- whether an audition was available and consumed. service_role only — the
-- client can never call this to grant itself auditions (or pass a fake limit).
create or replace function public.consume_audition(p_user_id uuid, p_month text, p_limit integer)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  updated_rows integer;
begin
  update public.profiles
    set auditions_month = p_month, auditions_used = 0
    where id = p_user_id and auditions_month is distinct from p_month;
  update public.profiles
    set auditions_used = auditions_used + 1
    where id = p_user_id and auditions_used < p_limit;
  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

grant execute on function public.consume_audition(uuid, text, integer) to service_role;

-- Give an audition back when the parse fails after it was consumed, so a failed
-- upload doesn't burn the user's quota (mirrors the credit refund).
create or replace function public.refund_audition(p_user_id uuid, p_month text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
    set auditions_used = greatest(0, auditions_used - 1)
    where id = p_user_id and auditions_month = p_month and auditions_used > 0;
end;
$$;

grant execute on function public.refund_audition(uuid, text) to service_role;

-- Service-role twin of spend_premium_credit() for the edge function, which has
-- no auth.uid(). Same atomic decrement-if-available.
create or replace function public.spend_premium_credit_for(p_user_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  updated_rows integer;
begin
  update public.profiles set premium_credits = premium_credits - 1
    where id = p_user_id and premium_credits > 0;
  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

grant execute on function public.spend_premium_credit_for(uuid) to service_role;

-- Owner/admin flag. Flip it on your own row once, in Table Editor:
-- profiles -> your row -> is_admin = true. Nobody can set it from the app
-- (the update policy already blocks profile edits beyond what it allows,
-- and this column is only readable via the RLS-scoped own-row select).
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Usage telemetry for the monthly cost analysis: one row per billable-ish
-- event. 'tts' rows carry the synthesized character count (the thing OpenAI
-- charges for); 'audition' rows mark a completed self-tape.
create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('tts', 'audition')),
  chars integer not null default 0,
  voice text,
  created_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;

drop policy if exists "insert own usage" on public.usage_events;
create policy "insert own usage"
  on public.usage_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "read own usage" on public.usage_events;
create policy "read own usage"
  on public.usage_events for select
  using (auth.uid() = user_id);

-- Monthly per-tier rollup for the admin dashboard. SECURITY DEFINER so it
-- can aggregate across all users, but it refuses anyone whose profile isn't
-- flagged is_admin. Tier attribution uses each user's CURRENT tier.
create or replace function public.admin_usage_summary(month_arg text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  m text := coalesce(month_arg, to_char(now(), 'YYYY-MM'));
  result jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  select jsonb_agg(t) into result from (
    select
      p.tier,
      count(distinct p.id) as users,
      count(e.id) filter (where e.kind = 'audition') as auditions,
      coalesce(sum(e.chars) filter (where e.kind = 'tts'), 0) as tts_chars,
      count(distinct e.user_id) as active_users
    from profiles p
    left join usage_events e
      on e.user_id = p.id and to_char(e.created_at, 'YYYY-MM') = m
    group by p.tier
  ) t;
  return coalesce(result, '[]'::jsonb);
end;
$$;

-- Voice popularity for the /admin "Top voices" panel. Same admin gate as
-- admin_usage_summary. Counts one row per paid synthesis (cache misses only,
-- since cached replays don't re-log) — a good signal for which voices users
-- actually pick, biased by caching rather than total playback. The 'voice'
-- values are the internal slot ids (alloy, coral, …); the app maps them to
-- display names (see VOICE_LABELS in src/lib/cloudVoice.ts).
create or replace function public.admin_voice_usage(month_arg text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  m text := coalesce(month_arg, to_char(now(), 'YYYY-MM'));
  result jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  select jsonb_agg(t) into result from (
    select
      e.voice,
      count(*) as uses,
      coalesce(sum(e.chars), 0) as chars
    from usage_events e
    where e.kind = 'tts' and e.voice is not null
      and to_char(e.created_at, 'YYYY-MM') = m
    group by e.voice
    order by uses desc
  ) t;
  return coalesce(result, '[]'::jsonb);
end;
$$;

grant execute on function public.admin_voice_usage(text) to authenticated;
