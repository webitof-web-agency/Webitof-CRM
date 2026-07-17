import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X, Power, LogOut } from 'lucide-react';
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
          'flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 overflow-hidden whitespace-nowrap',
          isActive ? 'font-medium' : 'font-medium text-[var(--sidebar-text)] hover-text-primary',
          !open && 'lg:justify-center lg:px-0',
          (!isActive && open) && 'hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]'
        )
      }
      style={({ isActive }) => ({
        marginLeft: open ? '0.75rem' : '0.5rem',
        marginRight: open ? '0.75rem' : '0.5rem',
        borderRadius: 'var(--radius-button, 0.75rem)',
        backgroundColor: (isActive && open) ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : undefined,
        color: isActive ? 'var(--primary)' : undefined,
      })}
      title={!open ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          <item.icon size={20} strokeWidth={1.5} className="shrink-0" />
          <span className={cn('truncate transition-opacity duration-200', !open && 'lg:hidden')}>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ open = false, onClose }) {
  const { user, logout } = useAuth();
  const [logos, setLogos] = useState({});

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

  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || user?.isSuperAdmin || user?.permissions?.includes(item.permission))
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      {open ? <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={onClose} /> : null}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] transition-all duration-300 flex flex-col overflow-hidden print:hidden',
          'max-w-[88vw] -translate-x-full lg:translate-x-0',
          open ? 'translate-x-0' : '',
          open ? 'w-64' : 'w-20'
        )}
      >
        <div className={cn("pt-6 pb-4 flex items-center justify-between gap-3 overflow-hidden min-h-[5.5rem]", open ? "px-6" : "px-0 justify-center")}>
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

        <nav className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden pt-4 pb-2 scrollbar-hide">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <p className={cn("mb-2 px-6 text-[10px] font-medium uppercase tracking-wider text-slate-500 whitespace-nowrap transition-opacity", !open && "hidden")}>
                {group.title}
              </p>
              <div className="space-y-1">
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
