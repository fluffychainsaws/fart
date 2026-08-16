// The permission model, in one place.
//
// IMPORTANT: this file does not enforce anything. Postgres does, in
// supabase/schema.sql. What lives here is the *mirror* of those policies, used
// to decide which buttons to render — so a player never sees an "Invite" button
// that the database would reject anyway.
//
// The rule for keeping the two honest: every capability below names the policy
// that backs it. If you add a capability with no server-side counterpart, you
// have added a UI affordance for an operation the database will refuse, which
// is a bug, not a feature.

export const ROLES = ['dm', 'player', 'observer'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  dm: 'Dungeon Master',
  player: 'Player',
  observer: 'Observer',
};

export const ROLE_BLURBS: Record<Role, string> = {
  dm: 'Runs the game. Sees everything, invites people, manages the table.',
  player: 'Plays a character, keeps private notes, sees shared lore.',
  observer: 'Reads shared material. Cannot create characters or post.',
};

export type Capability =
  | 'campaign.edit'
  | 'campaign.archive'
  | 'campaign.delete'
  | 'campaign.transfer'
  | 'members.manageRoles'
  | 'members.remove'
  | 'members.leave'
  | 'invites.view'
  | 'invites.create'
  | 'invites.createDm'
  | 'invites.revoke'
  | 'characters.create'
  | 'characters.editAny'
  | 'notes.create'
  | 'lore.viewDmOnly'
  | 'ai.dmPerspective';

type Rule = {
  /** Roles allowed to do this. */
  roles: readonly Role[];
  /** When true, being in an allowed role is not enough — you must own the campaign. */
  ownerOnly?: boolean;
  /** The database policy or trigger that actually enforces it. */
  enforcedBy: string;
};

const RULES: Record<Capability, Rule> = {
  'campaign.edit': { roles: ['dm'], enforcedBy: 'policy "dms edit the campaign"' },
  'campaign.archive': { roles: ['dm'], enforcedBy: 'policy "dms edit the campaign"' },
  'campaign.delete': {
    roles: ['dm'],
    ownerOnly: true,
    enforcedBy: 'policy "owner deletes the campaign"',
  },
  'campaign.transfer': {
    roles: ['dm'],
    ownerOnly: true,
    enforcedBy: 'trigger guard_campaign_update()',
  },
  'members.manageRoles': { roles: ['dm'], enforcedBy: 'policy "dms adjust roles"' },
  'members.remove': { roles: ['dm'], enforcedBy: 'policy "leave, or be removed by a dm"' },
  'members.leave': {
    roles: ['dm', 'player', 'observer'],
    enforcedBy: 'policy "leave, or be removed by a dm" + trigger guard_member_update()',
  },
  'invites.view': { roles: ['dm'], enforcedBy: 'policy "dms read invites"' },
  'invites.create': { roles: ['dm'], enforcedBy: 'policy "dms create invites"' },
  'invites.createDm': {
    roles: ['dm'],
    ownerOnly: true,
    enforcedBy: 'policy "dms create invites" (role <> dm or is_campaign_owner)',
  },
  'invites.revoke': { roles: ['dm'], enforcedBy: 'policy "dms revoke invites"' },
  'characters.create': {
    roles: ['dm', 'player'],
    enforcedBy: 'policy "players create their own characters"',
  },
  'characters.editAny': { roles: ['dm'], enforcedBy: 'policy "owner or dm edits a character"' },
  'notes.create': { roles: ['dm', 'player', 'observer'], enforcedBy: 'policy "write your own notes"' },
  'lore.viewDmOnly': { roles: ['dm'], enforcedBy: 'visibility predicates in read policies' },
  'ai.dmPerspective': { roles: ['dm'], enforcedBy: 'policy "open your own threads"' },
};

/** Who the caller is, within one campaign. Never spans campaigns. */
export type Viewer = {
  role: Role;
  isOwner: boolean;
};

export function can(viewer: Viewer | null | undefined, capability: Capability): boolean {
  if (!viewer) return false;
  const rule = RULES[capability];
  if (!rule.roles.includes(viewer.role)) return false;
  if (rule.ownerOnly && !viewer.isOwner) return false;
  return true;
}

/** For the settings screen: "why can't I do this?" without guessing. */
export function enforcedBy(capability: Capability): string {
  return RULES[capability].enforcedBy;
}

/** Roles a DM may assign. Handing out a DM seat is owner-only, so it is not here. */
export const ASSIGNABLE_ROLES: readonly Role[] = ['player', 'observer'];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
