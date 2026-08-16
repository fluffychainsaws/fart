import type { ReactNode } from 'react';

import { useCampaign } from '@/campaign/CampaignProvider';
import { Card, Notice } from '@/ui/kit';

// Phase 1 ends here on purpose. These pages exist so the shell is complete and
// navigable, and so each feature's permission story is written down at the
// place it will be built. They read no data — a placeholder that queried the
// database would be a feature, and features are Phase 2.

function Placeholder({
  title,
  intent,
  rules,
  phase,
}: {
  title: string;
  intent: string;
  rules: ReactNode;
  phase: string;
}) {
  const { campaign } = useCampaign();
  return (
    <div className="page stack">
      <div className="stack-tight">
        <h1>{title}</h1>
        <p className="muted">{intent}</p>
      </div>

      <div className="placeholder stack">
        <h3>Coming in {phase}</h3>
        <div className="small muted stack-tight">{rules}</div>
      </div>

      <Card>
        <span className="small faint">
          Everything on this page will belong to <strong>{campaign.name}</strong> and to no other
          campaign. The database enforces that with a campaign_id on every row and a policy that
          checks your membership of this campaign specifically.
        </span>
      </Card>
    </div>
  );
}

export function Characters() {
  const { can } = useCampaign();
  return (
    <>
      {!can('characters.create') && (
        <div className="page" style={{ paddingBottom: 0 }}>
          <Notice tone="info">
            Observers can read the party's shared characters but cannot create one.
          </Notice>
        </div>
      )}
      <Placeholder
        title="Characters"
        intent="Character sheets that stay in sync with the rules, the party and the story."
        phase="Phase 2"
        rules={
          <>
            <p>A character belongs to one player and one campaign.</p>
            <p>Players own their own sheets; a DM may edit any sheet at their table.</p>
            <p>A sheet marked private is visible to its owner and the DMs only.</p>
            <p>Bringing a character to a second campaign copies it — it never moves.</p>
          </>
        }
      />
    </>
  );
}

export function Notes() {
  return (
    <Placeholder
      title="Notes"
      intent="Your own scratchpad: theories, names you keep forgetting, plans the DM must never read."
      phase="Phase 2"
      rules={
        <>
          <p>Notes start private. Private means private from the DM too.</p>
          <p>You can share a note with the DMs, or with the whole table.</p>
          <p>Only the author can edit or delete a note, whatever it's shared with.</p>
        </>
      }
    />
  );
}

export function Journal() {
  return (
    <Placeholder
      title="Journal"
      intent="A session-by-session record of what actually happened, in and out of character."
      phase="Phase 3"
      rules={
        <>
          <p>Session entries are shared with the table by default.</p>
          <p>The DM can keep a parallel private log for what the party hasn't discovered.</p>
          <p>Entries become the assistant's memory of the campaign so far.</p>
        </>
      }
    />
  );
}

export function Lore() {
  const { can } = useCampaign();
  return (
    <Placeholder
      title="Lore"
      intent="NPCs, factions, locations and secrets — the world behind the sessions."
      phase="Phase 3"
      rules={
        <>
          <p>Every entry is either shared with the table or DM-only.</p>
          <p>
            {can('lore.viewDmOnly')
              ? 'As a DM you will see both, with the hidden ones clearly marked.'
              : 'As a player you will only ever be served the shared entries — including when the assistant answers you.'}
          </p>
          <p>Revealing a secret is one action, and it is logged.</p>
        </>
      }
    />
  );
}

export function Assistant() {
  const { can } = useCampaign();
  return (
    <Placeholder
      title="Assistant"
      intent="Claude, with your campaign's world in its context and nobody else's."
      phase="Phase 4 (the gateway ships in Phase 1)"
      rules={
        <>
          <p>Every request names one campaign. The server checks you belong to it before answering.</p>
          <p>
            Context is retrieved with the same visibility rules the screens use, so the assistant
            cannot repeat something to you that you could not read yourself.
          </p>
          <p>
            {can('ai.dmPerspective')
              ? 'You can ask as the DM, which unlocks the hidden half of the world.'
              : 'A DM can ask in DM mode; your conversations are answered from the player-visible world only.'}
          </p>
          <p>Conversations are private to you, and stored inside this campaign.</p>
        </>
      }
    />
  );
}
