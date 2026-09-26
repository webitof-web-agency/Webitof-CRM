-- Advanced Follow-up Engine
-- Additive, idempotent schema. Existing business tables are not renamed or removed.

CREATE TABLE IF NOT EXISTS follow_up_settings (
  id text PRIMARY KEY DEFAULT 'default',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  business_hours jsonb NOT NULL DEFAULT '{"start":"09:30","end":"18:30","workingDays":[1,2,3,4,5,6]}'::jsonb,
  holiday_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  protection_thresholds jsonb NOT NULL DEFAULT '{"highValueLead":250000,"untouchedHours":24,"waitingHours":48,"maxReschedules":3,"maxCriticalSnoozes":1,"renewalWindowDays":90}'::jsonb,
  default_reminders jsonb NOT NULL DEFAULT '[{"channel":"inApp","minutesBefore":30},{"channel":"inApp","minutesBefore":0}]'::jsonb,
  escalation_schedule jsonb NOT NULL DEFAULT '[{"level":1,"minutesOverdue":30},{"level":2,"minutesOverdue":120},{"level":3,"minutesOverdue":1440},{"level":4,"minutesOverdue":2880}]'::jsonb,
  retry_policy jsonb NOT NULL DEFAULT '{"delaysMinutes":[120,1440,2880],"maxAttempts":5,"respectBusinessHours":true}'::jsonb,
  feature_flags jsonb NOT NULL DEFAULT '{"automaticClientMessages":false,"browserNotifications":true,"dryRunBackfill":true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_templates (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  follow_up_type text NOT NULL DEFAULT 'Call',
  default_title text NOT NULL,
  description text,
  default_duration_minutes integer NOT NULL DEFAULT 30,
  default_priority text NOT NULL DEFAULT 'Medium',
  assignee_strategy text NOT NULL DEFAULT 'record_owner',
  reminder_settings jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_outcome text,
  next_action_suggestion text,
  escalation_rule_id text,
  message_template text,
  sequence_id text,
  is_active boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  updated_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_sequences (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  trigger_key text NOT NULL,
  applicable_entity_type text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  exit_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  pause_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  retry_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  updated_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_sequence_steps (
  id text PRIMARY KEY,
  sequence_id text NOT NULL REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  name text NOT NULL,
  delay_minutes integer NOT NULL DEFAULT 0,
  action_type text NOT NULL DEFAULT 'create_follow_up',
  follow_up_type text,
  title_template text,
  assignee_strategy text NOT NULL DEFAULT 'record_owner',
  reminder_settings jsonb NOT NULL DEFAULT '[]'::jsonb,
  message_template text,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  escalation_rule_id text,
  is_active boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, step_order)
);

CREATE TABLE IF NOT EXISTS follow_up_automation_rules (
  id text PRIMARY KEY,
  name text NOT NULL,
  trigger_key text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  updated_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_escalation_rules (
  id text PRIMARY KEY,
  name text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  levels jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  updated_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id text PRIMARY KEY,
  follow_up_number text NOT NULL UNIQUE,
  related_entity_type text NOT NULL,
  related_entity_id text NOT NULL,
  related_entity_label text,
  lead_id text REFERENCES leads(id) ON DELETE SET NULL,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  invoice_id text REFERENCES invoices(id) ON DELETE SET NULL,
  renewal_id text REFERENCES renewals(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  follow_up_type text NOT NULL DEFAULT 'Call',
  purpose text,
  scheduled_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  expected_duration_minutes integer NOT NULL DEFAULT 30,
  priority text NOT NULL DEFAULT 'Medium',
  priority_reason text,
  status text NOT NULL DEFAULT 'Scheduled',
  lead_stage_at_creation text,
  expected_outcome text,
  actual_outcome text,
  communication_result text,
  discussion_note text,
  next_action text,
  next_follow_up_at timestamptz,
  no_next_follow_up_reason text,
  internal_note text,
  customer_visible_note text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'manual',
  location text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  assigned_to text REFERENCES users(id) ON DELETE SET NULL,
  assigned_team text,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  updated_by text REFERENCES users(id) ON DELETE SET NULL,
  completed_by text REFERENCES users(id) ON DELETE SET NULL,
  escalated_to text REFERENCES users(id) ON DELETE SET NULL,
  backup_assignee text REFERENCES users(id) ON DELETE SET NULL,
  is_automatic boolean NOT NULL DEFAULT false,
  sequence_id text REFERENCES follow_up_sequences(id) ON DELETE SET NULL,
  sequence_step_id text REFERENCES follow_up_sequence_steps(id) ON DELETE SET NULL,
  template_id text REFERENCES follow_up_templates(id) ON DELETE SET NULL,
  automation_rule_id text REFERENCES follow_up_automation_rules(id) ON DELETE SET NULL,
  escalation_rule_id text REFERENCES follow_up_escalation_rules(id) ON DELETE SET NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  parent_follow_up_id text REFERENCES follow_ups(id) ON DELETE SET NULL,
  previous_follow_up_id text REFERENCES follow_ups(id) ON DELETE SET NULL,
  next_follow_up_id text REFERENCES follow_ups(id) ON DELETE SET NULL,
  reminder_acknowledged boolean NOT NULL DEFAULT false,
  reminder_acknowledged_at timestamptz,
  completed_at timestamptz,
  original_due_at timestamptz NOT NULL,
  reschedule_count integer NOT NULL DEFAULT 0,
  snooze_count integer NOT NULL DEFAULT 0,
  last_reschedule_reason text,
  escalation_level integer NOT NULL DEFAULT 0,
  last_escalation_at timestamptz,
  notification_delivery_status text NOT NULL DEFAULT 'pending',
  version integer NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_status_history (
  id text PRIMARY KEY,
  follow_up_id text NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  previous_status text,
  next_status text NOT NULL,
  reason text,
  changed_by text REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_reschedule_history (
  id text PRIMARY KEY,
  follow_up_id text NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  previous_due_at timestamptz NOT NULL,
  next_due_at timestamptz NOT NULL,
  reason text NOT NULL,
  note text,
  action_type text NOT NULL DEFAULT 'reschedule',
  changed_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_audit_logs (
  id text PRIMARY KEY,
  follow_up_id text REFERENCES follow_ups(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  old_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_escalation_logs (
  id text PRIMARY KEY,
  follow_up_id text NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  rule_id text REFERENCES follow_up_escalation_rules(id) ON DELETE SET NULL,
  escalation_level integer NOT NULL,
  action text NOT NULL,
  escalated_from text REFERENCES users(id) ON DELETE SET NULL,
  escalated_to text REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_reminders (
  id text PRIMARY KEY,
  follow_up_id text NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'inApp',
  recipient_user_id text REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  failure_reason text,
  retry_count integer NOT NULL DEFAULT 0,
  acknowledged_at timestamptz,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_notification_logs (
  id text PRIMARY KEY,
  follow_up_id text REFERENCES follow_ups(id) ON DELETE SET NULL,
  reminder_id text REFERENCES follow_up_reminders(id) ON DELETE SET NULL,
  channel text NOT NULL,
  recipient text,
  sent_at timestamptz,
  delivery_status text NOT NULL DEFAULT 'pending',
  failure_reason text,
  retry_count integer NOT NULL DEFAULT 0,
  acknowledged_at timestamptz,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_sequence_enrollments (
  id text PRIMARY KEY,
  sequence_id text NOT NULL REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  related_entity_type text NOT NULL,
  related_entity_id text NOT NULL,
  current_step_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active',
  next_run_at timestamptz,
  started_by text REFERENCES users(id) ON DELETE SET NULL,
  stopped_by text REFERENCES users(id) ON DELETE SET NULL,
  stop_reason text,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_sequence_executions (
  id text PRIMARY KEY,
  enrollment_id text NOT NULL REFERENCES follow_up_sequence_enrollments(id) ON DELETE CASCADE,
  sequence_step_id text REFERENCES follow_up_sequence_steps(id) ON DELETE SET NULL,
  step_order integer NOT NULL,
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'Success',
  idempotency_key text NOT NULL UNIQUE,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_automation_executions (
  id text PRIMARY KEY,
  rule_id text NOT NULL REFERENCES follow_up_automation_rules(id) ON DELETE CASCADE,
  trigger_key text NOT NULL,
  related_entity_type text NOT NULL,
  related_entity_id text NOT NULL,
  status text NOT NULL DEFAULT 'Success',
  idempotency_key text NOT NULL UNIQUE,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_promises (
  id text PRIMARY KEY,
  invoice_id text NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  promised_amount numeric(14,2) NOT NULL DEFAULT 0,
  promise_date date NOT NULL,
  promised_by text,
  note text,
  status text NOT NULL DEFAULT 'Pending',
  fulfilled_amount numeric(14,2) NOT NULL DEFAULT 0,
  fulfilled_date date,
  missed boolean NOT NULL DEFAULT false,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  updated_by text REFERENCES users(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency_key
  ON notifications(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follow_ups_due_status ON follow_ups(due_at, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_follow_ups_assignee_due ON follow_ups(assigned_to, due_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_follow_ups_priority ON follow_ups(priority) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_follow_ups_related ON follow_ups(related_entity_type, related_entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_follow_ups_team ON follow_ups(assigned_team) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_follow_ups_sequence ON follow_ups(sequence_id, sequence_step_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_follow_up_status_history_follow_up ON follow_up_status_history(follow_up_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follow_up_reschedule_history_follow_up ON follow_up_reschedule_history(follow_up_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follow_up_audit_logs_follow_up ON follow_up_audit_logs(follow_up_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follow_up_reminders_due ON follow_up_reminders(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_follow_up_enrollments_due ON follow_up_sequence_enrollments(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_payment_promises_due ON payment_promises(status, promise_date);

INSERT INTO follow_up_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
UPDATE follow_up_settings
SET protection_thresholds = protection_thresholds || '{"dailyWorkloadWarning":12}'::jsonb
WHERE id='default' AND NOT (protection_thresholds ? 'dailyWorkloadWarning');

INSERT INTO master_items (id, type, name, is_active, sort_order, payload)
VALUES
  ('fumaster-call','follow_up_type','Call',true,10,'{}'::jsonb),
  ('fumaster-callback','follow_up_type','Callback',true,20,'{}'::jsonb),
  ('fumaster-whatsapp','follow_up_type','WhatsApp',true,30,'{}'::jsonb),
  ('fumaster-email','follow_up_type','Email',true,40,'{}'::jsonb),
  ('fumaster-meeting','follow_up_type','Meeting',true,50,'{}'::jsonb),
  ('fumaster-video','follow_up_type','Video meeting',true,60,'{}'::jsonb),
  ('fumaster-demo','follow_up_type','Demo',true,70,'{}'::jsonb),
  ('fumaster-visit','follow_up_type','Visit',true,80,'{}'::jsonb),
  ('fumaster-site','follow_up_type','Site visit',true,90,'{}'::jsonb),
  ('fumaster-proposal','follow_up_type','Proposal follow-up',true,100,'{}'::jsonb),
  ('fumaster-quotation','follow_up_type','Quotation follow-up',true,110,'{}'::jsonb),
  ('fumaster-payment','follow_up_type','Payment follow-up',true,120,'{}'::jsonb),
  ('fumaster-document','follow_up_type','Document follow-up',true,130,'{}'::jsonb),
  ('fumaster-requirement','follow_up_type','Requirement follow-up',true,140,'{}'::jsonb),
  ('fumaster-approval','follow_up_type','Client approval',true,150,'{}'::jsonb),
  ('fumaster-internal','follow_up_type','Internal dependency',true,160,'{}'::jsonb),
  ('fumaster-project','follow_up_type','Project review',true,170,'{}'::jsonb),
  ('fumaster-support','follow_up_type','Support follow-up',true,180,'{}'::jsonb),
  ('fumaster-renewal','follow_up_type','Renewal follow-up',true,190,'{}'::jsonb),
  ('fumaster-feedback','follow_up_type','Feedback',true,200,'{}'::jsonb),
  ('fumaster-testimonial','follow_up_type','Testimonial',true,210,'{}'::jsonb),
  ('fumaster-referral','follow_up_type','Referral',true,220,'{}'::jsonb),
  ('fumaster-custom','follow_up_type','Custom',true,230,'{}'::jsonb)
ON CONFLICT (type, name) DO NOTHING;

INSERT INTO follow_up_escalation_rules (id, name, conditions, levels, is_active, payload)
VALUES (
  'fuer-default',
  'Default overdue escalation',
  '{}'::jsonb,
  '[{"level":1,"minutesOverdue":30,"actions":["notify_assignee"]},{"level":2,"minutesOverdue":120,"actions":["notify_assignee","increase_priority"]},{"level":3,"minutesOverdue":1440,"actions":["notify_manager"]},{"level":4,"minutesOverdue":2880,"actions":["notify_admin","mark_at_risk"]}]'::jsonb,
  true,
  '{}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO follow_up_sequences (id, name, description, trigger_key, applicable_entity_type, conditions, exit_conditions, retry_rules, version, is_active, payload)
VALUES (
  'fuseq-quotation-default',
  'Quotation Follow-up Sequence',
  'Default quotation response cadence without automatic client messaging.',
  'quotation_sent',
  'Quotation',
  '{}'::jsonb,
  '["client_replied","quotation_approved","quotation_rejected","lead_converted","manual_stop"]'::jsonb,
  '{"maxAttempts":5}'::jsonb,
  1,
  true,
  '{}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO follow_up_sequence_steps (id, sequence_id, step_order, name, delay_minutes, action_type, follow_up_type, title_template, assignee_strategy, reminder_settings, conditions, is_active, payload)
VALUES
  ('fustep-quotation-1', 'fuseq-quotation-default', 1, 'Quotation response check', 1440, 'create_follow_up', 'Quotation follow-up', 'Follow up on quotation', 'record_owner', '[{"channel":"inApp","minutesBefore":30}]'::jsonb, '{}'::jsonb, true, '{}'::jsonb),
  ('fustep-quotation-2', 'fuseq-quotation-default', 2, 'Sales call', 2880, 'create_follow_up', 'Call', 'Call regarding quotation', 'record_owner', '[{"channel":"inApp","minutesBefore":30}]'::jsonb, '{}'::jsonb, true, '{}'::jsonb),
  ('fustep-quotation-3', 'fuseq-quotation-default', 3, 'Manager escalation', 2880, 'escalate', 'Quotation follow-up', 'Escalate quotation response', 'record_owner', '[]'::jsonb, '{}'::jsonb, true, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO follow_up_templates (id, name, category, follow_up_type, default_title, description, default_duration_minutes, default_priority, assignee_strategy, reminder_settings, expected_outcome, next_action_suggestion, escalation_rule_id, sequence_id, is_active, payload)
VALUES
  ('futpl-new-lead', 'New Lead First Call', 'Lead', 'Call', 'First contact call', 'Contact the new lead, understand requirements, budget and timeline.', 20, 'High', 'record_owner', '[{"channel":"inApp","minutesBefore":10},{"channel":"inApp","minutesBefore":0}]'::jsonb, 'Connected', 'Schedule requirement discussion', 'fuer-default', null, true, '{}'::jsonb),
  ('futpl-callback', 'Callback', 'Lead', 'Callback', 'Client callback', 'Call at the time agreed with the client and capture the result.', 20, 'Medium', 'record_owner', '[{"channel":"inApp","minutesBefore":10}]'::jsonb, 'Callback Requested', 'Agree the next decision step', 'fuer-default', null, true, '{}'::jsonb),
  ('futpl-demo', 'Demo Reminder', 'Lead', 'Demo', 'Product demo', 'Prepare and complete the scheduled demonstration.', 45, 'High', 'record_owner', '[{"channel":"inApp","minutesBefore":60},{"channel":"inApp","minutesBefore":10}]'::jsonb, 'Demo Requested', 'Capture demo feedback', 'fuer-default', null, true, '{}'::jsonb),
  ('futpl-meeting', 'Meeting Reminder', 'General', 'Meeting', 'Client meeting', 'Review the agenda and record the client decision and dependencies.', 45, 'Medium', 'record_owner', '[{"channel":"inApp","minutesBefore":60},{"channel":"inApp","minutesBefore":10}]'::jsonb, 'Meeting Scheduled', 'Record the agreed action', 'fuer-default', null, true, '{}'::jsonb),
  ('futpl-proposal', 'Proposal Follow-up', 'Quotation', 'Proposal follow-up', 'Follow up on proposal', 'Confirm receipt, objections and the expected decision date.', 20, 'High', 'record_owner', '[{"channel":"inApp","minutesBefore":30}]'::jsonb, 'Decision Pending', 'Agree next decision date', 'fuer-default', null, true, '{}'::jsonb),
  ('futpl-quotation', 'Quotation Reminder', 'Quotation', 'Quotation follow-up', 'Follow up on quotation', 'Confirm that the quotation was received and capture the decision timeline.', 20, 'High', 'record_owner', '[{"channel":"inApp","minutesBefore":30}]'::jsonb, 'Decision Pending', 'Agree next decision date', 'fuer-default', 'fuseq-quotation-default', true, '{}'::jsonb),
  ('futpl-payment', 'Payment Reminder', 'Payment', 'Payment follow-up', 'Payment follow-up', 'Confirm payment status, promise date and TDS details.', 20, 'High', 'record_owner', '[{"channel":"inApp","minutesBefore":60},{"channel":"inApp","minutesBefore":0}]'::jsonb, 'Payment Promised', 'Record payment promise', 'fuer-default', null, true, '{}'::jsonb),
  ('futpl-content', 'Client Content Reminder', 'Project', 'Document follow-up', 'Client content reminder', 'Request pending project content and agree a delivery date.', 20, 'Medium', 'record_owner', '[{"channel":"inApp","minutesBefore":60}]'::jsonb, 'Requirement Pending', 'Confirm content delivery', 'fuer-default', null, true, '{}'::jsonb),
  ('futpl-approval', 'Approval Reminder', 'Project', 'Client approval', 'Client approval reminder', 'Follow up on the pending review or milestone approval.', 20, 'High', 'record_owner', '[{"channel":"inApp","minutesBefore":60}]'::jsonb, 'Client Approval Pending', 'Confirm approval or revision', 'fuer-default', null, true, '{}'::jsonb),
  ('futpl-feedback', 'Project Feedback', 'Project', 'Feedback', 'Project feedback', 'Capture delivery feedback and any open action items.', 30, 'Medium', 'record_owner', '[{"channel":"inApp","minutesBefore":60}]'::jsonb, 'Resolved', 'Close open feedback actions', 'fuer-default', null, true, '{}'::jsonb),
  ('futpl-renewal', 'Renewal Reminder', 'Renewal', 'Renewal follow-up', 'Renewal follow-up', 'Review renewal scope, price and client confirmation.', 30, 'High', 'record_owner', '[{"channel":"inApp","minutesBefore":1440}]'::jsonb, 'Client Approval Pending', 'Confirm renewal decision', 'fuer-default', null, true, '{}'::jsonb),
  ('futpl-reactivation', 'Lost Lead Reactivation', 'Lead', 'Call', 'Reconnect with lost lead', 'Revalidate the requirement, timing and decision criteria.', 20, 'Medium', 'record_owner', '[{"channel":"inApp","minutesBefore":60}]'::jsonb, 'Interested', 'Requalify the opportunity', 'fuer-default', null, true, '{}'::jsonb),
  ('futpl-testimonial', 'Testimonial Request', 'Client', 'Testimonial', 'Request client testimonial', 'Ask for a testimonial after a successful delivery.', 15, 'Low', 'client_owner', '[{"channel":"inApp","minutesBefore":60}]'::jsonb, 'Connected', 'Record testimonial response', 'fuer-default', null, true, '{}'::jsonb),
  ('futpl-referral', 'Referral Request', 'Client', 'Referral', 'Request client referral', 'Request a relevant introduction after a successful engagement.', 15, 'Low', 'client_owner', '[{"channel":"inApp","minutesBefore":60}]'::jsonb, 'Connected', 'Record referral response', 'fuer-default', null, true, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
