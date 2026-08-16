import type { Role } from './roles';

// Row shapes as the app consumes them. These mirror supabase/schema.sql by
// hand; Phase 2 should generate them with `supabase gen types typescript` and
// delete the duplication.

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Campaign = {
  id: string;
  owner_id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  game_system: string;
  settings: Record<string, unknown>;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/** A row of the my_campaigns view: a campaign plus the viewer's place in it. */
export type CampaignSummary = {
  id: string;
  name: string;
  tagline: string | null;
  game_system: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string;
  my_role: Role;
  joined_at: string;
  member_count: number;
};

export type Member = {
  campaign_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  profile: Pick<Profile, 'display_name' | 'avatar_url'> | null;
};

export type Invite = {
  id: string;
  campaign_id: string;
  code: string;
  role: Role;
  created_by: string;
  label: string | null;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type InvitePreview = {
  campaign_name: string | null;
  invited_role: Role | null;
  invited_by: string | null;
  is_valid: boolean;
  reason:
    | 'ok'
    | 'unknown_code'
    | 'revoked'
    | 'expired'
    | 'used_up'
    | 'archived';
};

export type RedeemResult = {
  campaign_id: string | null;
  joined: boolean;
  reason: 'ok' | 'already_member' | 'unknown_code' | 'revoked' | 'expired' | 'used_up' | 'archived' | 'not_signed_in';
};

export const GAME_SYSTEMS = [
  { id: 'dnd5e', label: 'D&D 5th Edition' },
  { id: 'dnd2024', label: 'D&D 2024 rules' },
  { id: 'other', label: 'Something else' },
] as const;
