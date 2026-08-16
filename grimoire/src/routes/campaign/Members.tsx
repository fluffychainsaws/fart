import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';
import { useCampaign } from '@/campaign/CampaignProvider';
import { removeMember, setMemberRole } from '@/data/members';
import { keys } from '@/data/keys';
import { ASSIGNABLE_ROLES, ROLE_BLURBS, ROLE_LABELS, isRole, type Role } from '@/domain/roles';
import { Avatar, Button, Card, Modal, Notice, RoleBadge, Select } from '@/ui/kit';

export default function Members() {
  const { campaignId, campaign, members, viewer, can } = useCampaign();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string } | null>(null);
  const [leaving, setLeaving] = useState(false);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: keys.members(campaignId) });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      setMemberRole(campaignId, userId, role),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (userId: string) => removeMember(campaignId, userId),
    onSuccess: async () => {
      setConfirmRemove(null);
      await refresh();
    },
  });

  const leave = useMutation({
    mutationFn: () => removeMember(campaignId, user!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.myCampaigns() });
      navigate('/campaigns', { replace: true });
    },
  });

  const error = changeRole.error ?? remove.error ?? leave.error;

  return (
    <div className="page stack">
      <div className="page-head">
        <div className="stack-tight">
          <h1>The table</h1>
          <p className="muted">
            {members.length} {members.length === 1 ? 'person' : 'people'} in {campaign.name}.
          </p>
        </div>
      </div>

      {error && <Notice tone="error">{(error as Error).message}</Notice>}

      <div className="card-list">
        {members.map((member) => {
          const isMe = member.user_id === user?.id;
          const isOwner = member.user_id === campaign.owner_id;
          const name = member.profile?.display_name ?? 'Unknown adventurer';
          // The owner's seat is immutable and you cannot edit your own role —
          // both refused by guard_member_update(), so don't offer the control.
          const editable = can('members.manageRoles') && !isOwner && !isMe;

          return (
            <Card key={member.user_id}>
              <div className="row-between wrap">
                <div className="person">
                  <Avatar name={name} />
                  <div className="stack-tight">
                    <span>
                      {name}
                      {isMe && <span className="faint small"> · you</span>}
                    </span>
                    <span className="small faint">
                      {isOwner ? 'Owner · ' : ''}
                      {ROLE_BLURBS[member.role]}
                    </span>
                  </div>
                </div>

                <div className="row">
                  {editable ? (
                    <Select
                      value={member.role}
                      aria-label={`Role for ${name}`}
                      style={{ width: 'auto' }}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (isRole(next)) changeRole.mutate({ userId: member.user_id, role: next });
                      }}
                    >
                      {ASSIGNABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                      {member.role === 'dm' && <option value="dm">{ROLE_LABELS.dm}</option>}
                    </Select>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}

                  {can('members.remove') && !isOwner && !isMe && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmRemove({ userId: member.user_id, name })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {can('invites.create') && (
        <Notice tone="info">
          New players join through an invite code — see the Invites page. Adding someone directly
          isn't possible by design: every join leaves an invite record behind.
        </Notice>
      )}

      {!viewer.isOwner && (
        <Card>
          <div className="row-between wrap">
            <div className="stack-tight">
              <h3>Leave this campaign</h3>
              <span className="small muted">
                Your characters and notes stay in the campaign. You'd need a new invite to return.
              </span>
            </div>
            <Button variant="danger" onClick={() => setLeaving(true)}>
              Leave
            </Button>
          </div>
        </Card>
      )}

      <Modal
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title={`Remove ${confirmRemove?.name ?? ''}?`}
      >
        <p className="muted small">
          They lose access to this campaign immediately. Anything they wrote stays.
        </p>
        <div className="row">
          <Button
            variant="danger"
            busy={remove.isPending}
            onClick={() => confirmRemove && remove.mutate(confirmRemove.userId)}
          >
            Remove
          </Button>
          <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
            Cancel
          </Button>
        </div>
      </Modal>

      <Modal open={leaving} onClose={() => setLeaving(false)} title={`Leave ${campaign.name}?`}>
        <p className="muted small">You'll need a new invite to come back.</p>
        <div className="row">
          <Button variant="danger" busy={leave.isPending} onClick={() => leave.mutate()}>
            Leave campaign
          </Button>
          <Button variant="ghost" onClick={() => setLeaving(false)}>
            Stay
          </Button>
        </div>
      </Modal>
    </div>
  );
}
