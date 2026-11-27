import { BarChart3, CalendarCheck, CloudUpload, FileText, Folder, Receipt, UserPlus, Users, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EmployeeDashboard } from '../components/dashboard/EmployeeDashboard';
import { BusinessDashboard } from '../components/dashboard/BusinessDashboard';

// Each shortcut shows only when its page would open for the user.
const QUICK_ACTIONS = [
  { label: 'Leads', icon: Users, link: '/app/leads', permission: 'leads.read', limitedOnly: true, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' },
  { label: 'Client', icon: UserPlus, link: '/app/clients', permission: 'clients.read', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' },
  { label: 'Project', icon: Folder, link: '/app/projects', permission: 'projects.read', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' },
  { label: 'Invoice', icon: FileText, link: '/app/invoices/new', permission: 'invoices.write', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800' },
  { label: 'Payment', icon: Wallet, link: '/app/payments/new', permission: 'payments.write', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
  { label: 'Expense', icon: Receipt, link: '/app/expenses', permission: 'expenses.read', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' },
  { label: 'Files', icon: CloudUpload, link: '/app/files', permission: 'files.read', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800' },
  { label: 'Renewals', icon: CalendarCheck, link: '/app/amc', permission: 'amc.read', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' },
  { label: 'Reports', icon: BarChart3, link: '/app/reports', permission: 'reports.view', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' }
];

const isAdmin = (user) => Boolean(user?.isSuperAdmin) || (user?.roles || []).some((role) => String(role?.code || '').toLowerCase() === 'admin');

/**
 * Admins get the whole business on one screen. Every other role gets their own day (personal
 * dashboard) followed by the business blocks their role may see: money for an accountant, the
 * sales team for a sales manager, projects for a CTO... The server decides which blocks to send.
 */
export function DashboardPage() {
  const { token, user, hasPermission } = useAuth();
  if (isAdmin(user)) return <BusinessDashboard token={token} />;
  const quickActions = QUICK_ACTIONS.filter((action) => hasPermission(action.permission));
  return (
    <div className="space-y-6">
      <EmployeeDashboard token={token} quickActions={quickActions} hasPermission={hasPermission} />
      <BusinessDashboard token={token} compact />
    </div>
  );
}
