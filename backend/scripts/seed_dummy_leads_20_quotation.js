const { closePool, withTransaction } = require('../config/db');
const leadModel = require('../models/lead.model');

const SEED_NAME = 'dummy-leads-20-quotation-v1';

const RAW_LEADS = [
  ['NovaCart Retail', 'Aditi Bansal', 'Jaipur', 'Rajasthan', 'Website', 'New', 125000, ['E-commerce Website Development', 'WhatsApp Business API Integration'], 'Multi-category online store with WhatsApp order updates'],
  ['HealWell Clinics', 'Dr. Rohan Mehta', 'Pune', 'Maharashtra', 'Referral', 'Qualified', 85000, ['Website Development', 'WhatsApp Business API Integration'], 'Clinic website with appointment enquiries and WhatsApp confirmation'],
  ['Shree Ganesh Furnishings', 'Mohit Agrawal', 'Raipur', 'Chhattisgarh', 'Google Ads', 'Quotation Pending', 110000, ['E-commerce Website Development'], 'Furniture catalogue, cart, checkout and local delivery workflow'],
  ['UrbanLeaf Organics', 'Naina Kapoor', 'Delhi', 'Delhi', 'Instagram', 'Contacted', 95000, ['E-commerce Website Development', 'Domain + Hosting Setup'], 'D2C organic products store with coupon and subscription support'],
  ['Apex Legal Partners', 'Adv. Neeraj Sinha', 'Lucknow', 'Uttar Pradesh', 'LinkedIn', 'Meeting Scheduled', 65000, ['Website Development', 'Domain + Hosting Setup'], 'Professional services website with consultation lead capture'],
  ['CraftAura Exports', 'Ritika Jain', 'Jodhpur', 'Rajasthan', 'Trade Show', 'Qualified', 140000, ['E-commerce Website Development', 'WhatsApp Business API Integration'], 'Export catalogue and wholesale enquiry portal'],
  ['EduSpark Tutorials', 'Karan Malhotra', 'Noida', 'Uttar Pradesh', 'Facebook Ads', 'Follow-up', 72000, ['Website Development', 'WhatsApp Business API Integration'], 'Course website with admissions enquiry and counselling alerts'],
  ['BlueRiver Logistics', 'Sanjay Nair', 'Kochi', 'Kerala', 'Cold Call', 'New', 58000, ['Website Development'], 'Corporate website with shipment enquiry forms'],
  ['FitCore Wellness', 'Shalini Rao', 'Hyderabad', 'Telangana', 'Google Ads', 'Demo Scheduled', 105000, ['E-commerce Website Development', 'Website AMC'], 'Wellness products store with membership and repeat-order flow'],
  ['SunGrid Energy', 'Arjun Menon', 'Chennai', 'Tamil Nadu', 'Website', 'Qualified', 78000, ['Website Development', 'Domain + Hosting Setup'], 'Solar installation website with project quotation requests'],
  ['TasteTrail Foods', 'Pooja Deshmukh', 'Nashik', 'Maharashtra', 'Instagram', 'Contacted', 118000, ['E-commerce Website Development', 'WhatsApp Business API Integration'], 'Packaged food storefront with city-wise shipping rules'],
  ['MedEquip Solutions', 'Parth Patel', 'Ahmedabad', 'Gujarat', 'Referral', 'Quotation Pending', 90000, ['Website Development', 'WhatsApp Business API Integration'], 'B2B medical equipment catalogue with dealer enquiries'],
  ['LittleSteps School', 'Sneha Mishra', 'Patna', 'Bihar', 'Facebook Ads', 'New', 52000, ['Website Development', 'Domain + Hosting Setup'], 'School website with admission enquiry and announcements'],
  ['RoyalNest Interiors', 'Simran Kaur', 'Chandigarh', 'Chandigarh', 'Instagram', 'Qualified', 68000, ['Website Development', 'Website AMC'], 'Interior portfolio with project filters and consultation booking'],
  ['FarmFresh Bazaar', 'Vivek Tiwari', 'Indore', 'Madhya Pradesh', 'Website', 'Follow-up', 130000, ['E-commerce Website Development', 'WhatsApp Business API Integration'], 'Farm produce marketplace with scheduled delivery slots'],
  ['CloudNine Travels', 'Meera Pillai', 'Bengaluru', 'Karnataka', 'Referral', 'Meeting Scheduled', 76000, ['Website Development', 'WhatsApp Business API Integration'], 'Travel package website with custom itinerary enquiries'],
  ['SteelArc Industries', 'Rakesh Verma', 'Nagpur', 'Maharashtra', 'Trade Show', 'Qualified', 98000, ['Website Development', 'Domain + Hosting Setup'], 'Industrial product catalogue with distributor lead capture'],
  ['GlowUp Beauty', 'Ishita Sen', 'Kolkata', 'West Bengal', 'Instagram', 'New', 115000, ['E-commerce Website Development', 'WhatsApp Business API Integration'], 'Beauty products store with offers, wishlist and WhatsApp support'],
  ['PrimeTax Advisors', 'Ankit Gupta', 'Gurugram', 'Haryana', 'LinkedIn', 'Contacted', 62000, ['Website Development', 'Website AMC'], 'Consulting website with secure callback and document request forms'],
  ['VedaCraft Studio', 'Madhuri Sharma', 'Varanasi', 'Uttar Pradesh', 'Website', 'Quotation Pending', 88000, ['E-commerce Website Development', 'Domain + Hosting Setup'], 'Handicraft store with domestic and export enquiry checkout']
];

function addDays(date, days) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

async function ensurePipeline(db) {
  await db.query(
    `insert into lead_pipelines (id, name, code, description, color, sort_order, is_active, payload)
     values ('pipe-it-service', 'IT Service', 'it-service', 'Service and project sales leads', '#0f766e', 10, true, '{}'::jsonb)
     on conflict (id) do nothing`
  );
}

async function getActiveUsers(db) {
  const result = await db.query(
    `select id from users where is_active = true order by created_at asc limit 20`
  );
  return result.rows.map((row) => row.id);
}

async function main() {
  const result = await withTransaction(async (db) => {
    await ensurePipeline(db);
    const userIds = await getActiveUsers(db);
    const existing = await db.query(
      `select payload->>'demoKey' as demo_key from leads where payload->>'demoSeed' = $1`,
      [SEED_NAME]
    );
    const existingKeys = new Set(existing.rows.map((row) => row.demo_key));
    const insertedIds = [];

    for (let index = 0; index < RAW_LEADS.length; index += 1) {
      const [companyName, contactPerson, city, state, source, status, budget, requiredServices, requirementTitle] = RAW_LEADS[index];
      const demoKey = `quotation-lead-${String(index + 1).padStart(2, '0')}`;
      if (existingKeys.has(demoKey)) continue;

      const compactCompany = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
      const assignedUserId = userIds.length ? userIds[index % userIds.length] : null;
      const phoneSuffix = String(71000000 + (index * 4193)).padStart(8, '0');
      const followUpDate = addDays('2026-10-09', index + 1);
      const expectedStartDate = addDays('2026-10-09', 14 + index);
      const deliveryWeeks = requiredServices.includes('E-commerce Website Development') ? 9 : 5;
      const lead = await leadModel.create({
        leadNumber: `L-DMY-2026-${String(index + 1).padStart(3, '0')}`,
        name: companyName,
        companyName,
        contactPerson,
        ownerName: contactPerson,
        type: 'Organization',
        email: `hello@${compactCompany}.example`,
        phone: `+91 98${phoneSuffix}`,
        whatsappNumber: `+91 98${phoneSuffix}`,
        website: `https://${compactCompany}.example`,
        preferredLanguage: index % 3 === 0 ? 'Hindi / English' : 'English',
        preferredContactMethod: index % 2 === 0 ? 'WhatsApp' : 'Call',
        pipelineId: 'pipe-it-service',
        status,
        source,
        requiredServices,
        requirementTitle,
        requirementSummary: requirementTitle,
        requirementDescription: `${requirementTitle}. The client needs a responsive, easy-to-manage solution with analytics and production deployment.`,
        clientPainPoints: 'Current enquiries and updates are managed manually, causing slow response and missed follow-ups.',
        expectedFeatures: requiredServices.includes('E-commerce Website Development')
          ? 'Responsive storefront, product management, cart, checkout, payments, order tracking and analytics'
          : 'Responsive pages, CMS, enquiry forms, analytics, SEO setup and deployment',
        preferredTechnology: 'React / Next.js, Node.js, PostgreSQL',
        expectedStartDate,
        expectedDeliveryDate: addDays(expectedStartDate, deliveryWeeks * 7),
        value: budget,
        estimatedBudget: budget,
        budgetMin: Math.round(budget * 0.9),
        budgetMax: Math.round(budget * 1.15),
        budgetRange: `${Math.round(budget * 0.9)} - ${Math.round(budget * 1.15)}`,
        budgetConfirmed: index % 4 === 0 ? 'No' : 'Yes',
        billingType: 'Milestone Based',
        gstInvoiceRequired: 'Yes',
        expectedClosingDate: addDays('2026-10-09', 20 + index),
        paymentPreference: 'Bank Transfer / UPI',
        purchaseTimeline: index < 8 ? 'Within 1 Month' : '1-3 Months',
        leadTemperature: ['Hot', 'Warm', 'Warm'][index % 3],
        priority: budget >= 100000 ? 'High' : 'Medium',
        conversionProbability: [70, 60, 80, 55][index % 4],
        leadScore: [78, 68, 84, 62][index % 4],
        statusNote: `Dummy lead ready for ${status === 'Quotation Pending' ? 'quotation creation' : 'sales follow-up'}.`,
        followUpDate,
        nextFollowUpTime: `${String(10 + (index % 7)).padStart(2, '0')}:30`,
        followUpMode: index % 2 === 0 ? 'WhatsApp' : 'Call',
        reminder: '1 Day Before',
        followUpNote: 'Confirm requirements, budget and next decision date.',
        assignedTeam: 'Sales',
        followUpPriority: budget >= 100000 ? 'High' : 'Medium',
        assignedTo: assignedUserId,
        leadOwner: assignedUserId,
        createdBy: assignedUserId,
        address: `${100 + index}, Business Park`,
        city,
        state,
        pincode: String(400001 + (index * 173)).slice(0, 6),
        country: 'India',
        currency: 'INR',
        currencySymbol: 'Rs.',
        labels: ['Dummy', requiredServices[0], budget >= 100000 ? 'High Value' : 'Standard'],
        notes: 'Quotation workflow demo lead generated on 09 Oct 2026.',
        decisionMakerIdentified: 'Yes',
        contactIsDecisionMaker: true,
        requirementConfirmed: 'Yes',
        timelineConfirmed: 'Yes',
        authorityConfirmed: 'Yes',
        needConfirmed: 'Yes',
        demoSeed: SEED_NAME,
        demoKey
      }, db);
      insertedIds.push(lead.id);
    }

    const verified = await db.query(
      `select count(*)::int as count from leads where payload->>'demoSeed' = $1`,
      [SEED_NAME]
    );
    return { inserted: insertedIds.length, totalForSeed: Number(verified.rows[0]?.count || 0), insertedIds };
  });

  console.log(JSON.stringify(result));
}

main()
  .catch((error) => {
    console.error('Failed to seed 20 quotation-ready dummy leads:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

