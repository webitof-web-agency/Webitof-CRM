-- HRM v3: employee onboarding wizard. Additive only.
-- Biometric/device code, per-employee attendance policy and profile photo on the employee.
ALTER TABLE hrm_employees
  ADD COLUMN IF NOT EXISTS employee_code text,
  ADD COLUMN IF NOT EXISTS attendance_policy_id text REFERENCES master_items(id),
  ADD COLUMN IF NOT EXISTS photo_document_id text;
CREATE UNIQUE INDEX IF NOT EXISTS hrm_employee_code_unique
  ON hrm_employees(lower(employee_code)) WHERE employee_code IS NOT NULL AND archived_at IS NULL;
-- Reason shown to the employee when HR rejects an uploaded document.
ALTER TABLE hrm_documents ADD COLUMN IF NOT EXISTS review_comment text;

-- Starting values for the dynamic masters (editable under HRM > Policies & organization).
INSERT INTO master_items (id, type, name, is_active, sort_order, payload) VALUES
  ('hrm-doc-identity', 'hrm_document_type', 'Identity Proof', true, 1, '{"defaultOnCreate": true, "hasExpiry": true}'),
  ('hrm-doc-address', 'hrm_document_type', 'Address Proof', true, 2, '{"defaultOnCreate": true}'),
  ('hrm-doc-education', 'hrm_document_type', 'Educational Certificates', true, 3, '{"defaultOnCreate": true}'),
  ('hrm-doc-pan', 'hrm_document_type', 'PAN Card', true, 4, '{}'),
  ('hrm-doc-experience', 'hrm_document_type', 'Previous Experience Letter', true, 5, '{}'),
  ('hrm-doc-photo', 'hrm_document_type', 'Profile Photo', true, 99, '{"system": true}'),
  ('hrm-policy-standard', 'hrm_attendance_policy', 'Standard office', true, 1,
    '{"hoursPerDay": 8.5, "daysPerWeek": 5, "geofenceRequired": true, "description": "Clock in at an approved work location; hourly work reports."}'),
  ('hrm-letter-joining', 'hrm_letter_template', 'Joining Letter', true, 1,
    '{"certificate": true, "description": "Official joining letter document", "content": "{{company_name}}\n\nJOINING LETTER\n\nDear {{employee_name}},\n\nWe are pleased to confirm your appointment as {{designation}} in the {{department}} department, with effect from {{joining_date}}. Your employee ID is {{employee_id}}.\n\nWe welcome you to {{company_name}} and wish you a rewarding career with us.\n\nFor {{company_name}}\n\nAuthorised Signatory"}'),
  ('hrm-letter-experience', 'hrm_letter_template', 'Experience Certificate', true, 2,
    '{"certificate": true, "description": "Work experience certificate", "content": "{{company_name}}\n\nEXPERIENCE CERTIFICATE\n\nThis is to certify that {{employee_name}} (Employee ID {{employee_id}}) worked with {{company_name}} as {{designation}} in the {{department}} department from {{joining_date}} to {{last_working_date}}.\n\nDuring this period we found their work and conduct satisfactory. We wish them success in the future.\n\nFor {{company_name}}\n\nAuthorised Signatory"}'),
  ('hrm-letter-noc', 'hrm_letter_template', 'NOC', true, 3,
    '{"certificate": true, "description": "No Objection Certificate", "content": "{{company_name}}\n\nNO OBJECTION CERTIFICATE\n\nThis is to certify that {{employee_name}} (Employee ID {{employee_id}}), {{designation}}, {{department}} department, has been associated with {{company_name}} since {{joining_date}}.\n\nThe company has no objection to the purpose for which this certificate is requested.\n\nFor {{company_name}}\n\nAuthorised Signatory"}')
-- Any unique clash (same id, or a master with the same name already there) keeps the existing row.
ON CONFLICT DO NOTHING;

-- Role given to logins created from the employee wizard: own records and self service only.
INSERT INTO roles (id, code, name, description, is_system, is_active, payload)
SELECT 'role-employee', 'employee', 'Employee', 'Employee self-service (web My day and Employee app)', false, true, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'employee' OR name = 'Employee');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('hrm.view_own', 'hrm.self_service')
WHERE r.code = 'employee'
ON CONFLICT DO NOTHING;

-- Indexes for list/sort paths that previously scanned and sorted whole tables.
CREATE INDEX IF NOT EXISTS hrm_audit_created ON hrm_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS hrm_request_created ON hrm_requests(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS hrm_record_created ON hrm_records(kind, created_at DESC) WHERE archived_at IS NULL;
-- The ping handler closes open offline/geofence alerts per attendance row.
CREATE INDEX IF NOT EXISTS hrm_alert_open ON hrm_alerts(attendance_id, kind) WHERE closed_at IS NULL;
