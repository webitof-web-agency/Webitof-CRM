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
  Sparkles,
  Loader2,
  FileText,
  Scale,
  FileImage
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { cn } from '../../lib/cn';

export function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { mode, setMode } = useTheme();
  const { token, hasPermission } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveResults, setLiveResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setLiveResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Live entity search with debounce
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2 || !token) {
      setLiveResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await api.search.global(token, trimmed);
        if (res.data) {
          const results = [];
          const { leads = [], clients = [], invoices = [], projects = [] } = res.data;

          leads.forEach((l) => {
            results.push({
              id: `lead-${l.id}`,
              label: l.title,
              subtitle: l.subtitle,
              category: 'Leads',
              icon: Target,
              action: () => {
                navigate(l.path);
                onClose();
              }
            });
          });

          clients.forEach((c) => {
            results.push({
              id: `client-${c.id}`,
              label: c.title,
              subtitle: c.subtitle,
              category: 'Clients',
              icon: Building2,
              action: () => {
                navigate(c.path);
                onClose();
              }
            });
          });

          invoices.forEach((inv) => {
            results.push({
              id: `invoice-${inv.id}`,
              label: inv.title,
              subtitle: inv.subtitle,
              category: 'Invoices',
              icon: ReceiptText,
              action: () => {
                navigate(inv.path);
                onClose();
              }
            });
          });

          projects.forEach((p) => {
            results.push({
              id: `project-${p.id}`,
              label: p.title,
              subtitle: p.subtitle,
              category: 'Projects',
              icon: BriefcaseBusiness,
              action: () => {
                navigate(p.path);
                onClose();
              }
            });
          });

          setLiveResults(results);
        }
      } catch {
        setLiveResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query, token, navigate, onClose]);

  const allItems = useMemo(() => {
    const items = [];

    // Navigation items
    const navItems = [
      { id: 'nav-dashboard', label: 'Dashboard', category: 'Navigation', icon: LayoutDashboard, path: '/app/dashboard', permission: 'dashboard.view' },
      { id: 'nav-followups', label: 'Follow-ups & Tasks', category: 'Navigation', icon: ListChecks, path: '/app/follow-ups' },
      { id: 'nav-leads', label: 'Leads & Opportunities', category: 'Navigation', icon: Target, path: '/app/leads', permission: 'leads.read' },
      { id: 'nav-clients', label: 'Clients & Accounts', category: 'Navigation', icon: Building2, path: '/app/clients', permission: 'clients.read' },
      { id: 'nav-projects', label: 'Projects & Workspaces', category: 'Navigation', icon: BriefcaseBusiness, path: '/app/projects', permission: 'projects.read' },
      { id: 'nav-quotations', label: 'Quotations', category: 'Navigation', icon: FileText, path: '/app/quotations', permission: 'leads.read' },
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
      { id: 'nav-service-master', label: 'Service Master', category: 'Navigation', icon: Boxes, path: '/app/service-master', permission: 'masters.read' },
      { id: 'nav-quotation-master', label: 'Quotation Master', category: 'Navigation', icon: FileImage, path: '/app/quotation-master', permission: 'masters.read' },
      { id: 'nav-legal-master', label: 'Legal Master (Terms & Conditions)', category: 'Navigation', icon: Scale, path: '/app/legal-master', permission: 'masters.read' },
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
    const list = [...liveResults];
    if (!query.trim()) return allItems;
    const q = query.toLowerCase().trim();
    const staticMatches = allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
    return [...list, ...staticMatches];
  }, [allItems, liveResults, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, liveResults]);

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
          {searching ? (
            <Loader2 size={18} className="text-[var(--primary)] animate-spin shrink-0" />
          ) : (
            <Search size={18} className="text-[var(--text-muted)] shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Search leads, clients, invoices, or type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] font-medium"
          />
          <kbd className="hidden sm:inline-flex items-center rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              No matching records, commands, or pages found.
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
                    'flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-medium transition-colors cursor-pointer',
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
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold">{item.label}</div>
                      {item.subtitle && (
                        <div className="truncate text-[11px] text-[var(--text-muted)] font-normal">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]">
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
            Live Search & Spotlight
          </span>
        </div>
      </div>
    </div>
  );
}
