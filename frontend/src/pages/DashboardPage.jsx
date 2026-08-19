import { useEffect, useState } from 'react';
import {
  RefreshCw,
  ShieldCheck,
  BriefcaseBusiness,
  FileText,
  Wallet,
  Banknote,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  MoreVertical,
  CreditCard,
  CalendarCheck,
  Users,
  Receipt,
  UploadCloud,
  Zap,
  Clock,
  Folder,
  ArrowDownToLine,
  PieChart,
  LineChart,
  UserPlus,
  CloudUpload,
  Rocket,
  Search,
  ArrowUpRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api/client';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';

function formatAmount(value) {
  const number = Number(value || 0);
  return number.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  });
}

function formatCount(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

// Sleek SVG Sparkline for visuals
function Sparkline({ color, points = [10, 20, 15, 25, 20, 30, 15] }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const paddingX = 2;
  const paddingY = 4;
  const width = 100;
  const height = 36;

  const getPoint = (val, i) => {
    const x = (i / (points.length - 1)) * (width - paddingX * 2) + paddingX;
    const y = height - paddingY - ((val - min) / range) * (height - paddingY * 2);
    return { x, y };
  };

  const pointCoords = points.map((val, i) => getPoint(val, i));
  const polylineStr = pointCoords.map((p) => `${p.x},${p.y}`).join(' ');
  const polygonStr = `${pointCoords[0].x},${height} ${polylineStr} ${pointCoords[pointCoords.length - 1].x},${height}`;
  const gradientId = `gradient-${String(color).replace('#', '').replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={polygonStr} fill={`url(#${gradientId})`} />
      <polyline
        points={polylineStr}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pointCoords.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} />
      ))}
    </svg>
  );
}

export function DashboardPage() {
  const { token, hasPermission, user } = useAuth();
  const canViewReports = hasPermission('reports.view');

  const [summary, setSummary] = useState(null);
  const [profitLoss, setProfitLoss] = useState(null);
  const [gst, setGst] = useState(null);
  const [pendingPayables, setPendingPayables] = useState([]);
  const [renewals, setRenewals] = useState({ nearby: [], expired: [], future: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!canViewReports) {
        if (mounted) setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [dashboardRes, profitLossRes, gstRes, payablesRes, renewalsRes] = await Promise.all([
          api.reports.dashboard(token),
          api.reports.profitLoss(token),
          api.reports.gst(token),
          api.reports.pendingPayables(token),
          api.reports.renewalDashboard(token)
        ]);
        if (!mounted) return;
        setSummary(dashboardRes.data || {});
        setProfitLoss(profitLossRes.data || {});
        setGst(gstRes.data || {});
        setPendingPayables(payablesRes.data || []);
        setRenewals(renewalsRes.data || { nearby: [], expired: [], future: [] });
      } catch (error) {
        if (!mounted) return;
        toast.error('Unable to load dashboard metrics');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [canViewReports, token]);

  const renewalRows = [
    ...(renewals.expired || []),
    ...(renewals.nearby || []),
    ...(renewals.future || [])
  ].map((item) => ({
    ...item,
    rowStatus: item.status || (item.recordType === 'AMC' ? 'AMC' : 'Renewal')
  }));

  const dummyPoints = [10, 20, 15, 25, 20, 30, 15];

  return (
    <div className="space-y-6">
      {/* Hero Banner with Modern SaaS Glass Layer */}
      <div
        className="relative overflow-hidden rounded-[var(--radius-card,1.25rem)] p-6 md:p-8 text-white shadow-lg"
        style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 80%, black) 100%)'
        }}
      >
        {/* Dynamic Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/20 pointer-events-none" />

        {/* Ambient Decorative Shapes (Desktop) */}
        <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none hidden md:block overflow-hidden opacity-30">
          <div className="absolute -top-10 right-10 w-72 h-72 rounded-full bg-white/20 blur-2xl" />
          <div className="absolute bottom-0 right-40 w-60 h-60 rounded-full bg-white/10 blur-xl" />
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md mb-3 border border-white/20">
            <span>✨ Overview Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
            Welcome back, {user?.fullName || user?.name || 'System Admin'} 👋
          </h1>
          <p className="text-white/80 max-w-xl text-xs sm:text-sm leading-relaxed mb-6">
            Here is what is happening across your CRM, client accounts, projects, and financials today.
          </p>

          {/* Quick Metrics Bar in Hero */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-md p-3 border border-white/15">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
                <Users size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-white/80 block truncate">Clients</span>
                <span className="text-lg font-bold text-white block truncate">
                  {summary?.totalClients || 0}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-md p-3 border border-white/15">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
                <Folder size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-white/80 block truncate">Projects</span>
                <span className="text-lg font-bold text-white block truncate">
                  {summary?.totalProjects || 0}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-md p-3 border border-white/15">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-white/80 block truncate">Invoices</span>
                <span className="text-lg font-bold text-white block truncate">
                  {summary?.totalInvoices || 0}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-md p-3 border border-white/15">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
                <CalendarCheck size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-white/80 block truncate">Due Renewals</span>
                <span className="text-lg font-bold text-white block truncate">
                  {summary?.renewalsExpiringSoon || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid (6 Columns) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {[
          {
            label: 'Total Clients',
            value: formatCount(summary?.totalClients || 0),
            icon: Users,
            color: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
            sub: 'Active CRM accounts'
          },
          {
            label: 'Total Projects',
            value: formatCount(summary?.totalProjects || 0),
            icon: Folder,
            color: 'text-purple-600 dark:text-purple-400',
            bg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
            sub: 'Workspaces active'
          },
          {
            label: 'Invoiced',
            value: formatAmount(summary?.totalInvoiceAmount || 0),
            icon: FileText,
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
            sub: 'Current month total'
          },
          {
            label: 'Received',
            value: formatAmount(summary?.totalReceived || 0),
            icon: ArrowDownToLine,
            color: 'text-teal-600 dark:text-teal-400',
            bg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
            sub: 'Collections credited'
          },
          {
            label: 'Due Balances',
            value: formatAmount(summary?.totalDue || 0),
            icon: Clock,
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
            sub: 'Outstanding revenue'
          },
          {
            label: 'GST Payable',
            value: formatAmount(summary?.netGstPayable || 0),
            icon: PieChart,
            color: 'text-rose-600 dark:text-rose-400',
            bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
            sub: 'Net tax liability'
          }
        ].map((stat, i) => (
          <Card
            key={i}
            className="p-4 flex flex-col justify-between bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-float)] transition-all duration-200"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate">
                {stat.label}
              </span>
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border',
                  stat.bg,
                  stat.color
                )}
              >
                <stat.icon size={16} strokeWidth={2} />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[var(--text-main)] tracking-tight leading-tight truncate">
                {stat.value}
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] mt-1 truncate">{stat.sub}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Grid: Finance Overview + Health + Quick Actions */}
      <div className="grid lg:grid-cols-12 gap-5">
        {/* Finance Overview (5 Cols) */}
        <Card className="lg:col-span-5 bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)] flex flex-col !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface)]">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)]">
                <LineChart size={18} strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--text-main)]">Finance Overview</h3>
                <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">
                  Profit, expense & GST breakdown
                </p>
              </div>
            </div>
            <Link
              to="/app/finance"
              className="text-xs font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
            >
              Ledger
              <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="flex-1 flex flex-col divide-y divide-[var(--border)]">
            {/* Top Row: Revenue, Expense, Profit */}
            <div className="grid grid-cols-3 divide-x divide-[var(--border)] bg-[var(--surface)]">
              {[
                { label: 'Revenue', value: formatAmount(profitLoss?.revenue || 0), color: '#3b82f6', points: dummyPoints },
                { label: 'Expense', value: formatAmount(profitLoss?.expense || 0), color: '#a855f7', points: dummyPoints },
                { label: 'Net Profit', value: formatAmount(profitLoss?.profit || 0), color: '#10b981', points: dummyPoints }
              ].map((item, i) => (
                <div key={i} className="p-3.5 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate">
                    {item.label}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[var(--text-main)] mt-1 truncate">
                    {item.value}
                  </span>
                  <div className="h-8 w-full mt-2">
                    <Sparkline color={item.color} points={item.points} />
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Row: GST Output, Input, Net */}
            <div className="grid grid-cols-3 divide-x divide-[var(--border)] bg-[var(--surface)]">
              {[
                { label: 'GST Output', value: formatAmount(gst?.outputGst || 0), color: '#f59e0b', points: dummyPoints },
                { label: 'GST Input', value: formatAmount(gst?.inputGst || 0), color: '#06b6d4', points: dummyPoints },
                { label: 'Net GST', value: formatAmount(gst?.netGstPayable || 0), color: '#ec4899', points: dummyPoints }
              ].map((item, i) => (
                <div key={i} className="p-3.5 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate">
                    {item.label}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[var(--text-main)] mt-1 truncate">
                    {item.value}
                  </span>
                  <div className="h-8 w-full mt-2">
                    <Sparkline color={item.color} points={item.points} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Operational Health (3 Cols) */}
        <Card className="lg:col-span-3 p-5 bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)] flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)]">
              <CheckCircle2 size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[var(--text-main)]">Operational Health</h3>
              <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">Key operational metrics</p>
            </div>
          </div>

          <div className="flex-1 space-y-1 divide-y divide-[var(--border)]">
            {[
              { label: 'Pending invoices', value: summary?.pendingInvoices || 0, icon: FileText },
              { label: 'AMC expiring (30d)', value: summary?.amcExpiringSoon || 0, icon: Clock },
              { label: 'Renewals due (30d)', value: summary?.renewalsExpiringSoon || 0, icon: RefreshCw },
              { label: 'Total invoices', value: summary?.totalInvoices || 0, icon: FileText },
              { label: 'Active projects', value: summary?.activeProjects || 0, icon: Rocket }
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2.5 text-[var(--text-muted)] min-w-0">
                  <item.icon size={14} className="shrink-0 text-[var(--primary)]" />
                  <span className="text-xs font-medium truncate">{item.label}</span>
                </div>
                <Badge tone="neutral" size="sm">
                  {item.value}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Actions (4 Cols) */}
        <Card className="lg:col-span-4 p-5 bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)] flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)]">
              <Zap size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[var(--text-main)]">Quick Actions</h3>
              <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">Shortcuts to workflows</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2.5 flex-1 items-center">
            {[
              { label: 'Client', icon: UserPlus, link: '/app/clients', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' },
              { label: 'Project', icon: Folder, link: '/app/projects', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' },
              { label: 'Invoice', icon: FileText, link: '/app/invoices/new', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800' },
              { label: 'Payment', icon: Wallet, link: '/app/payments/new', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
              { label: 'Expense', icon: Receipt, link: '/app/expenses', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' },
              { label: 'Files', icon: CloudUpload, link: '/app/files', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800' },
              { label: 'Renewals', icon: CalendarCheck, link: '/app/amc', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' },
              { label: 'Reports', icon: BarChart3, link: '/app/reports', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' }
            ].map((action, i) => (
              <Link
                key={i}
                to={action.link}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--hover-bg)] hover:border-[var(--primary)] transition-all duration-150 gap-2 text-center group"
              >
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border transition-transform group-hover:scale-105',
                    action.bg,
                    action.color
                  )}
                >
                  <action.icon size={16} strokeWidth={2} />
                </div>
                <span className="text-[10px] font-bold text-[var(--text-main)] truncate w-full">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom Grid: Recent Activity + Pending Payables + Renewals */}
      <div className="grid lg:grid-cols-12 gap-5">
        {/* Recent Activity (5 Cols) */}
        <Card className="lg:col-span-5 p-5 bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)] min-h-[280px] flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)]">
                <Clock size={18} strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--text-main)]">Recent Activity</h3>
                <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">
                  Latest invoices & payments
                </p>
              </div>
            </div>
            <Link
              to="/app/invoices"
              className="text-xs font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
            >
              View all
              <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="flex-1 flex flex-col overflow-auto">
            {summary?.recentActivity && summary.recentActivity.length > 0 ? (
              <div className="space-y-2">
                {summary.recentActivity.slice(0, 4).map((item, i) => {
                  const dateObj = item.date ? new Date(item.date) : null;
                  const formattedDate =
                    dateObj && !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                      : 'Unknown';
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-muted)] hover:bg-[var(--hover-bg)] transition-colors"
                    >
                      <div className="flex flex-col text-left max-w-[65%] min-w-0">
                        <span className="text-xs font-bold text-[var(--text-main)] truncate">
                          {item.title || 'Transaction'}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] truncate">
                          {item.type} &bull; {formattedDate} &bull; {item.status}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={cn(
                            'text-xs font-bold',
                            item.type === 'Payment'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-[var(--text-main)]'
                          )}
                        >
                          {item.type === 'Payment' ? '+' : ''}
                          {formatAmount(item.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <Search size={24} className="text-[var(--text-muted)] opacity-50 mb-2" />
                <h4 className="text-xs font-bold text-[var(--text-main)]">No recent activity</h4>
                <p className="text-[10px] text-[var(--text-muted)]">Activity will appear as transactions are posted.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Pending Payables (3 Cols) */}
        <Card className="lg:col-span-3 p-5 bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)] min-h-[280px] flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)]">
                <FileText size={18} strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--text-main)]">Pending Payables</h3>
                <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">Bills awaiting payment</p>
              </div>
            </div>
            <Link
              to="/app/expenses"
              className="text-xs font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
            >
              View all
              <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="flex-1 flex flex-col overflow-auto">
            {pendingPayables && pendingPayables.length > 0 ? (
              <div className="space-y-2">
                {pendingPayables.slice(0, 4).map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-muted)] hover:bg-[var(--hover-bg)] transition-colors"
                  >
                    <div className="flex flex-col text-left max-w-[65%] min-w-0">
                      <span className="text-xs font-bold text-[var(--text-main)] truncate">
                        {item.title || item.vendorName || item.partnerName || item.employeeName || 'Payable'}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] truncate">
                        {item.type || 'Expense'}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-[var(--text-main)]">
                        {formatAmount(item.amount || item.payable || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <CheckCircle2 size={24} className="text-emerald-500 opacity-60 mb-2" />
                <h4 className="text-xs font-bold text-[var(--text-main)]">All payables cleared</h4>
                <p className="text-[10px] text-[var(--text-muted)]">No pending expense bills found.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Renewals (4 Cols) */}
        <Card className="lg:col-span-4 p-5 bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)] min-h-[280px] flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)]">
                <CalendarCheck size={18} strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--text-main)]">Renewals & AMC</h3>
                <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">Upcoming contract expiries</p>
              </div>
            </div>
            <Link
              to="/app/amc"
              className="text-xs font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
            >
              View all
              <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="flex-1 flex flex-col overflow-auto">
            {renewalRows && renewalRows.length > 0 ? (
              <div className="space-y-2">
                {renewalRows.slice(0, 4).map((item, i) => {
                  const dateStr = item.renewalDate || item.endDate || item.expiryDate;
                  const dateObj = dateStr ? new Date(dateStr) : null;
                  const formattedDate =
                    dateObj && !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                      : 'Unknown';
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-muted)] hover:bg-[var(--hover-bg)] transition-colors"
                    >
                      <div className="flex flex-col text-left max-w-[65%] min-w-0">
                        <span className="text-xs font-bold text-[var(--text-main)] truncate">
                          {item.domainName ||
                            item.hostingName ||
                            item.softwareName ||
                            item.amcType ||
                            item.title ||
                            'Renewal'}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] truncate">
                          {item.clientName || item.rowStatus || 'Renewal'} &bull; {formattedDate}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-[var(--text-main)]">
                          {formatAmount(item.renewalPrice || item.amcAmount || item.amount || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <CheckCircle2 size={24} className="text-emerald-500 opacity-60 mb-2" />
                <h4 className="text-xs font-bold text-[var(--text-main)]">No renewals pending</h4>
                <p className="text-[10px] text-[var(--text-muted)]">All contracts and domains are up to date.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

