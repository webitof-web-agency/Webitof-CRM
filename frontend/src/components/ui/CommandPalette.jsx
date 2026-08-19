import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  Target,
  ListChecks,
  Building2,
  BriefcaseBusiness,
  ReceiptText,
  Banknote,
  CircleDollarSign,
  AlarmClock,
  Boxes,
  MessageSquareText,
  RotateCw,
  FileArchive,
  Wrench,
  ShieldCheck,
  SquareUser,
  Users,
  UserCog,
  Cog,
  Bell,
  Moon,
  Sun,
  Laptop,
  PlusCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';

export function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { mode, setMode } = useTheme();
  const { hasPermission } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const allItems = useMemo(() => {
    const items = [];

    // Navigation items
    const navItems = [
      { id: 'nav-dashboard', label: 'Dashboard', category: 'Navigation', icon: LayoutDashboard, path: '/app/dashboard', permission: 'dashboard.view' },
      { id: 'nav-leads', label: 'Leads & Opportunities', category: 'Navigation', icon: Target, path: '/app/leads', permission: 'leads.read' },
      { id: 'nav-followups', label: 'Follow-ups & Tasks', category: 'Navigation', icon: ListChecks, path: '/app/follow-ups' },
      { id: 'nav-clients', label: 'Clients & Accounts', category: 'Navigation', icon: Building2, path: '/app/clients', permission: 'clients.read' },
      { id: 'nav-projects', label: 'Projects & Workspaces', category: 'Navigation', icon: BriefcaseBusiness, path: '/app/projects', permission: 'projects.read' },
      { id: 'nav-invoices', label: 'Invoices & Billing', category: 'Navigation', icon: ReceiptText, path: '/app/invoices', permission: 'invoices.read' },
      { id: 'nav-payments', label: 'Payments & Collections', category: 'Navigation', icon: Banknote, path: '/app/payments', permission: 'payments.read' },
      { id: 'nav-finance', label: 'Finance & Ledger', category: 'Navigation', icon: CircleDollarSign, path: '/app/finance', permission: 'reports.view' },
      { id: 'nav-expenses', label: 'Expenses & Receipts', category: 'Navigation', icon: FileArchive, path: '/app/expenses', permission: 'expenses.read' },
      { id: 'nav-amc', label: 'AMC & Contracts', category: 'Navigation', icon: RotateCw, path: '/app/amc', permission: 'amc.read' },
      { id: 'nav-banking', label: 'Banking & Accounts', category: 'Navigation', icon: Wrench, path: '/app/banking', permission: 'banking.read' },
      { id: 'nav-automation', label: 'Automation & Rules', category: 'Navigation', icon: AlarmClock, path: '/app/automation', permission: 'reports.view' },
      { id: 'nav-reports', label: 'Reports & Analytics', category: 'Navigation', icon: SquareUser, path: '/app/reports', permission: 'reports.view' },
      { id: 'nav-files', label: 'File Manager', category: 'Navigation', icon: FileArchive, path: '/app/files', permission: 'files.read' },
      { id: 'nav-users', label: 'User Management', category: 'Navigation', icon: Users, path: '/app/users', permission: 'users.manage' },
      { id: 'nav-roles', label: 'Roles & Permissions', category: 'Navigation', icon: UserCog, path: '/app/roles', permission: 'roles.manage' },
      { id: 'nav-settings', label: 'System Settings', category: 'Navigation', icon: Cog, path: '/app/settings', permission: 'settings.read' },
      { id: 'nav-notifications', label: 'Notification Center', category: 'Navigation', icon: Bell, path: '/app/notifications' }
    ];

    navItems.forEach((item) => {
      if (!item.permission || hasPermission(item.permission)) {
        items.push({
          ...item,
          action: () => {
            navigate(item.path);
            onClose();
          }
        });
      }
    });

    // Quick Actions
    if (hasPermission('leads.write') || hasPermission('leads.create')) {
      items.push({
        id: 'action-new-lead',
        label: 'Create New Lead',
        category: 'Quick Actions',
        icon: PlusCircle,
        action: () => {
          navigate('/app/leads');
          onClose();
        }
      });
    }

    if (hasPermission('clients.write') || hasPermission('clients.create')) {
      items.push({
        id: 'action-new-client',
        label: 'Add New Client',
        category: 'Quick Actions',
        icon: PlusCircle,
        action: () => {
          navigate('/app/clients/new');
          onClose();
        }
      });
    }

    if (hasPermission('invoices.write') || hasPermission('invoices.create')) {
      items.push({
        id: 'action-new-invoice',
        label: 'Create New Invoice',
        category: 'Quick Actions',
        icon: PlusCircle,
        action: () => {
          navigate('/app/invoices/new');
          onClose();
        }
      });
    }

    if (hasPermission('payments.write') || hasPermission('payments.create')) {
      items.push({
        id: 'action-new-payment',
        label: 'Record New Payment',
        category: 'Quick Actions',
        icon: PlusCircle,
        action: () => {
          navigate('/app/payments/new');
          onClose();
        }
      });
    }

    // Appearance / Theme
    items.push({
      id: 'theme-light',
      label: 'Switch to Light Theme',
      category: 'Appearance',
      icon: Sun,
      action: () => {
        setMode('light');
        onClose();
      }
    });

    items.push({
      id: 'theme-dark',
      label: 'Switch to Dark Theme',
      category: 'Appearance',
      icon: Moon,
      action: () => {
        setMode('dark');
        onClose();
      }
    });

    items.push({
      id: 'theme-system',
      label: 'Use System Theme Preference',
      category: 'Appearance',
      icon: Laptop,
      action: () => {
        setMode('system');
        onClose();
      }
    });

    return items;
  }, [hasPermission, navigate, onClose, setMode]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (!open) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredItems, selectedIndex, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/45 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-[var(--radius-card,1.25rem)] border border-[var(--border-glass)] bg-[var(--surface)] shadow-[var(--shadow-modal)] backdrop-blur-2xl animate-fade-scale"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        {/* Search Bar */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5 bg-[var(--surface)]">
          <Search size={18} className="text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search modules... (e.g. Leads, Invoices, Dark mode)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] font-medium"
          />
          <kbd className="hidden sm:inline-flex items-center rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[340px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              No matching commands or pages found.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-[var(--primary-subtle)] text-[var(--primary)] font-semibold'
                      : 'text-[var(--text-main)] hover:bg-[var(--hover-bg)]'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
                        isSelected
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-white shadow-2xs'
                          : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                      )}
                    >
                      <Icon size={14} />
                    </div>
                    <span className="truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-[var(--text-muted)] font-normal hidden sm:inline">
                      {item.category}
                    </span>
                    {isSelected ? (
                      <ArrowRight size={13} className="text-[var(--primary)]" />
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-2)]/80 px-4 py-2 text-[11px] text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 font-mono text-[10px]">↑</kbd>{' '}
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 font-mono text-[10px]">↓</kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>{' '}
              Select
            </span>
          </div>
          <span className="flex items-center gap-1 font-medium text-[var(--primary)]">
            <Sparkles size={12} />
            Spotlight CRM
          </span>
        </div>
      </div>
    </div>
  );
}
