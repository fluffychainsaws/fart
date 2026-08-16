// React Query cache keys.
//
// Campaign isolation has a client-side half that has nothing to do with
// security and everything to do with not showing someone the wrong world: two
// campaigns must never share a cache entry. Every campaign-scoped key therefore
// begins ['campaign', campaignId, ...]. Switching campaigns cannot collide,
// and dropping a campaign's cache is one call.
//
// Building keys by hand anywhere else is how a shared key sneaks in, so this
// module is the only place that constructs them.

export const keys = {
  session: () => ['session'] as const,
  myProfile: () => ['profile', 'me'] as const,
  myCampaigns: () => ['campaigns', 'mine'] as const,

  /** Root of everything belonging to one campaign. Also the invalidation handle. */
  campaign: (campaignId: string) => ['campaign', campaignId] as const,
  campaignDetail: (campaignId: string) => ['campaign', campaignId, 'detail'] as const,
  members: (campaignId: string) => ['campaign', campaignId, 'members'] as const,
  invites: (campaignId: string) => ['campaign', campaignId, 'invites'] as const,
  characters: (campaignId: string) => ['campaign', campaignId, 'characters'] as const,
  notes: (campaignId: string) => ['campaign', campaignId, 'notes'] as const,
  aiThreads: (campaignId: string) => ['campaign', campaignId, 'ai', 'threads'] as const,

  /** Invite previews are keyed by code, not campaign — you are not a member yet. */
  invitePreview: (code: string) => ['invite-preview', code] as const,
} as const;

/** True when a key belongs to the given campaign. Used when clearing on switch. */
export function belongsToCampaign(key: readonly unknown[], campaignId: string): boolean {
  return key[0] === 'campaign' && key[1] === campaignId;
}
