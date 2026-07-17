CREATE TABLE IF NOT EXISTS app_settings (
  id text PRIMARY KEY DEFAULT 'default',
  company jsonb NOT NULL DEFAULT '{}'::jsonb,
  gst jsonb NOT NULL DEFAULT '{}'::jsonb,
  tds jsonb NOT NULL DEFAULT '{}'::jsonb,
  invoice jsonb NOT NULL DEFAULT '{}'::jsonb,
  bank jsonb NOT NULL DEFAULT '{}'::jsonb,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  smtp jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_templates jsonb NOT NULL DEFAULT '{}'::jsonb,
  compliance_note text NOT NULL DEFAULT '',
  roles jsonb NOT NULL DEFAULT '{}'::jsonb,
  statuses jsonb NOT NULL DEFAULT '{}'::jsonb,
  labels jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  module text NOT NULL,
  action text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  full_name text NOT NULL,
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  salary numeric(14,2) NOT NULL DEFAULT 0,
  phone text,
  address text,
  gender text,
  avatar_url text,
  avatar_file_id text,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  requested_from_ip text,
  requested_user_agent text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by text REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id text NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by text REFERENCES users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS master_items (
  id text PRIMARY KEY,
  type text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, name)
);

CREATE TABLE IF NOT EXISTS clients (
  id text PRIMARY KEY,
  name text NOT NULL,
  company_name text,
  client_type text,
  assigned_to text REFERENCES users(id) ON DELETE SET NULL,
  managers text,
  source text,
  mobile text,
  email text,
  website text,
  billing_address text,
  shipping_address text,
  city text,
  state text,
  state_code text,
  country text NOT NULL DEFAULT 'India',
  place_of_supply text,
  gst_registration_type text,
  gstin text,
  vat_number text,
  gst_number text,
  pan text,
  currency text NOT NULL DEFAULT 'INR',
  currency_symbol text,
  contact_person text,
  client_groups text,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  follow_up_date date,
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'Active',
  disable_online_payment boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id text PRIMARY KEY,
  name text NOT NULL,
  company_name text,
  type text NOT NULL DEFAULT 'Organization',
  email text,
  phone text,
  website text,
  status text NOT NULL DEFAULT 'New',
  source text,
  value numeric(14,2) NOT NULL DEFAULT 0,
  follow_up_date date,
  assigned_to text REFERENCES users(id) ON DELETE SET NULL,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  managers text,
  address text,
  city text,
  state text,
  pincode text,
  country text NOT NULL DEFAULT 'India',
  vat_number text,
  gst_number text,
  currency text,
  currency_symbol text,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  owner_name text,
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_contacts (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  job_title text,
  gender text,
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_contacts (
  id text PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  job_title text,
  gender text,
  notes text,
  is_primary boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  project_type text,
  value numeric(14,2) NOT NULL DEFAULT 0,
  start_date date,
  deadline date,
  status text NOT NULL DEFAULT 'Active',
  billing_type text,
  cost_estimate numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_events (
  id text PRIMARY KEY,
  lead_id text REFERENCES leads(id) ON DELETE CASCADE,
  client_id text REFERENCES clients(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id text,
  owner_user_id text REFERENCES users(id) ON DELETE SET NULL,
  visibility text NOT NULL DEFAULT 'all_team',
  allowed_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_team_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  event_type text NOT NULL DEFAULT 'event',
  title text NOT NULL,
  description text,
  start_date date,
  start_time text,
  end_date date,
  end_time text,
  location text,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  color text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id text PRIMARY KEY,
  invoice_number text NOT NULL UNIQUE,
  invoice_date date NOT NULL,
  due_date date,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  place_of_supply text,
  invoice_type text,
  amount_type text,
  status text NOT NULL DEFAULT 'Sent',
  notes text,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_interval text NOT NULL DEFAULT 'None',
  source_renewal_id text,
  source_amc_id text,
  taxable_amount numeric(14,2) NOT NULL DEFAULT 0,
  cgst numeric(14,2) NOT NULL DEFAULT 0,
  sgst numeric(14,2) NOT NULL DEFAULT 0,
  utgst numeric(14,2) NOT NULL DEFAULT 0,
  igst numeric(14,2) NOT NULL DEFAULT 0,
  gst_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY,
  payment_date date NOT NULL,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  invoice_id text REFERENCES invoices(id) ON DELETE SET NULL,
  amount_received numeric(14,2) NOT NULL DEFAULT 0,
  tds_deducted numeric(14,2) NOT NULL DEFAULT 0,
  payment_mode text,
  bank_account_id text,
  transaction_id text,
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id text PRIMARY KEY,
  expense_date date NOT NULL,
  vendor text NOT NULL,
  vendor_id text REFERENCES master_items(id) ON DELETE SET NULL,
  category_id text REFERENCES master_items(id) ON DELETE SET NULL,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  amount_before_gst numeric(14,2) NOT NULL DEFAULT 0,
  gst_rate numeric(8,2) NOT NULL DEFAULT 0,
  gst_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  invoice_number text,
  vendor_gstin text,
  payment_mode text,
  bank_account_id text,
  itc_eligible boolean NOT NULL DEFAULT true,
  rcm_applicable boolean NOT NULL DEFAULT false,
  attachment_url text,
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outsourcing_expenses (
  id text PRIMARY KEY,
  expense_date date NOT NULL,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  vendor_id text REFERENCES master_items(id) ON DELETE SET NULL,
  vendor_name text,
  work_type text,
  description text,
  base_amount numeric(14,2) NOT NULL DEFAULT 0,
  vendor_gst_registered boolean NOT NULL DEFAULT false,
  gst_applicable boolean NOT NULL DEFAULT false,
  gst_rate numeric(8,2) NOT NULL DEFAULT 0,
  gst_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  itc_eligible boolean NOT NULL DEFAULT true,
  payment_status text NOT NULL DEFAULT 'Pending',
  vendor_invoice_number text,
  vendor_invoice_url text,
  payment_proof_url text,
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_commissions (
  id text PRIMARY KEY,
  commission_date date NOT NULL,
  partner_id text REFERENCES master_items(id) ON DELETE SET NULL,
  partner_name text,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  commission_type text NOT NULL DEFAULT 'Percentage',
  commission_percentage numeric(8,2) NOT NULL DEFAULT 0,
  commission_base_amount numeric(14,2) NOT NULL DEFAULT 0,
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  gst_registered boolean NOT NULL DEFAULT false,
  gst_rate numeric(8,2) NOT NULL DEFAULT 0,
  gst_amount numeric(14,2) NOT NULL DEFAULT 0,
  gross_payable numeric(14,2) NOT NULL DEFAULT 0,
  tds_applicable boolean NOT NULL DEFAULT true,
  tds_section text,
  tds_rate numeric(8,2) NOT NULL DEFAULT 0,
  tds_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_payable numeric(14,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'Pending',
  invoice_number text,
  invoice_url text,
  tds_deposit_status text NOT NULL DEFAULT 'Not Deposited',
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id text PRIMARY KEY,
  bank_name text NOT NULL,
  account_holder_name text NOT NULL,
  account_number text,
  ifsc text,
  branch text,
  account_type text,
  upi_id text,
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id text PRIMARY KEY,
  date date NOT NULL,
  bank_account_id text REFERENCES bank_accounts(id) ON DELETE SET NULL,
  transaction_type text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  linked_client_id text REFERENCES clients(id) ON DELETE SET NULL,
  linked_project_id text REFERENCES projects(id) ON DELETE SET NULL,
  linked_invoice_id text REFERENCES invoices(id) ON DELETE SET NULL,
  linked_expense_id text REFERENCES expenses(id) ON DELETE SET NULL,
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS amcs (
  id text PRIMARY KEY,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  amc_type text NOT NULL,
  start_date date,
  end_date date,
  billing_cycle text,
  amc_amount numeric(14,2) NOT NULL DEFAULT 0,
  gst_type text,
  next_invoice_date date,
  reminder_days integer NOT NULL DEFAULT 7,
  status text NOT NULL DEFAULT 'Active',
  auto_invoice boolean NOT NULL DEFAULT false,
  remarks text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS renewals (
  id text PRIMARY KEY,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  category text NOT NULL,
  domain_name text,
  hosting_name text,
  package_name text,
  software_name text,
  license_scope text,
  seats integer,
  license_key text,
  provider text,
  purchase_date date,
  duration_years integer NOT NULL DEFAULT 1,
  renewal_date date,
  expiry_date date,
  purchase_price numeric(14,2) NOT NULL DEFAULT 0,
  renewal_price numeric(14,2) NOT NULL DEFAULT 0,
  renewal_cost numeric(14,2) NOT NULL DEFAULT 0,
  client_charge numeric(14,2) NOT NULL DEFAULT 0,
  reminder_date date,
  auto_renewal boolean NOT NULL DEFAULT false,
  finance_action text NOT NULL DEFAULT 'None',
  finance_entry_id text,
  finance_entry_type text,
  source_invoice_id text,
  source_expense_id text,
  status text NOT NULL DEFAULT 'Pending',
  remarks text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_items_type ON master_items(type);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_mobile ON clients(mobile);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_expenses_client_id ON expenses(client_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project_id ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_outsourcing_project_id ON outsourcing_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_lead_commissions_project_id ON lead_commissions(project_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_bank_account_id ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_amcs_client_id ON amcs(client_id);
CREATE INDEX IF NOT EXISTS idx_renewals_client_id ON renewals(client_id);
