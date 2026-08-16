import { supabase, readableError } from '@/lib/supabase';
import type { Campaign, CampaignSummary } from '@/domain/types';

// Campaigns are the only table addressed by their own id rather than by
// campaign_id — a campaign is the scope, so it cannot be inside one. Every read
// here is still membership-gated by the "read campaigns you belong to" policy.

function fail(error: unknown): never {
  throw new Error(readableError(error));
}

/** Every campaign the signed-in user belongs to, with their role in each. */
export async function listMyCampaigns(): Promise<CampaignSummary[]> {
  const { data, error } = await supabase
    .from('my_campaigns')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as CampaignSummary[];
}

export async function getCampaign(campaignId: string): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
  if (error) fail(error);
  return data as Campaign;
}

export type NewCampaign = {
  name: string;
  tagline?: string;
  description?: string;
  game_system?: string;
};

/**
 * Creating a campaign also enrolls the creator as its DM — but that half
 * happens in the database (trigger on_campaign_created), inside the same
 * transaction as the insert. Doing it here as a second request would leave a
 * campaign nobody can read if the second request failed.
 */
export async function createCampaign(ownerId: string, input: NewCampaign): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      owner_id: ownerId,
      name: input.name.trim(),
      tagline: input.tagline?.trim() || null,
      description: input.description?.trim() || null,
      game_system: input.game_system ?? 'dnd5e',
    })
    .select('*')
    .single();
  if (error) fail(error);
  return data as Campaign;
}

export async function updateCampaign(
  campaignId: string,
  patch: Partial<Pick<Campaign, 'name' | 'tagline' | 'description' | 'game_system' | 'settings'>>,
): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .update(patch)
    .eq('id', campaignId)
    .select('*')
    .single();
  if (error) fail(error);
  return data as Campaign;
}

export async function setArchived(campaignId: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('campaigns')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', campaignId);
  if (error) fail(error);
}

/** Owner only, and irreversible: every row in the campaign cascades away. */
export async function deleteCampaign(campaignId: string): Promise<void> {
  const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
  if (error) fail(error);
}

/** Owner only. The new owner must already be a DM (enforced by trigger). */
export async function transferOwnership(campaignId: string, newOwnerId: string): Promise<void> {
  const { error } = await supabase
    .from('campaigns')
    .update({ owner_id: newOwnerId })
    .eq('id', campaignId);
  if (error) fail(error);
}
