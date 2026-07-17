const { query, closePool } = require('./config/db');
const { createId } = require('./utils/format');

async function run() {
  try {
    await query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS statuses jsonb NOT NULL DEFAULT '{}'::jsonb;`);
    await query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '{}'::jsonb;`);
    await query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS labels jsonb NOT NULL DEFAULT '{}'::jsonb;`);
    console.log('Added statuses and sources columns');
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS salary numeric(14,2) NOT NULL DEFAULT 0;`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender text;`);
    console.log('Added user salary and gender columns');
    await query(`
      CREATE TABLE IF NOT EXISTS leads (
        id text PRIMARY KEY,
        name text NOT NULL,
        company_name text,
        email text,
        phone text,
        status text NOT NULL DEFAULT 'New',
        source text,
        value numeric(14,2) NOT NULL DEFAULT 0,
        owner_name text,
        assigned_to text REFERENCES users(id) ON DELETE SET NULL,
        created_by text REFERENCES users(id) ON DELETE SET NULL,
        notes text,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    `);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_name text;`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_by text REFERENCES users(id) ON DELETE SET NULL;`);
    await query(`
      update leads l
      set owner_name = coalesce(l.owner_name, u.full_name)
      from users u
      where l.assigned_to = u.id
        and (l.owner_name is null or l.owner_name = '')
    `);
    console.log('Added leads table');
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS tax_treatment text NOT NULL DEFAULT 'Regular';`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS tds_applicable boolean NOT NULL DEFAULT false;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS tds_section text;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS pincode text;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type text;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_to text;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS managers text;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS source text;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS website text;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS city text;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS vat_number text;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS gst_number text;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS currency_symbol text;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_groups text;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS labels jsonb NOT NULL DEFAULT '[]'::jsonb;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS follow_up_date date;`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS disable_online_payment boolean NOT NULL DEFAULT false;`);
    console.log('Added client tax columns');
    await query(`
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
    `);
    await query(`
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
    `);
    await query(`
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
    `);
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
    await query(`UPDATE lead_events SET scope_type = COALESCE(scope_type, CASE WHEN client_id IS NOT NULL THEN 'client' WHEN project_id IS NOT NULL THEN 'project' WHEN lead_id IS NOT NULL THEN 'lead' ELSE 'global' END), scope_id = COALESCE(scope_id, lead_id, client_id, project_id), visibility = COALESCE(visibility, 'all_team'), event_type = COALESCE(event_type, 'event') WHERE scope_type IS NULL OR scope_id IS NULL OR visibility IS NULL OR event_type IS NULL;`);
    await query(`CREATE INDEX IF NOT EXISTS idx_lead_events_scope ON lead_events(scope_type, scope_id);`);
    console.log('Added lead contacts and events tables');
    console.log('Added client contacts table');
    const userRows = await query(`select id, username, full_name from users order by created_at asc`);
    const ownerUserIds = userRows.rows.map((row) => row.id);
    const backfillResult = await query(`
      select c.id, c.contact_person, c.email, c.mobile
      from clients c
      left join client_contacts cc
        on cc.client_id = c.id
       and cc.is_primary = true
      where cc.id is null
        and coalesce(c.contact_person, '') <> ''
    `);

    for (const row of backfillResult.rows) {
      await query(
        `
          insert into client_contacts (
            id, client_id, first_name, last_name, email, phone, job_title, gender, notes, is_primary, payload, created_at, updated_at
          ) values (
            $1, $2, $3, '', $4, $5, $6, 'Other', '', true, '{}'::jsonb, now(), now()
          )
        `,
        [
          createId('client-contact'),
          row.id,
          String(row.contact_person || '').trim(),
          String(row.email || '').trim() || null,
          String(row.mobile || '').trim() || null,
          'Primary contact'
        ]
      );
    }
    console.log(`Backfilled ${backfillResult.rows.length} client contacts`);

    const clientRows = await query(`select id, assigned_to, follow_up_date, labels from clients order by created_at asc`);
    const clientLabelSets = [
      ['Consulting'],
      ['E-commerce', 'Hot'],
      ['SMB', 'Follow-up'],
      ['Healthcare'],
      ['Logistics', 'Warm']
    ];
    const clientFollowUps = ['2026-07-15', '2026-07-18', '2026-07-20', '2026-07-24', '2026-07-28'];
    for (let index = 0; index < clientRows.rows.length; index += 1) {
      const row = clientRows.rows[index];
      const assignedTo = row.assigned_to || ownerUserIds[index % ownerUserIds.length] || null;
      await query(
        `update clients
         set assigned_to = coalesce(assigned_to, $2),
             follow_up_date = coalesce(follow_up_date, $3::date),
             labels = case
               when labels is null or labels = '[]'::jsonb then $4::jsonb
               else labels
             end
         where id = $1`,
        [
          row.id,
          assignedTo,
          clientFollowUps[index] || null,
          JSON.stringify(clientLabelSets[index] || [])
        ]
      );
    }
    console.log(`Backfilled ${clientRows.rows.length} clients with owner/labels/follow-up data`);
    await query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ui jsonb NOT NULL DEFAULT '{}'::jsonb;`);
    await query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS logos jsonb NOT NULL DEFAULT '{}'::jsonb;`);
    console.log('Added ui/logos columns');
  } catch(e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
run();
