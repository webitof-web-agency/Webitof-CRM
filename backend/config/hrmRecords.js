const field = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  ...extra,
});
const RECORDS = {
  job: {
    label: "Job openings",
    permission: "recruitment",
    global: true,
    statuses: ["Draft", "Open", "On Hold", "Closed"],
    fields: [
      field("departmentId", "Department", "master", {
        masterType: "department",
      }),
      field("openings", "Open positions", "number", { min: 1 }),
      field("description", "Job description", "textarea"),
      field("requirements", "Requirements", "textarea"),
    ],
  },
  candidate: {
    label: "Candidates",
    permission: "recruitment",
    global: true,
    statuses: [
      "Applicant",
      "Screening",
      "Technical",
      "HR",
      "Selected",
      "Offer",
      "Joined",
      "Rejected",
    ],
    fields: [
      field("email", "Email", "email", { required: true }),
      field("phone", "Phone"),
      field("source", "Source"),
      field("notes", "Notes", "textarea"),
    ],
  },
  interview: {
    label: "Interviews",
    permission: "recruitment",
    global: true,
    statuses: ["Scheduled", "Completed", "Cancelled"],
    fields: [
      field("interviewer", "Interviewer"),
      field("scheduledAt", "Interview time", "datetime-local"),
      field("feedback", "Feedback", "textarea"),
      field("score", "Score (0–5)", "number", { min: 0, max: 5 }),
    ],
  },
  onboarding: {
    label: "Onboarding",
    permission: "manage_employees",
    statuses: ["Pending", "In Progress", "Done"],
    fields: [field("notes", "Notes", "textarea")],
  },
  offboarding: {
    label: "Offboarding",
    permission: "manage_employees",
    statuses: ["Pending", "In Progress", "Done"],
    fields: [field("notes", "Notes", "textarea")],
  },
  goal: {
    label: "Goals / OKRs",
    permission: "performance",
    self: true,
    statuses: ["Planned", "In Progress", "Completed", "Cancelled"],
    fields: [
      field("target", "Target", "number", { min: 0 }),
      field("progress", "Progress (%)", "number", { min: 0, max: 100 }),
      field("measurement", "Measurement"),
      field("notes", "Notes", "textarea"),
    ],
  },
  review: {
    label: "Performance reviews",
    permission: "performance",
    statuses: ["Draft", "Self Review", "Manager Review", "Published"],
    fields: [
      field("cycle", "Review cycle"),
      field("quality", "Work quality (0–5)", "number", { min: 0, max: 5 }),
      field("delivery", "Delivery (0–5)", "number", { min: 0, max: 5 }),
      field("communication", "Communication (0–5)", "number", {
        min: 0,
        max: 5,
      }),
      field("teamwork", "Team contribution (0–5)", "number", {
        min: 0,
        max: 5,
      }),
      field("managerRating", "Manager rating (0–5)", "number", {
        min: 0,
        max: 5,
      }),
      field("selfAssessment", "Self assessment", "textarea"),
      field("feedback", "Manager feedback", "textarea"),
      field("kpiTemplateId", "KPI template", "master", {
        masterType: "kpi_template",
      }),
    ],
  },
  skill: {
    label: "Skills",
    permission: "performance",
    self: true,
    statuses: ["Current", "Developing", "Archived"],
    fields: [
      field("level", "Proficiency", "select", {
        options: ["Beginner", "Intermediate", "Advanced", "Expert"],
      }),
      field("years", "Experience (years)", "number", { min: 0, max: 80 }),
      field("certification", "Certification"),
      field("lastUsed", "Last used", "date"),
    ],
  },
  asset: {
    label: "Assets",
    permission: "assets",
    global: true,
    statuses: ["Stock", "Assigned", "Returned", "Repair", "Retired"],
    fields: [
      field("serialNumber", "Serial / license number"),
      field("category", "Asset category"),
      field("warrantyEnd", "Warranty end", "date"),
      field("returnDue", "Return due", "date"),
      field("notes", "Condition / notes", "textarea"),
    ],
  },
  payroll_adjustment: {
    label: "Payroll adjustments / advances",
    permission: "payroll",
    sensitive: true,
    statuses: ["Draft", "Approved", "Processed"],
    fields: [
      field("type", "Adjustment", "select", {
        options: ["earning", "deduction"],
      }),
      field("amount", "Amount", "number", { min: 0.01 }),
      field("reason", "Reason", "textarea", { required: true }),
    ],
  },
};
module.exports = { RECORDS };
