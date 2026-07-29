import { useMemo, useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { navigationGroups } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { cn } from '../../lib/cn';
import { api } from '../../api/client';
import { GlobalEventsDrawer } from '../events/GlobalEventsDrawer';
import { persistAndApplyThemeSettings } from '../../config/theme';

function resolveTitle(pathname) {
  const item = navigationGroups.flatMap((group) => group.items).find((navItem) => pathname === navItem.path || pathname.startsWith(`${navItem.path}/`));
  return item?.label || 'Dashboard';
}

export function AppLayout() {
  const location = useLocation();
  const { user, token } = useAuth();
  
  // Default to open on large screens
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [settings, setSettings] = useState(null);

  // Auto-close sidebar on mobile when navigating
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Sync global UI settings on mount
  useEffect(() => {
    let mounted = true;
    api.settings.get(token).then((res) => {
      if (!mounted) return;
      const loadedSettings = res.data || null;
      setSettings(loadedSettings);
      if (loadedSettings) persistAndApplyThemeSettings(loadedSettings);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [token]);

  const title = useMemo(() => resolveTitle(location.pathname), [location.pathname]);
  const subtitle = user?.roles?.length ? `Signed in as ${user.roles.map((role) => role.name).join(', ')}` : 'Ready to manage your CRM data';

  return (
    <div className="app-shell bg-white min-h-screen">
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onToggleCollapse={() => setSidebarOpen(!sidebarOpen)}
      />
      <div className={cn('min-h-screen transition-all duration-300 print:pl-0', sidebarOpen ? 'lg:pl-64' : 'lg:pl-20')}>
        <Topbar
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onCalendarClick={() => setEventsOpen(true)}
        />
        <main className="w-full px-4 md:px-8 pt-6 pb-8 transition-all duration-300 print:px-0 print:pt-0 print:pb-0">
          <Outlet />
        </main>
      </div>
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
