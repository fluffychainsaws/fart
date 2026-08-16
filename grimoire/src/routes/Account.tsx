import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';
import { updateMyProfile } from '@/data/profiles';
import { Button, Field, Notice, TextInput } from '@/ui/kit';

export default function Account() {
  const { user, profile, reloadProfile, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name);
  }, [profile]);

  const save = useMutation({
    mutationFn: () => updateMyProfile(user!.id, { display_name: displayName.trim() }),
    onSuccess: () => reloadProfile(),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (displayName.trim()) save.mutate();
  }

  return (
    <div className="page stack" style={{ maxWidth: 520 }}>
      <div className="stack-tight">
        <Link to="/campaigns" className="small muted">
          ← Your campaigns
        </Link>
        <h1>Your account</h1>
        <p className="muted">{user?.email}</p>
      </div>

      {save.isError && <Notice tone="error">{(save.error as Error).message}</Notice>}
      {save.isSuccess && <Notice tone="success">Saved.</Notice>}

      <form className="stack" onSubmit={submit}>
        <Field
          label="Display name"
          htmlFor="display-name"
          hint="Everyone at every table you belong to sees this."
        >
          <TextInput
            id="display-name"
            value={displayName}
            maxLength={60}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <div>
          <Button type="submit" variant="primary" busy={save.isPending}>
            Save
          </Button>
        </div>
      </form>

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />

      <div className="stack-tight">
        <h3>Session</h3>
        <div>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
