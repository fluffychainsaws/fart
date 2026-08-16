// Shown when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. Without
// this the app would render a login form that fails on submit with a network
// error, which sends you looking in the wrong place.
export default function SetupNeeded() {
  return (
    <div className="auth-shell">
      <div className="auth-card stack">
        <div className="row">
          <span className="brand-mark">G</span>
          <span className="brand">Grimoire</span>
        </div>
        <h1>Almost there</h1>
        <p className="muted">This build has no backend configured yet.</p>
        <ol className="muted small stack-tight">
          <li>Create a project at supabase.com.</li>
          <li>
            Run <code className="mono">supabase/schema.sql</code> in its SQL editor.
          </li>
          <li>
            Copy <code className="mono">.env.example</code> to <code className="mono">.env</code> and
            fill in the project URL and anon key.
          </li>
          <li>Restart the dev server.</li>
        </ol>
        <p className="faint small">Full walkthrough: supabase/README.md</p>
      </div>
    </div>
  );
}
