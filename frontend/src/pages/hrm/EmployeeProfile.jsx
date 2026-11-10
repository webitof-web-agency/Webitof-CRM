import { useEffect, useMemo, useRef, useState } from "react";
import { confirmAction } from "../../lib/confirm";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FileText,
  Laptop,
  Mail,
  Phone,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { cn } from "../../lib/cn";
import { ActionDialog, DetailValues, Status } from "./HrmShared";
import { hrm, label, localDay } from "./hrmApi";
import { HrmCollection } from "./HrmCollection";
import { HrmDashboard } from "./HrmDashboard";
import { DocumentPreview } from "./DocumentPreview";
import { EmploymentAccessDialog, LoginBadge, isBlockedStatus } from "./EmploymentAccess";
import {
  PHOTO_CATEGORY,
  downloadLetter,
  employeePath,
  hourlyRate,
  masterLists,
  money,
  useDocumentImage,
} from "./employeeShared";

// Every section of the profile has its own tab and URL (/employees/<ref>/<tab>).
// `when` hides a tab the viewer cannot use; collection tabs render HrmCollection for that kind.
const TAB_GROUPS = [
  [
    "Profile",
    [
      ["overview", "Overview"],
      ["basic", "Basic info"],
      ["employment", "Employment"],
      ["contact", "Contact", ({ employee }) => Boolean(employee.profile)],
      ["banking", "Banking & pay", ({ can }) => can("view_salary")],
      ["documents", "Documents"],
      ["certifications", "Certifications"],
    ],
  ],
  [
    "Work",
    [
      ["attendance", "Attendance"],
      ["work-reports", "Work reports"],
      ["timesheets", "Timesheets"],
      ["allocations", "Allocations"],
      ["tasks", "Tasks"],
      ["analytics", "Analytics"],
    ],
  ],
  [
    "Leave & pay",
    [
      ["leave", "Leave"],
      ["leave-balances", "Leave balances"],
      ["payroll", "Payroll"],
      ["reimbursement", "Reimbursements"],
      ["salary-history", "Salary history", ({ can }) => can("view_salary")],
    ],
  ],
  [
    "Growth",
    [
      ["review", "Reviews"],
      ["goal", "Goals"],
      ["skill", "Skills"],
    ],
  ],
  [
    "Lifecycle",
    [
      ["onboarding", "Onboarding"],
      ["offboarding", "Offboarding"],
      ["asset", "Assets"],
      ["history", "Employment history"],
      ["audit", "Audit log", ({ can }) => can("audit")],
    ],
  ],
];
const COLLECTION_TABS = new Set([
  "attendance",
  "work-reports",
  "timesheets",
  "allocations",
  "leave",
  "payroll",
  "reimbursement",
  "salary-history",
  "review",
  "goal",
  "skill",
  "onboarding",
  "offboarding",
  "asset",
  "history",
  "audit",
]);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-11-02" -> "02 Nov 2026"
export function fmtDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  return m ? `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : value || "";
}
// "+918839229950" / "8839229950" -> "+91 88392 29950"; other numbers stay as stored.
export function fmtPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 10 ? digits : "";
  return local ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : value || "";
}
const fmtTime = (value, timezone) =>
  value
    ? new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: timezone })
    : "";
const hasValue = (v) => v === 0 || (v != null && String(v).trim() !== "");

// Label/value tiles that fill the width: 2 columns on tablets, up to 4 on wide screens.
function InfoGrid({ items, className = "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" }) {
  return (
    <dl className={cn("grid gap-2.5", className)}>
      {items.filter(Boolean).map(([title, value, wide]) => (
        <div
          key={title}
          className={cn("min-w-0 rounded-xl bg-[var(--surface-2)]/70 px-3.5 py-2.5", wide && "sm:col-span-2")}
        >
          <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{title}</dt>
          <dd className="mt-0.5 break-words text-sm font-semibold text-[var(--text-main)]">
            {hasValue(value) ? value : <span className="font-normal italic text-[var(--text-muted)]">Not added</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children, action, className }) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Loading() {
  return <p className="text-sm text-[var(--text-muted)]">Loading…</p>;
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
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {rows.map((r, i) => (
              <div key={r.id || i} className="rounded-xl border border-[var(--border)] p-3">
                <DetailValues data={r} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No records yet.</p>
        )
      ) : (
        <Loading />
      )}
    </Section>
  );
}

function LeaveBalances({ token, employeeId, year }) {
  const [rows, setRows] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    hrm(token, `/employees/${employeeId}/leave-balances?year=${year}`)
      .then((r) => active && setRows(r))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [token, employeeId, year]);
  return (
    <Section title={`Leave balances ${year}`}>
      {error ? (
        <p role="alert" className="text-rose-600">
          {error}
        </p>
      ) : !rows ? (
        <Loading />
      ) : !rows.length ? (
        <p className="text-sm text-[var(--text-muted)]">No leave types are set up yet.</p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {rows.map((r) => (
            <div key={r.leaveTypeId} className="rounded-xl bg-[var(--surface-2)]/70 px-4 py-3">
              <p className="truncate text-xs font-medium text-[var(--text-muted)]">{r.name}</p>
              <p className="mt-1 text-2xl font-bold">{Number(r.balance)}</p>
              <p className="text-[11px] text-[var(--text-muted)]">days left</p>
            </div>
          ))}
        </div>
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
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {letters.map((t) => (
        <div key={t.id} className="relative flex items-center gap-3 rounded-xl border border-[var(--border)] p-3">
          <FileText className="shrink-0 text-[var(--text-muted)]" size={20} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" title={t.name}>
              {t.name}
            </p>
            <p className="truncate text-xs text-[var(--text-muted)]">{t.payload?.description || "HR letter"}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={busy === t.id}
            aria-expanded={open === t.id}
            aria-label={`Download ${t.name}`}
            onClick={() => setOpen(open === t.id ? "" : t.id)}
          >
            <Download size={14} />
          </Button>
          {open === t.id && (
            <div className="absolute right-3 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg">
              {[
                ["pdf", "PDF"],
                ["doc", "Word (.doc)"],
              ].map(([format, title]) => (
                <button
                  key={format}
                  type="button"
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--surface-2)]"
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
      ))}
    </div>
  );
}

function Documents({ token, employeeId, can, onChange }) {
  const [docs, setDocs] = useState(null),
    [error, setError] = useState(""),
    [rejecting, setRejecting] = useState(null),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [preview, setPreview] = useState(null);
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
      onChange?.();
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  };
  if (error)
    return (
      <p role="alert" className="text-rose-600">
        {error}
      </p>
    );
  if (!docs) return <Loading />;
  if (!docs.length)
    return <p className="text-sm text-[var(--text-muted)]">No documents yet. Add them from Edit employee.</p>;
  const iconButton = "h-8 w-8 !p-0 justify-center";
  return (
    <>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {docs.map((d) => {
          const name = d.title || d.category;
          return (
            <div key={d.id} className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--border)] p-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <FileText className="mt-0.5 shrink-0 text-[var(--text-muted)]" size={18} />
                <div className="min-w-0 flex-1">
                  {/* The title tells two-sided documents apart ("Aadhaar Card Front" / "… Back"). */}
                  <p className="truncate text-sm font-semibold" title={name}>
                    {name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Status value={d.status} />
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {d.expiresOn ? `Expires ${fmtDate(d.expiresOn)}` : "No expiry"}
                    </span>
                  </div>
                  {d.status === "Rejected" && d.reviewComment && (
                    <p className="mt-1 text-xs text-rose-600">{d.reviewComment}</p>
                  )}
                </div>
              </div>
              <div className="mt-auto flex justify-end gap-1">
                <Button size="sm" variant="secondary" className={iconButton} title="View" aria-label={`View ${name}`} onClick={() => setPreview(d)}>
                  <Eye size={14} />
                </Button>
                {can("documents") && d.status !== "Verified" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className={iconButton}
                    title="Approve"
                    aria-label={`Approve ${name}`}
                    onClick={() => act(`/documents/${d.id}/verify`, { method: "POST", body: {} }, "Document approved")}
                  >
                    <Check size={14} />
                  </Button>
                )}
                {can("documents") && d.status !== "Rejected" && (
                  <Button size="sm" variant="secondary" className={iconButton} title="Reject" aria-label={`Reject ${name}`} onClick={() => setRejecting(d)}>
                    <X size={14} />
                  </Button>
                )}
                {(can("manage_employees") || can("documents")) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className={cn(iconButton, "hover:text-rose-600")}
                    title="Delete"
                    aria-label={`Delete ${name}`}
                    onClick={async () => {
                      if (
                        await confirmAction({
                          title: "Delete document?",
                          description: `${name} will be removed.`,
                          confirmText: "Delete",
                          type: "danger",
                        })
                      )
                        act(`/documents/${d.id}`, { method: "DELETE" }, "Document deleted");
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {rejecting && (
        <ActionDialog
          action={{
            title: "Reject document",
            description: `Tell the employee why "${rejecting.title || rejecting.category}" was rejected.`,
            comment: true,
            required: true,
          }}
          busy={busy}
          onClose={() => setRejecting(null)}
          onConfirm={async (comment) => {
            setBusy(true);
            const ok = await act(`/documents/${rejecting.id}/reject`, { method: "POST", body: { comment } }, "Document rejected");
            setBusy(false);
            if (ok) setRejecting(null);
          }}
        />
      )}
      {preview && <DocumentPreview token={token} doc={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

// Left rail on desktop (grouped, sticky), scrolling chips on small screens.
function ProfileNav({ groups, active, badges, onSelect }) {
  const Badge = ({ k }) => {
    const b = badges?.[k];
    if (!b) return null;
    return (
      <span
        className={cn(
          "ml-auto rounded-full px-1.5 text-[10px] font-bold leading-[18px]",
          b.attention
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
            : "bg-[var(--surface-2)] text-[var(--text-muted)]",
        )}
      >
        {b.count}
      </span>
    );
  };
  return (
    <>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden" role="tablist" aria-label="Employee sections">
        {groups.flatMap(([, tabs]) => tabs).map(([key, title]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active === key}
            onClick={() => onSelect(key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              active === key
                ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]",
            )}
          >
            {title}
            <Badge k={key} />
          </button>
        ))}
      </div>
      <nav className="sticky top-4 hidden self-start lg:block" aria-label="Employee sections">
        <Card className="max-h-[calc(100vh-2rem)] overflow-y-auto p-2">
          {groups.map(([group, tabs]) => (
            <div key={group} className="mb-1 last:mb-0">
              <p className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{group}</p>
              {tabs.map(([key, title]) => (
                <button
                  key={key}
                  type="button"
                  aria-current={active === key ? "page" : undefined}
                  onClick={() => onSelect(key)}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium transition",
                    active === key
                      ? "bg-[var(--primary-subtle)] text-[var(--primary)]"
                      : "text-[var(--text-main)] hover:bg-[var(--hover-bg)]",
                  )}
                >
                  <span className="truncate">{title}</span>
                  <Badge k={key} />
                </button>
              ))}
            </div>
          ))}
        </Card>
      </nav>
    </>
  );
}

function Stat({ icon: Icon, title, value, hint, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left shadow-2xs transition hover:border-[var(--primary)]"
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
          tone === "warn" ? "bg-amber-500/15 text-amber-600" : "bg-[var(--primary-subtle)] text-[var(--primary)]",
        )}
      >
        <Icon size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{title}</span>
        <span className="block truncate text-lg font-bold leading-tight">{value}</span>
        {hint && <span className="block truncate text-[11px] text-[var(--text-muted)]">{hint}</span>}
      </span>
    </button>
  );
}

function Rows({ items }) {
  const shown = items.filter(([, v]) => hasValue(v));
  if (!shown.length) return <p className="text-sm italic text-[var(--text-muted)]">Not added yet.</p>;
  return (
    <dl className="space-y-1.5 text-sm">
      {shown.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <dt className="shrink-0 text-[var(--text-muted)]">{k}</dt>
          <dd className="min-w-0 truncate text-right font-medium" title={typeof v === "string" ? v : undefined}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Progress({ title, done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium">{title}</span>
        <span className="text-[var(--text-muted)]">
          {done}/{total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniCard({ title, onOpen, children }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {onOpen && (
          <button type="button" onClick={onOpen} className="text-xs font-semibold text-[var(--primary)] hover:underline">
            View
          </button>
        )}
      </div>
      {children}
    </Card>
  );
}

function Overview({ employee, summary, info, timezone, open, canSalary }) {
  const p = employee.profile || {};
  if (!summary) return <Card className="h-40 animate-pulse" />;
  const s = summary;
  const t = s.today;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Stat
          icon={Clock}
          title="Today"
          value={t ? t.status : "Not marked"}
          hint={t ? [t.checkIn && `In ${fmtTime(t.checkIn, timezone)}`, t.checkOut && `Out ${fmtTime(t.checkOut, timezone)}`].filter(Boolean).join(" · ") : fmtDate(s.date)}
          onClick={() => open("attendance")}
        />
        <Stat
          icon={CalendarCheck}
          title="This month"
          value={`${s.month.present} present`}
          hint={`${s.month.absent} absent · ${s.month.leave} leave${s.month.halfDay ? ` · ${s.month.halfDay} half day` : ""}`}
          onClick={() => open("attendance")}
        />
        <Stat icon={CalendarDays} title="Leave balance" value={`${s.leave.balance} days`} hint={`${s.leave.types.length} leave types`} onClick={() => open("leave-balances")} />
        <Stat
          icon={ClipboardList}
          title="Pending requests"
          value={s.pendingRequests}
          hint={s.workReports.pending ? `${s.workReports.pending} work reports to review` : "Leave, reimbursements…"}
          tone={s.pendingRequests || s.workReports.pending ? "warn" : undefined}
          onClick={() => open("leave")}
        />
        <Stat icon={Briefcase} title="Allocation" value={`${Number(s.allocation.percent)}%`} hint={`${s.allocation.projects} active projects`} onClick={() => open("allocations")} />
        <Stat icon={Laptop} title="Assets" value={s.assets} hint="assigned now" onClick={() => open("asset")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <MiniCard title="Employment" onOpen={() => open("employment")}>
          <Rows items={info.employmentRows} />
        </MiniCard>
        <MiniCard title="Personal & contact" onOpen={employee.profile ? () => open("contact") : undefined}>
          <Rows
            items={[
              ["Date of birth", fmtDate(p.dob)],
              ["Gender", p.gender],
              ["Blood group", p.bloodGroup],
              ["Personal email", p.personalEmail],
              ["City", [p.city, p.state].filter(Boolean).join(", ")],
              ["Emergency", [p.emergencyName || p.emergencyContact, fmtPhone(p.emergencyPhone)].filter(Boolean).join(" · ")],
            ]}
          />
        </MiniCard>
        <MiniCard title="Documents" onOpen={() => open("documents")}>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ["Total", s.documents.total],
              ["Pending", s.documents.pending],
              ["Rejected", s.documents.rejected],
              ["Expiring", s.documents.expiring],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-[var(--surface-2)]/70 py-2">
                <p className={cn("text-lg font-bold", k !== "Total" && v ? "text-amber-600" : "")}>{v}</p>
                <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{k}</p>
              </div>
            ))}
          </div>
        </MiniCard>
        <MiniCard title="Leave balances" onOpen={() => open("leave-balances")}>
          {s.leave.types.length ? (
            <div className="flex flex-wrap gap-2">
              {s.leave.types.map((l) => (
                <span key={l.name} className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs">
                  {l.name} <b className="ml-1">{l.balance}</b>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm italic text-[var(--text-muted)]">No leave types set up.</p>
          )}
        </MiniCard>
        <MiniCard title="Checklists">
          <div className="space-y-3">
            <button type="button" className="block w-full text-left" onClick={() => open("onboarding")}>
              <Progress title="Onboarding" done={s.onboarding.done} total={s.onboarding.total} />
            </button>
            {s.offboarding.total > 0 && (
              <button type="button" className="block w-full text-left" onClick={() => open("offboarding")}>
                <Progress title="Offboarding" done={s.offboarding.done} total={s.offboarding.total} />
              </button>
            )}
            <p className="text-xs text-[var(--text-muted)]">
              {s.workReports.total} work reports this month{s.workReports.pending ? `, ${s.workReports.pending} waiting for review` : ""}.
            </p>
          </div>
        </MiniCard>
        {canSalary ? (
          <MiniCard title="Pay" onOpen={() => open("banking")}>
            <Rows items={info.payRows} />
          </MiniCard>
        ) : null}
        {s.activity && (
          <MiniCard title="Recent activity" onOpen={() => open("audit")}>
            {s.activity.length ? (
              <ul className="space-y-2 text-sm">
                {s.activity.map((a, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {label(a.entity)} {String(a.action).replace(/-/g, " ")}
                      {a.actor ? <span className="text-[var(--text-muted)]"> · {a.actor}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--text-muted)]">{fmtDate(String(a.at).slice(0, 10))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-[var(--text-muted)]">Nothing recorded yet.</p>
            )}
          </MiniCard>
        )}
      </div>
    </div>
  );
}

export function EmployeeProfile({ id, tab: tabParam = "", token, metadata, masters, can }) {
  const navigate = useNavigate();
  const location = useLocation();
  const lists = useMemo(() => masterLists(masters), [masters]);
  const [employee, setEmployee] = useState(null),
    [financial, setFinancial] = useState(null),
    [salary, setSalary] = useState(null),
    [summary, setSummary] = useState(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [action, setAction] = useState(null),
    [access, setAccess] = useState(""),
    [busy, setBusy] = useState(false);
  const photo = useDocumentImage(token, employee?.photoDocumentId);
  const topRef = useRef(null);
  const timezone = metadata.policy?.timezone || "Asia/Kolkata";

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
    // Counts and Overview numbers; the page works without them.
    hrm(token, `/employees/${id}/summary`)
      .then((s) => active && setSummary(s))
      .catch(() => active && setSummary(null));
    return () => {
      active = false;
    };
  }, [id, token, refresh, can]);

  const groups = useMemo(
    () =>
      employee
        ? TAB_GROUPS.map(([group, tabs]) => [group, tabs.filter(([, , when]) => !when || when({ employee, can }))]).filter(
            ([, tabs]) => tabs.length,
          )
        : [],
    [employee, can],
  );
  const tabKeys = groups.flatMap(([, tabs]) => tabs.map(([key]) => key));
  const tab = tabKeys.includes(tabParam) ? tabParam : "overview";

  // An old id link (/employees/hrm_…) is swapped for the readable one, keeping the tab.
  useEffect(() => {
    if (employee?.employeeNumber && /\/employees\/hrm_[a-z0-9]+/i.test(location.pathname))
      navigate(employeePath(employee, tabParam ? `/${tabParam}` : ""), { replace: true });
  }, [employee, location.pathname, navigate, tabParam]);

  if (error)
    return (
      <p role="alert" className="text-rose-600">
        {error}
      </p>
    );
  if (!employee) return <Card className="h-40 animate-pulse" />;

  const open = (key) => {
    navigate(employeePath(employee, key === "overview" ? "" : `/${key}`));
    if (window.innerWidth < 1024) topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const reload = () => setRefresh((n) => n + 1);

  const p = employee.profile || {};
  const name = lists.name;
  const designation = name(employee.designationId);
  const hours = financial?.hoursPerDay || lists.find(employee.attendancePolicyId)?.payload?.hoursPerDay;
  const days = financial?.daysPerWeek || lists.find(employee.attendancePolicyId)?.payload?.daysPerWeek;
  const rate = hourlyRate(salary?.monthlyCost, hours, days);
  const employmentRows = [
    ["Department", name(employee.departmentId)],
    ["Designation", designation],
    ["Branch", name(employee.locationId)],
    ["Employment type", name(employee.employmentTypeId)],
    ["Joining date", fmtDate(employee.joiningDate)],
    ["Reporting manager", employee.managerName],
    ["Shift", name(employee.shiftId)],
    ["Work mode", employee.workMode],
    ["Last working date", fmtDate(employee.exitDate)],
  ];
  const payRows = [
    ["Basic salary (monthly)", salary ? money(salary.monthlyCost) : ""],
    ["Rate per hour", rate == null ? "" : money(rate)],
    ["Bank", [financial?.bankName, financial?.ifsc].filter(Boolean).join(" · ")],
    ["PAN", financial?.pan],
  ];
  const initials = employee.fullName
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const facts = [
    [Mail, employee.companyEmail, employee.companyEmail && `mailto:${employee.companyEmail}`],
    [Phone, fmtPhone(employee.phone), employee.phone && `tel:${employee.phone}`],
    [CalendarDays, employee.joiningDate && `Joined ${fmtDate(employee.joiningDate)}`],
    [UserRound, employee.managerName && `Reports to ${employee.managerName}`],
    [Clock, name(employee.shiftId)],
  ].filter(([, text]) => text);

  let content;
  if (tab === "overview")
    content = (
      <Overview
        employee={employee}
        summary={summary}
        info={{ employmentRows, payRows }}
        timezone={timezone}
        open={open}
        canSalary={can("view_salary")}
      />
    );
  else if (tab === "basic")
    content = (
      <Section title="Basic information">
        <InfoGrid
          items={[
            ["Full name", employee.fullName],
            ["Employee ID", employee.employeeNumber],
            ["Employee code", employee.employeeCode],
            ["Company email", employee.companyEmail],
            ["Phone", fmtPhone(employee.phone)],
            ["ERP login", employee.userId ? (employee.login?.active ? "Linked · active" : "Linked · blocked") : "No login"],
            ...(employee.profile
              ? [
                  ["Date of birth", fmtDate(p.dob)],
                  ["Gender", p.gender],
                  ["Blood group", p.bloodGroup],
                  ["Marital status", p.maritalStatus],
                  ["Personal email", p.personalEmail],
                  ["Alternate mobile", fmtPhone(p.alternateMobile)],
                ]
              : []),
          ]}
        />
      </Section>
    );
  else if (tab === "employment")
    content = (
      <Section title="Employment details">
        <InfoGrid
          items={[
            ["Status", <Status key="s" value={employee.status} />],
            ...employmentRows,
            ["Attendance policy", name(employee.attendancePolicyId)],
            ...(employee.profile
              ? [
                  ["Probation start", fmtDate(p.probationStart)],
                  ["Confirmation date", fmtDate(p.confirmationDate)],
                  ["Notice period (days)", p.noticePeriodDays],
                ]
              : []),
            ["Probation end", fmtDate(employee.probationEnd)],
            ["Contract end", fmtDate(employee.contractEnd)],
          ]}
        />
      </Section>
    );
  else if (tab === "contact")
    content = (
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Address">
          <InfoGrid
            className="sm:grid-cols-2"
            items={[
              ["Address", [p.addressLine1 || p.currentAddress, p.addressLine2].filter(Boolean).join(", "), true],
              ["City", p.city],
              ["State", p.state],
              ["Country", p.country],
              ["PIN code", p.postalCode],
            ]}
          />
        </Section>
        <Section title="Emergency contact">
          <InfoGrid
            className="sm:grid-cols-2"
            items={[
              ["Name", p.emergencyName || p.emergencyContact],
              ["Relationship", p.emergencyRelationship],
              ["Phone", fmtPhone(p.emergencyPhone)],
              ["Personal email", p.personalEmail],
            ]}
          />
        </Section>
      </div>
    );
  else if (tab === "banking")
    content = (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title="Bank & statutory">
          <InfoGrid
            className="sm:grid-cols-2 2xl:grid-cols-3"
            items={[
              ["Bank name", financial?.bankName],
              ["Account holder", financial?.accountHolderName],
              ["Account number", financial?.accountNumber],
              ["IFSC", financial?.ifsc],
              ["Branch", financial?.bankBranch],
              ["PAN", financial?.pan],
              ["UAN (PF)", financial?.uan],
            ]}
          />
        </Section>
        <Section
          title="Pay & hours"
          action={
            <Button size="sm" variant="secondary" onClick={() => open("salary-history")}>
              Salary history
            </Button>
          }
        >
          <InfoGrid
            className="grid-cols-2"
            items={[
              ["Basic salary (monthly)", salary ? money(salary.monthlyCost) : ""],
              ["Rate per hour", rate == null ? "" : money(rate)],
              ["Hours per day", hours ? Number(hours).toFixed(2) : ""],
              ["Days per week", days ? Number(days).toFixed(2) : ""],
            ]}
          />
          {salary && <p className="mt-3 text-xs text-[var(--text-muted)]">Effective from {fmtDate(salary.effectiveDate)}.</p>}
        </Section>
      </div>
    );
  else if (tab === "documents")
    content = (
      <Section
        title="Documents"
        action={
          can("manage_employees") && (
            <Button size="sm" variant="secondary" onClick={() => navigate(employeePath(employee, "/edit"))}>
              <BadgeCheck size={15} /> Add documents
            </Button>
          )
        }
      >
        <Documents token={token} employeeId={id} can={can} onChange={reload} />
      </Section>
    );
  else if (tab === "certifications")
    content = (
      <Section title="Certificates & letters">
        <Certificates token={token} employeeId={id} letters={lists.letters} />
      </Section>
    );
  else if (tab === "tasks") content = <ProfileData token={token} path={`/tasks?employeeId=${id}`} title="Assigned ERP tasks" />;
  else if (tab === "leave-balances")
    content = <LeaveBalances token={token} employeeId={id} year={localDay(timezone).slice(0, 4)} />;
  else if (tab === "analytics")
    content = <HrmDashboard token={token} metadata={metadata} masters={masters} can={can} analytics employeeId={id} />;
  else if (COLLECTION_TABS.has(tab))
    content = (
      <HrmCollection key={tab} token={token} metadata={metadata} masters={masters} can={can} kind={tab} employeeId={id} onChange={reload} />
    );

  return (
    <div className="space-y-4" ref={topRef}>
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-[var(--surface-2)]">
              {photo ? (
                <img src={photo} alt={employee.fullName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-[var(--text-muted)]">{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold leading-tight">{employee.fullName}</h1>
                <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 font-mono text-xs font-semibold">
                  {employee.employeeNumber}
                </span>
                <Status value={employee.status} />
                <LoginBadge login={employee.login} />
              </div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {[designation, name(employee.departmentId), name(employee.locationId), name(employee.employmentTypeId), employee.workMode]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-main)]">
                {facts.map(([Icon, text, href], i) => (
                  <li key={i} className="flex min-w-0 items-center gap-1.5">
                    <Icon size={13} className="shrink-0 text-[var(--text-muted)]" />
                    {href ? (
                      <a href={href} className="truncate hover:text-[var(--primary)] hover:underline">
                        {text}
                      </a>
                    ) : (
                      <span className="truncate">{text}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button size="sm" variant="secondary" onClick={() => navigate("/app/hrm/employees")}>
              <ArrowLeft size={15} /> Back
            </Button>
            {can("manage_employees") && !employee.userId && (
              // Without a linked login the employee cannot use My day or the Employee app.
              <Button size="sm" variant="secondary" onClick={() => navigate(employeePath(employee, "/edit"))}>
                No login yet: create one
              </Button>
            )}
            {can("manage_employees") && (
              <Button size="sm" onClick={() => navigate(employeePath(employee, "/edit"))}>
                Edit employee
              </Button>
            )}
            {employee.status === "Notice Period" && can("hr_approve") && (
              <Button
                size="sm"
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
            {can("hr_approve") &&
              (isBlockedStatus(employee.status) ? (
                <Button size="sm" variant="success" onClick={() => setAccess("reinstate")}>
                  {employee.status === "Suspended" ? "Reinstate" : "Rejoin"}
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => setAccess("suspend")}>
                    Suspend
                  </Button>
                  {employee.status !== "Draft" && (
                    <Button size="sm" variant="danger" onClick={() => setAccess("terminate")}>
                      Terminate
                    </Button>
                  )}
                </>
              ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
        <ProfileNav groups={groups} active={tab} badges={summary?.badges} onSelect={open} />
        <div className="min-w-0">{content}</div>
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
              reload();
              toast.success("Offboarding completed");
            } catch (e) {
              toast.error(e.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {access && (
        <EmploymentAccessDialog
          kind={access}
          employee={employee}
          token={token}
          onClose={() => setAccess("")}
          onDone={() => {
            setAccess("");
            reload();
          }}
        />
      )}
    </div>
  );
}
