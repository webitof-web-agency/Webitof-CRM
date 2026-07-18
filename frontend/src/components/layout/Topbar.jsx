import { useState, useRef, useEffect } from 'react';
import { LogOut, Bell, Calendar, Settings, Clock3, ArrowUpRight, CheckCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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

export function Topbar({ title, subtitle, onMenuClick, onCalendarClick }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { unreadCount, notifications, markRead, markAllRead } = useNotifications();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const notificationsRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-20 py-3 px-4 md:px-8 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm print:hidden">
      <div className="flex w-full items-center justify-between gap-4">

        {/* Left section: Toggle & Title */}
        <div className="flex items-center gap-4">
          <div>
            <SidebarToggle onClick={onMenuClick} />
          </div>
        </div>

        {/* Right section: Notifications, Profile */}
        <div className="flex items-center gap-3">

          {/* Calendar */}
          <button
            type="button"
            onClick={onCalendarClick}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] hover-text-primary"
            aria-label="Open events"
          >
            <Calendar size={20} strokeWidth={1.5} />
          </button>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={() => setNotificationsOpen((current) => !current)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] hover-text-primary"
              aria-label="Open notifications"
            >
              <Bell size={20} strokeWidth={1.5} />
              {unreadCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </button>

            {notificationsOpen ? (
              <div className="absolute right-0 mt-2 w-[22rem] overflow-hidden rounded-[var(--radius-card,1.75rem)] border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Notifications</p>
                    <p className="text-xs text-slate-500">{unreadCount} unread</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await markAllRead();
                        setNotificationsOpen(false);
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                    >
                      <CheckCheck size={13} />
                      Mark all
                    </button>
                    <Link
                      to="/app/notifications"
                      onClick={() => setNotificationsOpen(false)}
                      className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,white)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition hover:bg-[color-mix(in_srgb,var(--primary)_16%,white)]"
                    >
                      View all
                      <ArrowUpRight size={13} />
                    </Link>
                  </div>
                </div>

                <div className="max-h-[24rem] overflow-y-auto p-2">
                  {notifications.length ? (
                    notifications.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={async () => {
                          if (!item.isRead) {
                            markRead(item.id).catch(() => {});
                          }
                          setNotificationsOpen(false);
                          if (item.routePath) {
                            navigate(item.routePath);
                          } else {
                            navigate('/app/notifications');
                          }
                        }}
                        className={`w-full rounded-2xl border p-3 text-left transition ${
                          item.isRead
                            ? 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                            : 'border-[color-mix(in_srgb,var(--primary)_18%,#dbe4f0)] bg-[color-mix(in_srgb,var(--primary)_4%,white)]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${item.isRead ? 'bg-slate-100 text-slate-500' : 'bg-[color-mix(in_srgb,var(--primary)_12%,white)] text-[var(--primary)]'}`}>
                            <Bell size={15} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-slate-800">{item.title || 'Notification'}</p>
                              {!item.isRead ? <Badge tone="info" className="border-transparent bg-[color-mix(in_srgb,var(--primary)_10%,white)] text-[var(--primary)]">New</Badge> : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.message || ''}</p>
                            <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                              <Clock3 size={11} />
                              {formatTime(item.createdAt)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-10 text-center">
                      <p className="text-sm font-medium text-slate-700">You're all caught up</p>
                      <p className="mt-1 text-xs text-slate-500">New alerts will appear here instantly.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* User Profile */}
          <div className="relative" ref={dropdownRef}>
            <div 
              className="flex items-center gap-3 pl-2 cursor-pointer group"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <UserAvatar 
                name={user?.fullName || user?.name || 'Admin'} 
                className="h-9 w-9 text-slate-400 shadow-sm ring-2 ring-white transition-all duration-200 group-hover:scale-105 group-hover:shadow-md group-hover:bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] group-hover:text-[var(--primary)]" 
                fallbackSize={18} 
              />
            </div>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-[var(--radius-card,1.75rem)] bg-white shadow-xl ring-1 ring-black/5 focus:outline-none overflow-hidden p-1 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                  <UserAvatar 
                    name={user?.fullName || user?.name || 'Admin'} 
                    className="h-12 w-12 text-slate-500 ring-4 ring-white shadow-sm" 
                    fallbackSize={24} 
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{user?.fullName || user?.name || 'System Admin'}</p>
                    <p className="text-xs font-medium text-[var(--primary)] mt-0.5 truncate">{user?.role || 'Admin'}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{user?.email || 'admin@webitof.com'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1">
                  <Link
                    to="/app/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Settings size={16} />
                    Edit
                  </Link>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
