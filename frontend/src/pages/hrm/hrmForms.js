const f = (name, title, type = "text", extra = {}) => ({
  name,
  title,
  type,
  ...extra,
});
const employee = f("employeeId", "Employee", "lookup", {
  lookup: "employees",
  required: true,
});
const dates = [
  f("startDate", "Start date", "date", { required: true }),
  f("endDate", "End / due date", "date"),
];
export const employeeFields = [
  f("userId", "Existing ERP login", "lookup", {
    lookup: "users",
    section: "Identity",
  }),
  f("fullName", "Full name", "text", { required: true, section: "Identity" }),
  f("companyEmail", "Company email", "email", { section: "Identity" }),
  f("phone", "Mobile", "text", { section: "Identity" }),
  ...[
    ["departmentId", "Department", "department"],
    ["designationId", "Designation", "designation"],
    ["teamId", "Team", "team"],
    ["employmentTypeId", "Employment type", "employment_type"],
    ["locationId", "Office location", "location"],
    ["shiftId", "Shift", "shift"],
  ].map(([name, title, master]) =>
    f(name, title, "master", { master, section: "Employment" }),
  ),
  f("managerId", "Reporting manager", "lookup", {
    lookup: "employees",
    section: "Employment",
  }),
  f("workMode", "Work mode", "select", {
    options: ["Office", "Remote", "Hybrid"],
    section: "Employment",
  }),
  f("status", "Employment status", "select", {
    options: [
      "Draft",
      "Upcoming Joining",
      "Active",
      "Probation",
      "Confirmed",
      "Notice Period",
      "Suspended",
      "Relieved",
      "Terminated",
      "Inactive",
    ],
    section: "Dates",
  }),
  f("joiningDate", "Joining date", "date", {
    required: true,
    section: "Dates",
  }),
  f("probationEnd", "Probation end", "date", { section: "Dates" }),
  f("contractEnd", "Contract end", "date", { section: "Dates" }),
  f("exitDate", "Last working date", "date", { section: "Dates" }),
  f("effectiveDate", "Change effective date", "date", { section: "Dates" }),
  f("reason", "Reason / employment change", "textarea", { section: "Dates" }),
];
export const forms = {
  "attendance-mark": {
    title: "Attendance decision",
    endpoint: "/attendance/mark",
    permission: "hr_approve",
    fields: [
      employee,
      f("workDate", "Date", "date", { required: true }),
      f("status", "Attendance status", "select", {
        options: [
          "Absent",
          "Holiday",
          "Week Off",
          "Comp Off",
          "Business Visit",
          "Half Day",
          "WFH",
          "Present",
        ],
        required: true,
      }),
      f("reason", "Reason", "textarea", { required: true }),
    ],
  },
  employees: {
    title: "Employee",
    endpoint: "/employees",
    permission: "manage_employees",
    fields: employeeFields,
  },
  leave: {
    title: "Leave request",
    endpoint: "/requests",
    permission: "self_service",
    defaults: { kind: "leave" },
    fields: [
      employee,
      f("title", "Request title", "text", { required: true }),
      ...dates,
      f("details.leaveTypeId", "Leave type", "master", {
        master: "leave_type",
        required: true,
      }),
      f("details.fraction", "Day fraction", "select", {
        options: [
          { value: 1, label: "Full day" },
          { value: 0.5, label: "Half day" },
        ],
      }),
      f("details.reason", "Reason", "textarea", { required: true }),
      f("details.documentId", "Attachment", "lookup", { lookup: "documents" }),
    ],
  },
  regularization: {
    title: "Attendance regularization",
    endpoint: "/requests",
    permission: "self_service",
    defaults: { kind: "regularization" },
    fields: [
      employee,
      f("title", "Request title", "text", { required: true }),
      ...dates,
      f("details.checkIn", "Correct check in", "datetime-local", {
        required: true,
      }),
      f("details.checkOut", "Correct check out", "datetime-local", {
        required: true,
      }),
      f("details.breakMinutes", "Break minutes", "number", { min: 0 }),
      f("details.status", "Attendance status", "select", {
        options: ["Present", "WFH", "Half Day", "Business Visit"],
      }),
      f("details.reason", "Reason", "textarea", { required: true }),
    ],
  },
  reimbursement: {
    title: "Reimbursement",
    endpoint: "/requests",
    permission: "self_service",
    defaults: { kind: "reimbursement" },
    fields: [
      employee,
      f("title", "Expense title", "text", { required: true }),
      f("startDate", "Expense date", "date", { required: true }),
      f("details.amount", "Amount", "number", { min: 0.01, required: true }),
      f("details.categoryId", "Expense category", "master", {
        master: "expense_category",
        required: true,
      }),
      f("details.projectId", "Project", "lookup", { lookup: "projects" }),
      f("details.documentId", "Receipt", "lookup", {
        lookup: "documents",
        required: true,
      }),
      f("details.reason", "Description", "textarea", { required: true }),
    ],
  },
  resignation: {
    title: "Resignation",
    endpoint: "/requests",
    permission: "self_service",
    defaults: { kind: "resignation" },
    fields: [
      employee,
      f("title", "Title", "text", { required: true }),
      f("startDate", "Resignation date", "date", { required: true }),
      f("details.lastWorkingDate", "Proposed last working date", "date", {
        required: true,
      }),
      f("details.reason", "Reason", "textarea", { required: true }),
    ],
  },
  helpdesk: {
    title: "HR request",
    endpoint: "/requests",
    permission: "self_service",
    defaults: { kind: "helpdesk" },
    fields: [
      employee,
      f("title", "Subject", "text", { required: true }),
      f("startDate", "Date", "date", { required: true }),
      f("details.category", "Category", "select", {
        options: [
          "Attendance",
          "Salary",
          "HR letter",
          "Asset issue",
          "Leave",
          "Reimbursement",
          "HR concern",
          "Other",
        ],
      }),
      f("details.reason", "Description", "textarea", { required: true }),
    ],
  },
  timesheets: {
    title: "Timesheet",
    endpoint: "/timesheets",
    permission: "self_service",
    fields: [employee, ...dates],
  },
  allocations: {
    title: "Project allocation",
    endpoint: "/allocations",
    permission: "manage_allocations",
    fields: [
      employee,
      f("projectId", "Project", "lookup", {
        lookup: "projects",
        required: true,
      }),
      f("role", "Project role", "text", { required: true }),
      f("percent", "Allocation (%)", "number", {
        min: 0.01,
        max: 100,
        required: true,
      }),
      ...dates,
      f("plannedHours", "Planned hours", "number", { min: 0 }),
      f("billable", "Billable", "checkbox"),
      f("billingRate", "Hourly billing rate", "number", {
        permission: "view_salary",
      }),
    ],
  },
  "salary-history": {
    title: "Salary revision",
    endpoint: "/salary-history",
    permission: "manage_salary",
    fields: [
      employee,
      f("effectiveDate", "Effective date", "date", { required: true }),
      f("monthlyCost", "Monthly employer cost", "number", {
        required: true,
        min: 0,
      }),
      f("currency", "Currency", "text", { required: true }),
      f("reason", "Reason", "textarea", { required: true }),
    ],
  },
  holidays: {
    title: "Holiday",
    endpoint: "/holidays",
    permission: "manage_settings",
    fields: [
      f("name", "Holiday name", "text", { required: true }),
      f("workDate", "Date", "date", { required: true }),
      f("locationId", "Office location", "master", { master: "location" }),
      f("optional", "Optional holiday", "checkbox"),
    ],
  },
  "leave-grant": {
    title: "Leave allocation / adjustment",
    endpoint: "/leave-grants",
    permission: "hr_approve",
    fields: [
      employee,
      f("leaveTypeId", "Leave type", "master", {
        master: "leave_type",
        required: true,
      }),
      f("year", "Calendar year", "number", { required: true }),
      f("amount", "Days (+ grant / − adjustment)", "number", {
        required: true,
        min: -366,
        max: 366,
      }),
      f("reason", "Reason", "textarea", { required: true }),
    ],
  },
};
export function recordForm(kind, metadata) {
  const m = metadata.records[kind];
  return m
    ? {
        title: m.label,
        endpoint: `/records/${kind}`,
        permission: m.permission,
        self: m.self,
        defaults: { status: m.statuses[0] },
        fields: [
          { ...employee, required: !m.global },
          f("title", "Title", "text", { required: true }),
          f("status", "Status", "select", { options: m.statuses }),
          ...dates.map((x) => ({ ...x, required: false })),
          ...(kind === "candidate" || kind === "interview"
            ? [
                f(
                  "parentId",
                  kind === "candidate" ? "Job opening" : "Candidate",
                  "lookup",
                  { lookup: "records" },
                ),
              ]
            : []),
          ...m.fields.map((x) => ({
            ...x,
            name: `details.${x.key}`,
            title: x.label,
            master: x.masterType,
          })),
        ],
      }
    : null;
}
