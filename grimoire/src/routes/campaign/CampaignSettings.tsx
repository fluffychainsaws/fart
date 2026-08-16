import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useCampaign } from '@/campaign/CampaignProvider';
import { deleteCampaign, setArchived, transferOwnership, updateCampaign } from '@/data/campaigns';
import { keys } from '@/data/keys';
import { GAME_SYSTEMS } from '@/domain/types';
import { enforcedBy } from '@/domain/roles';
import { Button, Card, Field, Modal, Notice, Select, TextArea, TextInput } from '@/ui/kit';

export default function CampaignSettings() {
  const { campaignId, campaign, members, viewer, can } = useCampaign();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState(campaign.name);
  const [tagline, setTagline] = useState(campaign.tagline ?? '');
  const [description, setDescription] = useState(campaign.description ?? '');
  const [system, setSystem] = useState(campaign.game_system);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [newOwner, setNewOwner] = useState('');

  useEffect(() => {
    setName(campaign.name);
    setTagline(campaign.tagline ?? '');
    setDescription(campaign.description ?? '');
    setSystem(campaign.game_system);
  }, [campaign]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: keys.campaignDetail(campaignId) });
    await queryClient.invalidateQueries({ queryKey: keys.myCampaigns() });
  };

  const save = useMutation({
    mutationFn: () =>
      updateCampaign(campaignId, {
        name: name.trim(),
        tagline: tagline.trim() || null,
        description: description.trim() || null,
        game_system: system,
      }),
    onSuccess: refresh,
  });

  const archive = useMutation({
    mutationFn: (archived: boolean) => setArchived(campaignId, archived),
    onSuccess: refresh,
  });

  const transfer = useMutation({
    mutationFn: () => transferOwnership(campaignId, newOwner),
    onSuccess: refresh,
  });

  const destroy = useMutation({
    mutationFn: () => deleteCampaign(campaignId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.myCampaigns() });
      navigate('/campaigns', { replace: true });
    },
  });

  // Ownership can only pass to another DM — the trigger refuses anything else,
  // so the picker only lists people who qualify.
  const eligibleOwners = members.filter((m) => m.role === 'dm' && m.user_id !== campaign.owner_id);
  const error = save.error ?? archive.error ?? transfer.error ?? destroy.error;

  if (!can('campaign.edit')) {
    return (
      <div className="page stack">
        <h1>Settings</h1>
        <Notice tone="info">
          Only a DM can change this campaign's details. You can leave the campaign from the table
          page.
        </Notice>
      </div>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <div className="page stack">
      <div className="stack-tight">
        <h1>Settings</h1>
        <p className="muted">Campaign details, archiving and ownership.</p>
      </div>

      {error && <Notice tone="error">{(error as Error).message}</Notice>}
      {save.isSuccess && <Notice tone="success">Saved.</Notice>}

      <Card>
        <form className="stack" onSubmit={submit}>
          <h3>Details</h3>
          <Field label="Name" htmlFor="c-name">
            <TextInput id="c-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Tagline" htmlFor="c-tagline">
            <TextInput id="c-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </Field>
          <Field label="Ruleset" htmlFor="c-system">
            <Select id="c-system" value={system} onChange={(e) => setSystem(e.target.value)}>
              {GAME_SYSTEMS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Premise" htmlFor="c-description">
            <TextArea
              id="c-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div>
            <Button type="submit" variant="primary" busy={save.isPending} disabled={!name.trim()}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="row-between wrap">
          <div className="stack-tight">
            <h3>{campaign.archived_at ? 'Unarchive' : 'Archive'} campaign</h3>
            <span className="small muted">
              An archived campaign stays readable but accepts no new members and no new invites.
            </span>
          </div>
          <Button
            busy={archive.isPending}
            onClick={() => archive.mutate(!campaign.archived_at)}
          >
            {campaign.archived_at ? 'Unarchive' : 'Archive'}
          </Button>
        </div>
      </Card>

      {viewer.isOwner && (
        <Card>
          <div className="stack">
            <div className="stack-tight">
              <h3>Transfer ownership</h3>
              <span className="small muted">
                The owner is the one account that can delete this campaign. Ownership can only pass
                to another DM.
              </span>
            </div>
            {eligibleOwners.length === 0 ? (
              <span className="small faint">
                No other DMs yet. Invite someone as a DM first, then come back.
              </span>
            ) : (
              <div className="row wrap">
                <Select value={newOwner} onChange={(e) => setNewOwner(e.target.value)}>
                  <option value="">Choose a DM…</option>
                  {eligibleOwners.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.profile?.display_name ?? m.user_id}
                    </option>
                  ))}
                </Select>
                <Button busy={transfer.isPending} disabled={!newOwner} onClick={() => transfer.mutate()}>
                  Transfer
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {viewer.isOwner && (
        <Card>
          <div className="row-between wrap">
            <div className="stack-tight">
              <h3>Delete campaign</h3>
              <span className="small muted">
                Everything in this world — characters, notes, journals, invites — is deleted with
                it. There is no undo.
              </span>
              <span className="small faint">Enforced by {enforcedBy('campaign.delete')}.</span>
            </div>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        </Card>
      )}

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this campaign?">
        <p className="muted small">
          Type <strong>{campaign.name}</strong> to confirm. This cannot be undone.
        </p>
        <TextInput
          value={deleteText}
          onChange={(e) => setDeleteText(e.target.value)}
          aria-label="Campaign name"
        />
        <div className="row">
          <Button
            variant="danger"
            busy={destroy.isPending}
            disabled={deleteText !== campaign.name}
            onClick={() => destroy.mutate()}
          >
            Delete forever
          </Button>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
