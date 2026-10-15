const { query } = require('../config/db');

async function ensureCallLogsSchema() {
  await query(`
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
  `);

  const countRes = await query(`SELECT COUNT(*)::int as count FROM call_logs`);
  if (Number(countRes.rows[0]?.count || 0) === 0) {
    const usersRes = await query(`SELECT id, full_name, phone, email FROM users LIMIT 5`);
    const leadsRes = await query(`SELECT id, name, phone FROM leads LIMIT 10`);
    const staffList = usersRes.rows.length ? usersRes.rows : [
      { id: null, full_name: 'Rahul Sharma', phone: '+91 98765 43210', email: 'rahul@webitof.com' },
      { id: null, full_name: 'Pooja Verma', phone: '+91 98111 22334', email: 'pooja@webitof.com' },
      { id: null, full_name: 'Amit Patel', phone: '+91 99222 33445', email: 'amit@webitof.com' }
    ];

    const sampleCalls = [
      {
        customerPhone: '+91 98234 56789',
        customerName: 'Rajesh Mehra',
        type: 'outgoing',
        status: 'completed',
        duration: 184,
        hoursAgo: 1,
        outcome: 'Interested',
        notes: 'Discussed CRM features, requested demo on Monday.',
        hasRecording: true
      },
      {
        customerPhone: '+91 97123 45678',
        customerName: 'Sunita Jain',
        type: 'incoming',
        status: 'completed',
        duration: 312,
        hoursAgo: 2.5,
        outcome: 'Proposal Sent',
        notes: 'Client called asking about pricing tiers and user packages.',
        hasRecording: true
      },
      {
        customerPhone: '+91 91234 56780',
        customerName: 'Vikas Dubey',
        type: 'missed',
        status: 'missed',
        duration: 0,
        hoursAgo: 4,
        outcome: 'Call Later',
        notes: 'Missed call received on mobile app. Needs callback.',
        hasRecording: false
      },
      {
        customerPhone: '+91 98989 89898',
        customerName: 'Deepak Choudhary',
        type: 'outgoing',
        status: 'completed',
        duration: 95,
        hoursAgo: 5,
        outcome: 'Connected',
        notes: 'Quick check-in on pending invoice approval.',
        hasRecording: true
      },
      {
        customerPhone: '+91 94567 89012',
        customerName: 'Ananya Roy',
        type: 'incoming',
        status: 'completed',
        duration: 240,
        hoursAgo: 7,
        outcome: 'Followup Required',
        notes: 'Requested WhatsApp brochure with service catalog.',
        hasRecording: true
      },
      {
        customerPhone: '+91 98765 12345',
        customerName: 'Gaurav Singhal',
        type: 'outgoing',
        status: 'busy',
        duration: 0,
        hoursAgo: 8,
        outcome: 'Busy',
        notes: 'Line busy. Scheduled re-dial in afternoon.',
        hasRecording: false
      },
      {
        customerPhone: '+91 99887 76655',
        customerName: 'Praveen Nair',
        type: 'outgoing',
        status: 'completed',
        duration: 420,
        hoursAgo: 26,
        outcome: 'Converted',
        notes: 'Final agreement concluded over call. Client signed up.',
        hasRecording: true
      },
      {
        customerPhone: '+91 93333 44444',
        customerName: 'Kavita Mishra',
        type: 'incoming',
        status: 'completed',
        duration: 156,
        hoursAgo: 28,
        outcome: 'Connected',
        notes: 'Inquiry regarding software development timeline.',
        hasRecording: true
      },
      {
        customerPhone: '+91 97777 88888',
        customerName: 'Manish Tyagi',
        type: 'rejected',
        status: 'cancelled',
        duration: 0,
        hoursAgo: 32,
        outcome: 'Wrong Number',
        notes: 'Call disconnected by user.',
        hasRecording: false
      }
    ];

    for (let i = 0; i < sampleCalls.length; i++) {
      const call = sampleCalls[i];
      const staff = staffList[i % staffList.length];
      const lead = leadsRes.rows[i % (leadsRes.rows.length || 1)] || null;
      const startedAt = new Date(Date.now() - call.hoursAgo * 60 * 60 * 1000);
      const endedAt = new Date(startedAt.getTime() + call.duration * 1000);
      const callId = `call-seed-${i + 1}`;

      await query(
        `INSERT INTO call_logs (
          id, user_id, staff_name, staff_phone, staff_email,
          customer_phone, customer_name, lead_id,
          call_type, call_status, duration_seconds, started_at, ended_at,
          outcome, notes, recording_url, recording_file_name,
          recording_file_size, recording_duration, recording_mime_type,
          source, sync_status, payload, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20,
          $21, 'synced', '{}'::jsonb, $12, $12
        ) ON CONFLICT (id) DO NOTHING`,
        [
          callId,
          staff.id || null,
          staff.full_name || 'Staff Member',
          staff.phone || '',
          staff.email || '',
          lead?.phone || call.customerPhone,
          lead?.name || call.customerName,
          lead?.id || null,
          call.type,
          call.status,
          call.duration,
          startedAt,
          endedAt,
          call.outcome,
          call.notes,
          call.hasRecording ? '/api/call-logs/recordings/demo-sample-call.wav' : null,
          call.hasRecording ? 'demo-sample-call.wav' : null,
          call.hasRecording ? 96044 : 0,
          call.hasRecording ? call.duration : 0,
          'audio/wav',
          'mobile_app'
        ]
      );
    }
  }
}

module.exports = {
  ensureCallLogsSchema
};
