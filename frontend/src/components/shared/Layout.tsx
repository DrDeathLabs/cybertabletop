import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  BookOpen,
  Calendar,
  Settings,
  LogOut,
  User,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    to: '/scenarios',
    label: 'Scenarios',
    icon: <BookOpen className="w-5 h-5" />,
    roles: ['FACILITATOR', 'ORG_ADMIN', 'SUPER_ADMIN'],
  },
  {
    to: '/sessions',
    label: 'Tabletops',
    icon: <Calendar className="w-5 h-5" />,
    roles: ['FACILITATOR', 'ORG_ADMIN', 'SUPER_ADMIN'],
  },
  {
    to: '/admin',
    label: 'Admin',
    icon: <Settings className="w-5 h-5" />,
    roles: ['ORG_ADMIN', 'SUPER_ADMIN'],
  },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORG_ADMIN: 'Org Admin',
  FACILITATOR: 'Facilitator',
  PLAYER: 'Player',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-500/20 text-red-400 border-red-500/40',
  ORG_ADMIN: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  FACILITATOR: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  PLAYER: 'bg-green-500/20 text-green-400 border-green-500/40',
};

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // best-effort
    }
    logout();
    navigate('/login');
  };

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700/50 flex flex-col flex-shrink-0 print:hidden">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/50">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">
            CyberTabletop
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/50 border border-transparent'
                }`
              }
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-slate-700/50 p-3">
          <NavLink
            to="/profile"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-700/50 transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">
                {user?.displayName ?? 'Unknown'}
              </p>
              {user?.role && (
                <span
                  className={`inline-block text-xs px-1.5 py-0.5 rounded border font-medium mt-0.5 ${
                    ROLE_COLORS[user.role] ?? 'bg-slate-700 text-slate-400 border-slate-600'
                  }`}
                >
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              )}
            </div>
          </NavLink>
          <button
            onClick={handleLogout}
            className="mt-1 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden print:block print:overflow-visible">
        {/* Top bar */}
        <header className="h-14 bg-slate-800/80 border-b border-slate-700/50 flex items-center px-6 gap-4 flex-shrink-0 backdrop-blur-sm print:hidden">
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <span className="text-sm text-slate-300">{user?.displayName}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-400 transition-colors px-2 py-1 rounded-md hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto print:overflow-visible">
          {children}
        </main>
      </div>
    </div>
  );
}
