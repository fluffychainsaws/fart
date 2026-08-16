import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';
import { createCampaign } from '@/data/campaigns';
import { keys } from '@/data/keys';
import { GAME_SYSTEMS } from '@/domain/types';
import { Button, Field, Notice, Select, TextArea, TextInput } from '@/ui/kit';

export default function NewCampaign() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [system, setSystem] = useState<string>('dnd5e');

  const create = useMutation({
    mutationFn: () =>
      createCampaign(user!.id, { name, tagline, description, game_system: system }),
    onSuccess: async (campaign) => {
      await queryClient.invalidateQueries({ queryKey: keys.myCampaigns() });
      navigate(`/c/${campaign.id}`, { replace: true });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate();
  }

  return (
    <div className="page stack">
      <div className="stack-tight">
        <Link to="/campaigns" className="small muted">
          ← Your campaigns
        </Link>
        <h1>Start a campaign</h1>
        <p className="muted">
          You'll be its Dungeon Master and owner. Nothing here is permanent — you can rename or
          delete it later.
        </p>
      </div>

      {create.isError && <Notice tone="error">{(create.error as Error).message}</Notice>}

      <form className="stack" onSubmit={submit} style={{ maxWidth: 520 }}>
        <Field label="Campaign name" htmlFor="name">
          <TextInput
            id="name"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Curse of Strahd"
          />
        </Field>

        <Field label="Tagline" htmlFor="tagline" hint="One line your players see in their list.">
          <TextInput
            id="tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Gothic horror in the mists of Barovia"
          />
        </Field>

        <Field label="Ruleset" htmlFor="system">
          <Select id="system" value={system} onChange={(e) => setSystem(e.target.value)}>
            {GAME_SYSTEMS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Premise"
          htmlFor="description"
          hint="Optional. Later, this is the first thing the AI reads about your world."
        >
          <TextArea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="row">
          <Button type="submit" variant="primary" busy={create.isPending} disabled={!name.trim()}>
            Create campaign
          </Button>
          <Link to="/campaigns">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
