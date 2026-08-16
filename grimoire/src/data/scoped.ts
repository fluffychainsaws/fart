// Campaign scoping, made mechanical.
//
// Every table listed here carries a campaign_id, and every query against one of
// them must filter on it. That is checked two ways:
//   * at runtime, by assertCampaignId(), which refuses a missing or malformed id
//     rather than letting an unfiltered query through;
//   * at build time, by scripts/check-isolation.mjs, which reads this list and
//     fails if any query in src/data/ touches one of these tables without
//     mentioning campaign_id.
//
// The database would refuse the cross-campaign read anyway. This layer exists
// so the mistake is caught in CI instead of silently returning an empty list
// that a screen then renders as "no notes yet".

export const CAMPAIGN_SCOPED_TABLES = [
  'campaign_members',
  'campaign_invites',
  'characters',
  'notes',
  'ai_threads',
  'ai_messages',
] as const;

export type CampaignScopedTable = (typeof CAMPAIGN_SCOPED_TABLES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards the seam where a campaign id arrives from a URL parameter. A route
 * like /c/:campaignId hands us a string of unknown provenance; if it is empty
 * or junk we want a loud failure here, not a query whose filter silently
 * matched nothing.
 */
export function assertCampaignId(campaignId: string | undefined | null): asserts campaignId is string {
  if (!campaignId || !UUID.test(campaignId)) {
    throw new Error(`Refusing to run a campaign query without a valid campaign id (got: ${String(campaignId)})`);
  }
}
