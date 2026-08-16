import { supabase, readableError } from '@/lib/supabase';
import { assertCampaignId } from './scoped';
import type { Invite, InvitePreview, RedeemResult } from '@/domain/types';
import type { Role } from '@/domain/roles';

function fail(error: unknown): never {
  throw new Error(readableError(error));
}

export async function listInvites(campaignId: string): Promise<Invite[]> {
  assertCampaignId(campaignId);
  const { data, error } = await supabase
    .from('campaign_invites')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as Invite[];
}

export type NewInvite = {
  role: Role;
  label?: string;
  maxUses?: number | null;
  expiresInDays?: number | null;
};

export async function createInvite(
  campaignId: string,
  createdBy: string,
  input: NewInvite,
): Promise<Invite> {
  assertCampaignId(campaignId);
  const expiresAt =
    input.expiresInDays != null
      ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
      : null;

  // `code` is omitted on purpose: the column defaults to
  // generate_invite_code(), so the code is minted server-side and a client
  // cannot choose a guessable one.
  const { data, error } = await supabase
    .from('campaign_invites')
    .insert({
      campaign_id: campaignId,
      created_by: createdBy,
      role: input.role,
      label: input.label?.trim() || null,
      max_uses: input.maxUses ?? null,
      expires_at: expiresAt,
    })
    .select('*')
    .single();
  if (error) fail(error);
  return data as Invite;
}

export async function revokeInvite(campaignId: string, inviteId: string): Promise<void> {
  assertCampaignId(campaignId);
  const { error } = await supabase
    .from('campaign_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('campaign_id', campaignId)
    .eq('id', inviteId);
  if (error) fail(error);
}

/**
 * What an invite code points at, for someone who is not a member yet and so
 * cannot read the campaign at all. The RPC is SECURITY DEFINER and returns
 * only a campaign name, the offered role, and who invited you.
 */
export async function previewInvite(code: string): Promise<InvitePreview> {
  const { data, error } = await supabase.rpc('preview_invite', { p_code: code });
  if (error) fail(error);
  const row = (data as InvitePreview[] | null)?.[0];
  return (
    row ?? { campaign_name: null, invited_role: null, invited_by: null, is_valid: false, reason: 'unknown_code' }
  );
}

export async function redeemInvite(code: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_invite', { p_code: code });
  if (error) fail(error);
  const row = (data as RedeemResult[] | null)?.[0];
  return row ?? { campaign_id: null, joined: false, reason: 'unknown_code' };
}

export function inviteUrl(code: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/join/${code}`;
}

export function inviteState(invite: Invite): 'active' | 'revoked' | 'expired' | 'used_up' {
  if (invite.revoked_at) return 'revoked';
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return 'expired';
  if (invite.max_uses != null && invite.use_count >= invite.max_uses) return 'used_up';
  return 'active';
}
