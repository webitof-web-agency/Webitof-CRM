// Seeds the HRM organization for Webitof (WEBITOF WEB AGENCY (OPC) PRIVATE LIMITED, Raipur):
// branch, departments, designations and teams shaped on the services listed on webitof.com,
// employment types, the Morning Shift 10:00–19:00 (Mon–Sat, lunch 14:00–14:45), attendance policies, document
// types, leave types, work categories, salary structures, KPI templates and HR letters. It also
// sets the office timing and lunch window in the HR policy.
//
// Additive and safe to re-run: a row is skipped when its id or (type, name) already exists, so
// anything HR has edited stays as it is. Usage: node database/seed-hrm-it-masters.js --yes
const { withTransaction, closePool } = require("../config/db");

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const item = (type, name, payload = {}, id = `hrm-it-${type.replace(/_/g, "-")}-${slug(name)}`) => ({ type, name, payload, id });

const OFFICE = { start: "10:00", end: "19:00", lunchStart: "14:00", lunchEnd: "14:45", lunchMinutes: 45 };
// Monday to Saturday working, Sunday off (confirmed by Webitof; the website's hours are out of date).
const WEEKLY_OFFS = [0];
const DAYS_PER_WEEK = 6;

const branches = [
  item("location", "Head Office – Raipur", {
    address: "Unit No. 3033, 3rd Floor, Currency Tower, VIP Rd, Vishal Nagar, Raipur, Chhattisgarh 492001, India",
    timezone: "Asia/Kolkata",
  }),
  item("location", "Remote / Work from home", { timezone: "Asia/Kolkata" }),
];

// department -> designations (department ids are resolved after insert)
const departments = {
  Management: ["Founder & Managing Director", "Director", "Chief Technology Officer (CTO)", "Operations Head"],
  "Software Development": [
    "Trainee Developer",
    "Junior Software Developer",
    "Software Developer",
    "Senior Software Developer",
    "MERN Stack Developer",
    "React / Next.js Developer",
    "PHP / Laravel Developer",
    "WordPress Developer",
    "Shopify Developer",
    "Team Lead",
    "Technical Architect",
  ],
  "Mobile App Development": [
    "Flutter Developer",
    "React Native Developer",
    "Android Developer",
    "iOS Developer",
    "Mobile Team Lead",
  ],
  "UI/UX Design": ["Graphic Designer", "UI/UX Designer (Figma)", "Senior UI/UX Designer", "Design Lead"],
  "Quality Assurance": ["QA Engineer", "Senior QA Engineer", "QA Lead"],
  "DevOps & Cloud": ["DevOps Engineer", "Cloud Engineer (AWS / Azure / GCP)", "System Administrator"],
  "Sales & Business Development": [
    "Business Development Executive",
    "Business Development Manager",
    "Pre-sales Consultant",
    "Inside Sales Executive",
  ],
  "Project Management": ["Project Coordinator", "Business Analyst", "Project Manager", "Delivery Manager"],
  "Customer Support": ["Customer Support Executive", "Technical Support Engineer"],
  "Human Resources": ["HR Executive", "Recruiter", "HR Manager"],
  "Finance & Accounts": ["Accounts Executive", "Accountant", "Finance Manager"],
  "Admin & Operations": ["Office Administrator", "Office Assistant", "IT Support Executive"],
};
// Teams follow the service lines on webitof.com.
const teams = {
  "Software Development": [
    "Web Development (MERN / Next.js)",
    "Custom Software (CRM / ERP / HRM)",
    "SaaS & Cloud Software",
    "E-commerce",
    "CMS (WordPress / Shopify / Elementor)",
    "WhatsApp API & Automation",
  ],
  "Mobile App Development": ["Flutter Apps", "React Native Apps"],
  "UI/UX Design": ["Figma & Product Design"],
};

const employmentTypes = ["Full-time", "Part-time", "Contract", "Intern", "Freelancer / Consultant"].map((n) =>
  item("employment_type", n),
);

const shifts = [
  item("shift", "Morning Shift (10:00 – 19:00)", {
    start: OFFICE.start,
    end: OFFICE.end,
    graceMinutes: 15,
    minimumHours: 8.25,
    halfDayHours: 4,
    breakMinutes: OFFICE.lunchMinutes,
    weeklyOffs: WEEKLY_OFFS,
    overtimeEnabled: false,
  }),
];

const attendancePolicies = [
  item("attendance_policy", "Standard office", {
    hoursPerDay: 8.25,
    daysPerWeek: DAYS_PER_WEEK,
    geofenceRequired: true,
    description: "Currency Tower office, Monday – Saturday 10:00 – 19:00, lunch 14:00 – 14:45; hourly work reports.",
  }, "hrm-policy-standard"),
  item("attendance_policy", "Remote / WFH", {
    hoursPerDay: 8.25,
    daysPerWeek: DAYS_PER_WEEK,
    geofenceRequired: false,
    description: "Work from the approved home location; same hours and hourly reports.",
  }),
  item("attendance_policy", "Hybrid", {
    hoursPerDay: 8.25,
    daysPerWeek: DAYS_PER_WEEK,
    geofenceRequired: true,
    description: "Office and approved home location both allowed.",
  }),
  item("attendance_policy", "Field / Client visit", {
    hoursPerDay: 8.25,
    daysPerWeek: DAYS_PER_WEEK,
    geofenceRequired: false,
    description: "Sales and client-site work; visits outside zones need a reason and admin review.",
  }),
];

const documentTypes = [
  item("document_type", "Identity Proof", { defaultOnCreate: true, hasExpiry: true }, "hrm-doc-identity"),
  item("document_type", "Address Proof", { defaultOnCreate: true }, "hrm-doc-address"),
  item("document_type", "Educational Certificates", { defaultOnCreate: true }, "hrm-doc-education"),
  item("document_type", "PAN Card", {}, "hrm-doc-pan"),
  item("document_type", "Previous Experience Letter", {}, "hrm-doc-experience"),
  item("document_type", "Aadhaar Card", { frontBack: true }),
  item("document_type", "Relieving Letter", {}),
  item("document_type", "Last 3 Months Salary Slips", {}),
  item("document_type", "Bank Proof (Cancelled Cheque / Passbook)", {}),
  item("document_type", "Passport", { hasExpiry: true }),
  item("document_type", "Signed Offer Letter", {}),
  item("document_type", "Signed NDA / Agreement", {}),
  item("document_type", "Profile Photo", { system: true }, "hrm-doc-photo"),
];

const leaveTypes = [
  item("leave_type", "Casual Leave", { annualDays: 12, paid: true, halfDayAllowed: true, sandwich: false, probationAllowed: true, accrual: "monthly", carryForward: false, encashmentAllowed: false }),
  item("leave_type", "Sick Leave", { annualDays: 6, paid: true, halfDayAllowed: true, sandwich: false, probationAllowed: true, accrual: "yearly", carryForward: false, encashmentAllowed: false }),
  item("leave_type", "Earned / Privilege Leave", { annualDays: 15, paid: true, halfDayAllowed: false, sandwich: true, probationAllowed: false, accrual: "monthly", carryForward: true, carryForwardLimit: 30, encashmentAllowed: true }),
  item("leave_type", "Maternity Leave", { annualDays: 182, paid: true, halfDayAllowed: false, sandwich: true, probationAllowed: true, accrual: "yearly", carryForward: false, encashmentAllowed: false }),
  item("leave_type", "Paternity Leave", { annualDays: 5, paid: true, halfDayAllowed: false, sandwich: false, probationAllowed: true, accrual: "yearly", carryForward: false, encashmentAllowed: false }),
  item("leave_type", "Bereavement Leave", { annualDays: 3, paid: true, halfDayAllowed: false, sandwich: false, probationAllowed: true, accrual: "yearly", carryForward: false, encashmentAllowed: false }),
  item("leave_type", "Compensatory Off", { annualDays: 0, paid: true, halfDayAllowed: true, sandwich: false, probationAllowed: true, accrual: "yearly", carryForward: false, encashmentAllowed: false }),
  item("leave_type", "Leave Without Pay", { annualDays: 0, paid: false, halfDayAllowed: true, sandwich: false, probationAllowed: true, accrual: "yearly", carryForward: false, encashmentAllowed: false }),
];

const workCategories = [
  "Development",
  "Bug Fixing",
  "Code Review",
  "Testing / QA",
  "UI/UX Design (Figma)",
  "Graphic Design",
  "Deployment / DevOps",
  "Requirement Analysis",
  "CRM / ERP Customisation",
  "WhatsApp API Integration",
  "WordPress / Shopify Work",
  "Client Meeting",
  "Internal Meeting",
  "Documentation",
  "Sales / Pre-sales",
  "Support / Maintenance",
  "Learning & Training",
  "Admin / HR",
].map((n) => item("work_category", n));

const salaryStructures = [
  item("salary_structure", "Standard CTC (India)", {
    components: [
      { name: "Basic", type: "earning", percentOfCtc: 40 },
      { name: "HRA", type: "earning", percentOfCtc: 20 },
      { name: "Special Allowance", type: "earning", percentOfCtc: 32 },
      { name: "Employer PF", type: "employer", percentOfCtc: 4.8 },
      { name: "Gratuity", type: "employer", percentOfCtc: 1.92 },
      { name: "Employee PF", type: "deduction", percentOfBasic: 12 },
      { name: "Professional Tax", type: "deduction", monthlyAmount: 200 },
    ],
  }),
  item("salary_structure", "Intern Stipend", {
    components: [{ name: "Stipend", type: "earning", percentOfCtc: 100 }],
  }),
];

const kpiTemplates = [
  item("kpi_template", "Developer KPI", { factors: ["On-time delivery", "Code quality & reviews", "Bugs after release", "Estimation accuracy", "Communication & teamwork", "Learning & initiative"] }),
  item("kpi_template", "Designer KPI", { factors: ["On-time delivery", "Design quality", "Client revisions", "Consistency with design system", "Communication"] }),
  item("kpi_template", "QA KPI", { factors: ["Test coverage", "Defects found before release", "Defects leaked to production", "Test documentation", "Turnaround time"] }),
  item("kpi_template", "Mobile Developer KPI", { factors: ["On-time delivery", "App stability (crashes)", "Store release quality", "Code quality & reviews", "Communication"] }),
  item("kpi_template", "Sales KPI", { factors: ["Revenue vs target", "Leads converted", "Pipeline value", "Follow-up discipline", "Client relationships"] }),
  item("kpi_template", "Project Manager KPI", { factors: ["Projects delivered on time", "Budget adherence", "Client satisfaction", "Team utilisation", "Risk management"] }),
];

const letter = (name, description, content, id) =>
  item("letter_template", name, { certificate: true, description, content }, id);
const sign = "\n\nFor {{company_name}}\n\nAuthorised Signatory";
const letters = [
  letter("Joining Letter", "Official joining letter document",
    "{{company_name}}\n\nJOINING LETTER\n\nDear {{employee_name}},\n\nWe are pleased to confirm your appointment as {{designation}} in the {{department}} department, with effect from {{joining_date}}. Your employee ID is {{employee_id}}.\n\nWe welcome you to {{company_name}} and wish you a rewarding career with us." + sign,
    "hrm-letter-joining"),
  letter("Experience Certificate", "Work experience certificate",
    "{{company_name}}\n\nEXPERIENCE CERTIFICATE\n\nThis is to certify that {{employee_name}} (Employee ID {{employee_id}}) worked with {{company_name}} as {{designation}} in the {{department}} department from {{joining_date}} to {{last_working_date}}.\n\nDuring this period we found their work and conduct satisfactory. We wish them success in the future." + sign,
    "hrm-letter-experience"),
  letter("NOC", "No Objection Certificate",
    "{{company_name}}\n\nNO OBJECTION CERTIFICATE\n\nThis is to certify that {{employee_name}} (Employee ID {{employee_id}}), {{designation}}, {{department}} department, has been associated with {{company_name}} since {{joining_date}}.\n\nThe company has no objection to the purpose for which this certificate is requested." + sign,
    "hrm-letter-noc"),
  letter("Offer Letter", "Offer of employment with salary",
    "{{company_name}}\n\nOFFER LETTER\n\nDear {{employee_name}},\n\nWe are pleased to offer you the position of {{designation}} in our {{department}} department. Your expected date of joining is {{joining_date}}.\n\nYour monthly compensation will be {{salary}}, subject to statutory deductions. Other terms are as per company policy.\n\nPlease sign and return a copy of this letter as your acceptance." + sign),
  letter("Relieving Letter", "Relieving letter on exit",
    "{{company_name}}\n\nRELIEVING LETTER\n\nDear {{employee_name}},\n\nThis is to confirm that you have been relieved from your duties as {{designation}} ({{department}}) at {{company_name}} with effect from {{last_working_date}}, after completing the exit formalities.\n\nWe thank you for your contributions and wish you the very best." + sign),
  letter("Internship Certificate", "Certificate for interns",
    "{{company_name}}\n\nINTERNSHIP CERTIFICATE\n\nThis is to certify that {{employee_name}} completed an internship with {{company_name}} as {{designation}} in the {{department}} department from {{joining_date}} to {{last_working_date}}.\n\nDuring the internship they showed sincerity and a willingness to learn. We wish them a bright future." + sign),
  letter("Address Proof Letter", "Employment proof for address / bank purposes",
    "{{company_name}}\n\nTO WHOMSOEVER IT MAY CONCERN\n\nThis is to certify that {{employee_name}} (Employee ID {{employee_id}}) is employed with {{company_name}} as {{designation}} in the {{department}} department since {{joining_date}}.\n\nThis letter is issued on the employee's request." + sign),
];

async function insert(db, rows, sortStart = 1) {
  let added = 0;
  for (const [i, r] of rows.entries()) {
    const res = await db.query(
      `INSERT INTO master_items (id, type, name, is_active, sort_order, payload)
       VALUES ($1, $2, $3, true, $4, $5::jsonb) ON CONFLICT DO NOTHING`,
      [r.id, `hrm_${r.type}`, r.name, sortStart + i, JSON.stringify(r.payload)],
    );
    added += res.rowCount;
  }
  return added;
}
async function idOf(db, type, name) {
  return (await db.query("SELECT id FROM master_items WHERE type=$1 AND name=$2", [`hrm_${type}`, name])).rows[0]?.id;
}

// Which employment types each leave applies to (empty = everyone). Interns and freelancers
// get no earned or parental leave; freelancers get no paid leave at all.
const LEAVE_ELIGIBILITY = {
  "Casual Leave": ["Full-time", "Part-time", "Contract", "Intern"],
  "Sick Leave": ["Full-time", "Part-time", "Contract", "Intern"],
  "Earned / Privilege Leave": ["Full-time"],
  "Maternity Leave": ["Full-time", "Contract"],
  "Paternity Leave": ["Full-time", "Contract"],
  "Bereavement Leave": ["Full-time", "Part-time", "Contract"],
  "Compensatory Off": ["Full-time", "Part-time", "Contract"],
  "Leave Without Pay": ["Full-time", "Part-time", "Contract", "Intern"],
};

// HRM access for staff roles: every CRM user can run their own workday (My day / Employee app);
// HR and team managers get the approval rights the HR module needs besides the admin.
const HRM_ROLES = [
  {
    code: "hr_manager",
    name: "HR Manager",
    description: "Runs HR: employees, attendance, leave, documents, payroll preparation",
    permissions: ["view_own", "view_all", "self_service", "manage_employees", "manage_settings", "approve", "hr_approve",
      "manage_allocations", "view_private", "manage_private", "view_salary", "manage_salary", "payroll",
      "recruitment", "performance", "assets", "documents", "export"],
  },
  {
    code: "team_manager",
    name: "Team Manager",
    description: "Leads a team: sees and approves their reports' work, leave and attendance",
    permissions: ["view_own", "view_team", "view_projects", "self_service", "approve", "manage_allocations"],
  },
];
const SELF_SERVICE_ROLES = ["sales", "accountant"];

// Links between masters and role access. Only fills what is empty, so HR choices stay.
async function applyMappings(db, counts) {
  const shiftId = await idOf(db, "shift", shifts[0].name);
  if (shiftId) {
    const r = await db.query(
      "UPDATE master_items SET payload = payload || jsonb_build_object('shiftId', $1::text), updated_at = now() WHERE type = 'hrm_department' AND coalesce(payload->>'shiftId', '') = ''",
      [shiftId],
    );
    counts["Department → shift"] = `${r.rowCount} linked to ${shifts[0].name}`;
  }
  const typeIds = Object.fromEntries(
    (await db.query("SELECT id, name FROM master_items WHERE type = 'hrm_employment_type'")).rows.map((r) => [r.name, r.id]),
  );
  let leaves = 0;
  for (const [leave, types] of Object.entries(LEAVE_ELIGIBILITY)) {
    const ids = types.map((t) => typeIds[t]).filter(Boolean);
    if (!ids.length) continue;
    const r = await db.query(
      "UPDATE master_items SET payload = payload || jsonb_build_object('employmentTypeIds', $2::jsonb), updated_at = now() WHERE type = 'hrm_leave_type' AND name = $1 AND coalesce(payload->'employmentTypeIds', '[]'::jsonb) = '[]'::jsonb",
      [leave, JSON.stringify(ids)],
    );
    leaves += r.rowCount;
  }
  counts["Leave → employment type"] = `${leaves} leave types linked`;

  let roles = 0;
  for (const role of HRM_ROLES) {
    const created = await db.query(
      `INSERT INTO roles (id, code, name, description, is_system, is_active, payload)
       SELECT $1, $2, $3, $4, false, true, '{}'::jsonb
       WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = $2 OR name = $3)`,
      [`role-${role.code.replace(/_/g, "-")}`, role.code, role.name, role.description],
    );
    roles += created.rowCount;
    await db.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = ANY($2::text[])
       WHERE r.code = $1 ON CONFLICT DO NOTHING`,
      [role.code, role.permissions.map((a) => `hrm.${a}`)],
    );
  }
  const selfService = await db.query(
    `INSERT INTO role_permissions (role_id, permission_id)
     SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('hrm.view_own', 'hrm.self_service')
     WHERE r.code = ANY($1::text[]) ON CONFLICT DO NOTHING`,
    [SELF_SERVICE_ROLES],
  );
  counts["Roles"] = `${roles} created (HR Manager, Team Manager); self service added to ${SELF_SERVICE_ROLES.join(", ")} (${selfService.rowCount} grants)`;
}

async function seed(db) {
  const counts = {};
  const run = async (label, rows) => {
    counts[label] = `${await insert(db, rows)} added of ${rows.length}`;
  };
  await run("Branches", branches);
  await run("Departments", Object.keys(departments).map((n) => item("department", n)));
  const designations = [],
    teamRows = [];
  for (const [dept, titles] of Object.entries(departments)) {
    const departmentId = await idOf(db, "department", dept);
    for (const t of titles) designations.push(item("designation", t, { departmentId }));
    for (const t of teams[dept] || []) teamRows.push(item("team", t, { departmentId }));
  }
  await run("Designations", designations);
  await run("Teams", teamRows);
  await run("Employment types", employmentTypes);
  await run("Shifts", shifts);
  await run("Attendance policies", attendancePolicies);
  await run("Document types", documentTypes);
  await run("Leave types", leaveTypes);
  await run("Work categories", workCategories);
  await run("Salary structures", salaryStructures);
  await run("KPI templates", kpiTemplates);
  await run("Letters & certificates", letters);

  // Office timing, lunch window and default shift in the HR policy (merged over current values).
  const generalShift = await idOf(db, "shift", shifts[0].name);
  await db.query(
    "UPDATE hrm_settings SET value = value || $1::jsonb, updated_at = now() WHERE key = 'policy'",
    [JSON.stringify({
      shiftStart: OFFICE.start,
      shiftEnd: OFFICE.end,
      standardDailyHours: 8.25,
      weeklyOffs: WEEKLY_OFFS,
      graceMinutes: 15,
      lunchWindowStart: OFFICE.lunchStart,
      lunchWindowEnd: OFFICE.lunchEnd,
      lunchMaxMinutes: OFFICE.lunchMinutes,
      ...(generalShift ? { defaultShiftId: generalShift } : {}),
    })],
  );
  counts["HR policy"] = "Mon–Sat 10:00–19:00, lunch 14:00–14:45, Sunday off";
  // The migration created "Standard office" with 8.5 h × 5 days; match Webitof's 8 h 15 m × 6 days unless HR changed it.
  const aligned = await db.query(
    "UPDATE master_items SET payload = payload || $1::jsonb, updated_at = now() WHERE id = 'hrm-policy-standard' AND payload->>'hoursPerDay' = '8.5'",
    [JSON.stringify(attendancePolicies[0].payload)],
  );
  if (aligned.rowCount) counts["Standard office"] = "8.25 h/day, 6 days/week";
  await applyMappings(db, counts);
  return counts;
}

if (require.main === module) {
  if (!process.argv.includes("--yes")) {
    console.error("Adds HRM organization masters to the database in DATABASE_URL. Re-run with --yes to continue.");
    process.exit(1);
  }
  const target = (() => {
    try {
      const u = new URL(String(process.env.DATABASE_URL || require("dotenv").config().parsed?.DATABASE_URL || "").replace(/^"|"$/g, ""));
      return `${u.hostname}:${u.port || 5432}/${u.pathname.slice(1)}`;
    } catch {
      return "DATABASE_URL";
    }
  })();
  withTransaction(seed)
    .then((counts) => {
      console.log(`HRM IT masters seeded into ${target} (existing rows kept):`);
      for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(24)} ${v}`);
    })
    .catch((e) => {
      console.error("Seeding failed, nothing was changed:", e.message);
      process.exitCode = 1;
    })
    .finally(closePool);
}

module.exports = { seed };
