import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';
import { getCampaign } from '@/data/campaigns';
import { listMembers } from '@/data/members';
import { keys } from '@/data/keys';
import { can, type Capability, type Role, type Viewer } from '@/domain/roles';
import type { Campaign, Member } from '@/domain/types';
import { Loading, Notice, Button } from '@/ui/kit';

// One campaign, and the viewer's authority inside it.
//
// This provider is the client-side edge of the isolation boundary. Below it,
// every screen reads the campaign id from context rather than from a prop, a
// module variable, or a second copy of the URL — so there is exactly one answer
// to "which world am I in?" at any moment, and it comes from the route.
//
// It is not a security control. A user who edits the URL to a campaign they do
// not belong to gets no rows back from Postgres, which is why the "not found"
// and "no access" cases below are the same screen: the app genuinely cannot
// tell them apart, and that is the correct amount of information to leak.

type CampaignValue = {
  campaignId: string;
  campaign: Campaign;
  members: Member[];
  viewer: Viewer;
  /** Mirror of the database policies — for rendering, never for enforcing. */
  can: (capability: Capability) => boolean;
};

const CampaignContext = createContext<CampaignValue | null>(null);

export function CampaignProvider({ children }: { children: ReactNode }) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Drop every other campaign's cached data on entry. React Query keys are
  // already namespaced per campaign, so this is not what prevents a mix-up —
  // it removes the possibility of one surviving in memory at all. The cost is
  // a refetch when hopping between campaigns, which is the right trade for a
  // guarantee this load-bearing.
  useEffect(() => {
    if (!campaignId) return;
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] === 'campaign' && query.queryKey[1] !== campaignId,
    });
  }, [campaignId, queryClient]);

  const campaignQuery = useQuery({
    queryKey: campaignId ? keys.campaignDetail(campaignId) : ['campaign', 'none'],
    queryFn: () => getCampaign(campaignId!),
    enabled: Boolean(campaignId),
    retry: false,
  });

  const membersQuery = useQuery({
    queryKey: campaignId ? keys.members(campaignId) : ['campaign', 'none', 'members'],
    queryFn: () => listMembers(campaignId!),
    enabled: Boolean(campaignId) && campaignQuery.isSuccess,
    retry: false,
  });

  const campaign = campaignQuery.data;
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);

  const viewer = useMemo<Viewer | null>(() => {
    if (!campaign || !user) return null;
    const mine = members.find((m) => m.user_id === user.id);
    if (!mine) return null;
    return { role: mine.role as Role, isOwner: campaign.owner_id === user.id };
  }, [campaign, members, user]);

  const value = useMemo<CampaignValue | null>(() => {
    if (!campaignId || !campaign || !viewer) return null;
    return {
      campaignId,
      campaign,
      members,
      viewer,
      can: (capability: Capability) => can(viewer, capability),
    };
  }, [campaignId, campaign, members, viewer]);

  if (campaignQuery.isLoading || (campaignQuery.isSuccess && membersQuery.isLoading)) {
    return <Loading label="Opening the campaign…" />;
  }

  if (campaignQuery.isError || !campaign || !viewer) {
    return (
      <div className="page stack">
        <h1>Campaign not found</h1>
        <Notice tone="error">
          This campaign does not exist, or you are not a member of it. If someone meant to invite
          you, ask them for a fresh invite link.
        </Notice>
        <div>
          <Link to="/campaigns">
            <Button variant="secondary">Back to your campaigns</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <CampaignContext.Provider value={value!}>{children}</CampaignContext.Provider>;
}

export function useCampaign(): CampaignValue {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error('useCampaign must be used inside <CampaignProvider>');
  return ctx;
}

/** Convenience for the common `can('invites.create') && <Button/>` shape. */
export function useCan(capability: Capability): boolean {
  return useCampaign().can(capability);
}

/** Renders children only when the viewer holds the capability. */
export function Gate({ capability, children }: { capability: Capability; children: ReactNode }) {
  return useCan(capability) ? <>{children}</> : null;
}
