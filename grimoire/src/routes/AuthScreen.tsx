import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';

import { useAuth } from '@/auth/AuthProvider';
import { Button, Field, Notice, TextInput } from '@/ui/kit';

export default function AuthScreen() {
  const { status, signIn, signUp } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from;

  if (status === 'signed-in') return <Navigate to={from ?? '/campaigns'} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const message =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, displayName || email.split('@')[0] || 'Adventurer');
    setBusy(false);

    if (message) {
      setError(message);
      return;
    }
    if (mode === 'signup') {
      // Whether a confirmation mail is required depends on the project's auth
      // settings, so say something true either way.
      setNotice('Account created. If your inbox has a confirmation link, follow it, then sign in.');
      setMode('signin');
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card stack">
        <div className="row">
          <span className="brand-mark">G</span>
          <span className="brand">Grimoire</span>
        </div>

        <div className="stack-tight">
          <h1>{mode === 'signin' ? 'Welcome back' : 'Make an account'}</h1>
          <p className="muted small">
            One account, any number of campaigns. Each one stays its own world.
          </p>
        </div>

        {from?.startsWith('/join') && (
          <Notice tone="info">Sign in and we'll take you straight to that invite.</Notice>
        )}
        {notice && <Notice tone="success">{notice}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        <form className="stack" onSubmit={submit}>
          {mode === 'signup' && (
            <Field label="Display name" htmlFor="name" hint="What your table sees. Change it any time.">
              <TextInput
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="nickname"
                placeholder="Sam"
              />
            </Field>
          )}

          <Field label="Email" htmlFor="email">
            <TextInput
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
          >
            <TextInput
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </Field>

          <Button type="submit" variant="primary" block busy={busy}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <div className="center small muted">
          {mode === 'signin' ? "Don't have an account? " : 'Already have one? '}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
            }}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
