import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { previewInvite, redeemInvite } from '@/data/invites';
import { keys } from '@/data/keys';
import { ROLE_LABELS } from '@/domain/roles';
import { Button, Card, Field, Notice, TextInput } from '@/ui/kit';
import type { RedeemResult } from '@/domain/types';

const REASONS: Record<string, string> = {
  unknown_code: "That code doesn't match any invite.",
  revoked: 'That invite was revoked by the DM.',
  expired: 'That invite has expired. Ask the DM for a new one.',
  used_up: 'That invite has already been used as many times as it allows.',
  archived: 'That campaign has been archived.',
  not_signed_in: 'Sign in first, then open the invite again.',
};

export default function JoinCampaign() {
  const { code: codeFromUrl } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState(codeFromUrl ?? '');
  const [submitted, setSubmitted] = useState(codeFromUrl ?? '');

  useEffect(() => {
    if (codeFromUrl) {
      setCode(codeFromUrl);
      setSubmitted(codeFromUrl);
    }
  }, [codeFromUrl]);

  const normalized = submitted.trim().toUpperCase();

  // What the invite points at, fetched through a SECURITY DEFINER function
  // because a non-member cannot read the campaigns table at all.
  const preview = useQuery({
    queryKey: keys.invitePreview(normalized),
    queryFn: () => previewInvite(normalized),
    enabled: normalized.length >= 6,
    retry: false,
  });

  const join = useMutation({
    mutationFn: () => redeemInvite(normalized),
    onSuccess: async (result: RedeemResult) => {
      if (!result.campaign_id) return;
      await queryClient.invalidateQueries({ queryKey: keys.myCampaigns() });
      navigate(`/c/${result.campaign_id}`, { replace: true });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(code.trim().toUpperCase());
    join.reset();
  }

  const invite = preview.data;
  const failedJoin = join.data && !join.data.campaign_id ? join.data.reason : null;

  return (
    <div className="page stack" style={{ maxWidth: 520 }}>
      <div className="stack-tight">
        <Link to="/campaigns" className="small muted">
          ← Your campaigns
        </Link>
        <h1>Join a campaign</h1>
        <p className="muted">Enter the code your DM sent you.</p>
      </div>

      <form className="stack" onSubmit={submit}>
        <Field label="Invite code" htmlFor="code">
          <TextInput
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XKCD4RT9"
            autoCapitalize="characters"
            spellCheck={false}
            className="input mono"
          />
        </Field>
        <div>
          <Button type="submit" variant="secondary" disabled={code.trim().length < 6}>
            Look it up
          </Button>
        </div>
      </form>

      {preview.isError && <Notice tone="error">{(preview.error as Error).message}</Notice>}

      {invite && !invite.is_valid && (
        <Notice tone="error">{REASONS[invite.reason] ?? 'That invite cannot be used.'}</Notice>
      )}

      {invite?.is_valid && (
        <Card raised>
          <div className="stack">
            <div className="stack-tight">
              <h2>{invite.campaign_name}</h2>
              <p className="muted small">
                {invite.invited_by ? `${invite.invited_by} invited you` : 'You have been invited'}
                {invite.invited_role ? ` as a ${ROLE_LABELS[invite.invited_role]}` : ''}.
              </p>
            </div>

            {failedJoin && <Notice tone="error">{REASONS[failedJoin] ?? 'Could not join.'}</Notice>}
            {join.isError && <Notice tone="error">{(join.error as Error).message}</Notice>}

            <div className="row">
              <Button variant="primary" busy={join.isPending} onClick={() => join.mutate()}>
                Join this campaign
              </Button>
              <Link to="/campaigns">
                <Button variant="ghost">Not now</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
