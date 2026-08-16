import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';
import { useCampaign } from '@/campaign/CampaignProvider';
import { createInvite, inviteState, inviteUrl, listInvites, revokeInvite } from '@/data/invites';
import { keys } from '@/data/keys';
import { ROLE_LABELS, type Role } from '@/domain/roles';
import { Badge, Button, Card, EmptyState, Field, Loading, Notice, Select } from '@/ui/kit';

const EXPIRY_CHOICES = [
  { value: '7', label: 'In a week' },
  { value: '30', label: 'In a month' },
  { value: '', label: 'Never' },
];

export default function Invites() {
  const { campaignId, campaign, can } = useCampaign();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role>('player');
  const [expiry, setExpiry] = useState('30');
  const [copied, setCopied] = useState<string | null>(null);

  const invitesQuery = useQuery({
    queryKey: keys.invites(campaignId),
    queryFn: () => listInvites(campaignId),
    enabled: can('invites.view'),
  });

  const create = useMutation({
    mutationFn: () =>
      createInvite(campaignId, user!.id, {
        role,
        expiresInDays: expiry ? Number(expiry) : null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.invites(campaignId) }),
  });

  const revoke = useMutation({
    mutationFn: (inviteId: string) => revokeInvite(campaignId, inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.invites(campaignId) }),
  });

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(code));
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access can be refused; the link is on screen either way.
    }
  }

  if (!can('invites.view')) {
    return (
      <div className="page stack">
        <h1>Invites</h1>
        <Notice tone="info">Only a DM of {campaign.name} can manage invitations.</Notice>
      </div>
    );
  }

  const invites = invitesQuery.data ?? [];
  const active = invites.filter((i) => inviteState(i) === 'active');
  const spent = invites.filter((i) => inviteState(i) !== 'active');

  return (
    <div className="page stack">
      <div className="stack-tight">
        <h1>Invites</h1>
        <p className="muted">
          Send someone a code and they join with the role you chose. Codes are minted by the server,
          never by this browser.
        </p>
      </div>

      {create.isError && <Notice tone="error">{(create.error as Error).message}</Notice>}
      {revoke.isError && <Notice tone="error">{(revoke.error as Error).message}</Notice>}

      <Card raised>
        <div className="stack">
          <h3>New invite</h3>
          <div className="row wrap">
            <Field label="Joins as">
              <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="player">{ROLE_LABELS.player}</option>
                <option value="observer">{ROLE_LABELS.observer}</option>
                {/* Handing out a DM seat is owner-only, enforced by the
                    "dms create invites" policy — so only offer it to the owner. */}
                {can('invites.createDm') && <option value="dm">{ROLE_LABELS.dm}</option>}
              </Select>
            </Field>

            <Field label="Expires">
              <Select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                {EXPIRY_CHOICES.map((choice) => (
                  <option key={choice.label} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Button variant="primary" busy={create.isPending} onClick={() => create.mutate()}>
              Create invite
            </Button>
          </div>
        </div>
      </Card>

      {invitesQuery.isLoading && <Loading label="Loading invites…" />}

      {!invitesQuery.isLoading && invites.length === 0 && (
        <EmptyState title="No invites yet">
          Create one above and send the link to your players.
        </EmptyState>
      )}

      {active.length > 0 && (
        <section className="stack">
          <h2>Active</h2>
          <div className="card-list">
            {active.map((invite) => (
              <Card key={invite.id}>
                <div className="row-between wrap">
                  <div className="stack-tight">
                    <span className="code-chip">{invite.code}</span>
                    <span className="small faint">
                      Joins as {ROLE_LABELS[invite.role]} ·{' '}
                      {invite.expires_at
                        ? `expires ${new Date(invite.expires_at).toLocaleDateString()}`
                        : 'no expiry'}{' '}
                      · used {invite.use_count}×
                    </span>
                  </div>
                  <div className="row">
                    <Button size="sm" onClick={() => void copy(invite.code)}>
                      {copied === invite.code ? 'Copied' : 'Copy link'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      busy={revoke.isPending && revoke.variables === invite.id}
                      onClick={() => revoke.mutate(invite.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {spent.length > 0 && (
        <section className="stack">
          <h2 className="muted">Past</h2>
          <div className="card-list">
            {spent.map((invite) => (
              <Card key={invite.id}>
                <div className="row-between wrap">
                  <span className="mono muted">{invite.code}</span>
                  <Badge>{inviteState(invite).replace('_', ' ')}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
