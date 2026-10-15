import { useMemo, useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { navigationGroups } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from '../ui/CommandPalette';
import { cn } from '../../lib/cn';
import { api } from '../../api/client';
import { GlobalEventsDrawer } from '../events/GlobalEventsDrawer';
import { persistAndApplyThemeSettings } from '../../config/theme';

function resolveTitle(pathname) {
  if (pathname.includes('/leads') && pathname.includes('/quotations')) {
    return 'Leads / Quotation Builder';
  }
  if (pathname.startsWith('/app/quotations') && (pathname.includes('/new') || pathname.includes('/builder'))) {
    return 'Quotations / Quotation Builder';
  }

  for (const group of navigationGroups) {
    for (const item of group.items) {
      if (item.children) {
        const child = item.children.find(
          (c) =>
            pathname === c.path ||
            (c.path === '/app/hrm/overview' && pathname === '/app/hrm') ||
            pathname.startsWith(`${c.path}/`)
        );
        if (child) {
          return `${item.label} · ${child.label}`;
        }
      }
      if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
        return item.label;
      }
    }
  }
  return 'Dashboard';
}

export function AppLayout() {
  const location = useLocation();
  const { user, token } = useAuth();

  // Default to open on large screens
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settings, setSettings] = useState(null);

  // Global keyboard shortcut for Command Palette (Ctrl+K or Cmd+K)
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-close sidebar on mobile when navigating
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Sync global UI settings on mount
  useEffect(() => {
    let mounted = true;
    api.settings
      .get(token)
      .then((res) => {
        if (!mounted) return;
        const loadedSettings = res.data || null;
        setSettings(loadedSettings);
        if (loadedSettings) persistAndApplyThemeSettings(loadedSettings);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [token]);

  const title = useMemo(() => resolveTitle(location.pathname), [location.pathname]);
  const subtitle = user?.roles?.length
    ? `Signed in as ${user.roles.map((role) => role.name).join(', ')}`
    : 'Ready to manage your CRM data';

  return (
    <div className="app-shell relative min-h-screen bg-[var(--background)] text-[var(--text-main)] overflow-x-hidden">
      {/* iOS 26 Liquid Aurora Backdrop Canvas (Refracts through all glass cards) */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Sapphire / Electric Blue Glow */}
        <div className="absolute -top-32 right-1/4 h-[550px] w-[550px] rounded-full bg-gradient-to-tr from-[#0071E3] via-[#00C6FF] to-[#0072FF] opacity-15 dark:opacity-20 blur-[130px]" />
        {/* Iris Magenta / Purple Aurora */}
        <div className="absolute top-1/3 -left-40 h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-[#7928CA] via-[#FF0080] to-[#6366F1] opacity-12 dark:opacity-18 blur-[140px]" />
        {/* Warm Coral Ambient Glow */}
        <div className="absolute -bottom-32 right-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-[#FF453A] via-[#FF9F0A] to-[#FF375F] opacity-10 dark:opacity-15 blur-[130px]" />
        {/* Electric Cyan Floating Orb */}
        <div className="absolute top-2/3 left-1/2 -translate-x-1/2 h-[450px] w-[450px] rounded-full bg-gradient-to-r from-[#00F2FE] via-[#4FACFE] to-[#0071E3] opacity-10 dark:opacity-12 blur-[140px]" />
      </div>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarOpen(!sidebarOpen)}
      />
      <div
        className={cn(
          'min-h-screen transition-all duration-250 flex flex-col print:pl-0',
          sidebarOpen ? 'lg:pl-64' : 'lg:pl-18'
        )}
      >
        <Topbar
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onCalendarClick={() => setEventsOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />
        <main className="w-full flex-1 px-4 md:px-8 py-6 transition-all duration-200 print:px-0 print:pt-0 print:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Global Events / Calendar Drawer */}
      <GlobalEventsDrawer
        open={eventsOpen}
        onClose={() => setEventsOpen(false)}
        token={token}
        user={user}
        sharedLabels={settings?.labels || []}
      />
    </div>
  );
}
