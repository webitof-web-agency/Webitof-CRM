import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Field, Status, DetailValues, ActionDialog } from "./HrmShared";
import { hrm, label, localDay } from "./hrmApi";
import { HrmCollection, exportPdf } from "./HrmCollection";
import { HrmDashboard } from "./HrmDashboard";
import { HrmSettings } from "./HrmSettings";
import { HrmForm } from "./HrmForm";
import { forms } from "./hrmForms";
const sections = [
  ["overview", "Overview"],
  ["employees", "Employees"],
  ["attendance", "Attendance"],
  ["leave", "Leave"],
  ["holidays", "Holidays"],
  ["work-reports", "Work reports"],
  ["timesheets", "Timesheets"],
  ["allocations", "Resource allocation"],
  ["analytics", "Employee analytics"],
  ["reimbursement", "Reimbursements"],
  ["payroll", "Payroll"],
  ["salary-history", "Compensation", "view_salary"],
  ["job", "Job openings", "recruitment"],
  ["candidate", "Candidates", "recruitment"],
  ["interview", "Interviews", "recruitment"],
  ["onboarding", "Onboarding"],
  ["goal", "Goals / OKRs"],
  ["review", "Performance"],
  ["skill", "Skills"],
  ["asset", "Assets", "assets"],
  ["documents", "Documents"],
  ["resignation", "Resignations"],
  ["offboarding", "Offboarding"],
  ["helpdesk", "HR helpdesk"],
  ["regularization", "Regularization"],
  ["payroll_adjustment", "Payroll adjustments", "payroll"],
  ["audit", "Activity history", "audit"],
  ["settings", "Policies & organization"],
];
export function HrmPage() {
  const { token, user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const path = params["*"] || "overview";
  const [kind, id] = path.split("/");
  const [metadata, setMetadata] = useState(null),
    [masters, setMasters] = useState([]),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const can = useCallback(
    (action) => hasPermission(`hrm.${action}`),
    [hasPermission],
  );
  const reload = useCallback(() => setRefresh((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    Promise.all([hrm(token, "/meta"), hrm(token, "/lookups?type=masters")])
      .then(([meta, m]) => {
        if (active) {
          setMetadata(meta);
          setMasters(m.rows);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [token, refresh]);
  if (error)
    return (
      <Card className="p-6">
        <h1 className="text-xl font-semibold">HRM is unavailable</h1>
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {error}
        </p>
        <Button className="mt-4" onClick={reload}>
          Retry
        </Button>
      </Card>
    );
  if (!metadata)
    return (
      <div className="space-y-4" aria-label="Loading HRM">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="h-28 animate-pulse bg-[var(--surface-2)]" />
        ))}
      </div>
    );
  const props = { token, metadata, masters, can };
  const available = sections.filter(
    ([, , permission]) => !permission || can(permission),
  );
  return (
    <div className="space-y-6">
      {kind === "employees" && id ? (
        <EmployeeProfile {...props} id={id} />
      ) : ["overview", "analytics"].includes(kind) ? (
        <HrmDashboard {...props} analytics={kind === "analytics"} />
      ) : kind === "settings" ? (
        <HrmSettings {...props} onReload={reload} />
      ) : available.some(([key]) => key === kind) ? (
        <HrmCollection key={kind} {...props} kind={kind} />
      ) : (
        <Card className="p-5">
          This HR workspace is unavailable for your role.
        </Card>
      )}
    </div>
  );
}
function EmployeeProfile({ id, token, metadata, masters, can }) {
  const [employee, setEmployee] = useState(null),
    [tab, setTab] = useState("overview"),
    [edit, setEdit] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [letter, setLetter] = useState(null),
    [template, setTemplate] = useState(""),
    [action, setAction] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    hrm(token, `/employees/${id}`)
      .then((r) => active && setEmployee(r))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id, token, refresh]);
  if (error)
    return (
      <p role="alert" className="text-rose-600">
        {error}
      </p>
    );
  if (!employee) return <Card className="h-40 animate-pulse" />;
  const tabs = [
    "overview",
    "attendance",
    "work-reports",
    "timesheets",
    "allocations",
    "tasks",
    "review",
    "goal",
    "leave",
    "leave-balances",
    "payroll",
    "reimbursement",
    "documents",
    "asset",
    "skill",
    "onboarding",
    "offboarding",
    "history",
    ...(can("audit") ? ["audit"] : []),
    ...(can("view_salary") ? ["salary-history"] : []),
    ...(can("view_private") ? ["private"] : []),
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={employee.employeeNumber}
        title={employee.fullName}
        description={[
          masters.find((m) => m.id === employee.designationId)?.name,
          masters.find((m) => m.id === employee.departmentId)?.name,
          employee.companyEmail,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        <Status value={employee.status} />
        {can("manage_employees") && (
          <Button onClick={() => setEdit(true)}>Edit employee</Button>
        )}
        {employee.status === "Notice Period" && can("hr_approve") && (
          <Button
            variant="secondary"
            onClick={() =>
              setAction({
                title: "Complete offboarding",
                description:
                  "The exit checklist and asset returns must be complete. This marks the employee as relieved and revokes the linked ERP login.",
              })
            }
          >
            Complete exit
          </Button>
        )}
      </PageHeader>
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4 text-sm">
          <span className="block text-xs text-[var(--text-muted)]">
            Employment
          </span>
          <p className="mt-1">
            Joined {employee.joiningDate} · {employee.workMode}
          </p>
        </Card>
        <Card className="p-4 text-sm">
          <span className="block text-xs text-[var(--text-muted)]">
            Company contact
          </span>
          <p className="mt-1">{employee.companyEmail || "Email not set"}</p>
          <p>{employee.phone || "Phone not set"}</p>
        </Card>
        <Card className="p-4">
          <Field
            name="profileTab"
            title="Employee profile section"
            type="select"
            options={tabs.map((value) => ({
              value,
              label: label(value.replace(/-/g, " ")),
            }))}
            value={tab}
            onChange={setTab}
          />
        </Card>
      </div>
      {tab === "overview" ? (
        <HrmDashboard
          token={token}
          metadata={metadata}
          masters={masters}
          can={can}
          analytics
          employeeId={id}
        />
      ) : tab === "private" ? (
        <PrivateProfile token={token} id={id} can={can} />
      ) : tab === "tasks" ? (
        <ProfileData
          token={token}
          path={`/tasks?employeeId=${id}`}
          title="Assigned ERP tasks"
        />
      ) : tab === "leave-balances" ? (
        <ProfileData
          token={token}
          path={`/employees/${id}/leave-balances?year=${localDay(metadata.policy.timezone).slice(0, 4)}`}
          title="Leave balances"
        />
      ) : (
        <HrmCollection
          key={tab}
          token={token}
          metadata={metadata}
          masters={masters}
          can={can}
          kind={tab}
          employeeId={id}
        />
      )}
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">HR letters</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-60">
            <Field
              name="letterTemplate"
              title="Letter template"
              type="select"
              options={masters
                .filter((m) => m.type === "hrm_letter_template")
                .map((m) => ({ value: m.id, label: m.name }))}
              value={template}
              onChange={setTemplate}
            />
          </div>
          <Button
            disabled={!template}
            onClick={() =>
              hrm(
                token,
                `/employees/${id}/letter?templateId=${encodeURIComponent(template)}`,
              )
                .then(setLetter)
                .catch((e) => toast.error(e.message))
            }
          >
            Generate letter
          </Button>
        </div>
      </Card>
      {edit && (
        <HrmForm
          token={token}
          metadata={metadata}
          masters={masters}
          employeeId={id}
          initial={employee}
          config={forms.employees}
          can={can}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            setRefresh((n) => n + 1);
          }}
        />
      )}
      {letter && (
        <Modal open title={letter.title} onClose={() => setLetter(null)}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {letter.content}
          </p>
          <Button
            className="mt-4"
            onClick={() => exportPdf(letter.title, { content: letter.content })}
          >
            Download PDF
          </Button>
        </Modal>
      )}
      {action && (
        <ActionDialog
          action={action}
          busy={busy}
          onClose={() => setAction(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await hrm(token, `/employees/${id}/offboard`, {
                method: "POST",
                body: {},
              });
              setAction(null);
              setRefresh((n) => n + 1);
              toast.success("Offboarding completed");
            } catch (e) {
              toast.error(e.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}
function ProfileData({ token, path, title }) {
  const [rows, setRows] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    hrm(token, path)
      .then((r) => active && setRows(r))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [token, path]);
  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-semibold">{title}</h2>
      {error ? (
        <p role="alert" className="text-rose-600">
          {error}
        </p>
      ) : rows ? (
        rows.length ? (
          rows.map((r, i) => (
            <div
              key={r.id || i}
              className="rounded-lg border border-[var(--border)] p-3"
            >
              <DetailValues data={r} />
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No records yet.</p>
        )
      ) : (
        <p>Loading…</p>
      )}
    </Card>
  );
}
function PrivateProfile({ token, id, can }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    hrm(token, `/employees/${id}/private`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token, id]);
  if (error)
    return (
      <p role="alert" className="text-rose-600">
        {error}
      </p>
    );
  if (!data) return <p>Loading private profile…</p>;
  const fields = [
    "personalEmail",
    "alternateMobile",
    "dob",
    "gender",
    "bloodGroup",
    "maritalStatus",
    "currentAddress",
    "permanentAddress",
    "emergencyContact",
    "noticePeriodDays",
    "probationStart",
    "confirmationDate",
  ];
  const financial = [
    "bankName",
    "accountNumber",
    "ifsc",
    "pan",
    "uan",
    "pfApplicable",
    "esiApplicable",
  ];
  return (
    <Card className="p-5">
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await hrm(token, `/employees/${id}/private`, {
              method: "PUT",
              body: {
                profile: data.profile,
                ...(can("manage_salary") ? { financial: data.financial } : {}),
              },
            });
            toast.success("Private profile saved");
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="font-semibold">Private employee information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((k) => (
            <Field
              key={k}
              name={k}
              title={label(k)}
              type={
                ["dob", "probationStart", "confirmationDate"].includes(k)
                  ? "date"
                  : "text"
              }
              value={data.profile?.[k]}
              disabled={!can("manage_private")}
              onChange={(v) =>
                setData((d) => ({ ...d, profile: { ...d.profile, [k]: v } }))
              }
            />
          ))}
        </div>
        {can("view_salary") && (
          <>
            <h2 className="font-semibold">Bank & statutory information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {financial.map((k) => (
                <Field
                  key={k}
                  name={k}
                  title={label(k)}
                  type={k.endsWith("Applicable") ? "checkbox" : "text"}
                  value={data.financial?.[k]}
                  disabled={!can("manage_salary")}
                  onChange={(v) =>
                    setData((d) => ({
                      ...d,
                      financial: { ...d.financial, [k]: v },
                    }))
                  }
                />
              ))}
            </div>
          </>
        )}
        {can("manage_private") && (
          <Button type="submit" loading={busy}>
            Save private information
          </Button>
        )}
      </form>
    </Card>
  );
}
