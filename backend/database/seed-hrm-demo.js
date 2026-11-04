// Seeds an IT-company HRM demo: masters, office/home geofences, two employees
// (Rahul Sharma — Full Stack Developer, Priya Verma — UI/UX Designer) with
// logins, salary, leave balances, allocations, Sep–Oct 2026 attendance built
// from hourly slot reports, edge cases (absent, half day, breach, lunch overrun,
// pending WFH / leave) and an approved September payroll.
//   node database/seed-hrm-demo.js --yes-seed-hrm
// Refuses to run against a database whose name contains "prod".
const bcrypt = require("bcryptjs");
const { pool, withTransaction, closePool } = require("../config/db");
const c = require("../services/hrm/core");
const calc = require("../services/hrm/calculations");
const d = require("../services/hrm/daylogic");
const { createId } = require("../utils/format");
const { migrate } = require("./migrate-hrm");

const TZ = "+05:30";
const at = (date, minutes) => {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return new Date(`${date}T${h}:${m}:00${TZ}`);
};
let seed = 20261030;
const rand = (min, max) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return min + (seed % (max - min + 1));
};
const OFFICE = { latitude: 28.6139, longitude: 77.209 };
const RAHUL_HOME = { latitude: 28.6201, longitude: 77.2151 };
const PRIYA_HOME = { latitude: 28.5355, longitude: 77.391 };
const jitter = (p) => ({
  latitude: Number((p.latitude + rand(-30, 30) / 100000).toFixed(6)),
  longitude: Number((p.longitude + rand(-30, 30) / 100000).toFixed(6)),
  accuracy: rand(6, 28),
});
const HOLIDAYS = [
  ["Gandhi Jayanti", "2026-10-02"],
  ["Dussehra", "2026-10-20"],
  ["Diwali", "2026-11-08"],
  ["Guru Nanak Jayanti", "2026-11-24"],
  ["Christmas", "2026-12-25"],
  ["Republic Day", "2027-01-26"],
];
const DEV_WORK = [
  ["Implemented JWT refresh-token rotation in the auth middleware with unit tests", "ORB"],
  ["Built the order-history API with cursor pagination and new PostgreSQL indexes", "ORB"],
  ["Fixed cart total rounding bug on checkout and added regression test", "ORB"],
  ["Code review of payment-webhook retry PR, requested idempotency changes", "ORB"],
  ["Integrated Razorpay sandbox for subscription payments and webhooks", "ORB"],
  ["Optimised product listing query, p95 down from 820 ms to 190 ms", "ORB"],
  ["Refactored React dashboard widgets into reusable typed components", "ORB"],
  ["Wrote Cypress e2e tests for login, signup and password reset flows", "ORB"],
  ["Deployed release to staging and verified smoke tests with QA", "ORB"],
  ["Built SLA timer and escalation logic for support tickets", "NOV"],
  ["Migrated ticket attachments to S3 with a zero-downtime backfill script", "NOV"],
  ["Investigated Node worker memory leak using heap snapshots", "NOV"],
  ["Added Redis caching for knowledge-base search endpoints", "NOV"],
  ["Sprint planning and estimation for the Nova support portal backlog", "NOV"],
  ["Pairing with QA on ticket assignment regression issues", "NOV"],
];
const DESIGN_WORK = [
  ["Designed high-fidelity Figma screens for the checkout flow", "ORB"],
  ["Prototyped onboarding flow with micro-interactions in Figma", "ORB"],
  ["Responsive mobile layouts for product listing and filters", "ORB"],
  ["Design review with developers for dashboard handoff and specs", "ORB"],
  ["Created design tokens and component variants in the design system", "ORB"],
  ["Synthesised findings from customer interviews for the support portal", "NOV"],
  ["Usability test on ticket creation; documented findings and fixes", "NOV"],
  ["Accessibility audit for colour contrast and focus states (WCAG AA)", "NOV"],
  ["Wireframes for the reports module with three layout options", "NOV"],
  ["Navigation iconography set for the support portal", "NOV"],
];

async function upsertMaster(tx, type, name, payload = {}, sort = 0) {
  const found = await tx.query("SELECT id FROM master_items WHERE type=$1 AND name=$2", [type, name]);
  if (found.rows[0]) return found.rows[0].id;
  const id = createId("mst");
  await tx.query(
    "INSERT INTO master_items(id,type,name,is_active,sort_order,payload) VALUES($1,$2,$3,true,$4,$5)",
    [id, type, name, sort, JSON.stringify(payload)],
  );
  return id;
}
async function seedUser(tx, { name, username, email, phone, password, roleId }) {
  const id = createId("user");
  await tx.query(
    "INSERT INTO users(id,full_name,username,email,phone,password_hash,is_active,payload) VALUES($1,$2,$3,$4,$5,$6,true,'{}'::jsonb)",
    [id, name, username, email, phone, await bcrypt.hash(password, 10)],
  );
  await tx.query("INSERT INTO user_roles(user_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [id, roleId]);
  return id;
}
function workDays(start, end) {
  const skip = new Set(HOLIDAYS.map((h) => h[1]));
  return c
    .days(start, end)
    .filter((x) => ![0, 6].includes(new Date(`${x}T00:00:00Z`).getUTCDay()) && !skip.has(x));
}

// Builds one realistic app-driven day: slots every ~60 working minutes.
async function seedDay(tx, ctx, emp, date, opts = {}) {
  const { policy, shift, adminId, projects, today } = ctx;
  const wfh = Boolean(opts.wfh);
  const place = wfh ? emp.home : OFFICE;
  const clockIn = at(date, 585 + rand(0, 25));
  const jobStart = new Date(clockIn.getTime() + rand(3, 8) * 60000);
  const lunchStart = at(date, 790 + rand(0, 30));
  const lunchLen = opts.lunchMinutes || rand(30, 44);
  const lunchEnd = new Date(lunchStart.getTime() + lunchLen * 60000);
  const jobEnd = opts.endAt ? at(date, opts.endAt) : at(date, 1130 + rand(0, 25));
  const tookLunch = jobEnd > lunchEnd;
  const checkOut = new Date(jobEnd.getTime() + rand(2, 6) * 60000);
  const att = {
    employeeId: emp.id,
    workDate: date,
    status: opts.status || (wfh ? "WFH" : "Present"),
    workMode: wfh ? "WFH" : "WFO",
    geofenceId: wfh ? emp.homeFenceId : ctx.officeFenceId,
    source: "app",
    checkIn: clockIn.toISOString(),
    jobStartedAt: jobStart.toISOString(),
    lunchStartedAt: tookLunch ? lunchStart.toISOString() : null,
    lunchEndedAt: tookLunch ? lunchEnd.toISOString() : null,
    lunchMinutes: tookLunch ? lunchLen : 0,
    breakMinutes: tookLunch ? lunchLen : 0,
    jobEndedAt: jobEnd.toISOString(),
    checkOut: checkOut.toISOString(),
    offlineMinutes: rand(0, 9) > 7 ? rand(5, 15) : 0,
    outsideMinutes: opts.outside ? opts.outside.minutes : 0,
    lastPingAt: jobEnd.toISOString(),
    lastLocation: JSON.stringify(jitter(place)),
    shiftSnapshot: JSON.stringify(shift),
  };
  // Slot timeline (server rules: due after 60 working minutes, lunch pauses).
  const slots = [];
  let idle = 0;
  const work = emp.work;
  while (true) {
    const s = d.slotState({ ...att, jobEndedAt: null }, slots, policy, jobEnd);
    const due = new Date(s.dueAt);
    if (due >= jobEnd) break;
    const late = rand(0, 10) > 8 ? rand(12, 20) : rand(0, 6);
    const submitted = new Date(Math.min(jobEnd, due.getTime() + late * 60000));
    const st = d.slotState({ ...att, jobEndedAt: null }, slots, policy, submitted);
    idle += st.lateMinutes;
    slots.push({ slotStart: st.slotStart, slotEnd: submitted.toISOString(), minutes: st.workedMinutes });
  }
  const last = d.slotState({ ...att }, slots, policy, jobEnd);
  if (last.workedMinutes >= 1)
    slots.push({ slotStart: last.slotStart, slotEnd: jobEnd.toISOString(), minutes: last.workedMinutes });
  att.idleMinutes = idle;
  Object.assign(att, calc.attendanceMetrics(att, shift, policy));
  const saved = await c.insert(tx, "hrm_attendance", att);
  const ev = (kind, when, extra = {}, loc = jitter(place)) =>
    c.insert(tx, "hrm_attendance_events", {
      attendanceId: saved.id,
      employeeId: emp.id,
      kind,
      at: when,
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      inside: true,
      details: JSON.stringify(extra),
    });
  await ev("clock_in", clockIn, { mode: att.workMode });
  await ev("job_start", jobStart);
  if (tookLunch) {
    await ev("lunch_prompt", at(date, 780), { key: `lunch:${date}` });
    await ev("lunch_start", lunchStart);
    await ev("lunch_end", lunchEnd, { minutes: lunchLen });
  }
  if (opts.outside) {
    await ev("exit", at(date, opts.outside.from), { fence: "Webitof HQ" }, jitter({ latitude: 28.6175, longitude: 77.2131 }));
    await ev("return", at(date, opts.outside.from + opts.outside.minutes), { minutes: opts.outside.minutes });
  }
  const reportStatus = date < ctx.approvedBefore ? "Approved" : "Submitted";
  const report = await c.insert(tx, "hrm_work_reports", {
    employeeId: emp.id,
    workDate: date,
    status: reportStatus,
    summary: opts.summary || "Worked on Orbit and Nova deliverables; all slot updates submitted.",
    submittedAt: checkOut,
    reviewedBy: reportStatus === "Approved" ? adminId : null,
    reviewedAt: reportStatus === "Approved" ? new Date(checkOut.getTime() + 86400000) : null,
    editCount: opts.edits || 0,
  });
  let i = 0;
  for (const s of slots) {
    const [text, code] = work[(emp.cursor++) % work.length];
    const project = code === "ORB" ? projects.orbit : projects.nova;
    await c.insert(tx, "hrm_work_entries", {
      reportId: report.id,
      projectId: project.id,
      clientId: project.clientId,
      description: `${text} (${code}-${100 + emp.cursor})`,
      minutes: Math.max(1, s.minutes),
      billable: !/planning|review|interviews/i.test(text),
      completion: Math.min(100, 20 + rand(0, 80)),
      priority: ["Medium", "High", "Medium", "Low"][rand(0, 3)],
      source: "slot",
      slotStart: s.slotStart,
      slotEnd: s.slotEnd,
      editCount: i === 1 ? opts.edits || 0 : 0,
      editedAt: i === 1 && opts.edits ? checkOut : null,
    });
    await ev("slot_submitted", new Date(s.slotEnd), { minutes: s.minutes });
    i++;
  }
  await ev("job_end", jobEnd);
  await ev("clock_out", checkOut);
  const entries = (await tx.query("SELECT * FROM hrm_work_entries WHERE report_id=$1", [report.id])).rows.map(c.camel);
  const evs = (await tx.query("SELECT * FROM hrm_attendance_events WHERE attendance_id=$1", [saved.id])).rows.map(c.camel);
  const summary = d.summarize({ ...att, ...saved }, entries, evs, policy, checkOut);
  await tx.query("UPDATE hrm_attendance SET summary=$2 WHERE id=$1", [saved.id, JSON.stringify(summary)]);
  return { attendance: saved, report };
}

async function main() {
  if (!process.argv.includes("--yes-seed-hrm"))
    throw new Error("Pass --yes-seed-hrm to seed HRM demo data.");
  const dbName = (await pool.query("SELECT current_database() AS n")).rows[0].n;
  if (/prod/i.test(dbName)) throw new Error(`Refusing to seed demo data into "${dbName}".`);
  await withTransaction(migrate);
  const admin = (
    await pool.query(
      "SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' ORDER BY u.created_at LIMIT 1",
    )
  ).rows[0];
  if (!admin) throw new Error("Create an admin user first (BOOTSTRAP_ADMIN_* env).");
  if ((await pool.query("SELECT 1 FROM hrm_employees WHERE employee_number='WBT-EMP-001'")).rowCount)
    throw new Error("HRM demo data already exists (WBT-EMP-001).");

  const ids = await withTransaction(async (tx) => {
    // Organization masters for an IT services company.
    const m = {
      engineering: await upsertMaster(tx, "hrm_department", "Engineering"),
      design: await upsertMaster(tx, "hrm_department", "Design & UX"),
      fullStack: await upsertMaster(tx, "hrm_designation", "Full Stack Developer"),
      designer: await upsertMaster(tx, "hrm_designation", "UI/UX Designer"),
      team: await upsertMaster(tx, "hrm_team", "Client Delivery Squad"),
      hq: await upsertMaster(tx, "hrm_location", "Webitof HQ", { address: "Connaught Place, New Delhi 110001", timezone: "Asia/Kolkata" }),
      fullTime: await upsertMaster(tx, "hrm_employment_type", "Full-time"),
      shift: await upsertMaster(tx, "hrm_shift", "General Shift (10:00–19:00)", {
        start: "10:00",
        end: "19:00",
        graceMinutes: 15,
        minimumHours: 8,
        halfDayHours: 4,
        breakMinutes: 45,
        weeklyOffs: [0, 6],
        overtimeEnabled: false,
      }),
      cl: await upsertMaster(tx, "hrm_leave_type", "Casual Leave", { annualDays: 12, paid: true, halfDayAllowed: true, accrual: "annual", probationAllowed: true }),
      sl: await upsertMaster(tx, "hrm_leave_type", "Sick Leave", { annualDays: 10, paid: true, halfDayAllowed: true, accrual: "annual", probationAllowed: true }),
      pl: await upsertMaster(tx, "hrm_leave_type", "Privilege Leave", { annualDays: 15, paid: true, halfDayAllowed: false, accrual: "monthly", carryForward: true, carryForwardLimit: 30, probationAllowed: false }),
      lop: await upsertMaster(tx, "hrm_leave_type", "Loss of Pay", { annualDays: 0, paid: false, halfDayAllowed: true }),
    };
    for (const [i, name] of ["Development", "Code Review", "Testing / QA", "UI/UX Design", "Meetings", "Research"].entries())
      await upsertMaster(tx, "hrm_work_category", name, {}, i);
    for (const name of ["Offer Letter", "Experience Letter"])
      await upsertMaster(tx, "hrm_letter_template", name, {
        content: `Dear {{employeeName}},\n\nThis ${name.toLowerCase()} confirms your role as {{designation}} at {{companyName}}.\n\nRegards,\nHR, {{companyName}}`,
      });
    const policy = await c.policy(tx);
    await tx.query(
      "UPDATE hrm_settings SET value=value||$1::jsonb,updated_at=now() WHERE key='policy'",
      [JSON.stringify({ defaultShiftId: m.shift, shiftStart: "10:00", shiftEnd: "19:00", automationEnabled: true })],
    );
    for (const [name, date] of HOLIDAYS)
      await c.insert(tx, "hrm_holidays", { name, workDate: date, createdBy: admin.id });

    // Employee role: own records + self service only.
    let role = (await tx.query("SELECT id FROM roles WHERE code='employee'")).rows[0];
    if (!role) {
      role = { id: createId("role") };
      await tx.query(
        "INSERT INTO roles(id,code,name,description,is_system,is_active,payload) VALUES($1,'employee','Employee','Employee self-service (HRM app)',false,true,'{}'::jsonb)",
        [role.id],
      );
    }
    await tx.query(
      "INSERT INTO role_permissions(role_id,permission_id) SELECT $1,id FROM permissions WHERE code IN ('hrm.view_own','hrm.self_service') ON CONFLICT DO NOTHING",
      [role.id],
    );
    const office = await c.insert(tx, "hrm_geofences", {
      kind: "office",
      locationId: m.hq,
      label: "Webitof HQ",
      address: "Connaught Place, New Delhi 110001",
      ...OFFICE,
      radiusMeters: 150,
      status: "Approved",
      reviewedBy: admin.id,
      reviewedAt: new Date("2026-08-25T10:00:00+05:30"),
      createdBy: admin.id,
    });
    const people = [];
    for (const p of [
      {
        number: "WBT-EMP-001",
        name: "Rahul Sharma",
        email: "rahul.sharma@webitof.com",
        phone: "+91 98110 45231",
        dept: m.engineering,
        designation: m.fullStack,
        joining: "2024-04-15",
        status: "Confirmed",
        mode: "Hybrid",
        salary: { cost: 92000, earn: [["Basic", 42500], ["HRA", 17000], ["Special Allowance", 25500]], ded: [["Provident Fund", 1800], ["Professional Tax", 200]] },
        home: RAHUL_HOME,
        homeStatus: "Approved",
        work: DEV_WORK,
        alloc: [["orbit", 70, 1800], ["nova", 30, 1500]],
        private: { dob: "1996-07-12", bloodGroup: "B+", emergencyContact: "Sunita Sharma (Mother) +91 98110 11223", currentAddress: "Flat 302, Karol Bagh, New Delhi 110005" },
      },
      {
        number: "WBT-EMP-002",
        name: "Priya Verma",
        email: "priya.verma@webitof.com",
        phone: "+91 99580 77412",
        dept: m.design,
        designation: m.designer,
        joining: "2025-06-02",
        status: "Active",
        mode: "Office",
        salary: { cost: 66000, earn: [["Basic", 30000], ["HRA", 12000], ["Special Allowance", 20000]], ded: [["Provident Fund", 1800], ["Professional Tax", 200]] },
        home: PRIYA_HOME,
        homeStatus: "Pending",
        work: DESIGN_WORK,
        alloc: [["orbit", 50, 1400], ["nova", 50, 1400]],
        private: { dob: "1998-02-03", bloodGroup: "O+", emergencyContact: "Amit Verma (Brother) +91 99580 22114", currentAddress: "Sector 62, Noida 201301" },
      },
    ]) {
      const userId = await seedUser(tx, {
        name: p.name,
        username: p.number.toLowerCase(),
        email: p.email,
        phone: p.phone,
        password: "123456",
        roleId: role.id,
      });
      const e = await c.insert(tx, "hrm_employees", {
        employeeNumber: p.number,
        userId,
        fullName: p.name,
        companyEmail: p.email,
        phone: p.phone,
        departmentId: p.dept,
        designationId: p.designation,
        teamId: m.team,
        locationId: m.hq,
        employmentTypeId: m.fullTime,
        shiftId: m.shift,
        workMode: p.mode,
        status: p.status,
        joiningDate: p.joining,
        profile: JSON.stringify({ skills: p.work === DEV_WORK ? ["Node.js", "React", "PostgreSQL", "AWS"] : ["Figma", "User research", "Design systems"] }),
        createdBy: admin.id,
      });
      await c.insert(tx, "hrm_employment_history", {
        employeeId: e.id,
        effectiveDate: p.joining,
        snapshot: JSON.stringify({ ...e, profile: undefined }),
        reason: "Joined",
        createdBy: admin.id,
      });
      await tx.query("INSERT INTO hrm_private_profiles(employee_id,details) VALUES($1,$2)", [e.id, JSON.stringify({ profile: p.private })]);
      const home = await c.insert(tx, "hrm_geofences", {
        kind: "home",
        employeeId: e.id,
        label: `Home – ${p.name}`,
        ...p.home,
        radiusMeters: 100,
        status: p.homeStatus,
        requestAccuracy: 12,
        reviewedBy: p.homeStatus === "Approved" ? admin.id : null,
        reviewedAt: p.homeStatus === "Approved" ? new Date("2026-09-25T11:00:00+05:30") : null,
        createdBy: userId,
      });
      people.push({ ...p, id: e.id, userId, homeFenceId: home.id, cursor: 0 });
    }
    const projects = Object.fromEntries(
      (await tx.query("SELECT id,client_id FROM projects WHERE id IN ('project-demo-portal','project-demo-retainer')")).rows.map((r) => [
        r.id === "project-demo-portal" ? "orbit" : "nova",
        { id: r.id, clientId: r.client_id },
      ]),
    );
    if (!projects.orbit || !projects.nova) throw new Error("Demo CRM projects are missing; run CRM init with SEED_DEFAULT_DATA=true first.");
    for (const p of people) {
      for (const [key, percent, rate] of p.alloc)
        await c.insert(tx, "hrm_allocations", {
          employeeId: p.id,
          projectId: projects[key].id,
          role: p.work === DEV_WORK ? "Developer" : "Designer",
          percent,
          startDate: "2026-09-01",
          endDate: "2026-12-31",
          plannedHours: Math.round((percent / 100) * 8 * 85),
          billable: true,
          billingRate: rate,
          createdBy: admin.id,
        });
      for (const [type, days] of [[m.cl, 12], [m.sl, 10], [m.pl, 15]])
        await c.insert(tx, "hrm_leave_ledger", {
          employeeId: p.id,
          leaveTypeId: type,
          year: 2026,
          amount: days,
          reason: "Annual allocation 2026",
          sourceKey: `seed:accrual:${p.id}:${type}:2026`,
          createdBy: admin.id,
        });
    }
    return { m, people, projects, officeFenceId: office.id, policy: { ...policy, defaultShiftId: m.shift } };
  });

  // Salary through the service (validates components); admin is super-admin.
  const adminUser = await require("../services/auth.service").getUserAccessProfile(admin.id);
  for (const p of ids.people)
    await require("../services/hrm/payroll").salary(adminUser, {
      employeeId: p.id,
      effectiveDate: "2026-04-01",
      monthlyCost: p.salary.cost,
      currency: "INR",
      components: [
        ...p.salary.earn.map(([name, amount]) => ({ name, type: "earning", amount })),
        ...p.salary.ded.map(([name, amount]) => ({ name, type: "deduction", amount })),
        { name: "Employer PF", type: "employer", amount: 1800 },
      ],
      reason: "Annual appraisal FY 2026-27",
    });

  await withTransaction(async (tx) => {
    const policy = await c.policy(tx);
    const shift = (await tx.query("SELECT payload FROM master_items WHERE id=$1", [ids.m.shift])).rows[0].payload;
    const ctx = { policy, shift, adminId: admin.id, projects: ids.projects, officeFenceId: ids.officeFenceId, approvedBefore: "2026-10-26" };
    const [rahul, priya] = ids.people;
    const leave = async (emp, typeId, start, end, fraction, status, title, extra = {}) => {
      const days = fraction === 0.5 ? 0.5 : workDays(start, end).length;
      const r = await c.insert(tx, "hrm_requests", {
        employeeId: emp.id,
        kind: "leave",
        title,
        startDate: start,
        endDate: end,
        status,
        details: JSON.stringify({ leaveTypeId: typeId, fraction, reason: title, days, paid: true, ...extra }),
        createdBy: emp.userId,
        reviewedBy: status === "Approved" ? admin.id : null,
        reviewedAt: status === "Approved" ? new Date(`${start}T09:00:00${TZ}`) : null,
      });
      if (status === "Approved")
        await c.insert(tx, "hrm_leave_ledger", {
          employeeId: emp.id,
          leaveTypeId: typeId,
          year: 2026,
          amount: -days,
          reason: "Approved leave",
          sourceKey: `leave:${r.id}`,
          createdBy: admin.id,
        });
      return r;
    };
    await leave(rahul, ids.m.sl, "2026-09-18", "2026-09-18", 1, "Approved", "Fever — sick leave");
    await leave(rahul, ids.m.cl, "2026-10-22", "2026-10-22", 0.5, "Approved", "Bank work — leaving at 2 PM", { fromTime: "14:00" });
    await leave(priya, ids.m.cl, "2026-11-06", "2026-11-06", 1, "Submitted", "Family function in Jaipur");
    await leave(priya, ids.m.pl, "2026-09-07", "2026-09-08", 1, "Approved", "Short trip — privilege leave");

    for (const date of workDays("2026-09-01", "2026-10-29")) {
      // Rahul: WFH on Wednesdays once his home location was approved.
      if (date === "2026-09-18")
        await c.insert(tx, "hrm_attendance", { employeeId: rahul.id, workDate: date, status: "Leave", source: "leave" });
      else if (date === "2026-10-22")
        await seedDay(tx, ctx, rahul, date, { status: "Half Day", endAt: 840, summary: "Half day — left at 2 PM on approved leave." });
      else
        await seedDay(tx, ctx, rahul, date, {
          wfh: date > "2026-09-25" && new Date(`${date}T00:00:00Z`).getUTCDay() === 3,
          lunchMinutes: date === "2026-10-28" ? 58 : undefined,
        });
      if (["2026-09-07", "2026-09-08"].includes(date))
        await c.insert(tx, "hrm_attendance", { employeeId: priya.id, workDate: date, status: "Leave", source: "leave" });
      else if (date === "2026-10-14") {
        const a = await c.insert(tx, "hrm_attendance", {
          employeeId: priya.id,
          workDate: date,
          status: "Absent",
          source: "automation",
          override: JSON.stringify({ auto: true, to: "Absent", at: new Date(`2026-10-15T00:05:00${TZ}`), comment: "No work report by the deadline" }),
        });
        await c.insert(tx, "hrm_alerts", {
          employeeId: priya.id,
          attendanceId: a.id,
          workDate: date,
          kind: "absent",
          title: `Priya Verma marked Absent for ${date} (no work report)`,
          openedAt: new Date(`2026-10-15T00:05:00${TZ}`),
        });
      } else {
        const r = await seedDay(tx, ctx, priya, date, {
          outside: date === "2026-10-27" ? { from: 910, minutes: 32 } : null,
          edits: date === "2026-10-29" ? 2 : 0,
        });
        if (date === "2026-10-27")
          await c.insert(tx, "hrm_alerts", {
            employeeId: priya.id,
            attendanceId: r.attendance.id,
            workDate: date,
            kind: "geofence_breach",
            status: "Resolved",
            title: "Priya Verma left Webitof HQ during office hours (412 m away)",
            details: JSON.stringify({ fence: "Webitof HQ", distance: 412, outsideMinutes: 32 }),
            openedAt: at(date, 910),
            closedAt: at(date, 942),
            explanation: "Went to the client office for a quick design walkthrough; forgot to mark client visit.",
            action: "warn",
            actionBy: admin.id,
            actionAt: at(date, 1000),
            comment: "Use 'Client visit' in the app next time.",
          });
      }
    }
    const overrun = (await tx.query("SELECT id FROM hrm_attendance WHERE employee_id=$1 AND work_date='2026-10-28'", [rahul.id])).rows[0];
    await c.insert(tx, "hrm_alerts", {
      employeeId: rahul.id,
      attendanceId: overrun.id,
      workDate: "2026-10-28",
      kind: "lunch_overrun",
      title: "Rahul Sharma took 58 min lunch (allowed 45)",
      details: JSON.stringify({ minutes: 58, allowed: 45 }),
      openedAt: at("2026-10-28", 860),
    });
    for (const p of ids.people)
      for (const [title, message] of [
        ["Welcome to the Webitof Employee app", "Clock in from office or your approved home location."],
        ["Work report for 2026-10-23 approved", "Good update quality — keep the slot reports specific."],
      ])
        await c.insert(tx, "notifications", {
          recipientType: "user",
          userId: p.userId,
          moduleName: "hrm",
          eventKey: "hr_update",
          entityType: "hrm",
          entityId: p.id,
          title,
          message,
          routePath: "/app/hrm",
          channels: JSON.stringify(["inApp"]),
        });
  });

  // September payroll through the payroll engine, then approved for payslips.
  const run = await require("../services/hrm/payroll").draft(adminUser, {
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    employeeIds: ids.people.map((p) => p.id),
  });
  await pool.query(
    "UPDATE hrm_payroll_runs SET status='Approved',approved_by=$2,approved_at=now() WHERE id=$1",
    [run.id || run.run?.id, admin.id],
  );
  console.log("HRM demo seeded:");
  console.log("  Admin (web):  existing admin user");
  console.log("  Employee app: WBT-EMP-001 / 123456  (Rahul Sharma, Full Stack Developer)");
  console.log("                WBT-EMP-002 / 123456  (Priya Verma, UI/UX Designer)");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(closePool);
