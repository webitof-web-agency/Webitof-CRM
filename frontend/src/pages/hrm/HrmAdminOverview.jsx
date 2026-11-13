import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CakeSlice,
  CalendarClock,
  CalendarHeart,
  CalendarOff,
  Check,
  ClipboardList,
  FileWarning,
  Gauge,
  LogOut,
  PartyPopper,
  Receipt,
  ShieldAlert,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { cn } from "../../lib/cn";
import { hrm } from "./hrmApi";

const usable = (block) => block && !block.error;

function time(value, tz) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function day(value) {
  if (!value) return "";
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00+05:30`);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(d);
}

function inDays(n) {
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n < 0) return `${-n}d ago`;
  return `in ${n}d`;
}

function rupees(value) {
  return Number(value || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function Panel({ title, icon: Icon, count, action, className = "", children }) {
  return (
    <Card className={cn("flex min-w-0 flex-col p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
          {Icon ? <Icon size={15} className="text-[var(--primary)]" /> : null}
          {title}
          {count ? <span className="rounded-full bg-[var(--primary-subtle)] px-1.5 text-[11px] text-[var(--primary)]">{count}</span> : null}
        </h3>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </Card>
  );
}

function More({ to, children = "View all" }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
      {children} <ArrowRight size={12} />
    </Link>
  );
}

function Empty({ children }) {
  return <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-5 text-center text-xs text-[var(--text-muted)]">{children}</p>;
}

function Failed() {
  return <p className="text-xs text-rose-600">Could not load this section.</p>;
}

// ── Today ──────────────────────────────────────────────────────────────────────

const GROUPS = [
  { key: "present", label: "Present", tone: "text-emerald-600" },
  { key: "late", label: "Late", tone: "text-amber-600" },
  { key: "working", label: "Working now", tone: "text-[var(--primary)]" },
  { key: "lunch", label: "On lunch", tone: "text-sky-600" },
  { key: "remote", label: "WFH / Visit", tone: "text-violet-600" },
  { key: "leave", label: "On leave", tone: "text-slate-500" },
  { key: "absent", label: "Absent", tone: "text-rose-600" },
  { key: "notIn", label: "Not clocked in", tone: "text-rose-600" },
  { key: "out", label: "Clocked out", tone: "text-slate-500" },
];

function TodayBoard({ board, tz }) {
  const [group, setGroup] = useState(() => (board.counts.notIn ? "notIn" : "present"));
  const people = board.groups[group] || [];
  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--text-main)]">
          Today · {board.total} employees
          <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">Shift starts {board.shiftStart}</span>
        </h3>
        <More to="/app/hrm/attendance">Attendance</More>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-9">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setGroup(g.key)}
            className={cn(
              "rounded-xl border px-2.5 py-2 text-left transition-colors",
              group === g.key ? "border-[var(--primary)] bg-[var(--primary-subtle)]" : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--primary)]/50",
            )}
          >
            <div className={cn("text-lg font-bold tabular-nums", g.tone)}>{board.counts[g.key] || 0}</div>
            <div className="truncate text-[11px] text-[var(--text-muted)]">{g.label}</div>
          </button>
        ))}
      </div>
      <div className="mt-3">
        {people.length ? (
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {people.map((p) => (
              <Link
                key={p.employeeId}
                to={`/app/hrm/employees/${p.employeeId}`}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5 hover:border-[var(--primary)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-[var(--text-main)]">{p.name}</span>
                  <span className="block truncate text-[11px] text-[var(--text-muted)]">
                    {p.leave
                      ? p.leave
                      : p.checkIn
                        ? `In ${time(p.checkIn, tz)}${p.checkOut ? ` · out ${time(p.checkOut, tz)}` : ""}${p.mode && !["WFO", "Office"].includes(p.mode) ? ` · ${p.mode}` : ""}`
                        : p.department}
                  </span>
                </span>
                {p.lateMinutes ? <span className="shrink-0 text-[10px] font-semibold text-amber-600">+{p.lateMinutes}m</span> : null}
                {p.alerts ? <AlertTriangle size={13} className="shrink-0 text-rose-500" /> : null}
              </Link>
            ))}
          </div>
        ) : (
          <Empty>No one in this group.</Empty>
        )}
      </div>
    </Card>
  );
}

// ── Approvals (inline) ─────────────────────────────────────────────────────────

const KIND_LABEL = {
  leave: "Leave",
  regularization: "Attendance fix",
  reimbursement: "Reimbursement",
  resignation: "Resignation",
  wfh: "Work from home",
};

function Approvals({ approvals, token, onChanged }) {
  const [busy, setBusy] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [comment, setComment] = useState("");

  async function act(item, action, note = "") {
    setBusy(item.id);
    try {
      await hrm(token, `/requests/${item.id}/action`, { method: "POST", body: { action, ...(note ? { comment: note } : {}) } });
      toast.success(`${KIND_LABEL[item.kind] || item.kind} ${action === "approve" ? "approved" : "rejected"} for ${item.employee}`);
      setRejecting(null);
      setComment("");
      onChanged();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      {approvals.items.length ? (
        <ul className="max-h-[24rem] divide-y divide-[var(--border)] overflow-y-auto pr-1">
          {approvals.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13px]">
                  <span className="font-semibold text-[var(--text-main)]">{item.employee}</span>
                  <span className="rounded bg-[var(--surface-2)] px-1.5 text-[10px] font-semibold text-[var(--text-muted)]">{KIND_LABEL[item.kind] || item.kind}</span>
                  {item.status === "Manager Approved" ? <span className="text-[10px] text-sky-600">manager approved</span> : null}
                </div>
                <div className="truncate text-[11px] text-[var(--text-muted)]">
                  {[
                    item.title,
                    item.startDate ? `${day(item.startDate)}${item.endDate && item.endDate !== item.startDate ? ` – ${day(item.endDate)}` : ""}` : "",
                    item.days ? `${item.days} day${item.days === 1 ? "" : "s"}` : item.halfDay ? "half day" : "",
                    item.amount ? rupees(item.amount) : "",
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
              {item.canAct ? (
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" loading={busy === item.id} onClick={() => act(item, "approve")}>
                    <Check size={13} /> Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => { setRejecting(item); setComment(""); }}>
                    <X size={13} /> Reject
                  </Button>
                </div>
              ) : (
                <span className="text-[11px] text-[var(--text-muted)]">Waiting for {item.status === "Manager Approved" ? "HR / finance" : "manager"}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Nothing waiting for approval. ✅</Empty>
      )}
      {approvals.workReports || approvals.timesheets ? (
        <div className="mt-2 flex flex-wrap gap-3 border-t border-[var(--border)] pt-2 text-[11px]">
          {approvals.workReports ? <Link to="/app/hrm/work-reports" className="text-[var(--primary)] hover:underline">{approvals.workReports} work report{approvals.workReports === 1 ? "" : "s"} to review →</Link> : null}
          {approvals.timesheets ? <Link to="/app/hrm/timesheets" className="text-[var(--primary)] hover:underline">{approvals.timesheets} timesheet{approvals.timesheets === 1 ? "" : "s"} to review →</Link> : null}
        </div>
      ) : null}

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={rejecting ? `Reject ${KIND_LABEL[rejecting.kind] || rejecting.kind}?` : ""}
        subtitle={rejecting ? `${rejecting.employee} · ${rejecting.title}` : ""}
        width="440px"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy === rejecting?.id}
              disabled={!comment.trim()}
              onClick={() => act(rejecting, "reject", comment.trim())}
            >
              Reject
            </Button>
          </div>
        }
      >
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-main)]">Reason (sent to the employee)</label>
        <textarea
          autoFocus
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 text-sm outline-none focus:border-[var(--primary)]"
          placeholder="e.g. Project deadline that week, please pick other dates."
        />
      </Modal>
    </>
  );
}

// ── Alerts ─────────────────────────────────────────────────────────────────────

const ALERT_ACTIONS = [
  { action: "ignore", label: "Ignore" },
  { action: "explain", label: "Ask why", needsComment: true },
  { action: "warn", label: "Warn", needsComment: true },
  { action: "half-day", label: "Half day", hr: true },
  { action: "absent", label: "Absent", hr: true },
];

function Alerts({ alerts, token, onChanged, tz }) {
  const [busy, setBusy] = useState("");
  const [pending, setPending] = useState(null);
  const [comment, setComment] = useState("");

  async function act(alert, action, note = "") {
    setBusy(alert.id);
    try {
      await hrm(token, `/alerts/${alert.id}/action`, { method: "POST", body: { action, ...(note ? { comment: note } : {}) } });
      toast.success("Alert updated");
      setPending(null);
      setComment("");
      onChanged();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy("");
    }
  }

  const actions = ALERT_ACTIONS.filter((a) => !a.hr || alerts.canOverride);
  return (
    <>
      {alerts.items.length ? (
        <ul className="max-h-[24rem] divide-y divide-[var(--border)] overflow-y-auto pr-1">
          {alerts.items.map((alert) => (
            <li key={alert.id} className="py-2">
              <div className="flex items-start gap-2">
                <ShieldAlert size={14} className={cn("mt-0.5 shrink-0", alert.status === "Explained" ? "text-sky-500" : "text-rose-500")} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-[var(--text-main)]">
                    <span className="font-semibold">{alert.employee}</span> · {alert.title}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {day(alert.workDate)} {time(alert.openedAt, tz)} · {alert.status}
                  </div>
                  {alert.explanation ? <div className="mt-0.5 rounded bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[var(--text-main)]">“{alert.explanation}”</div> : null}
                </div>
              </div>
              {alerts.canAct && !alert.own ? (
                <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
                  {actions.map((a) => (
                    <button
                      key={a.action}
                      type="button"
                      disabled={busy === alert.id}
                      onClick={() => (a.needsComment ? (setPending({ alert, ...a }), setComment("")) : act(alert, a.action))}
                      className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-main)] hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No open alerts in the last 7 days.</Empty>
      )}
      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending ? `${pending.label}: ${pending.alert.employee}` : ""}
        subtitle={pending?.alert.title}
        width="440px"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button loading={busy === pending?.alert.id} disabled={!comment.trim()} onClick={() => act(pending.alert, pending.action, comment.trim())}>
              Send
            </Button>
          </div>
        }
      >
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-main)]">Message to the employee</label>
        <textarea
          autoFocus
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
      </Modal>
    </>
  );
}

// ── Away / dates / productivity ────────────────────────────────────────────────

function Away({ away }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Today ({away.today.length})</div>
        {away.today.length ? (
          <ul className="space-y-1">
            {away.today.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 text-[12px]">
                <Link to={`/app/hrm/employees/${l.employeeId}`} className="truncate font-medium text-[var(--text-main)] hover:text-[var(--primary)]">{l.employee}</Link>
                <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{l.halfDay ? "Half day" : `till ${day(l.endDate)}`}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-[var(--text-muted)]">Everyone is in.</p>}
      </div>
      {away.week.filter((l) => !l.today).length ? (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Next 7 days</div>
          <ul className="space-y-1">
            {away.week.filter((l) => !l.today).map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="truncate text-[var(--text-main)]">{l.employee}</span>
                <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{day(l.startDate)}{l.endDate !== l.startDate ? `–${day(l.endDate)}` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Holidays</div>
        {away.holidays.length ? (
          <ul className="space-y-1">
            {away.holidays.map((h) => (
              <li key={`${h.date}-${h.name}`} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="flex min-w-0 items-center gap-1.5 text-[var(--text-main)]"><CalendarHeart size={12} className="shrink-0 text-rose-500" /><span className="truncate">{h.name}</span></span>
                <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{day(h.date)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-[var(--text-muted)]">None coming up.</p>}
      </div>
    </div>
  );
}

const EVENT_META = {
  birthday: { icon: CakeSlice, tone: "text-pink-500", label: () => "Birthday" },
  anniversary: { icon: PartyPopper, tone: "text-amber-500", label: (e) => `${e.years} year${e.years === 1 ? "" : "s"} at work` },
  probation: { icon: CalendarClock, tone: "text-sky-500", label: () => "Probation ends" },
  contract: { icon: Briefcase, tone: "text-violet-500", label: () => "Contract ends" },
  exit: { icon: UserMinus, tone: "text-rose-500", label: () => "Last working day" },
  document: { icon: FileWarning, tone: "text-orange-500", label: (e) => `${e.title} ${e.in < 0 ? "expired" : "expires"}` },
};

function Upcoming({ upcoming }) {
  const life = upcoming.lifecycle;
  return (
    <div className="space-y-2">
      {upcoming.events.length ? (
        <ul className="max-h-[18rem] space-y-1 overflow-y-auto pr-1">
          {upcoming.events.map((e, i) => {
            const meta = EVENT_META[e.type];
            return (
              <li key={`${e.type}-${e.employeeId}-${i}`} className="flex items-center gap-2 text-[12px]">
                <meta.icon size={13} className={cn("shrink-0", meta.tone)} />
                <span className="min-w-0 flex-1 truncate">
                  <Link to={`/app/hrm/employees/${e.employeeId}`} className="font-medium text-[var(--text-main)] hover:text-[var(--primary)]">{e.employee}</Link>
                  <span className="text-[var(--text-muted)]"> · {meta.label(e)}</span>
                </span>
                <span className={cn("shrink-0 text-[11px]", e.in <= 0 ? "font-semibold text-rose-600" : "text-[var(--text-muted)]")}>{inDays(e.in)}</span>
              </li>
            );
          })}
        </ul>
      ) : <Empty>Nothing in the coming days.</Empty>}
      {life && (life.onboarding || life.offboarding) ? (
        <div className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-2 text-[11px]">
          {life.onboarding ? <Link to="/app/hrm/onboarding" className="text-[var(--primary)] hover:underline">{life.onboarding} onboarding open →</Link> : null}
          {life.offboarding ? <Link to="/app/hrm/offboarding" className="text-[var(--primary)] hover:underline">{life.offboarding} offboarding open →</Link> : null}
        </div>
      ) : null}
    </div>
  );
}

function Mini({ label, value, tone = "" }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2">
      <div className={cn("text-lg font-bold tabular-nums text-[var(--text-main)]", tone)}>{value}</div>
      <div className="text-[11px] text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

function Productivity({ work }) {
  const max = Math.max(1, ...work.lateTrend.map((d) => d.present));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Mini label="Reports today" value={`${work.reportsSubmitted}/${work.reportsExpected}`} />
        <Mini label="Slots missed today" value={work.slotsMissed} tone={work.slotsMissed ? "text-rose-600" : ""} />
        <Mini label="Avg hours / day" value={work.avgHoursPerDay} />
        <Mini label="Billable" value={`${work.billablePercent}%`} />
      </div>
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Late arrivals · 14 days</div>
        <div className="flex h-16 items-end gap-1" role="img" aria-label="Late arrivals per day">
          {work.lateTrend.map((d) => (
            <div key={d.date} className="flex-1" title={`${d.date}: ${d.late} late of ${d.present}`}>
              <div className="relative w-full rounded-t bg-[var(--primary-subtle)]" style={{ height: `${Math.max(2, (d.present / max) * 56)}px` }}>
                <div className="absolute inset-x-0 bottom-0 rounded-t bg-amber-500" style={{ height: `${d.present ? (d.late / d.present) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DepartmentToday({ board }) {
  if (!board.departments.length) return <Empty>No employees.</Empty>;
  return (
    <ul className="space-y-2">
      {board.departments.map((d) => {
        const pct = d.expected ? Math.round((d.present / d.expected) * 100) : 0;
        return (
          <li key={d.department}>
            <div className="mb-0.5 flex justify-between text-[12px]">
              <span className="truncate text-[var(--text-main)]">{d.department}</span>
              <span className="tabular-nums text-[var(--text-muted)]">{d.present}/{d.expected} · {pct}%{d.late ? ` · ${d.late} late` : ""}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--surface-2)]">
              <div className={cn("h-1.5 rounded-full", pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Utilization({ util }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Mini label="Avg allocated" value={`${util.average}%`} />
        <Mini label="On bench" value={util.benchCount} tone={util.benchCount ? "text-amber-600" : ""} />
        <Mini label="Over 100%" value={util.over.length} tone={util.over.length ? "text-rose-600" : ""} />
      </div>
      {util.over.length ? (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Over-allocated</div>
          <ul className="space-y-0.5 text-[12px]">
            {util.over.slice(0, 5).map((r) => (
              <li key={r.employeeId} className="flex justify-between"><span className="truncate">{r.employee}</span><b className="text-rose-600">{r.percent}%</b></li>
            ))}
          </ul>
        </div>
      ) : null}
      {util.bench.length ? (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">On bench (no project today)</div>
          <p className="text-[12px] text-[var(--text-main)]">{util.bench.slice(0, 8).map((r) => r.employee).join(", ")}{util.benchCount > 8 ? ` +${util.benchCount - 8} more` : ""}</p>
        </div>
      ) : null}
    </div>
  );
}

function Movement({ movement, headcount }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Mini label="Joined this month" value={movement.joined.length} tone="text-emerald-600" />
        <Mini label="Left this month" value={movement.exited.length} tone={movement.exited.length ? "text-rose-600" : ""} />
      </div>
      {[...movement.joined.map((r) => ({ ...r, kind: "joined" })), ...movement.exited.map((r) => ({ ...r, kind: "left" }))].slice(0, 6).map((r) => (
        <div key={`${r.kind}-${r.employeeId}`} className="flex items-center gap-2 text-[12px]">
          {r.kind === "joined" ? <UserPlus size={12} className="text-emerald-500" /> : <UserMinus size={12} className="text-rose-500" />}
          <span className="min-w-0 flex-1 truncate text-[var(--text-main)]">{r.employee}</span>
          <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{day(r.date)}</span>
        </div>
      ))}
      {headcount?.length ? (
        <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-2">
          {headcount.map((h) => (
            <span key={h.status} className="rounded-lg bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--text-main)]">{h.status} <b>{h.count}</b></span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PayrollHiring({ payroll, recruitment }) {
  return (
    <div className="space-y-3">
      {usable(payroll) ? (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Payroll</div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--text-main)]">This month</span>
            <b className={payroll.current ? "text-emerald-600" : "text-amber-600"}>{payroll.current ? payroll.current.status : "Not started"}</b>
          </div>
          {!payroll.current && payroll.last ? (
            <div className="text-[11px] text-[var(--text-muted)]">Last run: {day(payroll.last.startDate)}–{day(payroll.last.endDate)} · {payroll.last.status}</div>
          ) : null}
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-1 text-[var(--text-main)]"><Receipt size={12} /> Reimbursements pending</span>
            <b>{payroll.reimbursements.pending} · {rupees(payroll.reimbursements.amount)}</b>
          </div>
          <More to="/app/hrm/payroll">Payroll</More>
        </div>
      ) : null}
      {usable(recruitment) ? (
        <div className={cn("space-y-1.5", usable(payroll) && "border-t border-[var(--border)] pt-2")}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Recruitment</div>
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Open jobs" value={recruitment.openJobs} />
            <Mini label="In pipeline" value={recruitment.inPipeline} />
          </div>
          <div className="flex flex-wrap gap-1">
            {recruitment.stages.filter((s) => s.count).map((s) => (
              <span key={s.stage} className="rounded bg-[var(--surface-2)] px-1.5 text-[11px]">{s.stage} <b>{s.count}</b></span>
            ))}
          </div>
          {recruitment.interviews.length ? (
            <ul className="space-y-0.5 text-[12px]">
              {recruitment.interviews.map((i) => (
                <li key={i.id} className="flex justify-between gap-2"><span className="truncate">{i.candidate}</span><span className="shrink-0 text-[11px] text-[var(--text-muted)]">{i.at ? String(i.at).replace("T", " ").slice(0, 16) : ""}</span></li>
              ))}
            </ul>
          ) : <p className="text-[11px] text-[var(--text-muted)]">No interviews today or tomorrow.</p>}
          <More to="/app/hrm/candidate">Candidates</More>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Admin / manager HRM overview. Data: GET /hrm/dashboard/overview (blocks the user may not
 * see come back as null; a failing block as { error }).
 */
export function HrmAdminOverview({ data, token, onChanged, HoursChart }) {
  const tz = data.timezone || "Asia/Kolkata";
  const showPayHire = usable(data.payroll) || usable(data.recruitment);
  return (
    <div className="space-y-4">
      {usable(data.board) ? <TodayBoard board={data.board} tz={tz} /> : data.board ? <Failed /> : null}

      <div className="grid items-start gap-4 xl:grid-cols-3">
        {data.approvals ? (
          <Panel
            title="Waiting for your approval"
            icon={ClipboardList}
            count={usable(data.approvals) ? data.approvals.total : 0}
            className="xl:col-span-2"
            action={<More to="/app/hrm/leave">Requests</More>}
          >
            {usable(data.approvals) ? <Approvals approvals={data.approvals} token={token} onChanged={onChanged} /> : <Failed />}
          </Panel>
        ) : null}
        <Panel
          title="Alerts"
          icon={AlertTriangle}
          count={usable(data.alerts) ? data.alerts.total : 0}
          className={data.approvals ? "" : "xl:col-span-3"}
          action={
            // Alert history lives in the live board further down this page.
            <button
              type="button"
              onClick={() => document.getElementById("hrm-live-board")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
            >
              History <ArrowRight size={12} />
            </button>
          }
        >
          {usable(data.alerts) ? <Alerts alerts={data.alerts} token={token} onChanged={onChanged} tz={tz} /> : <Failed />}
        </Panel>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Who is away" icon={CalendarOff} action={<More to="/app/hrm/leave" />}>
          {usable(data.away) ? <Away away={data.away} /> : <Failed />}
        </Panel>
        <Panel title="Coming up" icon={PartyPopper}>
          {usable(data.upcoming) ? <Upcoming upcoming={data.upcoming} /> : <Failed />}
        </Panel>
        <Panel title="Productivity" icon={Gauge} action={<More to="/app/hrm/work-reports">Reports</More>}>
          {usable(data.productivity) ? <Productivity work={data.productivity} /> : <Failed />}
        </Panel>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Panel title="Work hours & billable" icon={Gauge} className="xl:col-span-2" action={<span className="text-[11px] text-[var(--text-muted)]">{data.startDate} → {data.endDate}</span>}>
          <HoursChart rows={data.trend || []} />
        </Panel>
        <Panel title="Attendance by department · today" icon={Users}>
          {usable(data.board) ? <DepartmentToday board={data.board} /> : <Failed />}
        </Panel>
      </div>

      <div className={cn("grid items-start gap-4 md:grid-cols-2", showPayHire ? "xl:grid-cols-3" : "")}>
        <Panel title="Team allocation" icon={Briefcase} action={<More to="/app/hrm/allocations" />}>
          {usable(data.utilization) ? <Utilization util={data.utilization} /> : <Failed />}
        </Panel>
        <Panel title="Headcount" icon={Users} action={<More to="/app/hrm/employees">Employees</More>}>
          {usable(data.movement) ? <Movement movement={data.movement} headcount={data.headcount} /> : <Failed />}
        </Panel>
        {showPayHire ? (
          <Panel title="Payroll & hiring" icon={LogOut}>
            <PayrollHiring payroll={data.payroll} recruitment={data.recruitment} />
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
