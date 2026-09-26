CREATE TABLE IF NOT EXISTS hrm_schema_versions (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE SEQUENCE IF NOT EXISTS hrm_employee_number;
CREATE TABLE IF NOT EXISTS hrm_settings (
  key text PRIMARY KEY, value jsonb NOT NULL, updated_by text REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hrm_employees (
  id text PRIMARY KEY, employee_number text NOT NULL UNIQUE,
  user_id text UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  full_name text NOT NULL, company_email text, phone text,
  department_id text REFERENCES master_items(id), designation_id text REFERENCES master_items(id),
  team_id text REFERENCES master_items(id), location_id text REFERENCES master_items(id),
  employment_type_id text REFERENCES master_items(id), shift_id text REFERENCES master_items(id),
  manager_id text REFERENCES hrm_employees(id), work_mode text NOT NULL DEFAULT 'Office',
  status text NOT NULL DEFAULT 'Draft', joining_date date NOT NULL, exit_date date,
  probation_end date, contract_end date, profile jsonb NOT NULL DEFAULT '{}',
  created_by text REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1, archived_at timestamptz,
  CHECK (manager_id IS DISTINCT FROM id), CHECK (exit_date IS NULL OR exit_date >= joining_date)
);
CREATE INDEX IF NOT EXISTS hrm_employee_scope ON hrm_employees(manager_id, department_id, status) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS hrm_employee_team ON hrm_employees(team_id);
CREATE INDEX IF NOT EXISTS hrm_employee_dates ON hrm_employees(joining_date, exit_date);
CREATE TABLE IF NOT EXISTS hrm_employment_history (
  id text PRIMARY KEY, employee_id text NOT NULL REFERENCES hrm_employees(id), effective_date date NOT NULL,
  snapshot jsonb NOT NULL, reason text NOT NULL, created_by text REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hrm_employment_effective ON hrm_employment_history(employee_id, effective_date DESC, created_at DESC);
CREATE TABLE IF NOT EXISTS hrm_private_profiles (
  employee_id text PRIMARY KEY REFERENCES hrm_employees(id), details jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hrm_audit (
  id text PRIMARY KEY, actor_id text REFERENCES users(id), employee_id text REFERENCES hrm_employees(id),
  action text NOT NULL, entity text NOT NULL, entity_id text NOT NULL, old_value jsonb, new_value jsonb,
  ip text, sensitive boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hrm_audit_employee ON hrm_audit(employee_id, created_at DESC);
CREATE TABLE IF NOT EXISTS hrm_attendance (
  id text PRIMARY KEY, employee_id text NOT NULL REFERENCES hrm_employees(id), work_date date NOT NULL,
  status text NOT NULL DEFAULT 'Present', check_in timestamptz, check_out timestamptz,
  break_minutes integer NOT NULL DEFAULT 0 CHECK(break_minutes >= 0), break_started_at timestamptz,
  worked_minutes integer NOT NULL DEFAULT 0 CHECK(worked_minutes >= 0), late_minutes integer NOT NULL DEFAULT 0,
  early_minutes integer NOT NULL DEFAULT 0, overtime_minutes integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'web', shift_snapshot jsonb NOT NULL DEFAULT '{}', locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, work_date), CHECK(check_out IS NULL OR check_out > check_in)
);
CREATE UNIQUE INDEX IF NOT EXISTS hrm_one_open_session ON hrm_attendance(employee_id) WHERE check_in IS NOT NULL AND check_out IS NULL;
CREATE INDEX IF NOT EXISTS hrm_attendance_date ON hrm_attendance(work_date, employee_id);
CREATE TABLE IF NOT EXISTS hrm_holidays (
  id text PRIMARY KEY, name text NOT NULL, work_date date NOT NULL, location_id text REFERENCES master_items(id),
  optional boolean NOT NULL DEFAULT false, created_by text REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hrm_holiday_date ON hrm_holidays(work_date, location_id);
CREATE TABLE IF NOT EXISTS hrm_leave_ledger (
  id text PRIMARY KEY, employee_id text NOT NULL REFERENCES hrm_employees(id), leave_type_id text NOT NULL REFERENCES master_items(id),
  year integer NOT NULL, amount numeric(7,2) NOT NULL, reason text NOT NULL, source_key text NOT NULL UNIQUE,
  created_by text REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hrm_leave_balance ON hrm_leave_ledger(employee_id, leave_type_id, year);
CREATE TABLE IF NOT EXISTS hrm_requests (
  id text PRIMARY KEY, employee_id text NOT NULL REFERENCES hrm_employees(id), kind text NOT NULL,
  title text NOT NULL, start_date date, end_date date, status text NOT NULL DEFAULT 'Draft', details jsonb NOT NULL DEFAULT '{}',
  reviewed_by text REFERENCES users(id), reviewed_at timestamptz, comment text,
  created_by text REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
  CHECK(end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS hrm_request_scope ON hrm_requests(employee_id, kind, start_date, status);
CREATE INDEX IF NOT EXISTS hrm_request_pending ON hrm_requests(kind, status, updated_at);
CREATE TABLE IF NOT EXISTS hrm_work_reports (
  id text PRIMARY KEY, employee_id text NOT NULL REFERENCES hrm_employees(id), work_date date NOT NULL,
  status text NOT NULL DEFAULT 'Draft', summary text NOT NULL DEFAULT '', submitted_at timestamptz,
  reviewed_by text REFERENCES users(id), reviewed_at timestamptz, comment text, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(employee_id, work_date)
);
CREATE INDEX IF NOT EXISTS hrm_report_tracking ON hrm_work_reports(work_date, status, employee_id);
CREATE TABLE IF NOT EXISTS hrm_work_entries (
  id text PRIMARY KEY, report_id text NOT NULL REFERENCES hrm_work_reports(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE RESTRICT, client_id text REFERENCES clients(id) ON DELETE RESTRICT,
  task_id text, task_source text CHECK(task_source IN ('activity','event')), category_id text REFERENCES master_items(id),
  description text NOT NULL, completed text, in_progress text, blocker text, started_at timestamptz, ended_at timestamptz,
  minutes integer NOT NULL CHECK(minutes > 0 AND minutes <= 1440), billable boolean NOT NULL DEFAULT false,
  completion numeric(5,2) NOT NULL DEFAULT 0 CHECK(completion BETWEEN 0 AND 100), priority text NOT NULL DEFAULT 'Medium',
  evidence_url text, reference text, remarks text, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ended_at IS NULL OR ended_at > started_at)
);
CREATE INDEX IF NOT EXISTS hrm_work_report_entries ON hrm_work_entries(report_id);
CREATE INDEX IF NOT EXISTS hrm_work_project ON hrm_work_entries(project_id, report_id);
CREATE TABLE IF NOT EXISTS hrm_timesheets (
  id text PRIMARY KEY, employee_id text NOT NULL REFERENCES hrm_employees(id), start_date date NOT NULL, end_date date NOT NULL,
  status text NOT NULL DEFAULT 'Submitted', report_ids jsonb NOT NULL DEFAULT '[]', reviewed_by text REFERENCES users(id),
  comment text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(end_date >= start_date), UNIQUE(employee_id, start_date, end_date)
);
CREATE INDEX IF NOT EXISTS hrm_timesheet_dates ON hrm_timesheets(employee_id, start_date, end_date);
CREATE TABLE IF NOT EXISTS hrm_allocations (
  id text PRIMARY KEY, employee_id text NOT NULL REFERENCES hrm_employees(id), project_id text NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  role text NOT NULL, percent numeric(5,2) NOT NULL CHECK(percent > 0 AND percent <= 100),
  start_date date NOT NULL, end_date date NOT NULL CHECK(end_date >= start_date), planned_hours numeric(10,2) CHECK(planned_hours >= 0),
  billable boolean NOT NULL DEFAULT false, billing_rate numeric(14,2) CHECK(billing_rate >= 0),
  created_by text REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz
);
CREATE INDEX IF NOT EXISTS hrm_allocation_dates ON hrm_allocations(employee_id, start_date, end_date) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS hrm_allocation_project ON hrm_allocations(project_id, employee_id) WHERE archived_at IS NULL;
CREATE TABLE IF NOT EXISTS hrm_salary_history (
  id text PRIMARY KEY, employee_id text NOT NULL REFERENCES hrm_employees(id), effective_date date NOT NULL,
  monthly_cost numeric(14,2) NOT NULL CHECK(monthly_cost >= 0), currency text NOT NULL, components jsonb NOT NULL DEFAULT '[]',
  reason text NOT NULL, created_by text REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(employee_id,effective_date)
);
CREATE INDEX IF NOT EXISTS hrm_salary_effective ON hrm_salary_history(employee_id,effective_date DESC);
CREATE TABLE IF NOT EXISTS hrm_payroll_runs (
  id text PRIMARY KEY, start_date date NOT NULL, end_date date NOT NULL CHECK(end_date >= start_date),
  status text NOT NULL DEFAULT 'Draft', policy_snapshot jsonb NOT NULL, created_by text REFERENCES users(id),
  approved_by text REFERENCES users(id), approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hrm_payroll_entries (
  id text PRIMARY KEY, run_id text NOT NULL REFERENCES hrm_payroll_runs(id), employee_id text NOT NULL REFERENCES hrm_employees(id),
  gross numeric(14,2) NOT NULL CHECK(gross >= 0), deductions numeric(14,2) NOT NULL CHECK(deductions >= 0), net numeric(14,2) NOT NULL CHECK(net >= 0),
  currency text NOT NULL, calculation jsonb NOT NULL, expense_id text UNIQUE REFERENCES expenses(id), UNIQUE(run_id,employee_id)
);
CREATE INDEX IF NOT EXISTS hrm_payroll_employee ON hrm_payroll_entries(employee_id,run_id);
CREATE TABLE IF NOT EXISTS hrm_records (
  id text PRIMARY KEY, kind text NOT NULL, employee_id text REFERENCES hrm_employees(id), project_id text REFERENCES projects(id),
  parent_id text REFERENCES hrm_records(id), title text NOT NULL, status text NOT NULL, start_date date, end_date date,
  details jsonb NOT NULL DEFAULT '{}', created_by text REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1, archived_at timestamptz,
  CHECK(end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS hrm_record_scope ON hrm_records(kind,employee_id,status) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS hrm_record_parent ON hrm_records(parent_id);
CREATE TABLE IF NOT EXISTS hrm_documents (
  id text PRIMARY KEY, employee_id text NOT NULL REFERENCES hrm_employees(id), title text NOT NULL, category text NOT NULL,
  file_name text NOT NULL, mime_type text NOT NULL, size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
  content bytea NOT NULL, expires_on date, status text NOT NULL DEFAULT 'Pending',
  verified_by text REFERENCES users(id), created_by text REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hrm_document_employee ON hrm_documents(employee_id,expires_on);
CREATE TABLE IF NOT EXISTS hrm_automation_runs (
  source_key text PRIMARY KEY, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
