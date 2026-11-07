import { useEffect, useMemo, useState } from "react";
import { confirmAction } from '../../lib/confirm';
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  Eye,
  FileText,
  Fingerprint,
  Mail,
  Phone,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { ActionDialog, DetailValues, Status } from "./HrmShared";
import { hrm, label, localDay } from "./hrmApi";
import { HrmCollection } from "./HrmCollection";
import { HrmDashboard } from "./HrmDashboard";
import {
  PHOTO_CATEGORY,
  downloadLetter,
  hourlyRate,
  masterLists,
  money,
  openDocument,
  useDocumentImage,
} from "./employeeShared";

const MORE_TABS = [
  "overview",
  "attendance",
  "work-reports",
  "timesheets",
  "allocations",
  "tasks",
  "leave",
  "leave-balances",
  "payroll",
  "reimbursement",
  "review",
  "goal",
  "asset",
  "skill",
  "onboarding",
  "offboarding",
  "history",
];

function InfoGrid({ items }) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {items.map(([title, value]) => (
        <div key={title} className="min-w-0">
          <dt className="text-xs text-[var(--text-muted)]">{title}</dt>
          <dd className="mt-1 break-words font-medium text-[var(--text-main)]">
            {value === 0 ? 0 : value || "-"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children, action }) {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
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
    <Section title={title}>
      {error ? (
        <p role="alert" className="text-rose-600">
          {error}
        </p>
      ) : rows ? (
        rows.length ? (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={r.id || i} className="rounded-lg border border-[var(--border)] p-3">
                <DetailValues data={r} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No records yet.</p>
        )
      ) : (
        <p>Loading…</p>
      )}
    </Section>
  );
}

function Certificates({ token, employeeId, letters }) {
  const [open, setOpen] = useState(""),
    [busy, setBusy] = useState("");
  if (!letters.length)
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No certificate templates yet. Add letter templates under Policies & organization.
      </p>
    );
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {letters.map((t) => (
        <div key={t.id} className="rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 shrink-0 text-[var(--text-muted)]" size={22} />
            <div>
              <p className="font-semibold">{t.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{t.payload?.description || "HR letter"}</p>
            </div>
          </div>
          <div className="relative mt-4">
            <Button
              variant="secondary"
              className="w-full"
              loading={busy === t.id}
              aria-expanded={open === t.id}
              onClick={() => setOpen(open === t.id ? "" : t.id)}
            >
              <Download size={15} /> Download <ChevronDown size={14} />
            </Button>
            {open === t.id && (
              <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg">
                {[
                  ["pdf", "PDF"],
                  ["doc", "Word (.doc)"],
                ].map(([format, title]) => (
                  <button
                    key={format}
                    type="button"
                    className="block w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-2)]"
                    onClick={async () => {
                      setOpen("");
                      setBusy(t.id);
                      try {
                        await downloadLetter(token, employeeId, t, format);
                      } catch (e) {
                        toast.error(e.message);
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    {title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Documents({ token, employeeId, can }) {
  const [docs, setDocs] = useState(null),
    [error, setError] = useState(""),
    [rejecting, setRejecting] = useState(null),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    hrm(token, `/resources/documents?employeeId=${employeeId}&limit=100`)
      .then((r) => active && setDocs((r.rows || []).filter((d) => d.category !== PHOTO_CATEGORY)))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [token, employeeId, refresh]);
  const act = async (path, options, message) => {
    try {
      await hrm(token, path, options);
      toast.success(message);
      setRefresh((n) => n + 1);
    } catch (e) {
      toast.error(e.message);
    }
  };
  if (error)
    return (
      <p role="alert" className="text-rose-600">
        {error}
      </p>
    );
  if (!docs) return <p>Loading…</p>;
  if (!docs.length)
    return <p className="text-sm text-[var(--text-muted)]">No documents yet. Add them from Edit employee.</p>;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {docs.map((d) => (
          <div key={d.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] p-4">
            <div className="flex min-w-0 gap-3">
              <FileText className="mt-0.5 shrink-0 text-[var(--text-muted)]" size={22} />
              <div className="min-w-0">
                <p className="font-semibold">{d.category}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {d.expiresOn ? `Expires ${d.expiresOn}` : "No expiry date"}
                </p>
                <div className="mt-2">
                  <Status value={d.status} />
                </div>
                {d.status === "Rejected" && d.reviewComment && (
                  <p className="mt-1 text-xs text-rose-600">{d.reviewComment}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="secondary" aria-label={`View ${d.category}`} onClick={() => openDocument(token, d).catch((e) => toast.error(e.message))}>
                <Eye size={15} />
              </Button>
              {(can("manage_employees") || can("documents")) && (
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={`Delete ${d.category}`}
                  onClick={async () => {
                    if (await confirmAction({ title: 'Delete document?', description: `${d.category} will be removed.`, confirmText: 'Delete', type: 'danger' })) {
                      act(`/documents/${d.id}`, { method: "DELETE" }, "Document deleted");
                    }
                  }}
                >
                  <Trash2 size={15} />
                </Button>
              )}
              {can("documents") && d.status !== "Verified" && (
                <Button size="sm" variant="secondary" aria-label={`Approve ${d.category}`} onClick={() => act(`/documents/${d.id}/verify`, { method: "POST", body: {} }, "Document approved")}>
                  <Check size={15} />
                </Button>
              )}
              {can("documents") && d.status !== "Rejected" && (
                <Button size="sm" variant="secondary" aria-label={`Reject ${d.category}`} onClick={() => setRejecting(d)}>
                  <X size={15} />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      {rejecting && (
        <ActionDialog
          action={{
            title: "Reject document",
            description: `Tell the employee why "${rejecting.category}" was rejected.`,
            comment: true,
            required: true,
          }}
          busy={busy}
          onClose={() => setRejecting(null)}
          onConfirm={async (comment) => {
            setBusy(true);
            await act(`/documents/${rejecting.id}/reject`, { method: "POST", body: { comment } }, "Document rejected");
            setBusy(false);
            setRejecting(null);
          }}
        />
      )}
    </>
  );
}

export function EmployeeProfile({ id, token, metadata, masters, can }) {
  const navigate = useNavigate();
  const lists = useMemo(() => masterLists(masters), [masters]);
  const [employee, setEmployee] = useState(null),
    [financial, setFinancial] = useState(null),
    [salary, setSalary] = useState(null),
    [tab, setTab] = useState("basic"),
    [more, setMore] = useState(""),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [action, setAction] = useState(null),
    [busy, setBusy] = useState(false);
  const photo = useDocumentImage(token, employee?.photoDocumentId);

  useEffect(() => {
    let active = true;
    Promise.all([
      hrm(token, `/employees/${id}`),
      can("view_salary") ? hrm(token, `/employees/${id}/private`).catch(() => null) : null,
      can("view_salary")
        ? hrm(token, `/resources/salary-history?employeeId=${id}&limit=50`).catch(() => null)
        : null,
    ])
      .then(([e, priv, salaries]) => {
        if (!active) return;
        setEmployee(e);
        setFinancial(priv?.financial || null);
        setSalary(
          (salaries?.rows || []).sort((a, b) => String(b.effectiveDate).localeCompare(String(a.effectiveDate)))[0] ||
            null,
        );
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id, token, refresh, can]);

  if (error)
    return (
      <p role="alert" className="text-rose-600">
        {error}
      </p>
    );
  if (!employee) return <Card className="h-40 animate-pulse" />;

  const p = employee.profile || {};
  const name = lists.name;
  const designation = name(employee.designationId);
  const hours = financial?.hoursPerDay || lists.find(employee.attendancePolicyId)?.payload?.hoursPerDay;
  const days = financial?.daysPerWeek || lists.find(employee.attendancePolicyId)?.payload?.daysPerWeek;
  const rate = hourlyRate(salary?.monthlyCost, hours, days);
  const tabs = [
    ["basic", "Basic Info"],
    ["employment", "Employment"],
    ...(employee.profile ? [["contact", "Contact"]] : []),
    ...(can("view_salary") ? [["banking", "Banking"]] : []),
    ["certifications", "Certifications"],
    ["documents", "Documents"],
  ];
  const moreTabs = [...MORE_TABS, ...(can("view_salary") ? ["salary-history"] : []), ...(can("audit") ? ["audit"] : [])];
  const facts = [
    [User, `Employee ID: ${employee.employeeNumber}`],
    [Fingerprint, employee.employeeCode && `Code: ${employee.employeeCode}`],
    [Mail, employee.companyEmail],
    [Phone, employee.phone],
    [CalendarDays, p.dob && `DOB: ${p.dob}`],
    [CalendarDays, `Joined: ${employee.joiningDate}`],
    [Building2, name(employee.departmentId)],
    [Building2, name(employee.locationId)],
    [Briefcase, name(employee.employmentTypeId) || employee.workMode],
  ].filter(([, text]) => text);

  return (
    <div className="space-y-5">
      <PageHeader title={employee.fullName} description="View detailed information and activity for the employee.">
        <Button variant="secondary" onClick={() => navigate("/app/hrm/employees")}>
          <ArrowLeft size={16} /> Back
        </Button>
        {can("manage_employees") && (
          <Button onClick={() => navigate(`/app/hrm/employees/${id}/edit`)}>Edit employee</Button>
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

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-fit p-6">
          <div className="flex flex-col items-center text-center">
            <div className="grid h-32 w-32 place-items-center overflow-hidden rounded-full border-4 border-emerald-500/30 bg-[var(--surface-2)]">
              {photo ? (
                <img src={photo} alt={employee.fullName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-[var(--text-muted)]">
                  {employee.fullName
                    .split(/\s+/)
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
              )}
            </div>
            <h2 className="mt-4 text-xl font-bold">{employee.fullName}</h2>
            {designation && <p className="text-sm text-[var(--text-muted)]">{designation}</p>}
            <div className="mt-2">
              <Status value={employee.status} />
            </div>
          </div>
          <ul className="mt-6 space-y-3 text-sm">
            {facts.map(([Icon, text], i) => (
              <li key={i} className="flex items-center gap-2.5 break-all">
                <Icon size={16} className="shrink-0 text-[var(--text-muted)]" />
                {text}
              </li>
            ))}
          </ul>
        </Card>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-[var(--surface-2)] p-1.5" role="tablist">
            {tabs.map(([key, title]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={!more && tab === key}
                onClick={() => {
                  setMore("");
                  setTab(key);
                }}
                className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
                  !more && tab === key
                    ? "bg-[var(--surface)] text-[var(--text-main)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                {title}
              </button>
            ))}
            <select
              aria-label="More employee sections"
              value={more}
              onChange={(e) => setMore(e.target.value)}
              className={`rounded-xl border-0 bg-transparent px-3 py-2 text-sm font-medium ${more ? "bg-[var(--surface)] shadow-sm" : "text-[var(--text-muted)]"}`}
            >
              <option value="">More…</option>
              {moreTabs.map((value) => (
                <option key={value} value={value}>
                  {label(value.replace(/-/g, " "))}
                </option>
              ))}
            </select>
          </div>

          {more ? (
            more === "overview" ? (
              <HrmDashboard token={token} metadata={metadata} masters={masters} can={can} analytics employeeId={id} />
            ) : more === "tasks" ? (
              <ProfileData token={token} path={`/tasks?employeeId=${id}`} title="Assigned ERP tasks" />
            ) : more === "leave-balances" ? (
              <ProfileData
                token={token}
                path={`/employees/${id}/leave-balances?year=${localDay(metadata.policy.timezone).slice(0, 4)}`}
                title="Leave balances"
              />
            ) : (
              <HrmCollection key={more} token={token} metadata={metadata} masters={masters} can={can} kind={more} employeeId={id} />
            )
          ) : tab === "basic" ? (
            <Section title="Basic Information">
              <InfoGrid
                items={[
                  ["Full Name", employee.fullName],
                  ["Employee ID", employee.employeeNumber],
                  ["Email", employee.companyEmail],
                  ["Phone Number", employee.phone],
                  ["Employee Code", employee.employeeCode],
                  ...(employee.profile
                    ? [
                        ["Date of Birth", p.dob],
                        ["Gender", p.gender],
                      ]
                    : []),
                  ["ERP Login", employee.userId ? "Linked" : "No login"],
                ]}
              />
            </Section>
          ) : tab === "employment" ? (
            <Section title="Employment Details">
              <InfoGrid
                items={[
                  ["Branch", name(employee.locationId)],
                  ["Department", name(employee.departmentId)],
                  ["Designation", designation],
                  ["Date of Joining", employee.joiningDate],
                  ["Employment Type", name(employee.employmentTypeId)],
                  ["Status", employee.status],
                  ["Shift", name(employee.shiftId)],
                  ["Attendance Policy", name(employee.attendancePolicyId)],
                  ["Reporting Manager", employee.managerName],
                  ["Work Mode", employee.workMode],
                  ...(employee.probationEnd ? [["Probation End", employee.probationEnd]] : []),
                  ...(employee.exitDate ? [["Last Working Date", employee.exitDate]] : []),
                ]}
              />
            </Section>
          ) : tab === "contact" ? (
            <Section title="Contact Information">
              <InfoGrid
                items={[
                  ["Address Line 1", p.addressLine1 || p.currentAddress],
                  ["Address Line 2", p.addressLine2],
                  ["City", p.city],
                  ["State", p.state],
                  ["Country", p.country],
                  ["PIN / Postal Code", p.postalCode],
                ]}
              />
              <h3 className="mb-5 mt-6 border-t border-[var(--border)] pt-5 text-lg font-semibold">Emergency Contact</h3>
              <InfoGrid
                items={[
                  ["Name", p.emergencyName || p.emergencyContact],
                  ["Relationship", p.emergencyRelationship],
                  ["Phone Number", p.emergencyPhone],
                ]}
              />
            </Section>
          ) : tab === "banking" ? (
            <div className="space-y-4">
              <Section title="Banking Information">
                <InfoGrid
                  items={[
                    ["Bank Name", financial?.bankName],
                    ["Account Holder Name", financial?.accountHolderName],
                    ["Account Number", financial?.accountNumber],
                    ["IFSC Code", financial?.ifsc],
                    ["Bank Branch", financial?.bankBranch],
                    ["PAN", financial?.pan],
                    ["UAN (PF)", financial?.uan],
                  ]}
                />
              </Section>
              <Section title="Hours & Rates">
                <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Basic Salary (monthly)", salary ? money(salary.monthlyCost) : "-"],
                    ["Hours Per Day", hours ? Number(hours).toFixed(2) : "-"],
                    ["Days Per Week", days ? Number(days).toFixed(2) : "-"],
                    ["Rate Per Hour", rate == null ? "-" : money(rate)],
                  ].map(([title, value]) => (
                    <div key={title}>
                      <dt className="text-xs text-[var(--text-muted)]">{title}</dt>
                      <dd className="mt-1 text-lg font-bold">{value}</dd>
                    </div>
                  ))}
                </dl>
                {salary && (
                  <p className="mt-4 text-xs text-[var(--text-muted)]">
                    Effective from {salary.effectiveDate}. Full history under More → Salary history.
                  </p>
                )}
              </Section>
            </div>
          ) : tab === "certifications" ? (
            <Section title="Employee Certifications">
              <Certificates token={token} employeeId={id} letters={lists.letters} />
            </Section>
          ) : (
            <Section
              title="Documents"
              action={
                can("manage_employees") && (
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/app/hrm/employees/${id}/edit`)}>
                    <BadgeCheck size={15} /> Add documents
                  </Button>
                )
              }
            >
              <Documents token={token} employeeId={id} can={can} />
            </Section>
          )}
        </div>
      </div>

      {action && (
        <ActionDialog
          action={action}
          busy={busy}
          onClose={() => setAction(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await hrm(token, `/employees/${id}/offboard`, { method: "POST", body: {} });
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

