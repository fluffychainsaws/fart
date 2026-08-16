import { supabase, readableError } from '@/lib/supabase';
import { assertCampaignId } from './scoped';
import type { Member } from '@/domain/types';
import type { Role } from '@/domain/roles';

function fail(error: unknown): never {
  throw new Error(readableError(error));
}

export async function listMembers(campaignId: string): Promise<Member[]> {
  assertCampaignId(campaignId);
  const { data, error } = await supabase
    .from('campaign_members')
    .select('campaign_id, user_id, role, joined_at, profile:profiles!campaign_members_user_id_fkey(display_name, avatar_url)')
    .eq('campaign_id', campaignId)
    .order('joined_at', { ascending: true });
  if (error) fail(error);
  return (data ?? []) as unknown as Member[];
}

/**
 * DMs only, and never on yourself or the owner — both refused by
 * guard_member_update(). Promoting someone to DM is owner-only and goes through
 * a DM invite instead, so `role` here is a player/observer swap.
 */
export async function setMemberRole(campaignId: string, userId: string, role: Role): Promise<void> {
  assertCampaignId(campaignId);
  const { error } = await supabase
    .from('campaign_members')
    .update({ role })
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);
  if (error) fail(error);
}

/** Removing someone else needs DM; removing yourself is leaving. Same statement. */
export async function removeMember(campaignId: string, userId: string): Promise<void> {
  assertCampaignId(campaignId);
  const { error } = await supabase
    .from('campaign_members')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);
  if (error) fail(error);
}
