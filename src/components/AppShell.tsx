import type { CSSProperties, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Globe2,
  LogOut,
  Moon,
  Sun,
  BusFront,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '../lib/context';
import { initials } from '../lib/format';
import { NotificationBell } from './NotificationBell';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const SPACES: Array<{ key: string; label: string; to: string }> = [
  { key: 'passenger', label: 'Passager', to: '/passenger' },
  { key: 'company', label: 'Compagnie', to: '/company' },
  { key: 'driver', label: 'Chauffeur', to: '/driver' },
  { key: 'admin', label: 'Admin', to: '/admin' },
];

export function AppShell({
  space,
  nav,
  children,
  bellToken,
  bellRating,
  profileLabel,
  profileTo,
  accentColor,
}: {
  space: string;
  nav: NavItem[];
  children: ReactNode;
  bellToken?: string;
  bellRating?: boolean;
  profileLabel?: string;
  profileTo?: string;
  accentColor?: string;
}) {
  const { theme, toggleTheme, lang, toggleLang, logoutUser, logoutCompany, logoutDriver, userSession, companySession, driverSession } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const session = space === 'company' ? companySession : space === 'driver' ? driverSession : userSession;
  const user = space === 'driver' ? driverSession?.driver?.user : session && 'user' in session ? session.user : null;
  const displayName = space === 'driver'
    ? `${driverSession?.driver?.user?.firstName || ''} ${driverSession?.driver?.user?.lastName || ''}`.trim() || 'Chauffeur'
    : `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Mon compte';

  const logout = () => {
    if (space === 'company') logoutCompany();
    else if (space === 'driver') logoutDriver();
    else logoutUser();
    navigate(space === 'company' ? '/company' : space === 'driver' ? '/driver' : space === 'admin' ? '/admin' : '/passenger', { replace: true });
  };

  const switcher = (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {SPACES.map((s) => (
        <Link
          key={s.key}
          to={s.to}
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: 999,
            background: s.key === space ? 'var(--primary-soft)' : 'transparent',
            color: s.key === space ? 'var(--primary)' : 'var(--muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen" style={{ '--primary': accentColor } as CSSProperties}>
      <header className="card" style={{ borderRadius: 0, borderWidth: '0 0 1px 0', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to={`/${space === 'passenger' ? 'passenger' : space}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <BusFront size={19} />
            </span>
            <strong style={{ fontSize: 18, letterSpacing: '-0.03em' }}>vitoo</strong>
          </Link>
          <div style={{ flex: 1 }} />
          <div className="desktop-only" style={{ display: 'none' }}>{switcher}</div>
          <button className="btn btn-ghost btn-icon" onClick={toggleLang} title="Langue" aria-label="Changer de langue">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 800 }}>
              <Globe2 size={17} /> {lang.toUpperCase()}
            </span>
          </button>
          <button className="btn btn-ghost btn-icon" onClick={toggleTheme} title="Thème" aria-label="Changer de thème">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {bellToken && <NotificationBell token={bellToken} allowRating={bellRating} />}
          {profileTo && (
            <Link to={profileTo} className="avatar" title={profileLabel || displayName} style={{ width: 34, height: 34 }}>
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="avatar" style={{ width: 34, height: 34 }} /> : initials(user?.firstName, user?.lastName)}
            </Link>
          )}
          {!profileTo && <span className="muted" style={{ fontSize: 12, display: 'none' }}>{displayName}</span>}
          <button className="btn btn-ghost btn-icon" onClick={logout} title="Déconnexion" aria-label="Déconnexion">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '20px 18px 90px', display: 'flex', gap: 22 }}>
        <aside className="sidebar" style={{ width: 220, flexShrink: 0 }}>
          <div className="card" style={{ padding: 10 }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {nav.map((item) => {
                const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} className={`nav-link ${active ? 'active' : ''}`}>
                    <Icon size={18} /> {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="label" style={{ paddingLeft: 4 }}>Autres espaces</div>
            <div className="card" style={{ padding: 10 }}>{switcher}</div>
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>

      <nav className="mobile-nav" style={{ display: 'none' }}>
        {nav.slice(0, 5).map((item) => {
          const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className="nav-link" style={{ flex: 1, flexDirection: 'column', gap: 2, fontSize: 10, padding: '8px 2px', color: active ? 'var(--primary)' : 'var(--muted)' }}>
              <Icon size={19} /> {item.label}
            </Link>
          );
        })}
      </nav>

      <style>{`
        @media (min-width: 1024px) { .desktop-only { display: block !important; } }
        @media (max-width: 1023px) { .sidebar { display: none; } }
        @media (max-width: 767px) {
          .mobile-nav { display: flex !important; position: fixed; bottom: 0; left: 0; right: 0; z-index: 45;
            background: var(--surface); border-top: 1px solid var(--border); padding: 6px 6px calc(6px + env(safe-area-inset-bottom)); }
        }
      `}</style>
    </div>
  );
}

export function ShellTitle({ icon: Icon, title, subtitle }: { icon?: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      {Icon && <span className="stat-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', width: 38, height: 38 }}><Icon size={19} /></span>}
      <div>
        <h2 style={{ fontSize: 18 }}>{title}</h2>
        {subtitle && <div className="muted" style={{ fontSize: 12 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

export function GridCards({ children, min = 220 }: { children: ReactNode; min?: number }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 14 }}>{children}</div>;
}
