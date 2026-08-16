import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { useAuth, useMyName } from '@/auth/AuthProvider';
import { listMyCampaigns } from '@/data/campaigns';
import { keys } from '@/data/keys';
import { ROLE_LABELS } from '@/domain/roles';
import { Button, Card, EmptyState, Loading, Notice, RoleBadge } from '@/ui/kit';

// The one screen that spans campaigns — a lobby, not a world. It shows names
// and roles only; no campaign content is ever fetched here, so there is nothing
// on this page that could bleed from one world into another.

export default function CampaignsHub() {
  const name = useMyName();
  const { signOut } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: keys.myCampaigns(),
    queryFn: listMyCampaigns,
  });

  const campaigns = data ?? [];
  const active = campaigns.filter((c) => !c.archived_at);
  const archived = campaigns.filter((c) => c.archived_at);

  return (
    <div className="page stack">
      <div className="page-head">
        <div className="stack-tight">
          <div className="row">
            <span className="brand-mark">G</span>
            <span className="brand">Grimoire</span>
          </div>
          <p className="muted">Welcome back, {name}.</p>
        </div>
        <div className="row">
          <Link to="/account">
            <Button variant="ghost" size="sm">
              Account
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>

      <div className="row wrap">
        <Link to="/campaigns/new">
          <Button variant="primary">Start a campaign</Button>
        </Link>
        <Link to="/join">
          <Button variant="secondary">Join with a code</Button>
        </Link>
      </div>

      {error && <Notice tone="error">{(error as Error).message}</Notice>}
      {isLoading && <Loading label="Gathering your campaigns…" />}

      {!isLoading && campaigns.length === 0 && (
        <EmptyState title="No campaigns yet">
          Start one as the DM, or join a friend's table with the code they sent you.
        </EmptyState>
      )}

      {active.length > 0 && (
        <section className="stack">
          <h2>Your campaigns</h2>
          <div className="card-list">
            {active.map((campaign) => (
              <Link key={campaign.id} to={`/c/${campaign.id}`} className="card card-link">
                <div className="row-between">
                  <div className="stack-tight">
                    <h3>{campaign.name}</h3>
                    <span className="small muted">
                      {campaign.tagline || `${ROLE_LABELS[campaign.my_role]} · ${campaign.member_count} at the table`}
                    </span>
                  </div>
                  <RoleBadge role={campaign.my_role} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {archived.length > 0 && (
        <section className="stack">
          <h2 className="muted">Archived</h2>
          <div className="card-list">
            {archived.map((campaign) => (
              <Link key={campaign.id} to={`/c/${campaign.id}`} className="card card-link">
                <div className="row-between">
                  <span className="muted">{campaign.name}</span>
                  <RoleBadge role={campaign.my_role} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Card>
        <div className="stack-tight">
          <h3>Phase 1</h3>
          <p className="small muted">
            Accounts, campaigns, invitations and permissions are live. Characters, notes, journals
            and the AI assistant are scaffolded but not built yet — see docs/ROADMAP.md.
          </p>
        </div>
      </Card>
    </div>
  );
}
