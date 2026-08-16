#!/usr/bin/env node
// Campaign isolation, checked mechanically.
//
// Two rules, both about keeping one campaign's data out of another's:
//
//   1. Only src/data/ and src/lib/supabase.ts may touch the Supabase client.
//      A component that queries directly is a component that can forget to
//      scope its query, and it puts the scoping rule somewhere nobody looks.
//
//   2. Inside src/data/, any statement touching a campaign-scoped table must
//      mention campaign_id. Row Level Security would refuse the cross-campaign
//      read anyway; this catches the more common bug, which is a query that
//      quietly returns nothing because it was never scoped in the first place.
//
// Run with `npm run check:isolation`. It is part of `npm run verify`.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'src');

// Kept in step with src/data/scoped.ts, which is the list the app itself uses.
const scopedSource = readFileSync(join(srcDir, 'data', 'scoped.ts'), 'utf8');
const scopedTables = [...scopedSource.matchAll(/^\s*'([a-z_]+)',$/gm)].map((m) => m[1]);

if (scopedTables.length === 0) {
  console.error('check-isolation: could not read CAMPAIGN_SCOPED_TABLES from src/data/scoped.ts');
  process.exit(1);
}

const ALLOWED_CLIENT_IMPORTERS = [
  join('src', 'data'),
  join('src', 'auth'),
  join('src', 'lib', 'supabase.ts'),
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const problems = [];

for (const file of walk(srcDir)) {
  const rel = relative(root, file);
  const text = readFileSync(file, 'utf8');

  // Rule 1 — who may hold the client.
  const usesClient = /\bsupabase\s*\.\s*(from|rpc|storage|functions)\s*\(/.test(text);
  if (usesClient && !ALLOWED_CLIENT_IMPORTERS.some((prefix) => rel.startsWith(prefix + sep) || rel === prefix)) {
    problems.push(`${rel}: queries Supabase directly. Move the call into src/data/.`);
  }

  // Rule 2 — scoped tables must be filtered by campaign_id.
  for (const match of text.matchAll(/\.from\(\s*'([a-z_]+)'\s*\)/g)) {
    const table = match[1];
    if (!scopedTables.includes(table)) continue;

    // The statement runs from the `.from(` to the end of the awaited
    // expression; a semicolon at depth zero is a good enough terminator for
    // the chained style used throughout src/data/.
    const rest = text.slice(match.index);
    const end = rest.indexOf(';');
    const statement = end === -1 ? rest : rest.slice(0, end);

    if (!statement.includes('campaign_id')) {
      const line = text.slice(0, match.index).split('\n').length;
      problems.push(
        `${rel}:${line}: query on '${table}' has no campaign_id filter. ` +
          `Every campaign-scoped query must be scoped to exactly one campaign.`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error('\nCampaign isolation check failed:\n');
  for (const problem of problems) console.error('  ✗ ' + problem);
  console.error('\nSee docs/ARCHITECTURE.md, "Campaign isolation".\n');
  process.exit(1);
}

console.log(`✓ campaign isolation: ${scopedTables.length} scoped tables, no unscoped queries`);
