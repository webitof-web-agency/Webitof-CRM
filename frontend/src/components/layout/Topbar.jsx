import { useState, useRef, useEffect } from 'react';
import { LogOut, Bell, Search, Sun, Moon, User, Calendar, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SidebarToggle } from './Sidebar';
import { UserAvatar } from '../ui/UserAvatar';
import { Link } from 'react-router-dom';

function initials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function Topbar({ title, subtitle, onMenuClick, onCalendarClick }) {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
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
          <button className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] hover-text-primary">
            <Bell size={20} strokeWidth={1.5} />
          </button>

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
