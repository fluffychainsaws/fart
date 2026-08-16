import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';

import { useAuth } from '@/auth/AuthProvider';
import { isConfigured } from '@/lib/supabase';
import { Loading } from '@/ui/kit';

import AuthScreen from '@/routes/AuthScreen';
import SetupNeeded from '@/routes/SetupNeeded';
import CampaignsHub from '@/routes/CampaignsHub';
import NewCampaign from '@/routes/NewCampaign';
import JoinCampaign from '@/routes/JoinCampaign';
import Account from '@/routes/Account';
import CampaignShell from '@/routes/CampaignShell';
import Overview from '@/routes/campaign/Overview';
import Members from '@/routes/campaign/Members';
import Invites from '@/routes/campaign/Invites';
import CampaignSettings from '@/routes/campaign/CampaignSettings';
import { Characters, Notes, Journal, Lore, Assistant } from '@/routes/campaign/Placeholders';
import NotFound from '@/routes/NotFound';

/** Everything behind this needs a session. */
function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Loading label="Checking your session…" />;
  if (status === 'signed-out') {
    // Remember where they were headed — an invite link should survive signing in.
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

export default function App() {
  if (!isConfigured) return <SetupNeeded />;

  return (
    <Routes>
      <Route path="/signin" element={<AuthScreen />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<Navigate to="/campaigns" replace />} />
        <Route path="/campaigns" element={<CampaignsHub />} />
        <Route path="/campaigns/new" element={<NewCampaign />} />
        <Route path="/join" element={<JoinCampaign />} />
        <Route path="/join/:code" element={<JoinCampaign />} />
        <Route path="/account" element={<Account />} />

        {/* Every campaign-scoped screen lives under this one route, so the
            campaign id can only ever come from the URL — see CampaignShell. */}
        <Route path="/c/:campaignId" element={<CampaignShell />}>
          <Route index element={<Overview />} />
          <Route path="characters" element={<Characters />} />
          <Route path="notes" element={<Notes />} />
          <Route path="journal" element={<Journal />} />
          <Route path="lore" element={<Lore />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="members" element={<Members />} />
          <Route path="invites" element={<Invites />} />
          <Route path="settings" element={<CampaignSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
