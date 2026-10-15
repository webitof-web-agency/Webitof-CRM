CREATE TABLE IF NOT EXISTS call_logs (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  staff_name text,
  staff_phone text,
  staff_email text,
  customer_phone text NOT NULL,
  customer_name text,
  lead_id text REFERENCES leads(id) ON DELETE SET NULL,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  call_type text NOT NULL DEFAULT 'outgoing',
  call_status text NOT NULL DEFAULT 'completed',
  duration_seconds integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  outcome text,
  notes text,
  recording_url text,
  recording_file_name text,
  recording_file_size integer DEFAULT 0,
  recording_duration integer DEFAULT 0,
  recording_mime_type text,
  source text NOT NULL DEFAULT 'mobile_app',
  device_id text,
  device_model text,
  sync_status text NOT NULL DEFAULT 'synced',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_user_id ON call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_customer_phone ON call_logs(customer_phone);
CREATE INDEX IF NOT EXISTS idx_call_logs_started_at ON call_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_type ON call_logs(call_type);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_client_id ON call_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_source ON call_logs(source);
