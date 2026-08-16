import { Link } from 'react-router';

import { useCampaign } from '@/campaign/CampaignProvider';
import { GAME_SYSTEMS } from '@/domain/types';
import { Avatar, Badge, Button, Card, RoleBadge } from '@/ui/kit';

export default function Overview() {
  const { campaign, members, viewer, can } = useCampaign();
  const system = GAME_SYSTEMS.find((s) => s.id === campaign.game_system)?.label ?? campaign.game_system;
  const dms = members.filter((m) => m.role === 'dm');

  return (
    <div className="page stack">
      <div className="page-head">
        <div className="stack-tight">
          <h1>{campaign.name}</h1>
          {campaign.tagline && <p className="muted">{campaign.tagline}</p>}
          <div className="row">
            <Badge>{system}</Badge>
            <RoleBadge role={viewer.role} />
            {campaign.archived_at && <Badge tone="accent">Archived</Badge>}
          </div>
        </div>
        {can('invites.create') && (
          <Link to="invites">
            <Button variant="primary">Invite players</Button>
          </Link>
        )}
      </div>

      {campaign.description && (
        <Card>
          <div className="stack-tight">
            <h3>The premise</h3>
            <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>
              {campaign.description}
            </p>
          </div>
        </Card>
      )}

      <Card>
        <div className="stack">
          <div className="row-between">
            <h3>At the table</h3>
            <Link to="members" className="small">
              Manage
            </Link>
          </div>
          <div className="stack-tight">
            {members.slice(0, 8).map((member) => (
              <div key={member.user_id} className="person">
                <Avatar name={member.profile?.display_name ?? '?'} />
                <span className="grow">{member.profile?.display_name ?? 'Unknown'}</span>
                <RoleBadge role={member.role} />
              </div>
            ))}
          </div>
          {members.length > 8 && (
            <span className="small faint">and {members.length - 8} more</span>
          )}
        </div>
      </Card>

      <Card>
        <div className="stack-tight">
          <h3>What's next</h3>
          <p className="small muted">
            Phase 1 built the foundation: accounts, this campaign, its roster and its permissions.
            Characters, notes, journals, shared lore and the Claude-powered assistant are the next
            phases — every one of them will read and write inside this campaign only.
          </p>
          <p className="small faint">
            {dms.length === 1
              ? `${dms[0]?.profile?.display_name ?? 'The DM'} runs this campaign.`
              : `${dms.length} DMs run this campaign.`}
          </p>
        </div>
      </Card>
    </div>
  );
}
