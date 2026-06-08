// src/components/Layout.jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/',          icon: 'ti-home',       label: 'Home Feed',   exact: true },
  { to: '/trending',  icon: 'ti-trending-up', label: 'Trending' },
  { to: '/create',    icon: 'ti-plus-circle', label: 'Confess' },
  { to: '/search',    icon: 'ti-search',      label: 'Search' },
  { to: '/bookmarks', icon: 'ti-bookmark',    label: 'Bookmarks' },
  { to: '/profile',   icon: 'ti-user-circle', label: 'Profile' },
];

const MOBILE_NAV = [
  { to: '/',          icon: 'ti-home',        label: 'Home',    exact: true },
  { to: '/trending',  icon: 'ti-trending-up', label: 'Trending' },
  { to: '/create',    icon: 'ti-plus-circle', label: 'Confess' },
  { to: '/bookmarks', icon: 'ti-bookmark',    label: 'Saved' },
  { to: '/profile',   icon: 'ti-user-circle', label: 'Me' },
];

function NavItem({ to, icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all w-full text-left border border-transparent
        ${isActive
          ? 'bg-gradient-to-r from-[#2d1b69] to-[#1e1040] text-[#c084fc] font-medium'
          : 'text-[#9896a8] hover:bg-[#1c1c21] hover:text-white'}`
      }
    >
      <i className={`ti ${icon} text-base w-4`} />
      {label}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/login');
  };

  const avatarContent = user?.photo_url
    ? <img src={user.photo_url} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
    : <span className="text-sm font-semibold">{user?.username?.[0]?.toUpperCase() || '?'}</span>;

  return (
    <div className="flex min-h-screen bg-[#0d0d0f]">

      {/* ── Desktop Sidebar ────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-[220px] bg-[#141417] border-r border-[#2a2a32] sticky top-0 h-screen flex-shrink-0">
        {/* Brand */}
        <div className="px-5 py-6 border-b border-[#2a2a32]">
          <div className="font-serif text-xl text-white tracking-tight">Confessional</div>
          <div className="text-[10px] text-[#5a5868] tracking-[2px] uppercase mt-0.5">Anonymous Wall</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="text-[10px] text-[#5a5868] tracking-[2px] uppercase px-2 mb-2">Navigation</div>
          {NAV.map(n => <NavItem key={n.to} to={n.to} icon={n.icon} label={n.label} end={n.exact} />)}
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <NavItem to="/admin" icon="ti-shield" label="Admin" />
          )}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-[#2a2a32]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#ec4899] flex items-center justify-center flex-shrink-0 overflow-hidden text-white">
              {avatarContent}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-white truncate">{user?.username}</div>
              <div className="text-[11px] text-[#5a5868] capitalize">{user?.role}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="text-[#5a5868] hover:text-[#f87171] transition p-1 flex-shrink-0"
            >
              <i className="ti ti-logout text-base" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────── */}
      <main className="flex-1 overflow-y-auto min-h-screen pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* ── Mobile Bottom Nav ──────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#141417] border-t border-[#2a2a32] pb-safe z-40">
        <div className="flex justify-around py-2">
          {MOBILE_NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.exact}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] transition
                ${isActive ? 'text-[#c084fc]' : 'text-[#5a5868]'}`
              }
            >
              <i className={`ti ${n.icon} text-[22px]`} />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>

    </div>
  );
}
