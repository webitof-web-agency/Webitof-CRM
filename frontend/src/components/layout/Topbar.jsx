import { useState, useRef, useEffect } from 'react';
import { LogOut, Bell, Calendar, Settings, Clock3, ArrowUpRight, CheckCheck, Search, Sparkles, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { SidebarToggle } from './Sidebar';
import { UserAvatar } from '../ui/UserAvatar';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '../ui/Badge';

function formatTime(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function Topbar({
  title,
  subtitle,
  onMenuClick,
  onCalendarClick,
  onOpenCommandPalette
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useTheme();
  const { unreadCount, notifications, markRead, markAllRead } = useNotifications();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const notificationsRef = useRef(null);

  const isDarkMode =
    mode === 'dark' ||
    (mode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-16 px-4 md:px-8 glass-header flex items-center justify-between gap-4 print:hidden transition-all duration-200">
      {/* Left section: Sidebar toggle & Context Title */}
      <div className="flex items-center gap-3.5 min-w-0">
        <SidebarToggle onClick={onMenuClick} />
        <div className="min-w-0 hidden sm:block">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-tight text-[var(--text-main)] truncate">
              {typeof title === 'string' && title.includes(' / ') ? (
                (() => {
                  const [parent, ...rest] = title.split(' / ');
                  const child = rest.join(' / ');
                  const parentPath =
                    parent.toLowerCase() === 'leads'
                      ? '/app/leads'
                      : parent.toLowerCase() === 'quotations'
                        ? '/app/quotations'
                        : null;
                  return (
                    <span className="inline-flex items-center gap-1.5">
                      {parentPath ? (
                        <Link
                          to={parentPath}
                          className="font-semibold text-slate-500 dark:text-slate-400 hover:text-[var(--primary)] transition-colors"
                        >
                          {parent}
                        </Link>
                      ) : (
                        <span className="font-semibold text-slate-500 dark:text-slate-400">{parent}</span>
                      )}
                      <span className="text-slate-400 dark:text-slate-500 text-xs font-normal">/</span>
                      <span className="font-bold text-[var(--text-main)]">
                        {child}
                      </span>
                    </span>
                  );
                })()
              ) : (
                title
              )}
            </h2>
          </div>
        </div>
      </div>

      {/* Center section: Global Command Palette Search Bar */}
      <div className="flex-1 max-w-md mx-2 hidden sm:block">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex w-full items-center justify-between rounded-[14px] border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.05] hover:bg-white/90 dark:hover:bg-white/[0.09] px-3.5 py-2 text-xs text-slate-500 dark:text-slate-400 transition-all duration-150 shadow-xs backdrop-blur-md group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-[var(--primary)] transition-colors" />
            <span className="font-medium">Search anything...</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="inline-flex items-center rounded-lg border border-black/10 dark:border-white/15 bg-black/[0.04] dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
              ⌘K
            </kbd>
          </div>
        </button>
      </div>

      {/* Right section: Command Button (Mobile), Dark Mode Toggle, Calendar, Notifications, Profile */}
      <div className="flex items-center gap-2 md:gap-2.5">
        {/* Mobile Search Button */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="sm:hidden flex h-9.5 w-9.5 items-center justify-center rounded-[12px] border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          aria-label="Search"
        >
          <Search size={16} />
        </button>

        {/* Dedicated Dark Mode Toggle Button */}
        <button
          type="button"
          onClick={toggleMode}
          className="relative flex h-9.5 w-9.5 items-center justify-center rounded-[12px] border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 transition-all duration-200 hover:bg-white/90 dark:hover:bg-white/10 hover:scale-105 cursor-pointer shadow-xs"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle dark mode"
        >
          {isDarkMode ? (
            <Sun size={17} className="text-amber-400 transition-transform duration-300 hover:rotate-45" strokeWidth={2.2} />
          ) : (
            <Moon size={17} className="text-slate-600 transition-transform duration-300 hover:-rotate-12" strokeWidth={2} />
          )}
        </button>

        {/* Calendar / Events */}
        <button
          type="button"
          onClick={onCalendarClick}
          className="relative flex h-9.5 w-9.5 items-center justify-center rounded-[12px] border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 transition-all hover:bg-white/90 dark:hover:bg-white/10 hover:scale-105 cursor-pointer shadow-xs"
          aria-label="Open events and calendar"
          title="Events & Calendar"
        >
          <Calendar size={17} strokeWidth={1.8} />
        </button>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen((current) => !current)}
            className="relative flex h-9.5 w-9.5 items-center justify-center rounded-[12px] border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 transition-all hover:bg-white/90 dark:hover:bg-white/10 hover:scale-105 cursor-pointer shadow-xs"
            aria-label="Open notifications"
          >
            <Bell size={17} strokeWidth={1.8} />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-w-4 h-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white shadow-xs animate-pulse-subtle">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>

          {notificationsOpen ? (
            <div className="absolute right-0 mt-2 w-[22rem] sm:w-[24rem] overflow-hidden rounded-[22px] border border-white/80 dark:border-white/15 bg-white/90 dark:bg-[#131620]/90 shadow-2xl backdrop-blur-2xl animate-fade-scale z-50">
              <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.08] px-4 py-3 bg-white/50 dark:bg-white/[0.02]">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Notifications</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{unreadCount} unread</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await markAllRead();
                      setNotificationsOpen(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-black/[0.04] dark:bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-black/[0.08] dark:hover:bg-white/15 cursor-pointer"
                  >
                    <CheckCheck size={13} />
                    Mark all
                  </button>
                  <Link
                    to="/app/notifications"
                    onClick={() => setNotificationsOpen(false)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)]/15 dark:bg-[var(--primary)]/25 px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/25"
                  >
                    View all
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>

              <div className="max-h-[22rem] overflow-y-auto p-2 space-y-1">
                {notifications.length ? (
                  notifications.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        markRead(item.id);
                        if (item.link) navigate(item.link);
                        setNotificationsOpen(false);
                      }}
                      className={`w-full rounded-[14px] p-2.5 text-left transition-all duration-150 cursor-pointer ${
                        item.isRead
                          ? 'bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                          : 'bg-[var(--primary)]/8 dark:bg-[var(--primary)]/15 hover:bg-[var(--primary)]/12 border border-[var(--primary)]/15'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] ${
                            item.isRead
                              ? 'bg-black/[0.05] dark:bg-white/10 text-slate-500 dark:text-slate-400'
                              : 'bg-[var(--primary)] text-white shadow-xs'
                          }`}
                        >
                          <Bell size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                              {item.title || 'Notification'}
                            </p>
                            {!item.isRead ? (
                              <Badge tone="primary" size="sm">
                                New
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                            {item.message || ''}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                            <Clock3 size={10} />
                            {formatTime(item.createdAt)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">You're all caught up</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">New alerts will appear here instantly.</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* User Profile */}
        <div className="relative pl-1" ref={dropdownRef}>
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <UserAvatar
              name={user?.fullName || user?.name || 'Admin'}
              className="h-9.5 w-9.5 text-slate-400 border border-white/60 dark:border-white/15 shadow-xs transition-transform duration-150 group-hover:scale-105"
              fallbackSize={16}
            />
          </div>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-[22px] bg-white/90 dark:bg-[#131620]/90 border border-white/80 dark:border-white/15 shadow-2xl backdrop-blur-2xl focus:outline-none overflow-hidden p-1.5 animate-fade-scale z-50">
              <div className="flex items-center gap-3 px-3 py-3 border-b border-black/[0.06] dark:border-white/[0.08]">
                <UserAvatar
                  name={user?.fullName || user?.name || 'Admin'}
                  className="h-10 w-10 text-slate-500 border border-white/60 dark:border-white/15 shadow-xs"
                  fallbackSize={20}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {user?.fullName || user?.name || 'System Admin'}
                  </p>
                  <p className="text-[11px] font-semibold text-[var(--primary)] truncate">
                    {user?.role || 'Admin'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {user?.email || 'admin@webitof.com'}
                  </p>
                </div>
              </div>
              <div className="p-1 space-y-0.5">
                <Link
                  to="/app/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/10"
                >
                  <Settings size={14} className="text-slate-400" />
                  Edit Profile
                </Link>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
