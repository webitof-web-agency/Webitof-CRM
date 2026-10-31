import { useState } from "react";
import { toast } from "sonner";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { Modal } from "../../components/ui/Modal";
import { Pencil, Trash2 } from "lucide-react";
import { Field, DetailValues } from "./HrmShared";
import { hrm, label } from "./hrmApi";
// Display names: "location" is the Branch used on the employee form.
const masterTypeLabels = {
  location: "Branch / office location",
  attendance_policy: "Attendance policy",
  document_type: "Employee document type",
  letter_template: "Letter / certificate template",
};
const masterFields = {
  department: [
    ["branchId", "Branch (leave empty for all branches)", "location"],
    ["shiftId", "Default shift", "shift"],
  ],
  designation: [
    ["departmentId", "Department (leave empty for all departments)", "department"],
  ],
  attendance_policy: [
    ["hoursPerDay", "Hours per day", "number"],
    ["daysPerWeek", "Days per week", "number"],
    ["geofenceRequired", "Clock-in only at approved work locations", "checkbox"],
    ["description", "Description", "textarea"],
  ],
  document_type: [
    ["defaultOnCreate", "Ask for this document on every new employee", "checkbox"],
    ["hasExpiry", "Document has an expiry date", "checkbox"],
  ],
  team: [
    ["departmentId", "Department", "department"],
    ["managerId", "Manager reference", "text"],
  ],
  location: [
    ["address", "Office address", "textarea"],
    ["timezone", "Timezone", "text"],
  ],
  employment_type: [],
  work_category: [],
  shift: [
    ["start", "Start", "time"],
    ["end", "End", "time"],
    ["graceMinutes", "Grace period (minutes)", "number"],
    ["minimumHours", "Standard hours", "number"],
    ["halfDayHours", "Half-day threshold", "number"],
    ["breakMinutes", "Standard break (minutes)", "number"],
    ["weeklyOffs", "Weekly offs", "days"],
    ["overtimeEnabled", "Overtime enabled", "checkbox"],
  ],
  leave_type: [
    ["annualDays", "Annual allocation (days)", "number"],
    ["paid", "Paid leave", "checkbox"],
    ["halfDayAllowed", "Allow half day", "checkbox"],
    [
      "sandwich",
      "Include holidays / weekly offs between leave dates",
      "checkbox",
    ],
    ["probationAllowed", "Available during probation", "checkbox"],
    ["accrual", "Allocation frequency", "accrual"],
    ["carryForward", "Carry forward", "checkbox"],
    ["carryForwardLimit", "Maximum carry forward (days)", "number"],
    ["encashmentAllowed", "Encashment allowed", "checkbox"],
  ],
  letter_template: [
    ["certificate", "Show under employee Certifications", "checkbox"],
    ["description", "Short description", "text"],
    ["content", "Letter template", "textarea"],
  ],
  kpi_template: [["factors", "KPI factors (one per line)", "lines"]],
  salary_structure: [],
};
export function HrmSettings({ token, metadata, masters, can, onReload }) {
  const [tab, setTab] = useState("policy"),
    [policy, setPolicy] = useState(metadata.policy),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const allowed = can("manage_settings");
  const save = async (path, body) => {
    setBusy(true);
    setError("");
    try {
      await hrm(token, path, { method: "PUT", body });
      toast.success("HR configuration saved");
      onReload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title="HR policies & organization"
        description="Configure company rules and reusable organization masters. All changes are audited."
      />
      <div className="flex gap-2">
        <Button
          variant={tab === "policy" ? "primary" : "secondary"}
          onClick={() => setTab("policy")}
        >
          Policies
        </Button>
        <Button
          variant={tab === "masters" ? "primary" : "secondary"}
          onClick={() => setTab("masters")}
        >
          Organization & templates
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-rose-600">
          {error}
        </p>
      )}
      {!allowed ? (
        <Card className="p-5">
          <DetailValues data={metadata.policy} />
        </Card>
      ) : tab === "policy" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save("/policy", policy);
          }}
          className="space-y-5"
        >
          {[
            [
              "Work schedule",
              [
                "timezone",
                "currency",
                "employeePrefix",
                "standardDailyHours",
                "weeklyOffs",
                "shiftStart",
                "shiftEnd",
                "graceMinutes",
                "halfDayHours",
              ],
            ],
            [
              "Daily work reports",
              [
                "reportMandatory",
                "minimumReportHours",
                "reportDeadline",
                "allowBackdatedReports",
                "maxBackdateDays",
                "requireReportApproval",
                "requireProject",
                "requireTask",
                "requireDescription",
                "requireEvidence",
                "maxReportHours",
              ],
            ],
            [
              "Location-verified attendance (employee app)",
              [
                "geofenceRequired",
                "allowWebAttendance",
                "maxGpsAccuracyMeters",
                "gpsToleranceMeters",
                "defaultOfficeRadiusMeters",
                "defaultHomeRadiusMeters",
                "pingIntervalMinutes",
                "offlineAfterMinutes",
              ],
            ],
            [
              "Hourly work reports & lunch",
              [
                "reportIntervalMinutes",
                "slotGraceMinutes",
                "minSlotReportChars",
                "lunchWindowStart",
                "lunchWindowEnd",
                "lunchMaxMinutes",
                "absentIfNoReport",
              ],
            ],
            [
              "Approval & capacity",
              [
                "requireHrLeaveApproval",
                "requireHrRegularizationApproval",
                "probationLeaveAllowed",
                "underUtilization",
                "highUtilization",
                "overloadUtilization",
                "allowOverAllocation",
              ],
            ],
            [
              "Lifecycle & automation",
              [
                "onboardingChecklist",
                "offboardingChecklist",
                "automationEnabled",
                "reminderDays",
              ],
            ],
          ].map(([title, keys]) => (
            <Card key={title} className="space-y-4 p-5">
              <h2 className="font-semibold">{title}</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {keys.map((k) =>
                  k === "weeklyOffs" ? (
                    <DayPicker
                      key={k}
                      name={k}
                      value={policy[k]}
                      onChange={(v) => setPolicy((p) => ({ ...p, [k]: v }))}
                    />
                  ) : (
                    <Field
                      key={k}
                      name={k}
                      title={label(k)}
                      type={
                        Array.isArray(policy[k])
                          ? "textarea"
                          : typeof policy[k] === "boolean"
                            ? "checkbox"
                            : typeof policy[k] === "number"
                              ? "number"
                              : k.toLowerCase().includes("deadline") ||
                                  k === "shiftStart" ||
                                  k === "shiftEnd" ||
                                  k.startsWith("lunchWindow")
                                ? "time"
                                : "text"
                      }
                      value={
                        Array.isArray(policy[k])
                          ? policy[k].join("\n")
                          : policy[k]
                      }
                      onChange={(v) =>
                        setPolicy((p) => ({
                          ...p,
                          [k]: Array.isArray(p[k])
                            ? v.split("\n").filter(Boolean)
                            : typeof p[k] === "number"
                              ? Number(v)
                              : v,
                        }))
                      }
                      help={
                        k === "automationEnabled"
                          ? "Also requires the HR scheduler to be enabled on the server."
                          : Array.isArray(policy[k])
                            ? "One checklist item per line."
                            : undefined
                      }
                    />
                  ),
                )}
              </div>
            </Card>
          ))}
          <Button type="submit" loading={busy}>
            Save policies
          </Button>
        </form>
      ) : (
        <MastersBoard
          token={token}
          masters={masters}
          masterTypes={metadata.masterTypes}
          onReload={onReload}
        />
      )}
    </div>
  );
}
// What each master is for, in the order HR usually sets them up.
const masterTypeInfo = {
  location: ["Branches", "Offices / branches for the employee form and work locations"],
  department: ["Departments", "Optionally tied to a branch"],
  designation: ["Designations", "Optionally tied to a department"],
  team: ["Teams", "Groups inside a department"],
  employment_type: ["Employment types", "Full-time, part-time, contract, intern…"],
  shift: ["Shifts", "Timings, grace period and weekly offs"],
  attendance_policy: ["Attendance policies", "Hours per day and days per week"],
  document_type: ["Document types", "Asked for on the employee form"],
  leave_type: ["Leave types", "Allocation, carry forward and rules"],
  work_category: ["Work categories", "Used in work reports"],
  salary_structure: ["Salary structures", "Compensation components"],
  kpi_template: ["KPI templates", "Performance review factors"],
  letter_template: ["Letters & certificates", "Joining letter, experience certificate, NOC…"],
};
const masterOrder = Object.keys(masterTypeInfo);
const blankRecord = { name: "", isActive: true, payload: {} };

async function deleteMaster(token, type, master) {
  if (!window.confirm(`Delete "${master.name}"? If it is already used, mark it inactive instead.`))
    return false;
  try {
    await hrm(token, `/masters/${type}/${master.id}`, { method: "DELETE" });
    toast.success(`"${master.name}" deleted`);
    return true;
  } catch (e) {
    toast.error(e.message);
    return false;
  }
}

function MastersBoard({ token, masters, masterTypes, onReload }) {
  const [editing, setEditing] = useState(null),
    [search, setSearch] = useState("");
  const types = [
    ...masterOrder.filter((t) => masterTypes.includes(t)),
    ...masterTypes.filter((t) => !masterOrder.includes(t)),
  ];
  const needle = search.trim().toLowerCase();
  const nameOf = (id) => masters.find((m) => m.id === id)?.name;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)]">
          {types.length} lists · click an item to edit, or + to add.
        </p>
        <div className="w-full sm:w-72">
          <Field
            name="masterSearch"
            title="Search masters"
            value={search}
            onChange={setSearch}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {types.map((type) => {
          const all = masters.filter((m) => m.type === `hrm_${type}`);
          const items = needle
            ? all.filter((m) => m.name.toLowerCase().includes(needle))
            : all;
          if (needle && !items.length) return null;
          const [title, hint] = masterTypeInfo[type] || [masterTypeLabels[type] || label(type), ""];
          return (
            <Card key={type} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    {title}
                    <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                      {all.length}
                    </span>
                  </h3>
                  {hint && (
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={`Add ${title}`}
                  onClick={() => setEditing({ type, record: blankRecord })}
                >
                  + Add
                </Button>
              </div>
              <ul className="mt-3 max-h-48 space-y-0.5 overflow-y-auto">
                {items.length ? (
                  items.map((m) => {
                    const parent =
                      nameOf(m.payload?.branchId) || nameOf(m.payload?.departmentId);
                    return (
                      <li
                        key={m.id}
                        className="group flex items-center gap-1 rounded-lg pr-1 hover:bg-[var(--surface-2)]"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2 py-1.5 text-left text-sm"
                          onClick={() =>
                            setEditing({
                              type,
                              record: { ...m, payload: m.payload || {} },
                            })
                          }
                        >
                          <span className={`truncate ${m.isActive === false ? "text-[var(--text-muted)] line-through" : ""}`}>
                            {m.name}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                            {parent && <span className="max-w-28 truncate">{parent}</span>}
                            {m.isActive === false && (
                              <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-600">
                                Inactive
                              </span>
                            )}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${m.name}`}
                          title="Edit"
                          className="rounded-md p-1 text-[var(--text-muted)] opacity-60 hover:bg-[var(--surface)] hover:text-[var(--text-main)] group-hover:opacity-100"
                          onClick={() =>
                            setEditing({
                              type,
                              record: { ...m, payload: m.payload || {} },
                            })
                          }
                        >
                          <Pencil size={13} />
                        </button>
                        {!m.payload?.system && (
                          <button
                            type="button"
                            aria-label={`Delete ${m.name}`}
                            title="Delete"
                            className="rounded-md p-1 text-[var(--text-muted)] opacity-60 hover:bg-rose-500/10 hover:text-rose-600 group-hover:opacity-100"
                            onClick={async () => {
                              if (await deleteMaster(token, type, m)) onReload();
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </li>
                    );
                  })
                ) : (
                  <li className="px-2 py-1.5 text-xs text-[var(--text-muted)]">None yet</li>
                )}
              </ul>
            </Card>
          );
        })}
      </div>
      {editing && (
        <MasterEditor
          token={token}
          masters={masters}
          type={editing.type}
          initial={editing.record}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onReload();
          }}
        />
      )}
    </div>
  );
}

function MasterEditor({ token, masters, type, initial, onClose, onSaved }) {
  const [record, setRecord] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const title = masterTypeInfo[type]?.[0] || masterTypeLabels[type] || label(type);
  const setPayload = (key, value) =>
    setRecord((r) => ({ ...r, payload: { ...r.payload, [key]: value } }));
  return (
    <Modal
      open
      title={`${record.id ? "Edit" : "New"} — ${title}`}
      onClose={busy ? () => {} : onClose}
      width="min(620px,95vw)"
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await hrm(token, `/masters/${type}${record.id ? `/${record.id}` : ""}`, {
              method: record.id ? "PUT" : "POST",
              body: { name: record.name, isActive: record.isActive, payload: record.payload },
            });
            toast.success(`${title} saved`);
            onSaved();
          } catch (e2) {
            setError(e2.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            {error}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field
            name="masterName"
            title="Name"
            value={record.name}
            required
            onChange={(v) => setRecord((r) => ({ ...r, name: v }))}
          />
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--primary)]"
              checked={record.isActive !== false}
              onChange={(e) => setRecord((r) => ({ ...r, isActive: e.target.checked }))}
            />
            Active
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(masterFields[type] || []).map(([key, fieldTitle, fieldType]) => {
            const wide = ["textarea", "lines", "days"].includes(fieldType);
            if (fieldType === "days")
              return (
                <div key={key} className="sm:col-span-2">
                  <DayPicker
                    name={key}
                    value={record.payload[key] || []}
                    onChange={(v) => setPayload(key, v)}
                  />
                </div>
              );
            if (fieldType === "checkbox")
              return (
                <label key={key} className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--primary)]"
                    checked={Boolean(record.payload[key])}
                    onChange={(e) => setPayload(key, e.target.checked)}
                  />
                  {fieldTitle}
                </label>
              );
            const isSelect = ["shift", "department", "location", "accrual"].includes(fieldType);
            return (
              <div key={key} className={wide ? "sm:col-span-2" : ""}>
                <Field
                  name={`master${key}`}
                  title={fieldTitle}
                  type={fieldType === "lines" ? "textarea" : isSelect ? "select" : fieldType}
                  options={
                    fieldType === "accrual"
                      ? ["yearly", "monthly"]
                      : masters
                          .filter((m) => m.type === `hrm_${fieldType}` && m.id !== record.id)
                          .map((m) => ({ value: m.id, label: m.name }))
                  }
                  value={
                    fieldType === "lines"
                      ? (record.payload[key] || []).join("\n")
                      : record.payload[key]
                  }
                  onChange={(v) =>
                    setPayload(
                      key,
                      fieldType === "lines"
                        ? v.split("\n").filter(Boolean)
                        : fieldType === "number"
                          ? v === ""
                            ? undefined
                            : Number(v)
                          : v,
                    )
                  }
                />
              </div>
            );
          })}
        </div>
        {type === "letter_template" && (
          <p className="text-xs text-[var(--text-muted)]">
            Placeholders:{" "}
            {"{{employee_name}}, {{employee_id}}, {{designation}}, {{department}}, {{joining_date}}, {{company_name}}, {{last_working_date}}, {{salary}}"}
            . Salary letters need compensation access.
          </p>
        )}
        <div className="flex items-center gap-2 border-t border-[var(--border)] pt-4">
          {record.id && !record.payload?.system && (
            <Button
              type="button"
              variant="ghost"
              className="text-rose-600"
              disabled={busy}
              onClick={async () => {
                if (await deleteMaster(token, type, record)) onSaved();
              }}
            >
              <Trash2 size={15} /> Delete
            </Button>
          )}
          <span className="flex-1" />
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DayPicker({ name, value, onChange }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold">Weekly offs</legend>
      <div className="flex flex-wrap gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
          <label key={day} className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={value.includes(i)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, i]
                    : value.filter((x) => x !== i),
                )
              }
            />
            {day}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
