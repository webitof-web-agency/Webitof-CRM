import { canOpenHrm, hasEmployeeProfile } from '../lib/hrmAccess';
import {
  PhoneCall,
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
  FileSignature,
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
  ListChecks,
  CheckCircle2,
  Clock3,
  LayoutList,
  UsersRound,
  CalendarCheck,
  MapPinned,
  Timer,
  CalendarOff,
  CalendarHeart,
  ClipboardList,
  Clock,
  Network,
  BarChart3,
  Receipt,
  BadgePercent,
  Briefcase,
  UserSearch,
  Video,
  UserPlus,
  Award,
  GraduationCap,
  Laptop,
  FolderOpen,
  UserMinus,
  DoorOpen,
  LifeBuoy,
  FileCheck2,
  SlidersHorizontal,
  History,
  Settings,
  Scale,
  FileImage
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
      {
        label: 'Follow-ups',
        path: '/app/follow-ups',
        icon: ListChecks,
        permissions: ['followups.view_own', 'followups.view_team', 'followups.view_all'],
        children: [
          { label: 'Overview', path: '/app/follow-ups?view=today', icon: Clock3 },
          { label: 'All Follow-ups', path: '/app/follow-ups?view=list', icon: LayoutList },
          { label: 'Workload', path: '/app/follow-ups?view=workload', icon: UsersRound },
          { label: 'Completed', path: '/app/follow-ups?view=completed', icon: CheckCircle2 },
          { label: 'Report', path: '/app/follow-ups?view=report', icon: BarChart3 },
          { label: 'Analytics', path: '/app/follow-ups?view=analytics', icon: BarChart3 }
        ]
      },
            {
        label: 'Call History',
        path: '/app/call-history',
        icon: PhoneCall,
        permissions: ['calls.read']
      },
      { label: 'Leads', path: '/app/leads', icon: Target, permission: 'leads.read' },
      { label: 'Clients', path: '/app/clients', icon: Building2, permission: 'clients.read' },
      { label: 'Projects', path: '/app/projects', icon: BriefcaseBusiness, permission: 'projects.read' },
      { label: 'Quotations', path: '/app/quotations', icon: FileSignature, permission: 'leads.read' },
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
      {
        label: 'HRM',
        path: '/app/hrm',
        icon: Users,
        permissions: ['hrm.view_own', 'hrm.view_team', 'hrm.view_projects', 'hrm.view_all'],
        visible: canOpenHrm,
        children: [
          // Most-used first; `section` draws a small heading in the sidebar (see Sidebar.jsx).
          { label: 'Overview', path: '/app/hrm/overview', icon: LayoutDashboard, section: 'Daily' },
          { label: 'My day', path: '/app/hrm/my-day', icon: Timer, permission: 'hrm.self_service', visible: hasEmployeeProfile, section: 'Daily' },
          { label: 'Attendance', path: '/app/hrm/attendance', icon: CalendarCheck, section: 'Daily' },
          { label: 'Leave', path: '/app/hrm/leave', icon: CalendarOff, section: 'Daily' },
          { label: 'Work reports', path: '/app/hrm/work-reports', icon: ClipboardList, section: 'Daily' },
          { label: 'Regularization', path: '/app/hrm/regularization', icon: FileCheck2, section: 'Daily' },
          { label: 'Work locations', path: '/app/hrm/geofences', icon: MapPinned, permissions: ['hrm.approve', 'hrm.manage_settings'], section: 'Daily' },
          { label: 'Employees', path: '/app/hrm/employees', icon: Users, section: 'Daily' },
          { label: 'Timesheets', path: '/app/hrm/timesheets', icon: Clock, section: 'Weekly' },
          { label: 'HR helpdesk', path: '/app/hrm/helpdesk', icon: LifeBuoy, section: 'Weekly' },
          { label: 'Reimbursements', path: '/app/hrm/reimbursement', icon: Receipt, section: 'Weekly' },
          { label: 'Documents', path: '/app/hrm/documents', icon: FolderOpen, section: 'Weekly' },
          { label: 'Resource allocation', path: '/app/hrm/allocations', icon: Network, section: 'Weekly' },
          { label: 'Payroll', path: '/app/hrm/payroll', icon: Banknote, section: 'Payroll' },
          { label: 'Payroll adjustments', path: '/app/hrm/payroll_adjustment', icon: SlidersHorizontal, permission: 'hrm.payroll', section: 'Payroll' },
          { label: 'Compensation', path: '/app/hrm/salary-history', icon: BadgePercent, permission: 'hrm.view_salary', section: 'Payroll' },
          { label: 'Employee analytics', path: '/app/hrm/analytics', icon: BarChart3, section: 'Payroll' },
          { label: 'Holidays', path: '/app/hrm/holidays', icon: CalendarHeart, section: 'Payroll' },
          { label: 'Job openings', path: '/app/hrm/job', icon: Briefcase, permission: 'hrm.recruitment', section: 'Hiring' },
          { label: 'Candidates', path: '/app/hrm/candidate', icon: UserSearch, permission: 'hrm.recruitment', section: 'Hiring' },
          { label: 'Interviews', path: '/app/hrm/interview', icon: Video, permission: 'hrm.recruitment', section: 'Hiring' },
          { label: 'Onboarding', path: '/app/hrm/onboarding', icon: UserPlus, section: 'Hiring' },
          { label: 'Goals / OKRs', path: '/app/hrm/goal', icon: Target, section: 'Performance' },
          { label: 'Performance', path: '/app/hrm/review', icon: Award, section: 'Performance' },
          { label: 'Skills', path: '/app/hrm/skill', icon: GraduationCap, section: 'Performance' },
          { label: 'Assets', path: '/app/hrm/asset', icon: Laptop, permission: 'hrm.assets', section: 'Exit & assets' },
          { label: 'Resignations', path: '/app/hrm/resignation', icon: UserMinus, section: 'Exit & assets' },
          { label: 'Offboarding', path: '/app/hrm/offboarding', icon: DoorOpen, section: 'Exit & assets' },
          { label: 'Activity history', path: '/app/hrm/audit', icon: History, permission: 'hrm.audit', section: 'Admin' },
          { label: 'Policies & organization', path: '/app/hrm/settings', icon: Settings, section: 'Admin' }
        ]
      },
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
      {
        label: 'Service Master',
        path: '/app/service-master',
        icon: Boxes,
        permission: 'masters.read',
        children: [
          { label: 'All Services', path: '/app/service-master/services', icon: LayoutList },
          { label: 'Categories', path: '/app/service-master/categories', icon: FolderOpen },
          { label: 'Tech Stacks', path: '/app/service-master/tech-stacks', icon: SlidersHorizontal }
        ]
      },
      {
        label: 'Quotation Master',
        path: '/app/quotation-master',
        icon: FileImage,
        permission: 'masters.read'
      },
      {
        label: 'Legal Master',
        path: '/app/legal-master',
        icon: Scale,
        permission: 'masters.read'
      },
      { label: 'Masters', path: '/app/masters', icon: ShieldCheck, permission: 'masters.read' },
      { label: 'Reports', path: '/app/reports', icon: SquareUser, permission: 'reports.view' },
      { label: 'Files', path: '/app/files', icon: FileArchive, permission: 'files.read' },
      { label: 'Users', path: '/app/users', icon: Users, permission: 'users.manage' },
      { label: 'Roles', path: '/app/roles', icon: UserCog, permission: 'roles.manage' },
      { label: 'Settings', path: '/app/settings', icon: Cog, permission: 'settings.read' }
    ]
  }
];
