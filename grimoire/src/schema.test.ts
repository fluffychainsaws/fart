import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CAMPAIGN_SCOPED_TABLES } from './data/scoped';

// The schema is the actual security boundary, so it gets tests too. These read
// the SQL as text rather than running Postgres: they cannot prove a policy is
// correct, but they do catch the failure that matters most — a table added
// later without RLS, or without the campaign_id that every policy depends on.
//
// Phase 2 should add real policy tests (pgTAP, or a seeded database and two
// signed-in clients). Until then these are the guardrail.

const sql = readFileSync(fileURLToPath(new URL('../supabase/schema.sql', import.meta.url)), 'utf8');

const createdTables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]!);

describe('supabase/schema.sql', () => {
  it('creates the tables Phase 1 needs', () => {
    expect(createdTables).toEqual(
      expect.arrayContaining([
        'profiles',
        'campaigns',
        'campaign_members',
        'campaign_invites',
        'characters',
        'notes',
        'ai_threads',
        'ai_messages',
      ]),
    );
  });

  it('enables row level security on every table it creates', () => {
    const missing = createdTables.filter(
      (table) => !new RegExp(`alter table public\\.${table}\\s+enable row level security`).test(sql),
    );
    expect(missing).toEqual([]);
  });

  it('gives every campaign-scoped table a non-null campaign_id', () => {
    for (const table of CAMPAIGN_SCOPED_TABLES) {
      const body = tableBody(table);
      expect(body, `${table} is not created in schema.sql`).toBeTruthy();
      expect(body, `${table} is missing a not-null campaign_id`).toMatch(
        /campaign_id uuid not null/,
      );
    }
  });

  it('freezes campaign_id so a row cannot change worlds', () => {
    for (const table of CAMPAIGN_SCOPED_TABLES) {
      if (table === 'campaign_members') continue; // guarded by guard_member_update instead
      expect(sql).toMatch(new RegExp(`'${table}'`));
    }
    expect(sql).toMatch(/create or replace function public\.freeze_campaign_id/);
  });

  it('runs the my_campaigns view as the caller, not as its owner', () => {
    // A view without security_invoker executes with the definer's rights and
    // would hand every campaign to everyone.
    expect(sql).toMatch(/create or replace view public\.my_campaigns\s+with \(security_invoker = true\)/);
  });

  it('routes joining through redeem_invite rather than a client insert', () => {
    expect(sql).toMatch(/create or replace function public\.redeem_invite/);
    expect(sql).not.toMatch(/create policy "[^"]*" on public\.campaign_members for insert/);
  });
});

function tableBody(table: string): string | null {
  const start = sql.indexOf(`create table if not exists public.${table} (`);
  if (start === -1) return null;
  const end = sql.indexOf('\n);', start);
  return sql.slice(start, end === -1 ? undefined : end);
}
