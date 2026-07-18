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
