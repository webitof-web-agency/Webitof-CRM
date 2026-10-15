const bcrypt = require('bcryptjs');
const path = require('path');
const { query, runSqlFile, withTransaction } = require('./db');
const { DEFAULT_ROLE_DEFINITIONS, PERMISSIONS } = require('../config/rbac');
const { migrate: migrateHrm } = require('../database/migrate-hrm');
const {
  DEFAULT_SETTINGS,
  DEFAULT_SERVICE_CATEGORIES,
  DEFAULT_SERVICES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_TAX_RATES,
  DEFAULT_QUOTATION_MASTERS,
  DEFAULT_VENDORS,
  DEFAULT_RENEWAL_PROVIDERS,
  DEFAULT_AMC_TYPES,
  DEFAULT_BILLING_CYCLES,
  DEFAULT_INVOICE_TERMS,
  DEFAULT_LEGAL_TERMS
} = require('../database/defaultData');
const { createId } = require('../utils/format');
const { ensureCallLogsSchema } = require('../database/callLogs.schema');

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function isoDateOffset(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function isoDateTimeOffset(minutes = 0) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + Number(minutes || 0));
  return date.toISOString();
}

async function ensureDatabase() {
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  if (String(process.env.AUTO_INIT_DB || 'true').toLowerCase() === 'true') {
    await runSqlFile(schemaPath);
    await runSqlFile(path.join(__dirname, '..', 'database', 'storage.sql'));
    await runSqlFile(path.join(__dirname, '..', 'database', 'follow-up-engine.sql'));
  }
  await ensureLeadPipelineSchema();
  await ensureLeadEventsSchema();
  await ensureLeadManagementSchema();
  await ensureExpenseSchema();
  await ensureOutsourcingSchema();
  await ensureRenewalSchema();
  await ensureAmcSchema();
  await ensureAmcAutomationHistorySchema();
  await ensureWorkflowAutomationHistorySchema();
  await ensureNotificationsSchema();
  await ensurePaymentStatusSchema();
  await ensureCallLogsSchema();
  await ensureInvoiceSourceIndexes();
  await withTransaction(migrateHrm);
  if (String(process.env.SEED_DEFAULT_DATA || 'true').toLowerCase() === 'true') {
    await seedDefaultData();
    await seedAutomationDemoData();
    await seedNotificationDemoData();
  }
  if (String(process.env.SEED_DEFAULT_DATA || 'true').toLowerCase() === 'true') {
    await seedRbac();
  }
}

async function ensureLeadPipelineSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS lead_pipelines (
      id text PRIMARY KEY,
      name text NOT NULL UNIQUE,
      code text NOT NULL UNIQUE,
      description text,
      color text NOT NULL DEFAULT '#2563eb',
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS pipeline_id text REFERENCES lead_pipelines(id) ON DELETE SET NULL;`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lead_pipelines_active ON lead_pipelines(is_active);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lead_pipelines_sort ON lead_pipelines(sort_order, name);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_pipeline_id ON leads(pipeline_id);`);

  const pipelines = [
    ['pipe-default', 'Default Pipeline', 'default', 'Default lead pipeline', '#2563eb', 0],
    ['pipe-it-service', 'IT Service', 'it-service', 'Service and project sales leads', '#0f766e', 10],
    ['pipe-course-leads', 'Course Leads', 'course-leads', 'Course inquiry and admission leads', '#7c3aed', 20],
    ['pipe-course-students', 'Course Students', 'course-students', 'Converted course student records', '#ea580c', 30]
  ];

  for (const pipeline of pipelines) {
    await query(
      `insert into lead_pipelines (id, name, code, description, color, sort_order, is_active, payload)
       values ($1, $2, $3, $4, $5, $6, true, '{}'::jsonb)
       on conflict (id) do nothing`,
      pipeline
    );
  }

  await query(`UPDATE leads SET pipeline_id = 'pipe-default' WHERE pipeline_id IS NULL OR pipeline_id = '';`);
}

async function ensureLeadEventsSchema() {
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS lead_id text REFERENCES leads(id) ON DELETE CASCADE;`);
  await query(`ALTER TABLE lead_events ALTER COLUMN lead_id DROP NOT NULL;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS client_id text REFERENCES clients(id) ON DELETE CASCADE;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE CASCADE;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'global';`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS scope_id text;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS owner_user_id text REFERENCES users(id) ON DELETE SET NULL;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'all_team';`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS allowed_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS allowed_team_ids jsonb NOT NULL DEFAULT '[]'::jsonb;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'event';`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS title text;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS description text;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS start_date date;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS start_time text;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS end_date date;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS end_time text;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS location text;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS labels jsonb NOT NULL DEFAULT '[]'::jsonb;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;`);
  await query(`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS color text;`);
  await query(`
    UPDATE lead_events
    SET
      scope_type = COALESCE(scope_type, CASE
        WHEN client_id IS NOT NULL THEN 'client'
        WHEN project_id IS NOT NULL THEN 'project'
        WHEN lead_id IS NOT NULL THEN 'lead'
        ELSE 'global'
      END),
      scope_id = COALESCE(scope_id, lead_id, client_id, project_id),
      visibility = COALESCE(visibility, 'all_team'),
      event_type = COALESCE(event_type, 'event')
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_lead_events_scope ON lead_events(scope_type, scope_id);`);
}

async function ensureLeadManagementSchema() {
  await query(`CREATE SEQUENCE IF NOT EXISTS lead_number_seq START WITH 1 INCREMENT BY 1;`);

  const columns = [
    ['lead_number', 'text'],
    ['contact_person', 'text'],
    ['alternate_phone', 'text'],
    ['whatsapp_number', 'text'],
    ['preferred_language', 'text'],
    ['preferred_contact_method', 'text'],
    ['preferred_contact_time', 'text'],
    ['campaign_name', 'text'],
    ['source_reference', 'text'],
    ['utm_source', 'text'],
    ['utm_medium', 'text'],
    ['utm_campaign', 'text'],
    ['referrer_type', 'text'],
    ['referrer_name', 'text'],
    ['referrer_contact', 'text'],
    ['referrer_reference_id', 'text'],
    ['commission_applicable', 'boolean NOT NULL DEFAULT false'],
    ['commission_type', 'text'],
    ['commission_value', 'numeric(14,2)'],
    ['commission_notes', 'text'],
    ['required_services', `jsonb NOT NULL DEFAULT '[]'::jsonb`],
    ['requirement_title', 'text'],
    ['requirement_summary', 'text'],
    ['requirement_description', 'text'],
    ['client_pain_points', 'text'],
    ['expected_features', 'text'],
    ['reference_url', 'text'],
    ['preferred_technology', 'text'],
    ['existing_system_details', 'text'],
    ['expected_start_date', 'date'],
    ['expected_delivery_date', 'date'],
    ['requirement_attachments', `jsonb NOT NULL DEFAULT '[]'::jsonb`],
    ['estimated_budget', 'numeric(14,2)'],
    ['budget_min', 'numeric(14,2)'],
    ['budget_max', 'numeric(14,2)'],
    ['budget_range', 'text'],
    ['budget_confirmed', 'text'],
    ['billing_type', 'text'],
    ['gst_invoice_required', 'text'],
    ['expected_closing_date', 'date'],
    ['payment_preference', 'text'],
    ['purchase_timeline', 'text'],
    ['lead_temperature', 'text'],
    ['priority', 'text'],
    ['conversion_probability', 'numeric(5,2)'],
    ['lead_score', 'integer'],
    ['status_note', 'text'],
    ['last_status_changed_at', 'timestamptz'],
    ['last_status_changed_by', 'text REFERENCES users(id) ON DELETE SET NULL'],
    ['next_follow_up_time', 'text'],
    ['follow_up_mode', 'text'],
    ['reminder', 'text'],
    ['follow_up_note', 'text'],
    ['assigned_team', 'text'],
    ['follow_up_priority', 'text'],
    ['lead_owner', 'text REFERENCES users(id) ON DELETE SET NULL'],
    ['secondary_assignees', `jsonb NOT NULL DEFAULT '[]'::jsonb`],
    ['updated_by', 'text REFERENCES users(id) ON DELETE SET NULL'],
    ['first_conversation_summary', 'text'],
    ['last_conversation_summary', 'text'],
    ['client_expectations', 'text'],
    ['internal_notes', 'text'],
    ['preferred_communication_channel', 'text'],
    ['last_contact_date', 'date'],
    ['last_contact_time', 'text'],
    ['decision_maker_identified', 'text'],
    ['contact_is_decision_maker', 'boolean'],
    ['requirement_confirmed', 'text'],
    ['timeline_confirmed', 'text'],
    ['authority_confirmed', 'text'],
    ['need_confirmed', 'text'],
    ['qualification_notes', 'text'],
    ['lost_reason', 'text'],
    ['lost_reason_notes', 'text'],
    ['competitor_name', 'text'],
    ['competitor_price', 'numeric(14,2)'],
    ['reconnect_in_future', 'boolean NOT NULL DEFAULT false'],
    ['reconnect_date', 'date'],
    ['lost_at', 'timestamptz'],
    ['lost_by', 'text REFERENCES users(id) ON DELETE SET NULL'],
    ['original_lead_id', 'text REFERENCES leads(id) ON DELETE SET NULL'],
    ['converted_client_id', 'text REFERENCES clients(id) ON DELETE SET NULL'],
    ['converted_project_id', 'text REFERENCES projects(id) ON DELETE SET NULL'],
    ['converted_at', 'timestamptz'],
    ['converted_by', 'text REFERENCES users(id) ON DELETE SET NULL'],
    ['reopened_at', 'timestamptz'],
    ['reopened_by', 'text REFERENCES users(id) ON DELETE SET NULL']
  ];

  for (const [name, definition] of columns) {
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ${name} ${definition};`);
  }

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'leads_converted_project_id_fkey'
      ) THEN
        ALTER TABLE leads
        ADD CONSTRAINT leads_converted_project_id_fkey
        FOREIGN KEY (converted_project_id) REFERENCES projects(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  await query(`
    ALTER TABLE leads
    ALTER COLUMN lead_number SET DEFAULT (
      'LD-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('lead_number_seq')::text, 6, '0')
    );
  `);
  await query(`
    UPDATE leads
    SET lead_number = 'LD-' || to_char(COALESCE(created_at, now()), 'YYYY') || '-' || lpad(nextval('lead_number_seq')::text, 6, '0')
    WHERE lead_number IS NULL OR trim(lead_number) = '';
  `);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_lead_number ON leads(lead_number);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_email_lower ON leads(lower(email));`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_follow_up_date ON leads(follow_up_date);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_converted_client_id ON leads(converted_client_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_temperature ON leads(lead_temperature);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);`);

  await query(`
    CREATE TABLE IF NOT EXISTS lead_conversion_mappings (
      id text PRIMARY KEY,
      lead_id text NOT NULL UNIQUE REFERENCES leads(id) ON DELETE RESTRICT,
      client_id text REFERENCES clients(id) ON DELETE SET NULL,
      project_id text REFERENCES projects(id) ON DELETE SET NULL,
      converted_by text REFERENCES users(id) ON DELETE SET NULL,
      converted_at timestamptz NOT NULL DEFAULT now(),
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_lead_conversion_client_id ON lead_conversion_mappings(client_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lead_conversion_project_id ON lead_conversion_mappings(project_id);`);
}

async function ensureExpenseSchema() {
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_type text;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payee_type text;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payee_id text;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payee_name text;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS employee_id text REFERENCES users(id) ON DELETE SET NULL;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status text;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approval_status text;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_status text;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period_start date;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period_end date;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS due_date date;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_amount numeric(14,2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS balance_due numeric(14,2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS cost_center text;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tds_applicable boolean NOT NULL DEFAULT false;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tds_section text;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tds_rate numeric(8,2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tds_amount numeric(14,2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;`);
  await query(`ALTER TABLE expenses ALTER COLUMN expense_type SET DEFAULT 'Vendor Bill';`);
  await query(`ALTER TABLE expenses ALTER COLUMN payee_type SET DEFAULT 'Vendor';`);
  await query(`ALTER TABLE expenses ALTER COLUMN status SET DEFAULT 'Draft';`);
  await query(`ALTER TABLE expenses ALTER COLUMN approval_status SET DEFAULT 'Pending';`);
  await query(`ALTER TABLE expenses ALTER COLUMN payment_status SET DEFAULT 'Unpaid';`);
  await query(`
    UPDATE expenses
    SET
      expense_type = COALESCE(NULLIF(expense_type, ''), 'Vendor Bill'),
      payee_type = COALESCE(NULLIF(payee_type, ''), CASE WHEN employee_id IS NOT NULL THEN 'Employee' ELSE 'Vendor' END),
      payee_id = COALESCE(NULLIF(payee_id, ''), vendor_id::text),
      payee_name = COALESCE(NULLIF(payee_name, ''), vendor, ''),
      vendor = COALESCE(NULLIF(vendor, ''), payee_name, ''),
      status = COALESCE(NULLIF(status, ''), 'Draft'),
      approval_status = COALESCE(NULLIF(approval_status, ''), 'Pending'),
      payment_status = COALESCE(NULLIF(payment_status, ''), 'Unpaid'),
      paid_amount = COALESCE(paid_amount, 0),
      balance_due = COALESCE(balance_due, GREATEST(0, COALESCE(total_amount, 0) - COALESCE(paid_amount, 0))),
      tds_applicable = COALESCE(tds_applicable, false),
      tds_rate = COALESCE(tds_rate, 0),
      tds_amount = COALESCE(tds_amount, 0)
    WHERE TRUE;
  `);
  await query(`ALTER TABLE expenses ALTER COLUMN expense_type SET NOT NULL;`);
  await query(`ALTER TABLE expenses ALTER COLUMN payee_type SET NOT NULL;`);
  await query(`ALTER TABLE expenses ALTER COLUMN status SET NOT NULL;`);
  await query(`ALTER TABLE expenses ALTER COLUMN approval_status SET NOT NULL;`);
  await query(`ALTER TABLE expenses ALTER COLUMN payment_status SET NOT NULL;`);
}

async function ensureOutsourcingSchema() {
  await query(`ALTER TABLE outsourcing_expenses ADD COLUMN IF NOT EXISTS approval_status text;`);
  await query(`ALTER TABLE outsourcing_expenses ADD COLUMN IF NOT EXISTS due_date date;`);
  await query(`ALTER TABLE outsourcing_expenses ADD COLUMN IF NOT EXISTS reminder_days integer;`);
  await query(`ALTER TABLE outsourcing_expenses ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;`);
  await query(`ALTER TABLE outsourcing_expenses ADD COLUMN IF NOT EXISTS last_reminder_sent_for_date date;`);
  await query(`ALTER TABLE outsourcing_expenses ADD COLUMN IF NOT EXISTS last_automation_run_at timestamptz;`);
  await query(`ALTER TABLE outsourcing_expenses ADD COLUMN IF NOT EXISTS payment_status text;`);
  await query(`ALTER TABLE outsourcing_expenses ALTER COLUMN approval_status SET DEFAULT 'Pending';`);
  await query(`ALTER TABLE outsourcing_expenses ALTER COLUMN reminder_days SET DEFAULT 7;`);
  await query(`ALTER TABLE outsourcing_expenses ALTER COLUMN payment_status SET DEFAULT 'Pending';`);
  await query(`
    UPDATE outsourcing_expenses
    SET
      approval_status = COALESCE(NULLIF(approval_status, ''), 'Pending'),
      reminder_days = COALESCE(reminder_days, 7),
      payment_status = COALESCE(NULLIF(payment_status, ''), 'Pending')
    WHERE TRUE;
  `);
  await query(`ALTER TABLE outsourcing_expenses ALTER COLUMN approval_status SET NOT NULL;`);
  await query(`ALTER TABLE outsourcing_expenses ALTER COLUMN reminder_days SET NOT NULL;`);
  await query(`ALTER TABLE outsourcing_expenses ALTER COLUMN payment_status SET NOT NULL;`);
}

async function ensureRenewalSchema() {
  await query(`ALTER TABLE renewals ADD COLUMN IF NOT EXISTS reminder_days integer;`);
  await query(`ALTER TABLE renewals ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;`);
  await query(`ALTER TABLE renewals ADD COLUMN IF NOT EXISTS last_reminder_sent_for_date date;`);
  await query(`ALTER TABLE renewals ADD COLUMN IF NOT EXISTS last_automation_run_at timestamptz;`);
  await query(`ALTER TABLE renewals ALTER COLUMN reminder_days SET DEFAULT 30;`);
  await query(`
    UPDATE renewals
    SET reminder_days = COALESCE(reminder_days, 30)
    WHERE TRUE;
  `);
  await query(`ALTER TABLE renewals ALTER COLUMN reminder_days SET NOT NULL;`);
}

async function ensureAmcSchema() {
  await query(`ALTER TABLE amcs ADD COLUMN IF NOT EXISTS title text;`);
  await query(`ALTER TABLE amcs ALTER COLUMN title SET DEFAULT '';`);
  await query(`
    UPDATE amcs
    SET title = COALESCE(NULLIF(title, ''), NULLIF(amc_type, ''), 'AMC')
    WHERE title IS NULL OR title = '';
  `);
  await query(`ALTER TABLE amcs ALTER COLUMN title SET NOT NULL;`);
  await query(`
    UPDATE amcs
    SET
      start_date = COALESCE(start_date, NULLIF(payload->>'startDate', '')::date),
      end_date = COALESCE(end_date, NULLIF(payload->>'endDate', '')::date, NULLIF(payload->>'renewalDate', '')::date),
      billing_cycle = COALESCE(NULLIF(billing_cycle, ''), NULLIF(payload->>'billingCycle', '')),
      amc_amount = COALESCE(amc_amount, NULLIF(payload->>'amcAmount', '')::numeric, 0),
      gst_type = COALESCE(NULLIF(gst_type, ''), NULLIF(payload->>'gstType', '')),
      next_invoice_date = COALESCE(next_invoice_date, NULLIF(payload->>'nextInvoiceDate', '')::date),
      reminder_days = COALESCE(reminder_days, NULLIF(payload->>'reminderDays', '')::int, 7),
      status = COALESCE(NULLIF(status, ''), NULLIF(payload->>'status', ''), 'Active'),
      auto_invoice = COALESCE(auto_invoice, NULLIF(payload->>'autoInvoice', '')::boolean, false),
      remarks = COALESCE(NULLIF(remarks, ''), NULLIF(payload->>'remarks', ''))
    WHERE TRUE;
  `);
}

async function ensureAmcAutomationHistorySchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS amc_automation_logs (
      id text PRIMARY KEY,
      amc_id text NOT NULL REFERENCES amcs(id) ON DELETE CASCADE,
      run_id text NOT NULL,
      run_source text NOT NULL DEFAULT 'manual',
      action text NOT NULL,
      status text NOT NULL DEFAULT 'Success',
      due_date date,
      invoice_id text REFERENCES invoices(id) ON DELETE SET NULL,
      invoice_number text,
      message text,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_amc_automation_logs_amc_id ON amc_automation_logs(amc_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_amc_automation_logs_run_id ON amc_automation_logs(run_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_amc_automation_logs_created_at ON amc_automation_logs(created_at);`);
}

async function ensureWorkflowAutomationHistorySchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS workflow_automation_logs (
      id text PRIMARY KEY,
      module_name text NOT NULL,
      entity_id text NOT NULL,
      run_id text NOT NULL,
      run_source text NOT NULL DEFAULT 'manual',
      action text NOT NULL,
      status text NOT NULL DEFAULT 'Success',
      due_date date,
      reference_id text,
      reference_name text,
      message text,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_workflow_automation_logs_module_name ON workflow_automation_logs(module_name);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_workflow_automation_logs_entity_id ON workflow_automation_logs(entity_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_workflow_automation_logs_run_id ON workflow_automation_logs(run_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_workflow_automation_logs_created_at ON workflow_automation_logs(created_at);`);
}

async function ensureNotificationsSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id text PRIMARY KEY,
      recipient_type text NOT NULL DEFAULT 'user',
      user_id text REFERENCES users(id) ON DELETE CASCADE,
      client_id text REFERENCES clients(id) ON DELETE CASCADE,
      module_name text NOT NULL,
      event_key text NOT NULL,
      entity_type text NOT NULL DEFAULT '',
      entity_id text NOT NULL DEFAULT '',
      title text NOT NULL,
      message text NOT NULL,
      severity text NOT NULL DEFAULT 'info',
      is_read boolean NOT NULL DEFAULT false,
      read_at timestamptz,
      email_to text,
      email_status text NOT NULL DEFAULT 'pending',
      email_sent_at timestamptz,
      email_error text,
      actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
      route_path text,
      channels jsonb NOT NULL DEFAULT '[]'::jsonb,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_client_id ON notifications(client_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_module_name ON notifications(module_name);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_event_key ON notifications(event_key);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);`);
}

async function ensurePaymentStatusSchema() {
  await query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_status text;`);
  await query(`ALTER TABLE payments ALTER COLUMN payment_status SET DEFAULT 'Received';`);
  await query(`
    UPDATE payments
    SET payment_status = COALESCE(NULLIF(payment_status, ''), 'Received')
    WHERE payment_status IS NULL OR payment_status = '';
  `);
  await query(`ALTER TABLE payments ALTER COLUMN payment_status SET NOT NULL;`);
}

async function ensureInvoiceSourceIndexes() {
  await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_quotation_id text REFERENCES lead_events(id) ON DELETE SET NULL;`);
  await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'percent';`);
  await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_value numeric(14,2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS advance_amount numeric(14,2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_type text NOT NULL DEFAULT 'none';`);
  await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate numeric(8,2) NOT NULL DEFAULT 0;`);
  await query(`CREATE INDEX IF NOT EXISTS idx_invoices_source_amc_id ON invoices(source_amc_id);`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_source_quotation_id ON invoices(source_quotation_id) WHERE source_quotation_id IS NOT NULL;`);
}

async function seedDefaultData() {
  const settingsCount = await query('select count(*)::int as count from app_settings');
  if ((settingsCount.rows[0]?.count || 0) === 0) {
    await query(
      `insert into app_settings (id, company, gst, tds, invoice, bank, branding, smtp, email_templates, compliance_note, roles, payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        'default',
        DEFAULT_SETTINGS.company,
        DEFAULT_SETTINGS.gst,
        DEFAULT_SETTINGS.tds,
        DEFAULT_SETTINGS.invoice,
        DEFAULT_SETTINGS.bank,
        DEFAULT_SETTINGS.branding,
        DEFAULT_SETTINGS.smtp,
        DEFAULT_SETTINGS.emailTemplates,
        DEFAULT_SETTINGS.complianceNote,
        DEFAULT_SETTINGS.roles,
        {}
      ]
    );
  }

  const masters = [
    ...DEFAULT_SERVICE_CATEGORIES,
    ...DEFAULT_SERVICES,
    ...DEFAULT_EXPENSE_CATEGORIES,
    ...DEFAULT_TAX_RATES,
    ...DEFAULT_QUOTATION_MASTERS,
    ...DEFAULT_VENDORS,
    ...DEFAULT_RENEWAL_PROVIDERS,
    ...DEFAULT_AMC_TYPES,
    ...DEFAULT_BILLING_CYCLES,
    ...DEFAULT_INVOICE_TERMS,
    ...DEFAULT_LEGAL_TERMS
  ];

  for (const item of masters) {
    await query(
      `insert into master_items (id, type, name, is_active, sort_order, payload)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (type, name)
       do nothing`,
      [
        item.id || createId(item.type || 'master'),
        item.type,
        item.name,
        item.is_active !== false,
        item.sort_order || 0,
        item.payload || {}
      ]
    );
  }
}

async function seedAutomationDemoData() {
  const counts = await Promise.all([
    query('select count(*)::int as count from clients'),
    query('select count(*)::int as count from projects'),
    query('select count(*)::int as count from amcs'),
    query('select count(*)::int as count from renewals'),
    query('select count(*)::int as count from outsourcing_expenses'),
    query('select count(*)::int as count from amc_automation_logs'),
    query('select count(*)::int as count from workflow_automation_logs')
  ]);

  const [clientsCount, projectsCount, amcsCount, renewalsCount, outsourcingCount, amcLogsCount, workflowLogsCount] = counts.map((result) => Number(result.rows[0]?.count || 0));
  if (amcsCount || renewalsCount || outsourcingCount || amcLogsCount || workflowLogsCount) {
    return;
  }

  const primaryClientId = 'client-demo-orbit';
  const secondaryClientId = 'client-demo-nova';
  const primaryProjectId = 'project-demo-portal';
  const secondaryProjectId = 'project-demo-retainer';
  const amcOneId = 'amc-demo-portal';
  const amcTwoId = 'amc-demo-support';
  const renewalOneId = 'renewal-demo-domain';
  const renewalTwoId = 'renewal-demo-hosting';
  const renewalThreeId = 'renewal-demo-software';
  const outsourcingOneId = 'outsource-demo-domain';
  const outsourcingTwoId = 'outsource-demo-design';
  const outsourcingThreeId = 'outsource-demo-marketing';

  const existingClients = await query('select id from clients order by created_at asc limit 2');
  let demoClientIds = existingClients.rows.map((row) => row.id).filter(Boolean);

  if (!demoClientIds.length) {
    await query(
      `insert into clients (
        id, name, company_name, client_type, source, mobile, email, city, state, country, status, labels, payload
      ) values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'India', 'Active', '[]'::jsonb, $10::jsonb),
        ($11, $12, $13, $14, $15, $16, $17, $18, $19, 'India', 'Active', '[]'::jsonb, $20::jsonb)
      on conflict (id) do nothing`,
      [
        primaryClientId,
        'Orbit Retail',
        'Orbit Retail Pvt Ltd',
        'Organization',
        'Referral',
        '+91 90000 10001',
        'accounts@orbitretail.test',
        'Raipur',
        'Chhattisgarh',
        JSON.stringify({ notes: 'Demo client for automation dashboard' }),
        secondaryClientId,
        'Nova Health',
        'Nova Health Labs',
        'Organization',
        'Website',
        '+91 90000 10002',
        'finance@novahealth.test',
        'Bengaluru',
        'Karnataka',
        JSON.stringify({ notes: 'Second demo client for renewals and outsourcing' })
      ]
    );
    demoClientIds = [primaryClientId, secondaryClientId];
  }

  const primaryClientSeedId = demoClientIds[0] || primaryClientId;
  const secondaryClientSeedId = demoClientIds[1] || demoClientIds[0] || secondaryClientId;

  const existingProjects = await query('select id from projects order by created_at asc limit 2');
  let demoProjectIds = existingProjects.rows.map((row) => row.id).filter(Boolean);

  if (!demoProjectIds.length) {
    await query(
      `insert into projects (
        id, client_id, title, project_type, value, start_date, deadline, status, billing_type, cost_estimate, notes, labels, payload
      ) values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '[]'::jsonb, $12::jsonb),
        ($13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, '[]'::jsonb, $24::jsonb)
      on conflict (id) do nothing`,
      [
        primaryProjectId,
        primaryClientSeedId,
        'Orbit Customer Portal',
        'Web App',
        240000,
        isoDateOffset(-120),
        isoDateOffset(30),
        'In Progress',
        'Milestone',
        180000,
        'Demo project linked to AMC and outsourcing.',
        JSON.stringify({ priority: 'High' }),
        secondaryProjectId,
        secondaryClientSeedId,
        'Nova Support Portal',
        'Support Portal',
        180000,
        isoDateOffset(-90),
        isoDateOffset(18),
        'Active',
        'Recurring',
        140000,
        'Second demo project for renewals and payable monitoring.',
        JSON.stringify({ priority: 'Medium' })
      ]
    );
    demoProjectIds = [primaryProjectId, secondaryProjectId];
  }

  const primaryProjectSeedId = demoProjectIds[0] || primaryProjectId;
  const secondaryProjectSeedId = demoProjectIds[1] || demoProjectIds[0] || secondaryProjectId;

  await query(
    `insert into amcs (
      id, client_id, project_id, title, amc_type, start_date, end_date, billing_cycle, amc_amount, gst_type, next_invoice_date, reminder_days, status, auto_invoice, remarks, payload
    ) values
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, '{}'::jsonb),
      ($16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, '{}'::jsonb)
    on conflict (id) do nothing`,
    [
      amcOneId,
      primaryClientSeedId,
      primaryProjectSeedId,
      'Orbit Portal AMC',
      'Website Maintenance',
      isoDateOffset(-75),
      isoDateOffset(20),
      'Monthly',
      12000,
      'GST',
      isoDateOffset(4),
      7,
      'Active',
      true,
      'Monthly support, bug fixes, and updates.',
      amcTwoId,
      secondaryClientSeedId,
      secondaryProjectSeedId,
      'Nova Infrastructure AMC',
      'Server Maintenance',
      isoDateOffset(-210),
      isoDateOffset(-6),
      'Monthly',
      18000,
      'GST',
      isoDateOffset(-2),
      5,
      'Active',
      true,
      'Server monitoring and emergency support.'
    ]
  );

  await query(
    `insert into renewals (
      id, client_id, project_id, category, domain_name, hosting_name, package_name, software_name, provider, purchase_date, duration_years, renewal_date, expiry_date, purchase_price, renewal_price, renewal_cost, client_charge, reminder_date, reminder_days, auto_renewal, finance_action, status, remarks, payload
    ) values
      ($1, $2, $3, $4, $5, null, null, null, $6, $7, 1, $8, $9, $10, $11, $12, $13, $14, 30, false, 'Renew', 'Due Soon', $15, '{}'::jsonb),
      ($16, $17, $18, $19, null, $20, null, null, $21, $22, 1, $23, $24, $25, $26, $27, $28, $29, 30, false, 'Renew', 'Expired', $30, '{}'::jsonb),
      ($31, $32, $33, $34, null, null, $35, $36, $37, $38, 1, $39, $40, $41, $42, $43, $44, $45, 30, false, 'Create Invoice', 'Pending', $46, '{}'::jsonb)
    on conflict (id) do nothing`,
    [
      renewalOneId,
      primaryClientSeedId,
      primaryProjectSeedId,
      'Domain',
      'orbitretail.in',
      'GoDaddy',
      isoDateOffset(-350),
      isoDateOffset(18),
      isoDateOffset(18),
      1200,
      1499,
      0,
      1499,
      isoDateOffset(8),
      'Domain renewal due soon.',
      renewalTwoId,
      secondaryClientSeedId,
      secondaryProjectSeedId,
      'Hosting',
      'novahealth.com hosting',
      'Hostinger',
      isoDateOffset(-370),
      isoDateOffset(-3),
      isoDateOffset(-3),
      5000,
      6500,
      0,
      6500,
      isoDateOffset(-10),
      'Hosting renewal overdue.',
      renewalThreeId,
      primaryClientSeedId,
      primaryProjectSeedId,
      'Software',
      'Microsoft 365',
      'Microsoft',
      'Business Standard',
      isoDateOffset(-200),
      isoDateOffset(14),
      isoDateOffset(14),
      12000,
      13500,
      0,
      13500,
      isoDateOffset(7),
      'Software license pending renewal.'
    ]
  );

  await query(
    `insert into outsourcing_expenses (
      id, expense_date, client_id, project_id, vendor_id, vendor_name, work_type, description, base_amount, vendor_gst_registered, gst_applicable, gst_rate, gst_amount, total_amount, itc_eligible, approval_status, due_date, payment_status, reminder_days, notes, payload
    ) values
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, true, 18, $10, $11, true, 'Pending', $12, 'Pending', 7, $13, '{}'::jsonb),
      ($14, $15, $16, $17, $18, $19, $20, $21, $22, true, true, 18, $23, $24, true, 'Approved', $25, 'Pending', 5, $26, '{}'::jsonb),
      ($27, $28, $29, $30, $31, $32, $33, $34, $35, false, false, 0, 0, $36, false, 'Approved', $37, 'Pending', 3, $38, '{}'::jsonb)
    on conflict (id) do nothing`,
    [
      outsourcingOneId,
      isoDateOffset(-2),
      primaryClientSeedId,
      primaryProjectSeedId,
      'vendor-godaddy',
      'GoDaddy',
      'Domain Purchase',
      'New domain purchase and renewal consolidation.',
      9000,
      10620,
      10620,
      isoDateOffset(5),
      'Pending approval, due soon.',
      outsourcingTwoId,
      isoDateOffset(-6),
      secondaryClientSeedId,
      secondaryProjectSeedId,
      'vendor-designer-sample',
      'Freelance Graphic Designer',
      'Landing Page Redesign',
      'Creative redesign for the customer portal.',
      15000,
      17700,
      17700,
      isoDateOffset(2),
      'Approved and due soon.',
      outsourcingThreeId,
      isoDateOffset(-12),
      primaryClientSeedId,
      primaryProjectSeedId,
      'vendor-referral-sample',
      'Rahul Referral Partner',
      'Lead Partnership',
      'Referral payout for closed deal.',
      22000,
      22000,
      isoDateOffset(-4),
      'Overdue payable.'
    ]
  );

  const amcLatestRun = 'amcrun-demo-20260718-2';
  const amcPreviousRun = 'amcrun-demo-20260718-1';
  const outsourcingLatestRun = 'outsrc-demo-20260718-2';
  const outsourcingPreviousRun = 'outsrc-demo-20260718-1';

  await query(
    `insert into amc_automation_logs (
      id, amc_id, run_id, run_source, action, status, due_date, invoice_number, message, payload, created_at, updated_at
    ) values
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $11),
      ($12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb, $22, $22),
      ($23, $24, $25, $26, $27, $28, $29, $30, $31, $32::jsonb, $33, $33),
      ($34, $35, $36, $37, $38, $39, $40, $41, $42, $43::jsonb, $44, $44)
    on conflict (id) do nothing`,
    [
      'amclog-demo-1',
      amcOneId,
      amcPreviousRun,
      'manual',
      'reminder_sent',
      'Success',
      isoDateOffset(18),
      null,
      'Reminder sent for upcoming AMC',
      JSON.stringify({ reminderDays: 7 }),
      isoDateTimeOffset(-1440),
      'amclog-demo-2',
      amcTwoId,
      amcPreviousRun,
      'manual',
      'invoice_created',
      'Success',
      isoDateOffset(-6),
      'INV-2501',
      'Auto invoice created for AMC',
      JSON.stringify({ invoiceId: 'inv-demo-1' }),
      isoDateTimeOffset(-1435),
      'amclog-demo-3',
      amcOneId,
      amcLatestRun,
      'manual',
      'reminder_sent',
      'Success',
      isoDateOffset(4),
      null,
      'Reminder sent for Orbit Portal AMC',
      JSON.stringify({ reminderDays: 7 }),
      isoDateTimeOffset(-60),
      'amclog-demo-4',
      amcTwoId,
      amcLatestRun,
      'manual',
      'invoice_created',
      'Success',
      isoDateOffset(-2),
      'INV-2502',
      'Invoice created for AMC renewal',
      JSON.stringify({ invoiceId: 'inv-demo-2' }),
      isoDateTimeOffset(-55)
    ]
  );

  await query(
    `insert into workflow_automation_logs (
      id, module_name, entity_id, run_id, run_source, action, status, due_date, reference_id, reference_name, message, payload, created_at, updated_at
    ) values
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $13),
      ($14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25::jsonb, $26, $26),
      ($27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38::jsonb, $39, $39),
      ($40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51::jsonb, $52, $52),
      ($53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64::jsonb, $65, $65)
    on conflict (id) do nothing`,
    [
      'wflog-demo-1',
      'outsourcing',
      outsourcingOneId,
      outsourcingPreviousRun,
      'manual',
      'approval_alert',
      'Success',
      isoDateOffset(5),
      'ref-out-1',
      'Domain Purchase',
      'Approval alert sent to finance inbox',
      JSON.stringify({ note: 'Pending approval' }),
      isoDateTimeOffset(-1440),
      'wflog-demo-2',
      'outsourcing',
      outsourcingTwoId,
      outsourcingPreviousRun,
      'manual',
      'due_alert',
      'Success',
      isoDateOffset(2),
      'ref-out-2',
      'Landing Page Redesign',
      'Due alert sent for outsourcing payable',
      JSON.stringify({ note: 'Due soon' }),
      isoDateTimeOffset(-1430),
      'wflog-demo-3',
      'outsourcing',
      outsourcingThreeId,
      outsourcingLatestRun,
      'manual',
      'overdue_alert',
      'Warning',
      isoDateOffset(-4),
      'ref-out-3',
      'Lead Partnership',
      'Overdue alert sent for payable',
      JSON.stringify({ note: 'Overdue' }),
      isoDateTimeOffset(-65),
      'wflog-demo-4',
      'outsourcing',
      outsourcingOneId,
      outsourcingLatestRun,
      'manual',
      'approval_reminder_sent',
      'Success',
      isoDateOffset(5),
      'ref-out-1',
      'Domain Purchase',
      'Approval reminder sent',
      JSON.stringify({ note: 'Reminder sent' }),
      isoDateTimeOffset(-60),
      'wflog-demo-5',
      'outsourcing',
      outsourcingTwoId,
      outsourcingLatestRun,
      'manual',
      'payment_reminder_sent',
      'Success',
      isoDateOffset(2),
      'ref-out-2',
      'Landing Page Redesign',
      'Payment reminder sent',
      JSON.stringify({ note: 'Payment reminder' }),
      isoDateTimeOffset(-55)
    ]
  );
}

async function seedNotificationDemoData() {
  const bootstrapEmail = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL || '');
  const bootstrapUsername = normalizeUsername(process.env.BOOTSTRAP_ADMIN_USERNAME || bootstrapEmail);
  if (!bootstrapEmail && !bootstrapUsername) return;

  const userResult = await query(
    `select id, email
     from users
     where lower(email) = $1 or lower(username) = $2
     order by created_at asc
     limit 1`,
    [bootstrapEmail, bootstrapUsername]
  );

  const adminUserId = userResult.rows[0]?.id || null;
  const adminEmail = userResult.rows[0]?.email || bootstrapEmail;
  if (!adminUserId) return;

  const countResult = await query('select count(*)::int as count from notifications where user_id = $1', [adminUserId]);
  if ((countResult.rows[0]?.count || 0) > 0) return;

  const notifications = [
    {
      id: 'notif-demo-1',
      moduleName: 'invoices',
      eventKey: 'invoice_created',
      entityType: 'invoice',
      entityId: 'inv-demo-2508',
      title: 'Invoice INV-2508 created',
      message: 'Invoice generated for Orbit Portal AMC. Amount: Rs. 14,160.',
      severity: 'success',
      isRead: false,
      emailTo: adminEmail,
      emailStatus: 'pending',
      routePath: '/app/invoices',
      channels: ['inApp', 'email'],
      payload: { source: 'demo', amount: 14160, invoiceNumber: 'INV-2508' },
      createdAt: isoDateTimeOffset(-45)
    },
    {
      id: 'notif-demo-2',
      moduleName: 'payments',
      eventKey: 'payment_received',
      entityType: 'payment',
      entityId: 'pay-demo-9001',
      title: 'Payment received from Nova Health',
      message: 'Rs. 59,000 payment recorded against invoice INV-003.',
      severity: 'success',
      isRead: false,
      emailTo: adminEmail,
      emailStatus: 'pending',
      routePath: '/app/payments',
      channels: ['inApp'],
      payload: { source: 'demo', amount: 59000, invoiceNumber: 'INV-003' },
      createdAt: isoDateTimeOffset(-120)
    },
    {
      id: 'notif-demo-3',
      moduleName: 'projects',
      eventKey: 'project_updated',
      entityType: 'project',
      entityId: 'project-demo-portal',
      title: 'Project status updated',
      message: 'Nova Support Portal moved to In Progress.',
      severity: 'info',
      isRead: true,
      readAt: isoDateTimeOffset(-95),
      routePath: '/app/projects',
      channels: ['inApp'],
      payload: { source: 'demo', status: 'In Progress' },
      createdAt: isoDateTimeOffset(-96)
    },
    {
      id: 'notif-demo-4',
      moduleName: 'amc',
      eventKey: 'amc_due_soon',
      entityType: 'amc',
      entityId: 'amc-demo-portal',
      title: 'AMC renewal due in 4 days',
      message: 'Orbit Portal AMC is due for renewal on 22 Jul 2026.',
      severity: 'warning',
      isRead: false,
      routePath: '/app/amc',
      channels: ['inApp'],
      payload: { source: 'demo', daysRemaining: 4 },
      createdAt: isoDateTimeOffset(-18)
    },
    {
      id: 'notif-demo-5',
      moduleName: 'renewals',
      eventKey: 'renewal_expired',
      entityType: 'renewal',
      entityId: 'renewal-demo-hosting',
      title: 'Hosting renewal expired',
      message: 'Nova Health hosting expired 2 days ago and needs immediate follow-up.',
      severity: 'danger',
      isRead: false,
      routePath: '/app/renewals',
      channels: ['inApp'],
      payload: { source: 'demo', daysRemaining: -2 },
      createdAt: isoDateTimeOffset(-12)
    },
    {
      id: 'notif-demo-6',
      moduleName: 'outsourcing',
      eventKey: 'payable_overdue',
      entityType: 'outsourcing',
      entityId: 'outsource-demo-design',
      title: 'Outsourcing payable overdue',
      message: 'Freelance Graphic Designer payment is 2 days overdue.',
      severity: 'warning',
      isRead: false,
      routePath: '/app/outsourcing',
      channels: ['inApp', 'email'],
      payload: { source: 'demo', daysRemaining: -2, amount: 17700 },
      createdAt: isoDateTimeOffset(-8)
    },
    {
      id: 'notif-demo-7',
      moduleName: 'automation',
      eventKey: 'automation_completed',
      entityType: 'automation',
      entityId: 'run-demo-automation',
      title: 'Automation run completed',
      message: 'AMC and outsourcing automation finished successfully.',
      severity: 'success',
      isRead: true,
      readAt: isoDateTimeOffset(-5),
      routePath: '/app/automation',
      channels: ['inApp'],
      payload: { source: 'demo', modules: ['amc', 'outsourcing'] },
      createdAt: isoDateTimeOffset(-6)
    }
  ];

  for (const notification of notifications) {
    await query(
      `insert into notifications (
        id, recipient_type, user_id, module_name, event_key, entity_type, entity_id, title, message, severity,
        is_read, read_at, email_to, email_status, actor_user_id, route_path, channels, payload, created_at, updated_at
      ) values (
        $1, 'user', $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, null, $14, $15::jsonb, $16::jsonb, $17, $17
      )
      on conflict (id) do nothing`,
      [
        notification.id,
        adminUserId,
        notification.moduleName,
        notification.eventKey,
        notification.entityType,
        notification.entityId,
        notification.title,
        notification.message,
        notification.severity,
        notification.isRead,
        notification.readAt || null,
        notification.emailTo || null,
        notification.emailStatus || 'pending',
        notification.routePath || '',
        JSON.stringify(notification.channels || ['inApp']),
        JSON.stringify(notification.payload || {}),
        notification.createdAt
      ]
    );
  }
}

async function seedRbac() {
  await withTransaction(async (client) => {
    await client.query(`SET LOCAL statement_timeout = '0'`);
    await client.query(`SET LOCAL lock_timeout = '0'`);

    for (const permission of PERMISSIONS) {
      await client.query(
        `insert into permissions (id, code, name, module, action, description, is_active, payload)
         values ($1, $2, $3, $4, $5, $6, true, '{}'::jsonb)
         on conflict (code)
         do update set
           name = excluded.name,
           module = excluded.module,
           action = excluded.action,
           description = excluded.description,
           is_active = excluded.is_active,
           updated_at = now()`,
        [
          createId('perm'),
          permission.code,
          permission.name,
          permission.module,
          permission.action,
          permission.description || ''
        ]
      );
    }

    for (const role of DEFAULT_ROLE_DEFINITIONS) {
      await client.query(
        `insert into roles (id, code, name, description, is_system, is_active, payload)
         values ($1, $2, $3, $4, $5, $6, '{}'::jsonb)
         on conflict (code)
         do update set
           name = excluded.name,
           description = excluded.description,
           is_system = excluded.is_system,
           is_active = excluded.is_active,
           updated_at = now()`,
        [
          createId('role'),
          role.code,
          role.name,
          role.description || '',
          Boolean(role.isSystem),
          true
        ]
      );
    }

    const roleResult = await client.query(
      `select id, code
       from roles
       where code = any($1::text[])`,
      [DEFAULT_ROLE_DEFINITIONS.map((role) => role.code)]
    );
    const permissionResult = await client.query(
      `select id, code
       from permissions
       where code = any($1::text[])`,
      [PERMISSIONS.map((permission) => permission.code)]
    );

    const roleIdByCode = new Map(roleResult.rows.map((row) => [row.code, row.id]));
    const permissionIdByCode = new Map(permissionResult.rows.map((row) => [row.code, row.id]));

    for (const role of DEFAULT_ROLE_DEFINITIONS) {
      const roleId = roleIdByCode.get(role.code);
      if (!roleId) continue;

      // Preserve explicitly assigned HRM grants when refreshing legacy default roles.
      await client.query("delete from role_permissions where role_id = $1 and permission_id in (select id from permissions where module <> 'hrm')", [roleId]);
      const permissionIds = [...new Set((role.permissions || []).map((code) => permissionIdByCode.get(code)).filter(Boolean))];

      for (const permissionId of permissionIds) {
        await client.query(
          `insert into role_permissions (role_id, permission_id, granted_by)
           values ($1, $2, null)
           on conflict (role_id, permission_id) do nothing`,
          [roleId, permissionId]
        );
      }
    }

    const bootstrapEmail = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL || '');
    const bootstrapPassword = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '').trim();
    const bootstrapName = String(process.env.BOOTSTRAP_ADMIN_NAME || 'System Admin').trim() || 'System Admin';
    const bootstrapUsername = normalizeUsername(process.env.BOOTSTRAP_ADMIN_USERNAME || bootstrapEmail);

    if (bootstrapEmail && bootstrapPassword) {
      const userResult = await client.query(
        `select id, email, username
         from users
         where lower(email) = $1 or lower(username) = $2
         limit 1`,
        [bootstrapEmail, bootstrapUsername]
      );

      let adminUserId = userResult.rows[0]?.id || null;
      const passwordHash = await bcrypt.hash(bootstrapPassword, 10);

      if (adminUserId) {
        await client.query(
          `update users
           set full_name = $2,
               username = $3,
               email = $4,
               is_active = true,
               updated_at = now()
           where id = $1`,
          [adminUserId, bootstrapName, bootstrapUsername, bootstrapEmail]
        );
      } else {
        adminUserId = createId('user');
        await client.query(
          `insert into users (id, full_name, username, email, password_hash, is_active, payload)
           values ($1, $2, $3, $4, $5, true, '{}'::jsonb)`,
          [adminUserId, bootstrapName, bootstrapUsername, bootstrapEmail, passwordHash]
        );
      }

      const adminRoleId = roleIdByCode.get('admin');
      if (adminRoleId) {
        await client.query(
          `insert into user_roles (user_id, role_id, assigned_by)
           values ($1, $2, null)
           on conflict (user_id, role_id) do nothing`,
          [adminUserId, adminRoleId]
        );
      }
    }
  });
}

module.exports = {
  ensureDatabase,
  ensureInvoiceSourceIndexes,
  ensureLeadManagementSchema
};
