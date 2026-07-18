const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query, closePool } = require('../config/db');

async function migrate() {
  try {
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
    console.log('Notifications structure ensured successfully.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await closePool();
  }
}

migrate();
