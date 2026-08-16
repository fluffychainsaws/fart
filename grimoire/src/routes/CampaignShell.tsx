import { NavLink, Link, Outlet } from 'react-router';

import { CampaignProvider, useCampaign } from '@/campaign/CampaignProvider';
import { useMyName } from '@/auth/AuthProvider';
import { RoleBadge } from '@/ui/kit';

// The frame every campaign screen renders inside. It sits below
// CampaignProvider, so from here down the campaign id comes from context and
// nothing needs to pass it around.

type NavItem = { to: string; label: string; icon: string; end?: boolean; show?: boolean };

function Sidebar() {
  const { campaign, viewer, can } = useCampaign();
  const myName = useMyName();

  const world: NavItem[] = [
    { to: '.', label: 'Overview', icon: '🗺', end: true },
    { to: 'characters', label: 'Characters', icon: '🎭' },
    { to: 'notes', label: 'Notes', icon: '📓' },
    { to: 'journal', label: 'Journal', icon: '📖' },
    { to: 'lore', label: 'Lore', icon: '📜' },
    { to: 'assistant', label: 'Assistant', icon: '✨' },
  ];

  const table: NavItem[] = [
    { to: 'members', label: 'The table', icon: '👥' },
    { to: 'invites', label: 'Invites', icon: '✉', show: can('invites.view') },
    { to: 'settings', label: 'Settings', icon: '⚙' },
  ];

  return (
    <aside className="sidebar">
      <div className="stack-tight">
        <Link to="/campaigns" className="small muted">
          ← All campaigns
        </Link>
        <span className="sidebar-title">{campaign.name}</span>
        <RoleBadge role={viewer.role} />
      </div>

      <nav className="nav">
        {world.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <nav className="nav">
        <span className="nav-section">Table</span>
        {table
          .filter((item) => item.show !== false)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
      </nav>

      <div className="grow" />
      <Link to="/account" className="small faint">
        {myName}
      </Link>
    </aside>
  );
}

export default function CampaignShell() {
  return (
    <CampaignProvider>
      <div className="shell">
        <Sidebar />
        <main className="main">
          <Outlet />
        </main>
      </div>
    </CampaignProvider>
  );
}
