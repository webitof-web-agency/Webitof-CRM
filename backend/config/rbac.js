const PERMISSIONS = [
  { code: 'dashboard.view', name: 'View Dashboard', module: 'dashboard', action: 'view', description: 'Access dashboard widgets and stats.' },
  { code: 'leads.read', name: 'Read Leads', module: 'leads', action: 'read', description: 'View lead records.' },
  { code: 'leads.write', name: 'Write Leads', module: 'leads', action: 'write', description: 'Create and edit lead records.' },
  { code: 'leads.delete', name: 'Delete Leads', module: 'leads', action: 'delete', description: 'Delete lead records.' },
  { code: 'clients.read', name: 'Read Clients', module: 'clients', action: 'read', description: 'View client records.' },
  { code: 'clients.write', name: 'Write Clients', module: 'clients', action: 'write', description: 'Create and edit client records.' },
  { code: 'clients.delete', name: 'Delete Clients', module: 'clients', action: 'delete', description: 'Delete client records.' },
  { code: 'projects.read', name: 'Read Projects', module: 'projects', action: 'read', description: 'View project records.' },
  { code: 'projects.write', name: 'Write Projects', module: 'projects', action: 'write', description: 'Create and edit projects.' },
  { code: 'projects.delete', name: 'Delete Projects', module: 'projects', action: 'delete', description: 'Delete project records.' },
  { code: 'invoices.read', name: 'Read Invoices', module: 'invoices', action: 'read', description: 'View invoices.' },
  { code: 'invoices.write', name: 'Write Invoices', module: 'invoices', action: 'write', description: 'Create and edit invoices.' },
  { code: 'invoices.delete', name: 'Delete Invoices', module: 'invoices', action: 'delete', description: 'Delete invoices.' },
  { code: 'payments.read', name: 'Read Payments', module: 'payments', action: 'read', description: 'View payment records.' },
  { code: 'payments.write', name: 'Write Payments', module: 'payments', action: 'write', description: 'Create and edit payments.' },
  { code: 'payments.delete', name: 'Delete Payments', module: 'payments', action: 'delete', description: 'Delete payment records.' },
  { code: 'expenses.read', name: 'Read Expenses', module: 'expenses', action: 'read', description: 'View expense records.' },
  { code: 'expenses.write', name: 'Write Expenses', module: 'expenses', action: 'write', description: 'Create and edit expenses.' },
  { code: 'expenses.delete', name: 'Delete Expenses', module: 'expenses', action: 'delete', description: 'Delete expense records.' },
  { code: 'outsourcing.read', name: 'Read Outsourcing', module: 'outsourcing', action: 'read', description: 'View outsourcing costs.' },
  { code: 'outsourcing.write', name: 'Write Outsourcing', module: 'outsourcing', action: 'write', description: 'Create and edit outsourcing costs.' },
  { code: 'outsourcing.delete', name: 'Delete Outsourcing', module: 'outsourcing', action: 'delete', description: 'Delete outsourcing costs.' },
  { code: 'lead-commissions.read', name: 'Read Lead Commissions', module: 'lead-commissions', action: 'read', description: 'View commission records.' },
  { code: 'lead-commissions.write', name: 'Write Lead Commissions', module: 'lead-commissions', action: 'write', description: 'Create and edit commission records.' },
  { code: 'lead-commissions.delete', name: 'Delete Lead Commissions', module: 'lead-commissions', action: 'delete', description: 'Delete commission records.' },
  { code: 'banking.read', name: 'Read Banking', module: 'banking', action: 'read', description: 'View bank accounts and transactions.' },
  { code: 'banking.write', name: 'Write Banking', module: 'banking', action: 'write', description: 'Create and edit bank accounts/transactions.' },
  { code: 'banking.delete', name: 'Delete Banking', module: 'banking', action: 'delete', description: 'Delete bank records.' },
  { code: 'amc.read', name: 'Read AMC', module: 'amc', action: 'read', description: 'View AMC records.' },
  { code: 'amc.write', name: 'Write AMC', module: 'amc', action: 'write', description: 'Create and edit AMC records.' },
  { code: 'amc.delete', name: 'Delete AMC', module: 'amc', action: 'delete', description: 'Delete AMC records.' },
  { code: 'renewals.read', name: 'Read Renewals', module: 'renewals', action: 'read', description: 'View renewal records.' },
  { code: 'renewals.write', name: 'Write Renewals', module: 'renewals', action: 'write', description: 'Create and edit renewal records.' },
  { code: 'renewals.delete', name: 'Delete Renewals', module: 'renewals', action: 'delete', description: 'Delete renewal records.' },
  { code: 'masters.read', name: 'Read Masters', module: 'masters', action: 'read', description: 'View master data.' },
  { code: 'masters.write', name: 'Write Masters', module: 'masters', action: 'write', description: 'Create and edit master data.' },
  { code: 'masters.delete', name: 'Delete Masters', module: 'masters', action: 'delete', description: 'Delete master data.' },
  { code: 'settings.read', name: 'Read Settings', module: 'settings', action: 'read', description: 'View settings.' },
  { code: 'settings.write', name: 'Write Settings', module: 'settings', action: 'write', description: 'Change settings.' },
  { code: 'reports.view', name: 'View Reports', module: 'reports', action: 'view', description: 'View dashboard and reports.' },
  { code: 'files.read', name: 'Read Files', module: 'files', action: 'read', description: 'View uploaded files.' },
  { code: 'files.write', name: 'Write Files', module: 'files', action: 'write', description: 'Upload and archive files.' },
  { code: 'files.delete', name: 'Delete Files', module: 'files', action: 'delete', description: 'Delete file metadata or archive files.' },
  { code: 'users.manage', name: 'Manage Users', module: 'users', action: 'manage', description: 'Create and edit users and their role assignments.' },
  { code: 'roles.manage', name: 'Manage Roles', module: 'roles', action: 'manage', description: 'Create and edit roles.' },
  { code: 'permissions.manage', name: 'Manage Permissions', module: 'permissions', action: 'manage', description: 'Create and edit permission mappings.' }
];

const PERMISSION_CODES = PERMISSIONS.map((permission) => permission.code);

const DEFAULT_ROLE_DEFINITIONS = [
  {
    code: 'admin',
    name: 'Admin',
    description: 'Full system access',
    isSystem: true,
    permissions: PERMISSION_CODES
  },
  {
    code: 'accountant',
    name: 'Accountant',
    description: 'Finance and reporting access',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'clients.read',
      'projects.read',
      'invoices.read',
      'invoices.write',
      'payments.read',
      'payments.write',
      'expenses.read',
      'expenses.write',
      'outsourcing.read',
      'outsourcing.write',
      'lead-commissions.read',
      'lead-commissions.write',
      'banking.read',
      'banking.write',
      'amc.read',
      'amc.write',
      'renewals.read',
      'renewals.write',
      'masters.read',
      'settings.read',
      'reports.view',
      'files.read',
      'files.write'
    ]
  },
  {
    code: 'sales',
    name: 'Sales',
    description: 'Client and project access',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'leads.read',
      'leads.write',
      'clients.read',
      'clients.write',
      'projects.read',
      'projects.write',
      'invoices.read',
      'invoices.write',
      'payments.read',
      'files.read',
      'files.write'
    ]
  }
];

module.exports = {
  DEFAULT_ROLE_DEFINITIONS,
  PERMISSION_CODES,
  PERMISSIONS
};
