import { useState } from "react";
import { toast } from "sonner";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { Field, DetailValues } from "./HrmShared";
import { hrm, label } from "./hrmApi";
const masterFields = {
  department: [["shiftId", "Default shift", "shift"]],
  designation: [],
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
  letter_template: [["content", "Letter template", "textarea"]],
  kpi_template: [["factors", "KPI factors (one per line)", "lines"]],
  salary_structure: [],
};
export function HrmSettings({ token, metadata, masters, can, onReload }) {
  const [tab, setTab] = useState("policy"),
    [policy, setPolicy] = useState(metadata.policy),
    [masterType, setMasterType] = useState("department"),
    [record, setRecord] = useState({ name: "", isActive: true, payload: {} }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const allowed = can("manage_settings");
  const save = async (path, body) => {
    setBusy(true);
    setError("");
    try {
      await hrm(token, path, {
        method: path === "/policy" || record.id ? "PUT" : "POST",
        body,
      });
      toast.success("HR configuration saved");
      onReload();
      if (path !== "/policy")
        setRecord({ name: "", isActive: true, payload: {} });
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
                                  k === "shiftEnd"
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
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="space-y-4 p-5">
            <Field
              name="masterType"
              title="Master type"
              type="select"
              options={metadata.masterTypes.map((t) => ({
                value: t,
                label: label(t),
              }))}
              value={masterType}
              onChange={(v) => {
                setMasterType(v);
                setRecord({ name: "", isActive: true, payload: {} });
              }}
            />
            <div className="space-y-2">
              {masters
                .filter((m) => m.type === `hrm_${masterType}`)
                .map((m) => (
                  <button
                    key={m.id}
                    className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] p-3 text-left text-sm hover:bg-[var(--hover-bg)]"
                    onClick={() => setRecord(m)}
                  >
                    <span>{m.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {m.isActive ? "Active" : "Inactive"}
                    </span>
                  </button>
                ))}
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                setRecord({ name: "", isActive: true, payload: {} })
              }
            >
              New {label(masterType)}
            </Button>
          </Card>
          <Card className="p-5">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save(
                  `/masters/${masterType}${record.id ? `/${record.id}` : ""}`,
                  {
                    name: record.name,
                    isActive: record.isActive,
                    payload: record.payload,
                  },
                );
              }}
            >
              <h2 className="font-semibold">
                {record.id ? "Edit" : "Create"} {label(masterType)}
              </h2>
              <Field
                name="masterName"
                title="Name"
                value={record.name}
                required
                onChange={(v) => setRecord((r) => ({ ...r, name: v }))}
              />
              <Field
                name="masterActive"
                title="Active"
                type="checkbox"
                value={record.isActive}
                onChange={(v) => setRecord((r) => ({ ...r, isActive: v }))}
              />
              {(masterFields[masterType] || []).map(([key, title, type]) =>
                type === "days" ? (
                  <DayPicker
                    key={key}
                    name={key}
                    value={record.payload[key] || []}
                    onChange={(v) =>
                      setRecord((r) => ({
                        ...r,
                        payload: { ...r.payload, [key]: v },
                      }))
                    }
                  />
                ) : (
                  <Field
                    key={key}
                    name={`master${key}`}
                    title={title}
                    type={
                      type === "lines"
                        ? "textarea"
                        : ["shift", "department", "accrual"].includes(type)
                          ? "select"
                          : type
                    }
                    options={
                      type === "accrual"
                        ? ["yearly", "monthly"]
                        : masters
                            .filter((m) => m.type === `hrm_${type}`)
                            .map((m) => ({ value: m.id, label: m.name }))
                    }
                    value={
                      type === "lines"
                        ? (record.payload[key] || []).join("\n")
                        : record.payload[key]
                    }
                    onChange={(v) =>
                      setRecord((r) => ({
                        ...r,
                        payload: {
                          ...r.payload,
                          [key]:
                            type === "lines"
                              ? v.split("\n").filter(Boolean)
                              : type === "number"
                                ? Number(v)
                                : v,
                        },
                      }))
                    }
                  />
                ),
              )}
              {masterType === "letter_template" && (
                <p className="text-xs text-[var(--text-muted)]">
                  Placeholders:{" "}
                  {
                    "{{employee_name}}, {{employee_id}}, {{designation}}, {{department}}, {{joining_date}}, {{company_name}}, {{last_working_date}}, {{salary}}"
                  }
                  . Salary letters require compensation access.
                </p>
              )}
              <Button type="submit" loading={busy}>
                Save master
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
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
