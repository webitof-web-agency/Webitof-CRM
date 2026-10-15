const { query } = require('../config/db');
const { createId } = require('../utils/format');

const callData = [
  {
    customerName: 'NovaCart Retail',
    customerPhone: '+91 98710 00000',
    type: 'outgoing',
    status: 'completed',
    duration: 184,
    hoursAgo: 1,
    outcome: 'Interested',
    notes: 'Discussed CRM features, requested demo on Monday.',
    hasRecording: true
  },
  {
    customerName: 'HealWell Clinics',
    customerPhone: '+91 98710 04193',
    type: 'incoming',
    status: 'completed',
    duration: 312,
    hoursAgo: 2.5,
    outcome: 'Proposal Sent',
    notes: 'Client called asking about pricing tiers and user packages.',
    hasRecording: true
  },
  {
    customerName: 'Shree Ganesh Furniture',
    customerPhone: '+91 98710 08386',
    type: 'missed',
    status: 'missed',
    duration: 0,
    hoursAgo: 3.8,
    outcome: 'Call Later',
    notes: 'Missed call received on mobile app. Scheduled callback for evening.',
    hasRecording: false
  },
  {
    customerName: 'UrbanLeaf Organics',
    customerPhone: '+91 98710 12579',
    type: 'outgoing',
    status: 'completed',
    duration: 95,
    hoursAgo: 5,
    outcome: 'Connected',
    notes: 'Quick check-in on pending invoice approval.',
    hasRecording: true
  },
  {
    customerName: 'Apex Legal Partners',
    customerPhone: '+91 98710 16772',
    type: 'incoming',
    status: 'completed',
    duration: 240,
    hoursAgo: 6.5,
    outcome: 'Followup Required',
    notes: 'Requested WhatsApp brochure with service catalog and portfolio.',
    hasRecording: true
  },
  {
    customerName: 'CraftAura Exports',
    customerPhone: '+91 98710 20965',
    type: 'outgoing',
    status: 'busy',
    duration: 0,
    hoursAgo: 8,
    outcome: 'Busy',
    notes: 'Line busy. Scheduled re-dial in afternoon.',
    hasRecording: false
  },
  {
    customerName: 'EduSpark Tutorials',
    customerPhone: '+91 98710 25158',
    type: 'outgoing',
    status: 'completed',
    duration: 420,
    hoursAgo: 11,
    outcome: 'Converted',
    notes: 'Final agreement concluded over call. Client signed up for annual plan.',
    hasRecording: true
  },
  {
    customerName: 'BlueRiver Logistics',
    customerPhone: '+91 98710 29351',
    type: 'incoming',
    status: 'completed',
    duration: 156,
    hoursAgo: 14,
    outcome: 'Connected',
    notes: 'Inquiry regarding software development timeline and milestone schedule.',
    hasRecording: true
  },
  {
    customerName: 'FitCore Wellness',
    customerPhone: '+91 98710 33544',
    type: 'rejected',
    status: 'cancelled',
    duration: 0,
    hoursAgo: 16,
    outcome: 'Wrong Number',
    notes: 'Call disconnected by user. Stated wrong extension.',
    hasRecording: false
  },
  {
    customerName: 'Zenith Tech Solutions',
    customerPhone: '+91 98710 37737',
    type: 'outgoing',
    status: 'completed',
    duration: 265,
    hoursAgo: 18.5,
    outcome: 'Demo Scheduled',
    notes: 'CTO agreed for product demo on Tuesday at 3 PM via Google Meet.',
    hasRecording: true
  },
  {
    customerName: 'Golden Crust Bakery',
    customerPhone: '+91 98710 41930',
    type: 'incoming',
    status: 'completed',
    duration: 180,
    hoursAgo: 22,
    outcome: 'Quotation Sent',
    notes: 'Requested quotation for billing POS and CRM integration.',
    hasRecording: true
  },
  {
    customerName: 'Horizon Real Estate',
    customerPhone: '+91 98710 46123',
    type: 'outgoing',
    status: 'completed',
    duration: 340,
    hoursAgo: 25,
    outcome: 'Meeting Fixed',
    notes: 'Direct visit scheduled with sales director for corporate licenses.',
    hasRecording: true
  },
  {
    customerName: 'Pinnacle Infotech',
    customerPhone: '+91 98710 50316',
    type: 'missed',
    status: 'missed',
    duration: 0,
    hoursAgo: 27,
    outcome: 'Call Later',
    notes: 'Customer called during lunch hours. Needs immediate callback.',
    hasRecording: false
  },
  {
    customerName: 'Kaveri Textiles',
    customerPhone: '+91 98710 54509',
    type: 'incoming',
    status: 'completed',
    duration: 215,
    hoursAgo: 30,
    outcome: 'Payment Pending',
    notes: 'Discussed invoice #INV-2026-089. Payment confirmed for tomorrow.',
    hasRecording: true
  },
  {
    customerName: 'AeroGlide Travels',
    customerPhone: '+91 98710 58702',
    type: 'outgoing',
    status: 'completed',
    duration: 110,
    hoursAgo: 34,
    outcome: 'Interested',
    notes: 'Showed strong interest in WhatsApp automation module.',
    hasRecording: true
  },
  {
    customerName: 'Sterling Pharma Labs',
    customerPhone: '+91 98710 62895',
    type: 'outgoing',
    status: 'completed',
    duration: 490,
    hoursAgo: 38,
    outcome: 'Proposal Sent',
    notes: 'Comprehensive CRM proposal sent via email to procurement head.',
    hasRecording: true
  },
  {
    customerName: 'Metro Movers Packers',
    customerPhone: '+91 98710 67088',
    type: 'missed',
    status: 'missed',
    duration: 0,
    hoursAgo: 42,
    outcome: 'Call Later',
    notes: 'Missed inquiry from lead generation campaign.',
    hasRecording: false
  },
  {
    customerName: 'Radha Krishna Jewellers',
    customerPhone: '+91 98710 71281',
    type: 'incoming',
    status: 'completed',
    duration: 195,
    hoursAgo: 46,
    outcome: 'Connected',
    notes: 'Discussed loyalty program and SMS gateway features.',
    hasRecording: true
  },
  {
    customerName: 'Verve Media Works',
    customerPhone: '+91 98710 75474',
    type: 'outgoing',
    status: 'busy',
    duration: 0,
    hoursAgo: 50,
    outcome: 'Busy',
    notes: 'Line was busy. Automated SMS sent to customer.',
    hasRecording: false
  },
  {
    customerName: 'BrightFuture Academy',
    customerPhone: '+91 98710 79667',
    type: 'outgoing',
    status: 'completed',
    duration: 380,
    hoursAgo: 54,
    outcome: 'Demo Scheduled',
    notes: 'Online walkthrough scheduled with school principal on Friday.',
    hasRecording: true
  },
  {
    customerName: 'Oasis Water Solutions',
    customerPhone: '+91 98710 83860',
    type: 'incoming',
    status: 'completed',
    duration: 145,
    hoursAgo: 58,
    outcome: 'Followup Required',
    notes: 'Wants integration with existing ERP database.',
    hasRecording: true
  },
  {
    customerName: 'Saffron Spice Restaurant',
    customerPhone: '+91 98710 88053',
    type: 'rejected',
    status: 'cancelled',
    duration: 0,
    hoursAgo: 62,
    outcome: 'Wrong Number',
    notes: 'Owner busy during kitchen prep hours. Disconnected.',
    hasRecording: false
  },
  {
    customerName: 'Quantum Solar Systems',
    customerPhone: '+91 98710 92246',
    type: 'outgoing',
    status: 'completed',
    duration: 520,
    hoursAgo: 66,
    outcome: 'Converted',
    notes: 'Contract finalized for 15 CRM user licenses and mobile dialers.',
    hasRecording: true
  },
  {
    customerName: 'SilverLine Automotives',
    customerPhone: '+91 98710 96439',
    type: 'incoming',
    status: 'completed',
    duration: 230,
    hoursAgo: 70,
    outcome: 'Connected',
    notes: 'Inquiry regarding telecalling dialer integration for service center.',
    hasRecording: true
  },
  {
    customerName: 'Heritage Handlooms',
    customerPhone: '+91 98711 00632',
    type: 'outgoing',
    status: 'completed',
    duration: 75,
    hoursAgo: 74,
    outcome: 'Followup Required',
    notes: 'Owner is traveling, requested callback next Monday.',
    hasRecording: false
  },
  {
    customerName: 'Nexus Cloud Services',
    customerPhone: '+91 98711 04825',
    type: 'missed',
    status: 'missed',
    duration: 0,
    hoursAgo: 78,
    outcome: 'Call Later',
    notes: 'Callback requested via mobile dialer app notification.',
    hasRecording: false
  },
  {
    customerName: 'Prime Care Diagnostics',
    customerPhone: '+91 98711 09018',
    type: 'incoming',
    status: 'completed',
    duration: 290,
    hoursAgo: 82,
    outcome: 'Quotation Sent',
    notes: 'Quotation prepared for multi-branch clinic appointment system.',
    hasRecording: true
  },
  {
    customerName: 'Emerald Events & Decor',
    customerPhone: '+91 98711 13211',
    type: 'outgoing',
    status: 'completed',
    duration: 160,
    hoursAgo: 86,
    outcome: 'Interested',
    notes: 'Client loved lead tracking and follow-up reminders demo.',
    hasRecording: true
  },
  {
    customerName: 'Falcon Security Systems',
    customerPhone: '+91 98711 17404',
    type: 'outgoing',
    status: 'completed',
    duration: 410,
    hoursAgo: 90,
    outcome: 'Proposal Sent',
    notes: 'Sent tailored enterprise proposal with custom API endpoints.',
    hasRecording: true
  },
  {
    customerName: 'Blissful Living Interiors',
    customerPhone: '+91 98711 21597',
    type: 'incoming',
    status: 'completed',
    duration: 205,
    hoursAgo: 96,
    outcome: 'Connected',
    notes: 'Confirmed requirement for automated lead assignment to team.',
    hasRecording: true
  }
];

async function seed30Calls() {
  try {
    console.log('Seeding 30 call records...');

    // Fetch existing users & leads
    const usersRes = await query(`SELECT id, full_name, phone, email FROM users ORDER BY created_at ASC`);
    const leadsRes = await query(`SELECT id, name, phone FROM leads ORDER BY created_at ASC`);

    const staffList = usersRes.rows.length ? usersRes.rows : [
      { id: null, full_name: 'System Admin', phone: '+91 98765 43210', email: 'admin@webitof.com' },
      { id: null, full_name: 'Hitesh Admin', phone: '+91 98111 22334', email: 'digitalweb.hitesh@gmail.com' }
    ];

    // Clear previous seed logs so we have a fresh, consistent set of 30 records
    await query(`DELETE FROM call_logs`);

    for (let i = 0; i < callData.length; i++) {
      const item = callData[i];
      const staff = staffList[i % staffList.length];
      const lead = leadsRes.rows.length ? leadsRes.rows[i % leadsRes.rows.length] : null;

      const callId = `call_${createId()}`;
      const startedAt = new Date(Date.now() - item.hoursAgo * 3600 * 1000);
      const endedAt = new Date(startedAt.getTime() + item.duration * 1000);

      const recordingUrl = item.hasRecording ? '/api/call-logs/recordings/demo-sample-call.wav' : null;
      const recordingFileName = item.hasRecording ? 'demo-sample-call.wav' : null;

      await query(
        `INSERT INTO call_logs (
          id, user_id, staff_name, staff_phone, staff_email,
          customer_phone, customer_name, lead_id,
          call_type, call_status, duration_seconds,
          started_at, ended_at, outcome, notes,
          recording_url, recording_file_name, recording_file_size, recording_duration,
          source, sync_status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17, $18, $19,
          $20, $21, $22, $23
        )`,
        [
          callId,
          staff.id || null,
          staff.full_name || 'Staff Member',
          staff.phone || '',
          staff.email || '',
          item.customerPhone,
          item.customerName,
          lead ? lead.id : null,
          item.type,
          item.status,
          item.duration,
          startedAt,
          endedAt,
          item.outcome,
          item.notes,
          recordingUrl,
          recordingFileName,
          item.hasRecording ? 96044 : 0,
          item.hasRecording ? (item.duration || 6) : 0,
          'mobile_app',
          'synced',
          startedAt,
          startedAt
        ]
      );
    }

    const countRes = await query(`SELECT COUNT(*)::int as count FROM call_logs`);
    console.log(`Successfully seeded ${countRes.rows[0].count} call records!`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed 30 calls:', err);
    process.exit(1);
  }
}

seed30Calls();
