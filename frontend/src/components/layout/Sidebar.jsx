import { useMemo, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight, Menu, X, Sparkles } from 'lucide-react';
import { navigationGroups } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';

function SidebarLink({ item, onNavigate, open }) {
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex h-10 items-center gap-3 overflow-hidden whitespace-nowrap rounded-[14px] text-xs font-semibold transition-all duration-150',
          open ? 'mx-3 px-3.5' : 'mx-2 justify-center px-0',
          isActive
            ? 'bg-gradient-to-r from-[#0071E3]/15 to-[#0071E3]/5 dark:from-[#0071E3]/25 dark:to-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF] border border-[#0071E3]/25 dark:border-[#0071E3]/35 shadow-xs font-bold'
            : 'text-[var(--sidebar-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-[var(--text-main)] border border-transparent'
        )
      }
      title={!open ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          <item.icon
            size={18}
            strokeWidth={isActive ? 2.3 : 1.8}
            className={cn(
              'shrink-0 transition-colors duration-150',
              isActive
                ? 'text-[#0071E3] dark:text-[#2997FF]'
                : 'text-[var(--sidebar-text)] group-hover:text-[var(--text-main)]'
            )}
          />
          <span
            className={cn(
              'truncate transition-opacity duration-150',
              !open && 'hidden'
            )}
          >
            {item.label}
          </span>
          {item.badge ? (
            <span
              className={cn(
                'ml-auto rounded-full bg-[#0071E3]/15 dark:bg-[#0071E3]/25 px-2 py-0.5 text-[10px] font-bold text-[#0071E3] dark:text-[#2997FF]',
                !open && 'hidden'
              )}
            >
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ open = false, onClose }) {
  const { user } = useAuth();
  const location = useLocation();
  const [logos, setLogos] = useState({});
  const [collapsedGroups, setCollapsedGroups] = useState({});

  useEffect(() => {
    const loadLogos = () => {
      try {
        const raw = window.localStorage.getItem('webitof-logos');
        if (raw) setLogos(JSON.parse(raw));
      } catch (e) {}
    };
    loadLogos();
    window.addEventListener('logos-updated', loadLogos);
    return () => window.removeEventListener('logos-updated', loadLogos);
  }, []);

  const visibleGroups = useMemo(
    () =>
      navigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            const required = [item.permission, ...(item.permissions || [])].filter(Boolean);
            return (
              !required.length ||
              user?.isSuperAdmin ||
              required.some((permission) => user?.permissions?.includes(permission))
            );
          })
        }))
        .filter((group) => group.items.length > 0),
    [user?.isSuperAdmin, user?.permissions]
  );

  useEffect(() => {
    setCollapsedGroups((current) => {
      const next = { ...current };
      visibleGroups.forEach((group) => {
        const hasActiveItem = group.items.some(
          (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
        );
        if (hasActiveItem) next[group.title] = false;
      });
      return next;
    });
  }, [location.pathname, visibleGroups]);

  function toggleGroup(title) {
    setCollapsedGroups((current) => ({
      ...current,
      [title]: !current[title]
    }));
  }

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 glass-sidebar transition-all duration-250 flex flex-col overflow-hidden print:hidden shadow-xs',
          'max-w-[85vw] -translate-x-full lg:translate-x-0',
          open ? 'translate-x-0 w-64' : 'w-18'
        )}
      >
        {/* Sidebar Header / Brand Logo */}
        <div
          className={cn(
            'flex items-center justify-between border-b border-[var(--sidebar-border)] px-4 h-16 shrink-0',
            !open && 'justify-center px-2'
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {open ? (
              logos.sidebar ? (
                <img
                  src={logos.sidebar}
                  alt="Logo"
                  className="h-9 w-auto max-w-[160px] object-contain"
                />
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="relative flex h-8.5 w-8.5 items-center justify-center rounded-[12px] bg-gradient-to-b from-[#0077ED] via-[#0071E3] to-[#005bb5] text-white shadow-md shadow-blue-500/25 border border-white/40 font-extrabold text-sm">
                    <span className="drop-shadow-xs">W</span>
                    <div className="absolute inset-0 rounded-[12px] bg-gradient-to-tr from-white/30 via-transparent to-transparent pointer-events-none" />
                  </div>
                  <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                    Webitof CRM
                  </span>
                </div>
              )
            ) : logos.sidebarCollapsed ? (
              <img
                src={logos.sidebarCollapsed}
                alt="Logo"
                className="h-8 w-8 object-contain rounded-lg"
              />
            ) : (
              <div className="relative flex h-8.5 w-8.5 items-center justify-center rounded-[12px] bg-gradient-to-b from-[#0077ED] via-[#0071E3] to-[#005bb5] text-white shadow-md shadow-blue-500/25 border border-white/40 font-extrabold text-sm">
                <span className="drop-shadow-xs">W</span>
                <div className="absolute inset-0 rounded-[12px] bg-gradient-to-tr from-white/30 via-transparent to-transparent pointer-events-none" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--sidebar-text)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden py-3 scrollbar-hide">
          {visibleGroups.map((group) => (
            <div key={group.title || 'main'}>
              {open && !group.standalone && group.title ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  className="mb-1 flex h-7 w-full items-center justify-between px-5 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--sidebar-text)] opacity-80 transition hover:text-[var(--text-main)] cursor-pointer"
                  aria-expanded={!collapsedGroups[group.title]}
                >
                  <span className="whitespace-nowrap truncate">{group.title}</span>
                  <ChevronRight
                    size={14}
                    strokeWidth={2}
                    className={cn(
                      'shrink-0 transition-transform duration-200',
                      !collapsedGroups[group.title] && 'rotate-90'
                    )}
                  />
                </button>
              ) : null}
              <div
                className={cn(
                  'space-y-0.5 overflow-hidden transition-all duration-200',
                  open && !group.standalone && collapsedGroups[group.title] && 'max-h-0 opacity-0',
                  (!open || group.standalone || !collapsedGroups[group.title]) && 'max-h-[600px] opacity-100'
                )}
              >
                {group.items.map((item) => (
                  <SidebarLink
                    key={item.path}
                    item={item}
                    open={open}
                    onNavigate={() => {
                      if (window.innerWidth < 1024) onClose();
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export function SidebarToggle({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] cursor-pointer border border-[var(--border-muted)]"
      aria-label="Toggle navigation"
    >
      <Menu size={18} strokeWidth={1.8} />
    </button>
  );
}
