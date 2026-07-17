CREATE TABLE IF NOT EXISTS storage_folders (
  id text PRIMARY KEY,
  folder_key text NOT NULL UNIQUE,
  folder_name text NOT NULL,
  drive_folder_id text NOT NULL,
  parent_key text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS file_assets (
  id text PRIMARY KEY,
  file_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  stored_name text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL DEFAULT 0,
  drive_file_id text NOT NULL UNIQUE,
  drive_folder_id text,
  drive_web_view_link text,
  drive_web_content_link text,
  module_name text,
  entity_id text,
  folder_key text,
  is_public boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  archived_reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storage_folders_parent_key ON storage_folders(parent_key);
CREATE INDEX IF NOT EXISTS idx_file_assets_module_entity ON file_assets(module_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_assets_folder_key ON file_assets(folder_key);
