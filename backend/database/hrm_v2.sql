-- HRM v2: geofenced attendance, job timer, lunch, slot work reports, alerts and devices.
-- Additive only: existing rows keep their meaning; new columns have safe defaults.
ALTER TABLE hrm_attendance
  ADD COLUMN IF NOT EXISTS work_mode text,
  ADD COLUMN IF NOT EXISTS geofence_id text,
  ADD COLUMN IF NOT EXISTS job_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS job_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS lunch_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS lunch_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS lunch_minutes integer NOT NULL DEFAULT 0 CHECK (lunch_minutes >= 0),
  ADD COLUMN IF NOT EXISTS last_ping_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_location jsonb,
  ADD COLUMN IF NOT EXISTS offline_minutes integer NOT NULL DEFAULT 0 CHECK (offline_minutes >= 0),
  ADD COLUMN IF NOT EXISTS outside_minutes integer NOT NULL DEFAULT 0 CHECK (outside_minutes >= 0),
  ADD COLUMN IF NOT EXISTS idle_minutes integer NOT NULL DEFAULT 0 CHECK (idle_minutes >= 0),
  ADD COLUMN IF NOT EXISTS auto_checkout_at timestamptz,
  ADD COLUMN IF NOT EXISTS summary jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS override jsonb;
CREATE INDEX IF NOT EXISTS hrm_attendance_open_job ON hrm_attendance(job_started_at) WHERE check_out IS NULL AND check_in IS NOT NULL;

CREATE TABLE IF NOT EXISTS hrm_geofences (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('office','home')),
  employee_id text REFERENCES hrm_employees(id),
  location_id text REFERENCES master_items(id),
  label text NOT NULL,
  address text,
  latitude numeric(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  radius_meters integer NOT NULL CHECK (radius_meters BETWEEN 20 AND 5000),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected','Retired')),
  request_accuracy integer,
  reviewed_by text REFERENCES users(id), reviewed_at timestamptz, comment text,
  created_by text REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'home') = (employee_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS hrm_one_live_home ON hrm_geofences(employee_id) WHERE kind = 'home' AND status IN ('Pending','Approved');
CREATE INDEX IF NOT EXISTS hrm_geofence_status ON hrm_geofences(kind, status);

CREATE TABLE IF NOT EXISTS hrm_attendance_events (
  id text PRIMARY KEY,
  attendance_id text NOT NULL REFERENCES hrm_attendance(id) ON DELETE CASCADE,
  employee_id text NOT NULL REFERENCES hrm_employees(id),
  kind text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  latitude numeric(9,6), longitude numeric(9,6), accuracy integer,
  inside boolean, distance_meters integer,
  details jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS hrm_attendance_event_day ON hrm_attendance_events(attendance_id, at);
CREATE INDEX IF NOT EXISTS hrm_attendance_event_kind ON hrm_attendance_events(attendance_id, kind);

CREATE TABLE IF NOT EXISTS hrm_alerts (
  id text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES hrm_employees(id),
  attendance_id text REFERENCES hrm_attendance(id) ON DELETE SET NULL,
  work_date date NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Explanation Requested','Explained','Resolved')),
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  explanation text,
  action text, action_by text REFERENCES users(id), action_at timestamptz, comment text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hrm_alert_queue ON hrm_alerts(status, work_date DESC);
CREATE INDEX IF NOT EXISTS hrm_alert_employee ON hrm_alerts(employee_id, work_date DESC);

CREATE TABLE IF NOT EXISTS hrm_devices (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'android',
  app_version text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hrm_device_user ON hrm_devices(user_id);

ALTER TABLE hrm_work_reports
  ADD COLUMN IF NOT EXISTS edit_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_edited_by text REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS admin_edited_at timestamptz;
ALTER TABLE hrm_work_entries
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS slot_start timestamptz,
  ADD COLUMN IF NOT EXISTS slot_end timestamptz,
  ADD COLUMN IF NOT EXISTS edit_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS hrm_work_entry_slot ON hrm_work_entries(report_id, slot_start) WHERE slot_start IS NOT NULL;
