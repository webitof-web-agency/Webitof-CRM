import {
  Banknote,
  CircleDollarSign,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Bell,
  LayoutDashboard,
  LucideFileText,
  MessageSquareText,
  ReceiptText,
  RotateCw,
  ShieldCheck,
  SquareUser,
  Users,
  Wrench,
  FileArchive,
  Cog,
  UserCog,
  Target,
  AlarmClock,
  ListChecks
} from 'lucide-react';

export const navigationGroups = [
  {
    title: '',
    standalone: true,
    items: [
      { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' }
    ]
  },
  {
    title: 'Workspace',
    items: [
      { label: 'Leads', path: '/app/leads', icon: Target, permission: 'leads.read' },
      { label: 'Follow-ups', path: '/app/follow-ups', icon: ListChecks, permissions: ['followups.view_own', 'followups.view_team', 'followups.view_all'] },
      { label: 'Clients', path: '/app/clients', icon: Building2, permission: 'clients.read' },
      { label: 'Projects', path: '/app/projects', icon: BriefcaseBusiness, permission: 'projects.read' },
      { label: 'Invoices', path: '/app/invoices', icon: ReceiptText, permission: 'invoices.read' },
      { label: 'Payments', path: '/app/payments', icon: Banknote, permission: 'payments.read' },
      { label: 'Finance', path: '/app/finance', icon: CircleDollarSign, permission: 'reports.view' },
      { label: 'Notifications', path: '/app/notifications', icon: Bell },
      { label: 'Automation', path: '/app/automation', icon: AlarmClock, permission: 'reports.view' }
    ]
  },
  {
    title: 'Operations',
    items: [
      { label: 'Expenses', path: '/app/expenses', icon: FileArchive, permission: 'expenses.read' },
      { label: 'Outsourcing', path: '/app/outsourcing', icon: Boxes, permission: 'outsourcing.read' },
      { label: 'Lead Commissions', path: '/app/lead-commissions', icon: MessageSquareText, permission: 'lead-commissions.read' },
      { label: 'Banking', path: '/app/banking', icon: Wrench, permission: 'banking.read' },
      { label: 'AMC', path: '/app/amc', icon: RotateCw, permission: 'amc.read' },
      { label: 'Renewals', path: '/app/renewals', icon: LucideFileText, permission: 'renewals.read' }
    ]
  },
  {
    title: 'Administration',
    items: [
      { label: 'Masters', path: '/app/masters', icon: ShieldCheck, permission: 'masters.read' },
      { label: 'Reports', path: '/app/reports', icon: SquareUser, permission: 'reports.view' },
      { label: 'Files', path: '/app/files', icon: FileArchive, permission: 'files.read' },
      { label: 'Users', path: '/app/users', icon: Users, permission: 'users.manage' },
      { label: 'Roles', path: '/app/roles', icon: UserCog, permission: 'roles.manage' },
      { label: 'Settings', path: '/app/settings', icon: Cog, permission: 'settings.read' }
    ]
  }
];
