import { useMemo, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight, Menu, X } from 'lucide-react';
import { navigationGroups } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';

function initials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function SidebarLink({ item, onNavigate, open }) {
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex h-12 items-center gap-4 overflow-hidden whitespace-nowrap px-4 text-[15px] transition-all duration-200',
          isActive ? 'font-semibold text-[var(--primary)]' : 'font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950',
          !open && 'lg:mx-2 lg:justify-center lg:px-0'
        )
      }
      style={({ isActive }) => ({
        marginLeft: open ? '1.35rem' : undefined,
        marginRight: open ? '1rem' : undefined,
        borderRadius: '0.75rem',
        backgroundColor: isActive && open ? 'color-mix(in srgb, var(--primary) 13%, white)' : undefined,
        color: isActive ? 'var(--primary)' : undefined,
      })}
      title={!open ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          <item.icon
            size={22}
            strokeWidth={1.8}
            className={cn('shrink-0', isActive ? 'text-[var(--primary)]' : 'text-slate-600 group-hover:text-slate-900')}
          />
          <span className={cn('truncate transition-opacity duration-200', !open && 'lg:hidden')}>{item.label}</span>
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
      } catch (e) { }
    };
    loadLogos();
    window.addEventListener('logos-updated', loadLogos);
    return () => window.removeEventListener('logos-updated', loadLogos);
  }, []);

  const visibleGroups = useMemo(() => navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || user?.isSuperAdmin || user?.permissions?.includes(item.permission))
    }))
    .filter((group) => group.items.length > 0), [user?.isSuperAdmin, user?.permissions]);

  useEffect(() => {
    setCollapsedGroups((current) => {
      const next = { ...current };
      visibleGroups.forEach((group) => {
        const hasActiveItem = group.items.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
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
      {open ? <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={onClose} /> : null}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200 transition-all duration-300 flex flex-col overflow-hidden print:hidden',
          'max-w-[88vw] -translate-x-full lg:translate-x-0',
          open ? 'translate-x-0' : '',
          open ? 'w-64' : 'w-20'
        )}
      >
        <div className={cn("pt-5 pb-3 flex items-center justify-between gap-3 overflow-hidden min-h-[5.25rem]", open ? "px-6" : "px-0 justify-center")}>
          <div className="flex items-center gap-3 h-14">
            {open ? (
              logos.sidebar ? (
                <img src={logos.sidebar} alt="Logo" className="h-full w-auto max-w-[200px] object-contain" />
              ) : null
            ) : logos.sidebarCollapsed ? (
              <img src={logos.sidebarCollapsed} alt="Logo" className="h-full w-14 object-contain" />
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--sidebar-text)] transition hover:bg-[var(--sidebar-bg-active)] hover:text-[var(--sidebar-text-active)] lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden pt-3 pb-5 scrollbar-hide">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              {open && !group.standalone ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  className="mb-1 flex h-11 w-full items-center justify-between px-6 text-left text-[15px] font-semibold text-slate-600 transition hover:text-slate-950"
                  aria-expanded={!collapsedGroups[group.title]}
                >
                  <span className="whitespace-nowrap normal-case">{group.title}</span>
                  <ChevronRight
                    size={18}
                    strokeWidth={2}
                    className={cn('shrink-0 text-slate-500 transition-transform duration-200', !collapsedGroups[group.title] && 'rotate-90')}
                  />
                </button>
              ) : null}
              <div className={cn('space-y-1 overflow-hidden transition-all duration-200', open && !group.standalone && collapsedGroups[group.title] && 'max-h-0 opacity-0', (!open || group.standalone || !collapsedGroups[group.title]) && 'max-h-[560px] opacity-100')}>
                {group.items.map((item) => (
                  <SidebarLink key={item.path} item={item} open={open} onNavigate={() => { if (window.innerWidth < 1024) onClose(); }} />
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
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] hover-text-primary"
      aria-label="Toggle navigation"
    >
      <Menu size={20} strokeWidth={1.5} />
    </button>
  );
}
