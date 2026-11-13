import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FilePenLine,
  Download,
  LogOut,
  PenLine,
  RotateCcw,
  Search,
  Timer,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { cn } from "../../lib/cn";
import { SearchableSelect } from "../../components/forms/SearchableSelect";
import { HrmForm } from "./HrmForm";
import { forms } from "./hrmForms";
import { downloadHrm, hrm, queryString } from "./hrmApi";
import { clock, hm } from "./hrmTime";

// Day codes from GET /hrm/attendance/month.
const CODES = {
  P: { label: "Present", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", cell: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25" },
  A: { label: "Absent", chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", cell: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/25" },
  MP: { label: "Missing punch", chip: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300", cell: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/25" },
  HD: { label: "Half day", chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", cell: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25" },
  L: { label: "Leave", chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", cell: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/25" },
  "L½": { label: "Half-day leave", chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", cell: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/25" },
  WO: { label: "Weekly off", chip: "bg-slate-200 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300", cell: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/25" },
  H: { label: "Holiday", chip: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300", cell: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/25" },
  SW: { label: "Worked on off day", chip: "bg-yellow-200 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300", cell: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30" },
  CO: { label: "Comp off", chip: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300", cell: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/25" },
};
const FLAGS = [
  ["late", "Late", Clock3, "text-orange-500"],
  ["punchError", "Punch error", AlertTriangle, "text-amber-500"],
  ["early", "Early checkout", LogOut, "text-rose-500"],
  ["afterShift", "After shift", Timer, "text-sky-500"],
];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekday = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
const prettyDate = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });
const shiftMonth = (ym, delta) => {
  const d = new Date(`${ym}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
};
// Toolbar controls share one pill shape (the select keeps its own radius unless overridden).
const PILL = "h-10 py-2 text-sm! rounded-full!";
const fmtDays = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
// "Morning Shift (10:00 – 19:00)" -> "Morning Shift"; the full name stays in the tooltip.
const shortShift = (name) => String(name || "").replace(/\s*\(.*\)\s*$/, "") || "—";

function Chip({ code, className }) {
  if (!code) return <span className="text-[var(--text-muted)]">—</span>;
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", CODES[code]?.chip, className)}>{CODES[code]?.label || code}</span>;
}

function DayFlags({ day, size = 11 }) {
  const on = FLAGS.filter(([key]) => day?.[key]);
  if (!on.length) return null;
  return (
    <span className="flex items-center justify-center gap-0.5">
      {on.map(([key, label, Icon, color]) => (
        <Icon key={key} size={size} className={color} aria-label={label} />
      ))}
    </span>
  );
}

function Legend({ compact = false }) {
  return (
    <div className={cn("flex flex-wrap items-center text-[var(--text-muted)]", compact ? "gap-x-3 gap-y-1 text-[11px]" : "gap-x-4 gap-y-2 text-xs")}>
      {Object.entries(CODES).map(([code, { label, chip }]) => (
        <span key={code} className="inline-flex items-center gap-1.5">
          <span className={cn("inline-flex min-w-[26px] justify-center rounded-md px-1.5 py-0.5 text-[10px] font-bold", chip)}>{code}</span>
          {label}
        </span>
      ))}
      {FLAGS.map(([key, label, Icon, color]) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <Icon size={13} className={color} /> {label}
        </span>
      ))}
    </div>
  );
}

function MonthPicker({ month, onChange, years }) {
  const [y, m] = month.split("-");
  return (
    <div className="flex items-center gap-2">
      <Button size="xs" variant="secondary" aria-label="Previous month" onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeft size={14} />
      </Button>
      <select
        aria-label="Month"
        className="h-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
        value={m}
        onChange={(e) => onChange(`${y}-${e.target.value}`)}
      >
        {MONTHS.map((name, i) => (
          <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>
        ))}
      </select>
      <select
        aria-label="Year"
        className="h-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
        value={y}
        onChange={(e) => onChange(`${e.target.value}-${m}`)}
      >
        {years.map((year) => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
      <Button size="xs" variant="secondary" aria-label="Next month" onClick={() => onChange(shiftMonth(month, 1))}>
        <ChevronRight size={14} />
      </Button>
    </div>
  );
}

function Pager({ total, page, limit, onPage, onLimit, sizes = [10, 20, 50, 100] }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 text-xs">
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        <span>{total} item{total === 1 ? "" : "s"}</span>
        <span>·</span>
        <span>Per page</span>
        {sizes.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onLimit(size)}
            className={cn("rounded-full px-2.5 py-1 font-semibold", limit === size ? "bg-[var(--primary)] text-white" : "hover:bg-[var(--hover-bg)]")}
          >
            {size}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button size="xs" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={13} /> Prev
        </Button>
        <span className="text-[var(--text-muted)]">Page {page} of {pages}</span>
        <Button size="xs" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight size={13} />
        </Button>
      </div>
    </div>
  );
}

/** One day: status, punches and the follow-up actions. */
function DayDetail({ day, employee, timezone, can, isSelf, onClose, onAction }) {
  const rows = [
    ["Shift", day.shift || "—"],
    ["In", clock(day.checkIn, timezone)],
    ["Out", day.checkIn && !day.checkOut ? (day.live ? "Still working" : "Not punched out") : clock(day.checkOut, timezone)],
    ["Worked", day.workedMinutes ? hm(day.workedMinutes) : "—"],
    ["Late", day.lateMinutes ? hm(day.lateMinutes) : "—"],
    ["Early checkout", day.earlyMinutes ? hm(day.earlyMinutes) : "—"],
    ["After shift", day.overtimeMinutes ? hm(day.overtimeMinutes) : "—"],
    ["Work mode", day.workMode || "—"],
  ];
  return (
    <Modal open title={prettyDate(day.date)} subtitle={`${employee.fullName} · ${employee.employeeNumber}`} width="min(520px, 95vw)" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Chip code={day.code} />
          {day.unmarked && <span className="text-xs text-[var(--text-muted)]">Nothing recorded for this working day</span>}
          {day.leave && <span className="text-xs text-violet-600">{day.leave.fraction === 1 ? "Full day" : "Half day"} {day.leave.paid ? "paid" : "unpaid"} leave</span>}
          <DayFlags day={day} size={14} />
        </div>
        <dl className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-[var(--text-muted)]">{label}</dt>
              <dd className="font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          {can("hr_approve") && (
            <Button size="sm" onClick={() => onAction("attendance-mark", { employeeId: employee.id, workDate: day.date })}>
              <PenLine size={14} /> Mark attendance
            </Button>
          )}
          {isSelf && can("self_service") && day.date && (
            <Button size="sm" variant="secondary" onClick={() => onAction("regularization", { employeeId: employee.id, startDate: day.date, endDate: day.date, title: `Correction for ${day.date}` })}>
              Request correction
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Calendar + day list for one employee. */
function MyAttendance({ token, metadata, employees, employeeId, month, setMonth, years, onDay, refresh }) {
  const timezone = metadata.policy.timezone || "Asia/Kolkata";
  const own = metadata.ownEmployeeId || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const chosen = employeeId || own || employees[0]?.id || "";
  useEffect(() => {
    if (!chosen) return undefined;
    let active = true;
    hrm(token, `/attendance/month?${queryString({ month, employeeId: chosen, limit: 1 })}`)
      .then((r) => active && (setData(r), setError("")))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [token, month, chosen, refresh]);
  useEffect(() => setPage(1), [month, chosen]);
  const row = data?.rows?.[0];
  const listed = useMemo(() => (row ? row.days.filter((d) => d.date <= data.today && d.code).slice().reverse() : []), [row, data]);
  if (!chosen)
    return <Card className="p-5 text-sm text-[var(--text-muted)]">No employee profile is linked to your login, and there is no employee to show.</Card>;
  const firstWeekday = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7; // Monday first
  const t = row?.totals;
  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <MonthPicker month={month} onChange={setMonth} years={years} />
            {t && (
              <p className="flex gap-3 text-sm">
                <span>Present <b className="text-emerald-600">{fmtDays(t.present)}</b></span>
                <span>Absent <b className="text-rose-600">{t.absent}</b></span>
                <span>Leave <b className="text-violet-600">{fmtDays(t.leave)}</b></span>
                {t.missingPunch > 0 && <span>Missing punch <b className="text-pink-600">{t.missingPunch}</b></span>}
              </p>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstWeekday }, (_, i) => <div key={`pad-${i}`} />)}
            {(row?.days || data?.dates?.map((date) => ({ date })) || []).map((day) => {
              const style = CODES[day.code]?.cell;
              const isToday = day.date === data?.today;
              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={!row}
                  onClick={() => row && onDay(day, row.employee, chosen === own)}
                  title={CODES[day.code]?.label || "Nothing yet"}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 rounded-[12px] border text-base font-bold transition hover:brightness-95",
                    style || "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]",
                    isToday && "ring-2 ring-[var(--primary)] ring-offset-1 ring-offset-[var(--surface)]",
                  )}
                >
                  {Number(day.date.slice(8))}
                  <DayFlags day={day} />
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--text-muted)]">Click a day for its status, punches and actions.</p>
        </Card>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-[var(--surface-2)] text-left text-xs uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  {["Date", "Shift", "In", "Out", "Hours", "Status", "Late", "Early out", "Overtime"].map((h) => (
                    // Shift only on wide screens, so In/Out/Late/Early/Overtime always fit.
                    <th key={h} className={cn("px-2.5 py-2.5 font-semibold", h === "Shift" && "hidden min-[1800px]:table-cell")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {listed.slice((page - 1) * limit, page * limit).map((d) => (
                  <tr key={d.date} className="cursor-pointer hover:bg-[var(--hover-bg)]" onClick={() => onDay(d, row.employee, chosen === own)}>
                    <td className="whitespace-nowrap px-2.5 py-2.5 font-semibold">{prettyDate(d.date)}</td>
                    <td className="hidden whitespace-nowrap px-2.5 py-2.5 text-[var(--text-muted)] min-[1800px]:table-cell" title={d.shift || ""}>{d.checkIn ? shortShift(d.shift) : "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 tabular-nums">{d.checkIn ? clock(d.checkIn, timezone) : "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 tabular-nums">{d.checkOut ? clock(d.checkOut, timezone) : d.checkIn ? (d.live ? "Working" : "—") : "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 font-semibold tabular-nums">{d.workedMinutes ? hm(d.workedMinutes) : "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5">
                      <span className="inline-flex items-center gap-1.5"><Chip code={d.code} /><DayFlags day={d} size={12} /></span>
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 text-orange-600 tabular-nums">{d.lateMinutes ? hm(d.lateMinutes) : "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 text-rose-600 tabular-nums">{d.earlyMinutes ? hm(d.earlyMinutes) : "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 text-sky-600 tabular-nums">{d.overtimeMinutes ? hm(d.overtimeMinutes) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {row && !listed.length && <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No days yet in this month.</p>}
          </div>
          {listed.length > 0 && <Pager total={listed.length} page={page} limit={limit} onPage={setPage} onLimit={(n) => (setLimit(n), setPage(1))} sizes={[10, 20, 50]} />}
        </Card>
      </div>
    </div>
  );
}

/** Employees x days for the month. */
function AttendanceChart({ token, filters, setSort, month, onDay, refresh }) {
  const { search, locationId, employeeId, sort } = filters;
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [query, locationId, employeeId, month, limit]);
  useEffect(() => {
    let active = true;
    hrm(token, `/attendance/month?${queryString({ month, search: query, locationId, employeeId, sort, page, limit })}`)
      .then((r) => active && (setData(r), setError("")))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [token, month, query, locationId, employeeId, sort, page, limit, refresh]);
  const [y, m] = month.split("-");
  const monthName = `${MONTHS[Number(m) - 1]} ${y}`;
  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th rowSpan={2} className="sticky left-0 z-20 min-w-[200px] border-b border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left">
                  <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => setSort((s) => (s === "asc" ? "desc" : "asc"))}>
                    Employee {sort === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                  </button>
                </th>
                <th colSpan={data?.dates?.length || 1} className="border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-normal">
                  {/* Month name and the legend share the header row. */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                    <span className="text-base font-semibold text-[var(--text-main)]">{monthName}</span>
                    <Legend compact />
                  </div>
                </th>
                <th rowSpan={2} className="sticky right-[92px] z-20 w-[64px] min-w-[64px] border-b border-l border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs font-semibold uppercase tracking-wider">Total</th>
                <th rowSpan={2} className="sticky right-0 z-20 w-[92px] min-w-[92px] border-b border-l border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs font-semibold uppercase tracking-wider">Overtime</th>
              </tr>
              <tr>
                {(data?.dates || []).map((date) => {
                  const wd = weekday(date);
                  return (
                    <th key={date} className={cn("min-w-[32px] border-b border-[var(--border)] bg-[var(--surface-2)] px-0 py-1.5 text-center", date === data.today && "text-[var(--primary)]")}>
                      <span className="block text-sm font-bold">{Number(date.slice(8))}</span>
                      <span className="block text-[10px] font-semibold text-[var(--text-muted)]">{wd}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(data?.rows || []).map((r) => (
                <tr key={r.employee.id} className="group">
                  <td className="sticky left-0 z-10 max-w-[200px] border-b border-r border-[var(--border)] bg-[var(--surface)] px-3 py-2 group-hover:bg-[var(--hover-bg)]">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-bold">{r.employee.fullName.slice(0, 1)}</span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{r.employee.fullName}</p>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">{r.employee.employeeCode || r.employee.employeeNumber}{r.employee.location ? ` · ${r.employee.location}` : ""}</p>
                      </div>
                    </div>
                  </td>
                  {r.days.map((d) => (
                    <td key={d.date} className="border-b border-[var(--border)] px-[2px] py-1.5 text-center">
                      {d.code ? (
                        <button
                          type="button"
                          title={`${prettyDate(d.date)} · ${CODES[d.code]?.label || d.code}`}
                          onClick={() => onDay(d, r.employee, false)}
                          className={cn("flex h-10 w-full min-w-[28px] flex-col items-center justify-center gap-0.5 rounded-[6px] border px-0 text-[10px] font-bold leading-none transition hover:brightness-95", CODES[d.code]?.cell)}
                        >
                          {d.code}
                          <DayFlags day={d} size={10} />
                        </button>
                      ) : (
                        <span className="text-[var(--text-muted)]">·</span>
                      )}
                    </td>
                  ))}
                  <td className="sticky right-[92px] z-10 w-[64px] border-b border-l border-[var(--border)] bg-[var(--surface)] px-2 text-center font-semibold tabular-nums group-hover:bg-[var(--hover-bg)]" title="Present / working days so far">
                    {fmtDays(r.totals.present)}/{fmtDays(r.totals.workingDays)}
                  </td>
                  <td className="sticky right-0 z-10 w-[92px] border-b border-l border-[var(--border)] bg-[var(--surface)] px-2 text-center text-xs tabular-nums group-hover:bg-[var(--hover-bg)]">
                    <span className="block font-semibold text-sky-600">{r.totals.overtimeMinutes ? hm(r.totals.overtimeMinutes) : "0h 00m"}</span>
                    {r.totals.late > 0 && <span className="block text-orange-600">{r.totals.late} late</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.rows.length && <p className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">No employees match these filters.</p>}
        </div>
        {data && <Pager total={data.total} page={page} limit={limit} onPage={setPage} onLimit={setLimit} />}
      </Card>
    </div>
  );
}

/** HRM → Attendance: "My attendance" calendar and the team attendance chart. */
export function HrmAttendance({ token, metadata, masters, can }) {
  const today = new Date().toISOString().slice(0, 10);
  const canChart = can("approve") || can("hr_approve") || can("view_team") || can("view_all");
  const [tab, setTab] = useState("mine");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [employees, setEmployees] = useState([]);
  const [day, setDay] = useState(null);
  const [editor, setEditor] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const own = metadata.ownEmployeeId || "";
  const [mineEmployee, setMineEmployee] = useState(own);
  const [filters, setFilters] = useState({ search: "", locationId: "", employeeId: "", sort: "asc" });
  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value ?? "" }));
  const locations = masters.filter((m) => m.type === "hrm_location");
  const actionLabel = tab === "chart" && canChart ? "hidden min-[1750px]:inline" : "hidden md:inline";
  const thisYear = Number(today.slice(0, 4));
  const years = Array.from({ length: 6 }, (_, i) => String(thisYear - 4 + i));
  useEffect(() => {
    if (!canChart) return undefined;
    let active = true;
    hrm(token, "/lookups?type=employees")
      .then((r) => active && setEmployees(r.rows || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token, canChart]);
  const [, monthNo] = month.split("-");
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(monthNo), 0)).toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      {/* Tabs, filters and actions share one row; it wraps on narrow screens. */}
      <Card className="flex flex-wrap items-center gap-2 p-2">
        <div className="inline-flex shrink-0 rounded-2xl bg-[var(--surface-2)] p-1">
          {[["mine", "My attendance"], ...(canChart ? [["chart", "Attendance chart"]] : [])].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn("whitespace-nowrap rounded-xl px-3.5 py-1.5 text-sm font-semibold transition", tab === key ? "bg-[var(--primary)] text-white shadow" : "text-[var(--text-muted)] hover:text-[var(--text-main)]")}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "chart" && canChart ? (
          <>
            <label className="relative min-w-[160px] flex-1">
              <span className="sr-only">Search</span>
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                className="h-10 w-full rounded-full border border-[var(--input-border)] bg-[var(--surface)] pl-9 pr-4 text-sm shadow-2xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-subtle)]"
                placeholder="Search name, email or code…"
                value={filters.search}
                onChange={(e) => setFilter("search")(e.target.value)}
              />
            </label>
            <div className="w-36 shrink-0">
              <SearchableSelect aria-label="Branch" value={filters.locationId} onChange={setFilter("locationId")} options={[{ value: "", label: "All branches" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} triggerClassName={PILL} />
            </div>
            <div className="w-40 shrink-0">
              <SearchableSelect aria-label="Employee" searchable value={filters.employeeId} onChange={setFilter("employeeId")} options={[{ value: "", label: "All employees" }, ...employees.map((e) => ({ value: e.id, label: e.fullName }))]} triggerClassName={PILL} />
            </div>
            <div className="w-32 shrink-0">
              <SearchableSelect aria-label="Month" value={month.slice(5)} onChange={(v) => v && setMonth(`${month.slice(0, 4)}-${v}`)} options={MONTHS.map((name, i) => ({ value: String(i + 1).padStart(2, "0"), label: name }))} triggerClassName={PILL} />
            </div>
            <div className="w-24 shrink-0">
              <SearchableSelect aria-label="Year" value={month.slice(0, 4)} onChange={(v) => v && setMonth(`${v}-${month.slice(5)}`)} options={years.map((v) => ({ value: v, label: v }))} triggerClassName={PILL} />
            </div>
            <Button size="sm" variant="ghost" aria-label="Reset filters" title="Reset filters" onClick={() => setFilters({ search: "", locationId: "", employeeId: "", sort: "asc" })}>
              <RotateCcw size={14} />
            </Button>
          </>
        ) : (
          canChart && (
            <>
              <div className="w-72 max-w-full shrink-0">
                <SearchableSelect
                  aria-label="Employee"
                  searchable
                  value={mineEmployee || employees[0]?.id || ""}
                  onChange={(v) => setMineEmployee(v || own)}
                  options={employees.map((e) => ({ value: e.id, label: `${e.fullName} · ${e.employeeNumber}` }))}
                  triggerClassName={PILL}
                />
              </div>
              {own && mineEmployee && mineEmployee !== own && (
                <Button size="sm" variant="ghost" onClick={() => setMineEmployee(own)}>
                  Back to mine
                </Button>
              )}
            </>
          )
        )}
        <div className="ml-auto flex shrink-0 flex-wrap gap-2">
          {can("hr_approve") && (
            <Button size="sm" variant="secondary" title="Mark attendance" aria-label="Mark attendance" onClick={() => setEditor({ config: forms["attendance-mark"] })}>
              <PenLine size={14} /> <span className={actionLabel}>Mark attendance</span>
            </Button>
          )}
          {can("self_service") && own && (
            <Button size="sm" variant="secondary" title="Request correction" aria-label="Request correction" onClick={() => setEditor({ config: forms.regularization, initial: { employeeId: own } })}>
              <FilePenLine size={14} /> <span className={actionLabel}>Request correction</span>
            </Button>
          )}
          {can("export") && (
            <Button
              size="sm"
              variant="secondary"
              title="Export"
              aria-label="Export"
              onClick={() => downloadHrm(token, `/export/attendance?${queryString({ startDate: `${month}-01`, endDate: monthEnd })}`, `attendance-${month}.csv`)}
            >
              <Download size={14} /> <span className={actionLabel}>Export</span>
            </Button>
          )}
        </div>
      </Card>
      {tab === "chart" && canChart ? (
        <AttendanceChart token={token} filters={filters} setSort={(update) => setFilters((f) => ({ ...f, sort: typeof update === "function" ? update(f.sort) : update }))} month={month} refresh={refresh} onDay={(d, employee, isSelf) => setDay({ d, employee, isSelf })} />
      ) : (
        <MyAttendance token={token} metadata={metadata} employees={employees} employeeId={mineEmployee} month={month} setMonth={setMonth} years={years} refresh={refresh} onDay={(d, employee, isSelf) => setDay({ d, employee, isSelf })} />
      )}
      {day && (
        <DayDetail
          day={day.d}
          employee={day.employee}
          isSelf={day.isSelf}
          timezone={metadata.policy.timezone || "Asia/Kolkata"}
          can={can}
          onClose={() => setDay(null)}
          onAction={(form, initial) => {
            setDay(null);
            setEditor({ config: forms[form], initial });
          }}
        />
      )}
      {editor && (
        <HrmForm
          token={token}
          metadata={metadata}
          masters={masters}
          employeeId={editor.initial?.employeeId || ""}
          initial={editor.initial}
          config={editor.config}
          can={can}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setRefresh((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
