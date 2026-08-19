const originalConsoleLog = console.log;
console.log = () => {};
const { closePool, withTransaction } = require('../config/db');
console.log = originalConsoleLog;

const { createId } = require('../utils/format');

const SEED_NAME = 'dummy-leads-30-v1';

const PIPELINES = [
  ['pipe-default', 'Default Pipeline', 'default', 'Default lead pipeline', '#2563eb', 0],
  ['pipe-it-service', 'IT Service', 'it-service', 'Service and project sales leads', '#0f766e', 10],
  ['pipe-course-leads', 'Course Leads', 'course-leads', 'Course inquiry and admission leads', '#7c3aed', 20],
  ['pipe-course-students', 'Course Students', 'course-students', 'Converted course student records', '#ea580c', 30]
];

const LEADS = [
  ['lead-001', 'Aarohan Foods Pvt Ltd', 'Suresh Agrawal', 'Mumbai', 'Maharashtra', 'Website', 'New', 'Food Processing', 85000, 'Website redesign with online catalogue', 'pipe-it-service'],
  ['lead-002', 'BluePeak Diagnostics', 'Dr. Nisha Shah', 'Ahmedabad', 'Gujarat', 'Referral', 'Qualified', 'Healthcare', 145000, 'Appointment booking and reporting portal', 'pipe-it-service'],
  ['lead-003', 'Chandra Motors', 'Kunal Chandra', 'Raipur', 'Chhattisgarh', 'Cold Call', 'New', 'Automobile', 62000, 'Lead tracking for sales enquiries', 'pipe-default'],
  ['lead-004', 'DigiLearn Academy', 'Ananya Kulkarni', 'Pune', 'Maharashtra', 'Facebook Ads', 'Qualified', 'Education', 48000, 'Website and admission enquiry CRM', 'pipe-course-leads'],
  ['lead-005', 'Evergreen Builders', 'Rohit Jain', 'Indore', 'Madhya Pradesh', 'Trade Show', 'Won', 'Real Estate', 210000, 'Project microsites and lead capture automation', 'pipe-it-service'],
  ['lead-006', 'FinEdge Advisors', 'Meera Iyer', 'Bengaluru', 'Karnataka', 'LinkedIn', 'Qualified', 'Finance', 125000, 'Client onboarding workflow and secure document upload', 'pipe-it-service'],
  ['lead-007', 'GreenKart Organics', 'Prateek Verma', 'Jaipur', 'Rajasthan', 'Website', 'New', 'E-commerce', 76000, 'Shopify integration and CRM sync', 'pipe-it-service'],
  ['lead-008', 'Horizon Travels', 'Neel Banerjee', 'Kolkata', 'West Bengal', 'Referral', 'Lost', 'Travel', 39000, 'Package enquiry management', 'pipe-default'],
  ['lead-009', 'Innova Textile Hub', 'Farhan Khan', 'Surat', 'Gujarat', 'Cold Call', 'Qualified', 'Manufacturing', 168000, 'B2B catalogue and dealer enquiry CRM', 'pipe-it-service'],
  ['lead-010', 'Jeevan Dental Care', 'Dr. Kavita Rao', 'Hyderabad', 'Telangana', 'Google Ads', 'New', 'Healthcare', 54000, 'Clinic website and appointment reminders', 'pipe-it-service'],
  ['lead-011', 'Kritika Fashion Studio', 'Kritika Sethi', 'Delhi', 'Delhi', 'Instagram', 'New', 'Retail', 32000, 'Portfolio website and WhatsApp enquiry routing', 'pipe-default'],
  ['lead-012', 'Lotus Legal Associates', 'Adv. Manish Bose', 'Lucknow', 'Uttar Pradesh', 'Referral', 'Qualified', 'Legal', 93000, 'Case enquiry CRM and document intake', 'pipe-it-service'],
  ['lead-013', 'MetroPack Industries', 'Harish Patel', 'Vadodara', 'Gujarat', 'Trade Show', 'Won', 'Packaging', 235000, 'ERP-lite dashboard and client portal', 'pipe-it-service'],
  ['lead-014', 'Nirman Steel Works', 'Ajay Singh', 'Nagpur', 'Maharashtra', 'Cold Call', 'New', 'Manufacturing', 112000, 'Dealer order tracking and CRM setup', 'pipe-it-service'],
  ['lead-015', 'Omkar Coaching Classes', 'Pallavi Deshmukh', 'Nashik', 'Maharashtra', 'Google Ads', 'Qualified', 'Education', 45000, 'Course landing pages and student enquiry tracking', 'pipe-course-leads'],
  ['lead-016', 'PrimeCare Pharmacy', 'Ishaan Reddy', 'Vijayawada', 'Andhra Pradesh', 'Website', 'New', 'Healthcare', 67000, 'Online pharmacy enquiry and loyalty module', 'pipe-it-service'],
  ['lead-017', 'QuickServe Cloud Kitchen', 'Ritika Malhotra', 'Gurugram', 'Haryana', 'Instagram', 'Qualified', 'Food', 88000, 'Ordering landing page and CRM integration', 'pipe-it-service'],
  ['lead-018', 'Rudra Mining Supplies', 'Mahesh Sahu', 'Bilaspur', 'Chhattisgarh', 'Referral', 'New', 'Industrial', 156000, 'Vendor portal and quotation workflow', 'pipe-it-service'],
  ['lead-019', 'SkillBridge Institute', 'Tanya Kapoor', 'Noida', 'Uttar Pradesh', 'Facebook Ads', 'Won', 'Education', 72000, 'Course CRM and batch management', 'pipe-course-students'],
  ['lead-020', 'Triveni Hotels', 'Ramesh Pillai', 'Kochi', 'Kerala', 'Website', 'Qualified', 'Hospitality', 134000, 'Booking enquiry CRM and website maintenance', 'pipe-it-service'],
  ['lead-021', 'UrbanNest Interiors', 'Simran Arora', 'Chandigarh', 'Chandigarh', 'LinkedIn', 'New', 'Interior Design', 58000, 'Portfolio website and project enquiry pipeline', 'pipe-default'],
  ['lead-022', 'Veda Wellness Spa', 'Mansi Jain', 'Bhopal', 'Madhya Pradesh', 'Google Ads', 'Qualified', 'Wellness', 81000, 'Membership CRM and appointment automation', 'pipe-it-service'],
  ['lead-023', 'Westline Logistics', 'Devendra Rathore', 'Jodhpur', 'Rajasthan', 'Trade Show', 'New', 'Logistics', 190000, 'Shipment dashboard and lead follow-up workflow', 'pipe-it-service'],
  ['lead-024', 'Xpress Auto Care', 'Rahul Nambiar', 'Coimbatore', 'Tamil Nadu', 'Cold Call', 'Lost', 'Automobile', 47000, 'Service reminder and customer CRM', 'pipe-default'],
  ['lead-025', 'Yashoda Public School', 'Seema Mishra', 'Patna', 'Bihar', 'Referral', 'Qualified', 'Education', 98000, 'School website and admission management', 'pipe-course-leads'],
  ['lead-026', 'Zenith Solar Solutions', 'Arvind Menon', 'Chennai', 'Tamil Nadu', 'Website', 'Won', 'Renewable Energy', 260000, 'Dealer CRM and installation project tracker', 'pipe-it-service'],
  ['lead-027', 'AlphaTax Consultants', 'Sonal Garg', 'Ghaziabad', 'Uttar Pradesh', 'LinkedIn', 'New', 'Consulting', 64000, 'Client portal and document collection workflow', 'pipe-it-service'],
  ['lead-028', 'BrightMind Kids School', 'Naveen Thomas', 'Thiruvananthapuram', 'Kerala', 'Facebook Ads', 'Qualified', 'Education', 52000, 'Admission campaign and parent enquiry CRM', 'pipe-course-leads'],
  ['lead-029', 'CraftRoot Handicrafts', 'Madhuri Sen', 'Varanasi', 'Uttar Pradesh', 'Instagram', 'New', 'Handicrafts', 36000, 'Catalogue website and export enquiry form', 'pipe-default'],
  ['lead-030', 'DeltaMed Equipments', 'Parag Bhatt', 'Rajkot', 'Gujarat', 'Trade Show', 'Qualified', 'Medical Equipment', 175000, 'B2B product catalogue and distributor CRM', 'pipe-it-service']
].map(([key, companyName, ownerName, city, state, source, status, segment, value, requirement, pipelineId], index) => {
  const domain = companyName
    .toLowerCase()
    .replace(/pvt ltd|associates|industries|solutions|academy|classes|school|institute|studio|hub|works|care|kitchen|spa|hotels|consultants|equipments/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 22);
  const followUpDay = String((index % 24) + 1).padStart(2, '0');
  const followUpMonth = index < 15 ? '08' : '09';

  return {
    key,
    name: companyName,
    companyName,
    ownerName,
    email: `hello@${domain || key}.in`,
    phone: `+91 98${String(61000000 + index * 7319).padStart(8, '0')}`,
    website: `https://${domain || key}.in`,
    type: 'Organization',
    city,
    state,
    pincode: String(400000 + index * 173).slice(0, 6),
    country: 'India',
    source,
    status,
    labels: [segment, status === 'Won' ? 'Converted' : status === 'Lost' ? 'Cold' : value >= 120000 ? 'Hot' : 'Warm'],
    value,
    followUpDate: `2026-${followUpMonth}-${followUpDay}`,
    pipelineId,
    currency: 'INR',
    currencySymbol: 'Rs.',
    notes: requirement,
    segment,
    requirement
  };
});

function splitPersonName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  return {
    firstName: parts.shift() || '',
    lastName: parts.join(' ')
  };
}

function userIdByPreference(users, preferences) {
  for (const preference of preferences) {
    const found = users.find((user) => {
      const username = String(user.username || '').toLowerCase();
      const email = String(user.email || '').toLowerCase();
      const fullName = String(user.full_name || '').toLowerCase();
      return username.includes(preference) || email.includes(preference) || fullName.includes(preference);
    });
    if (found) return found.id;
  }
  return users[0]?.id || null;
}

async function ensurePipelines(db) {
  for (const pipeline of PIPELINES) {
    await db.query(
      `insert into lead_pipelines (id, name, code, description, color, sort_order, is_active, payload)
       values ($1, $2, $3, $4, $5, $6, true, '{}'::jsonb)
       on conflict (id) do update
       set name = excluded.name,
           code = excluded.code,
           description = excluded.description,
           color = excluded.color,
           sort_order = excluded.sort_order,
           is_active = true,
           updated_at = now()`,
      pipeline
    );
  }
}

async function getUsers(db) {
  const result = await db.query(
    `select id, username, email, full_name
     from users
     where is_active = true
     order by created_at asc
     limit 20`
  );
  return result.rows;
}

async function upsertLead(db, lead, assignment) {
  const existing = await db.query(
    `select id
     from leads
     where payload->>'demoSeed' = $1 and payload->>'demoKey' = $2
     limit 1`,
    [SEED_NAME, lead.key]
  );

  const fallbackExisting = existing.rows.length ? existing : await db.query(
    `select id
     from leads
     where lower(coalesce(email, '')) = lower($1)
        or lower(coalesce(company_name, '')) = lower($2)
     limit 1`,
    [lead.email, lead.companyName]
  );

  const payload = {
    demoSeed: SEED_NAME,
    demoKey: lead.key,
    segment: lead.segment,
    requirement: lead.requirement
  };

  const values = [
    lead.name,
    lead.companyName,
    lead.type,
    lead.email,
    lead.phone,
    lead.website,
    lead.status,
    lead.pipelineId,
    lead.source,
    lead.value,
    lead.followUpDate,
    assignment.assignedTo,
    assignment.createdBy,
    `${lead.city} business district`,
    lead.city,
    lead.state,
    lead.pincode,
    lead.country,
    lead.currency,
    lead.currencySymbol,
    JSON.stringify(lead.labels),
    lead.ownerName,
    lead.notes,
    JSON.stringify(payload)
  ];

  if (fallbackExisting.rows.length) {
    const id = fallbackExisting.rows[0].id;
    const result = await db.query(
      `update leads
       set name = $1,
           company_name = $2,
           type = $3,
           email = $4,
           phone = $5,
           website = $6,
           status = $7,
           pipeline_id = $8,
           source = $9,
           value = $10,
           follow_up_date = $11,
           assigned_to = $12,
           created_by = $13,
           address = $14,
           city = $15,
           state = $16,
           pincode = $17,
           country = $18,
           currency = $19,
           currency_symbol = $20,
           labels = $21::jsonb,
           owner_name = $22,
           notes = $23,
           payload = coalesce(payload, '{}'::jsonb) || $24::jsonb,
           updated_at = now()
       where id = $25
       returning id`,
      [...values, id]
    );
    return result.rows[0].id;
  }

  const id = createId('lead');
  const result = await db.query(
    `insert into leads
      (id, name, company_name, type, email, phone, website, status, pipeline_id, source, value, follow_up_date,
       assigned_to, created_by, address, city, state, pincode, country, currency, currency_symbol, labels, owner_name, notes, payload)
     values
      ($25, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb, $22, $23, $24::jsonb)
     returning id`,
    [...values, id]
  );
  return result.rows[0].id;
}

async function replaceRelatedData(db, leadId, lead, ownerUserId) {
  await db.query(`delete from lead_contacts where lead_id = $1 and payload->>'demoSeed' = $2`, [leadId, SEED_NAME]);
  await db.query(`delete from lead_events where lead_id = $1 and payload->>'demoSeed' = $2`, [leadId, SEED_NAME]);

  const primary = splitPersonName(lead.ownerName);
  const secondaryFirstNames = ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Meenal'];
  const secondaryLastNames = ['Sharma', 'Joshi', 'Gupta', 'Nair', 'Rao', 'Mehta'];
  const secondaryIndex = Number(lead.key.replace('lead-', '')) - 1;
  const contactPayload = JSON.stringify({ demoSeed: SEED_NAME, demoKey: lead.key });

  await db.query(
    `insert into lead_contacts
      (id, lead_id, first_name, last_name, email, phone, job_title, gender, notes, payload)
     values ($1, $2, $3, $4, $5, $6, $7, 'Other', $8, $9::jsonb)`,
    [
      createId('lead-contact'),
      leadId,
      primary.firstName,
      primary.lastName,
      lead.email.replace('hello@', 'contact@'),
      lead.phone,
      'Decision Maker',
      `Primary contact for ${lead.requirement}.`,
      contactPayload
    ]
  );

  if (secondaryIndex % 3 === 0) {
    const firstName = secondaryFirstNames[secondaryIndex % secondaryFirstNames.length];
    const lastName = secondaryLastNames[secondaryIndex % secondaryLastNames.length];
    await db.query(
      `insert into lead_contacts
        (id, lead_id, first_name, last_name, email, phone, job_title, gender, notes, payload)
       values ($1, $2, $3, $4, $5, $6, $7, 'Other', $8, $9::jsonb)`,
      [
        createId('lead-contact'),
        leadId,
        firstName,
        lastName,
        lead.email.replace('hello@', `${firstName.toLowerCase()}.${lastName.toLowerCase()}@`),
        lead.phone.replace(/(\d{2})$/, (_, value) => String(Number(value) + 1).padStart(2, '0')),
        'Operations Contact',
        'Secondary contact for requirement clarification.',
        contactPayload
      ]
    );
  }

  const eventPayload = JSON.stringify({ demoSeed: SEED_NAME, demoKey: lead.key });
  const leadNumber = Number(lead.key.replace('lead-', ''));
  const createdDate = `2026-07-${String(((leadNumber - 1) % 20) + 1).padStart(2, '0')}`;

  await db.query(
    `insert into lead_events
      (id, lead_id, scope_type, scope_id, owner_user_id, visibility, event_type, title, description, start_date, end_date, labels, color, payload)
     values ($1, $2, 'lead', $2, $3, 'all_team', 'system', $4, $5, $6, $6, $7::jsonb, $8, $9::jsonb)`,
    [
      createId('lead-event'),
      leadId,
      ownerUserId,
      'Lead created',
      `Demo lead added from ${lead.source}.`,
      createdDate,
      JSON.stringify(['Demo', lead.source]),
      '#64748b',
      eventPayload
    ]
  );

  await db.query(
    `insert into lead_events
      (id, lead_id, scope_type, scope_id, owner_user_id, visibility, event_type, title, description,
       start_date, start_time, end_date, end_time, labels, color, payload)
     values ($1, $2, 'lead', $2, $3, 'all_team', 'event', $4, $5, $6, $7, $6, $8, $9::jsonb, $10, $11::jsonb)`,
    [
      createId('lead-event'),
      leadId,
      ownerUserId,
      'Follow-up discussion',
      lead.requirement,
      lead.followUpDate,
      '11:00',
      '11:30',
      JSON.stringify(['Follow-up', lead.status]),
      lead.status === 'Won' ? '#10b981' : lead.status === 'Lost' ? '#ef4444' : '#2563eb',
      eventPayload
    ]
  );
}

async function main() {
  const result = await withTransaction(async (db) => {
    await ensurePipelines(db);

    const users = await getUsers(db);
    const adminId = userIdByPreference(users, ['admin', 'system']);
    const salesId = userIdByPreference(users, ['sales']);
    const managerId = userIdByPreference(users, ['manager']);
    const supportId = userIdByPreference(users, ['support']);
    const assignmentCycle = [salesId, managerId, supportId, adminId].filter(Boolean);
    const creatorCycle = [adminId, salesId, managerId, supportId].filter(Boolean);

    let insertedOrUpdated = 0;
    let contacts = 0;
    let events = 0;

    for (let index = 0; index < LEADS.length; index += 1) {
      const lead = LEADS[index];
      const assignment = {
        assignedTo: assignmentCycle[index % assignmentCycle.length] || null,
        createdBy: creatorCycle[index % creatorCycle.length] || null
      };
      const leadId = await upsertLead(db, lead, assignment);
      await replaceRelatedData(db, leadId, lead, assignment.assignedTo);
      insertedOrUpdated += 1;
      contacts += (index % 3 === 0 ? 2 : 1);
      events += 2;
    }

    return { insertedOrUpdated, contacts, events };
  });

  console.log(`Seeded ${result.insertedOrUpdated} dummy leads, ${result.contacts} contacts, and ${result.events} lead events.`);
}

main()
  .catch((error) => {
    console.error('Failed to seed dummy leads:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
