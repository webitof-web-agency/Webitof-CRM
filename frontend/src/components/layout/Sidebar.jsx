import { useMemo, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight, Menu, X } from 'lucide-react';
import { navigationGroups } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';

function SidebarLink({ item, onNavigate, open, isChild = false }) {
  const location = useLocation();

  const isExplicitlyActive = useMemo(() => {
    if (item.path.includes('?')) {
      return (location.pathname + location.search) === item.path;
    }
    if (item.path === '/app/hrm/overview') {
      return location.pathname === '/app/hrm' || location.pathname === '/app/hrm/overview';
    }
    return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  }, [item.path, location.pathname, location.search]);

  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) => {
        const active = item.path.includes('?') ? isExplicitlyActive : (isExplicitlyActive || isActive);
        return cn(
          'group relative flex items-center gap-3 overflow-hidden whitespace-nowrap font-semibold transition-all duration-150',
          isChild
            ? 'h-8.5 text-[11.5px] px-2.5 mx-1 rounded-[10px]'
            : 'h-10 text-xs',
          !isChild && (open ? 'mx-3 px-3.5 rounded-[14px]' : 'mx-2 justify-center px-0 rounded-[14px]'),
          active
            ? 'bg-gradient-to-r from-[var(--primary)]/15 to-[var(--primary)]/5 dark:from-[var(--primary)]/25 dark:to-[var(--primary)]/10 text-[var(--primary)] dark:text-[var(--primary)] border border-[var(--primary)]/25 dark:border-[var(--primary)]/35 shadow-xs font-bold'
            : 'text-[var(--sidebar-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-[var(--text-main)] border border-transparent'
        );
      }}
      title={!open && !isChild ? item.label : undefined}
    >
      {({ isActive }) => {
        const active = isExplicitlyActive || isActive;
        return (
          <>
            {item.icon ? (
              <item.icon
                size={isChild ? 15 : 18}
                strokeWidth={active ? 2.3 : 1.8}
                className={cn(
                  'shrink-0 transition-colors duration-150',
                  active
                    ? 'text-[var(--primary)] dark:text-[var(--primary)]'
                    : 'text-[var(--sidebar-text)] group-hover:text-[var(--text-main)]'
                )}
              />
            ) : isChild ? (
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full shrink-0 transition-colors duration-150',
                  active
                    ? 'bg-[var(--primary)] dark:bg-[var(--primary)]'
                    : 'bg-[var(--sidebar-text)]/40 group-hover:bg-[var(--text-main)]'
                )}
              />
            ) : null}
            <span
              className={cn(
                'truncate transition-opacity duration-150',
                !open && !isChild && 'hidden'
              )}
            >
              {item.label}
            </span>
            {item.badge ? (
              <span
                className={cn(
                  'ml-auto rounded-full bg-[var(--primary)]/15 dark:bg-[var(--primary)]/25 px-2 py-0.5 text-[10px] font-bold text-[var(--primary)] dark:text-[var(--primary)]',
                  !open && !isChild && 'hidden'
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </>
        );
      }}
    </NavLink>
  );
}

function SidebarExpandableItem({ item, onNavigate, open, isExpanded, onToggleExpand }) {
  const location = useLocation();
  const isParentActive =
    location.pathname === item.path ||
    location.pathname.startsWith(`${item.path}/`) ||
    item.children?.some(
      (c) =>
        location.pathname === c.path ||
        (c.path === '/app/hrm/overview' && location.pathname === '/app/hrm') ||
        location.pathname.startsWith(`${c.path}/`)
    );

  if (!open) {
    return (
      <NavLink
        to={item.path}
        onClick={onNavigate}
        className={cn(
          'group relative flex h-10 items-center justify-center overflow-hidden whitespace-nowrap rounded-[14px] text-xs font-semibold transition-all duration-150 mx-2 px-0',
          isParentActive
            ? 'bg-gradient-to-r from-[var(--primary)]/15 to-[var(--primary)]/5 dark:from-[var(--primary)]/25 dark:to-[var(--primary)]/10 text-[var(--primary)] dark:text-[var(--primary)] border border-[var(--primary)]/25 dark:border-[var(--primary)]/35 shadow-xs font-bold'
            : 'text-[var(--sidebar-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-[var(--text-main)] border border-transparent'
        )}
        title={item.label}
      >
        <item.icon
          size={18}
          strokeWidth={isParentActive ? 2.3 : 1.8}
          className={cn(
            'shrink-0 transition-colors duration-150',
            isParentActive
              ? 'text-[var(--primary)] dark:text-[var(--primary)]'
              : 'text-[var(--sidebar-text)] group-hover:text-[var(--text-main)]'
          )}
        />
      </NavLink>
    );
  }

  return (
    <div className="space-y-0.5">
      <div
        onClick={() => onToggleExpand(item.path)}
        className={cn(
          'group relative flex h-10 items-center justify-between overflow-hidden whitespace-nowrap rounded-[14px] text-xs font-semibold transition-all duration-150 mx-3 px-3.5 cursor-pointer select-none',
          isParentActive
            ? 'bg-[var(--primary)]/10 dark:bg-[var(--primary)]/20 text-[var(--primary)] dark:text-[var(--primary)] font-bold border border-[var(--primary)]/25 dark:border-[var(--primary)]/35'
            : 'text-[var(--sidebar-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-[var(--text-main)] border border-transparent'
        )}
      >
        <NavLink
          to={item.path}
          onClick={(e) => {
            e.stopPropagation();
            if (!isExpanded) onToggleExpand(item.path, true);
            if (window.innerWidth < 1024) onNavigate();
          }}
          className="flex items-center gap-3 min-w-0 flex-1 h-full"
        >
          <item.icon
            size={18}
            strokeWidth={isParentActive ? 2.3 : 1.8}
            className={cn(
              'shrink-0 transition-colors duration-150',
              isParentActive
                ? 'text-[var(--primary)] dark:text-[var(--primary)]'
                : 'text-[var(--sidebar-text)] group-hover:text-[var(--text-main)]'
            )}
          />
          <span className="truncate">{item.label}</span>
          {item.badge ? (
            <span className="rounded-full bg-[var(--primary)]/15 dark:bg-[var(--primary)]/25 px-2 py-0.5 text-[10px] font-bold text-[var(--primary)] dark:text-[var(--primary)]">
              {item.badge}
            </span>
          ) : null}
        </NavLink>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(item.path);
          }}
          className="p-1 -mr-1 rounded-md text-[var(--sidebar-text)] opacity-70 hover:opacity-100 hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition-all cursor-pointer"
          aria-label={isExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
        >
          <ChevronRight
            size={14}
            strokeWidth={2}
            className={cn(
              'transition-transform duration-200',
              isExpanded && 'rotate-90'
            )}
          />
        </button>
      </div>

      {/* Submenu Children Container */}
      <div
        className={cn(
          'transition-all duration-200 overflow-hidden',
          isExpanded ? 'max-h-[2500px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="ml-6 pl-2.5 border-l-2 border-slate-200/80 dark:border-slate-800/80 space-y-0.5 my-1">
          {item.children.map((child) => (
            <SidebarLink
              key={child.path}
              item={child}
              open={open}
              isChild={true}
              onNavigate={() => {
                if (window.innerWidth < 1024) onNavigate();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ open = false, onClose }) {
  const { user } = useAuth();
  const location = useLocation();
  const [logos, setLogos] = useState(() => {
    try {
      const raw = window.localStorage.getItem('webitof-logos');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      primary: '/assets/images/horizontal-logo.png',
      primaryDark: '/assets/images/horizontal-white-logo.png',
      sidebar: '/assets/images/horizontal-logo.png',
      sidebarDark: '/assets/images/horizontal-white-logo.png',
      sidebarCollapsed: '/assets/images/round-logo.png',
      sidebarCollapsedDark: '/assets/images/webitof-icon-white.png',
      favicon: '/assets/images/round-logo.png',
      loginLight: '/assets/images/webitof-icon.png',
      loginDark: '/assets/images/webitof-icon-white.png'
    };
  });
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [expandedItems, setExpandedItems] = useState({});

  useEffect(() => {
    const loadLogos = () => {
      try {
        const raw = window.localStorage.getItem('webitof-logos');
        if (raw) setLogos(JSON.parse(raw));
      } catch (e) {}
    };
    loadLogos();

    // Fetch live public settings so unauthenticated / fresh browsers get updated logos
    fetch('/api/settings/public')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.logos) {
          setLogos(data.data.logos);
          try {
            window.localStorage.setItem('webitof-logos', JSON.stringify(data.data.logos));
          } catch (e) {}
        }
      })
      .catch(() => {});

    window.addEventListener('logos-updated', loadLogos);
    return () => window.removeEventListener('logos-updated', loadLogos);
  }, []);

  const visibleGroups = useMemo(
    () =>
      navigationGroups
        .map((group) => ({
          ...group,
          items: group.items
            .map((item) => {
              if (item.children) {
                const visibleChildren = item.children.filter((child) => {
                  const required = [child.permission, ...(child.permissions || [])].filter(Boolean);
                  return (
                    !required.length ||
                    user?.isSuperAdmin ||
                    required.some((permission) => user?.permissions?.includes(permission))
                  );
                });
                return {
                  ...item,
                  children: visibleChildren
                };
              }
              return item;
            })
            .filter((item) => {
              const required = [item.permission, ...(item.permissions || [])].filter(Boolean);
              const hasItemPermission =
                !required.length ||
                user?.isSuperAdmin ||
                required.some((permission) => user?.permissions?.includes(permission));

              if (item.children) {
                return hasItemPermission && item.children.length > 0;
              }
              return hasItemPermission;
            })
        }))
        .filter((group) => group.items.length > 0),
    [user?.isSuperAdmin, user?.permissions]
  );

  useEffect(() => {
    setCollapsedGroups((current) => {
      const next = { ...current };
      visibleGroups.forEach((group) => {
        const hasActiveItem = group.items.some((item) => {
          if (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)) {
            return true;
          }
          if (item.children) {
            return item.children.some(
              (c) =>
                location.pathname === c.path ||
                (c.path === '/app/hrm/overview' && location.pathname === '/app/hrm') ||
                location.pathname.startsWith(`${c.path}/`)
            );
          }
          return false;
        });
        if (hasActiveItem) next[group.title] = false;
      });
      return next;
    });

    // Auto-expand expandable parent items on route change
    visibleGroups.forEach((group) => {
      group.items.forEach((item) => {
        if (item.children) {
          const isItemOrChildActive =
            location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`) ||
            item.children.some(
              (c) =>
                location.pathname === c.path ||
                (c.path === '/app/hrm/overview' && location.pathname === '/app/hrm') ||
                location.pathname.startsWith(`${c.path}/`)
            );
          if (isItemOrChildActive) {
            setExpandedItems((prev) => ({ ...prev, [item.path]: true }));
          }
        }
      });
    });
  }, [location.pathname, visibleGroups]);

  function toggleGroup(title) {
    setCollapsedGroups((current) => ({
      ...current,
      [title]: !current[title]
    }));
  }

  function toggleExpandItem(path, forceState) {
    setExpandedItems((prev) => ({
      ...prev,
      [path]: forceState !== undefined ? forceState : !prev[path]
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
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Expanded Light Mode Logo */}
                <img
                  src={logos.sidebar || logos.primary || '/assets/images/horizontal-logo.png'}
                  alt="Webitof CRM"
                  className={cn(
                    "h-9 w-auto max-w-[160px] object-contain transition-opacity duration-200",
                    (logos.sidebarDark || logos.primaryDark || '/assets/images/horizontal-white-logo.png')
                      ? "dark:hidden"
                      : ""
                  )}
                />
                {/* Expanded Dark Mode Logo */}
                {(logos.sidebarDark || logos.primaryDark || '/assets/images/horizontal-white-logo.png') && (
                  <img
                    src={logos.sidebarDark || logos.primaryDark || '/assets/images/horizontal-white-logo.png'}
                    alt="Webitof CRM"
                    className="h-9 w-auto max-w-[160px] object-contain hidden dark:block transition-opacity duration-200"
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center min-w-0">
                {/* Collapsed Light Mode Logo */}
                <img
                  src={logos.sidebarCollapsed || logos.favicon || '/assets/images/round-logo.png'}
                  alt="Webitof"
                  className={cn(
                    "h-8 w-8 object-contain rounded-full shadow-xs transition-opacity duration-200",
                    (logos.sidebarCollapsedDark || '/assets/images/webitof-icon-white.png')
                      ? "dark:hidden"
                      : ""
                  )}
                />
                {/* Collapsed Dark Mode Logo */}
                {(logos.sidebarCollapsedDark || '/assets/images/webitof-icon-white.png') && (
                  <img
                    src={logos.sidebarCollapsedDark || '/assets/images/webitof-icon-white.png'}
                    alt="Webitof"
                    className="h-8 w-auto max-w-[34px] object-contain drop-shadow-xs hidden dark:block transition-opacity duration-200"
                  />
                )}
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
                  (!open || group.standalone || !collapsedGroups[group.title]) && 'max-h-[3000px] opacity-100'
                )}
              >
                {group.items.map((item) =>
                  item.children ? (
                    <SidebarExpandableItem
                      key={item.path}
                      item={item}
                      open={open}
                      isExpanded={Boolean(expandedItems[item.path])}
                      onToggleExpand={toggleExpandItem}
                      onNavigate={() => {
                        if (window.innerWidth < 1024) onClose();
                      }}
                    />
                  ) : (
                    <SidebarLink
                      key={item.path}
                      item={item}
                      open={open}
                      onNavigate={() => {
                        if (window.innerWidth < 1024) onClose();
                      }}
                    />
                  )
                )}
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

