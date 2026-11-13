import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FilePenLine,
  Download,
  ListFilter,
  LogOut,
  PenLine,
  Plus,
  RotateCcw,
  Search,
  Timer,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { cn } from "../../lib/cn";
import { SearchableSelect } from "../../components/forms/SearchableSelect";
import { FloatingDropdown } from "../../components/ui/FloatingDropdown";
import { Checkbox } from "../../components/ui/Checkbox";
import { employeePath } from "./employeeShared";
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
const PICKER = "h-8 py-1 text-sm! rounded-full!";
// "09:42 am" -> "9:42" for the small in–out line inside a calendar day.
const shortClock = (iso, timezone) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { timeZone: timezone, hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s*[ap]m$/i, "") : "";
// Minutes after midnight in the policy timezone, for the average check-in.
const minuteOfDay = (iso, timezone) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const get = (type) => Number(parts.find((x) => x.type === type)?.value || 0);
  return (get("hour") % 24) * 60 + get("minute");
};
const clockOfMinutes = (m) => {
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(Math.round(m % 60)).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
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
      {/* Themed dropdowns, same as the toolbar selects. */}
      <div className="w-36">
        <SearchableSelect
          aria-label="Month"
          searchable={false}
          value={m}
          onChange={(v) => v && onChange(`${y}-${v}`)}
          options={MONTHS.map((name, i) => ({ value: String(i + 1).padStart(2, "0"), label: name }))}
          triggerClassName={PICKER}
        />
      </div>
      <div className="w-24">
        <SearchableSelect
          aria-label="Year"
          searchable={false}
          value={y}
          onChange={(v) => v && onChange(`${v}-${m}`)}
          options={years.map((year) => ({ value: year, label: year }))}
          triggerClassName={PICKER}
        />
      </div>
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

// Wall-clock "HH:MM" on a date in the policy timezone -> epoch ms.
function zonedInstant(date, hhmm, timezone) {
  if (!date || !/^\d{1,2}:\d{2}/.test(hhmm || "")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const guess = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), h, m);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(guess));
  const get = (type) => Number(parts.find((x) => x.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return guess - (wall - guess);
}
// "5:36 pm" (accepts an ISO string or epoch ms).
const clock12 = (at, timezone) =>
  at || at === 0 ? new Date(at).toLocaleTimeString("en-IN", { timeZone: timezone, hour: "numeric", minute: "2-digit", hour12: true }) : "—";
// "1:30–2:05 pm", "11:50 am–12:30 pm", or "1:30 pm–now" while it is still running.
function timeRange(a, b, timezone) {
  const x = clock12(a, timezone);
  if (!b) return `${x}–now`;
  const y = clock12(b, timezone);
  return x.slice(-2) === y.slice(-2) ? `${x.slice(0, -3)}–${y}` : `${x}–${y}`;
}
const dayMonth = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const REQUEST_TONE = {
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  Submitted: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

// Re-renders every minute while `active`, for "working since … · 3h 12m so far".
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** One bar for the day: the shift window, time worked, lunch, and time outside the zone or offline. */
function DayTimeline({ day, events, offlineMinutes, timezone, now }) {
  const checkIn = day.checkIn ? Date.parse(day.checkIn) : null;
  const end = day.checkOut ? Date.parse(day.checkOut) : day.live ? now : null;
  const shiftStart = zonedInstant(day.date, day.shiftStart, timezone);
  let shiftEnd = zonedInstant(day.date, day.shiftEnd, timezone);
  if (shiftStart && shiftEnd && shiftEnd <= shiftStart) shiftEnd += 86400000;
  const lunchStart = day.lunchStart ? Date.parse(day.lunchStart) : null;
  const lunchEnd = day.lunchEnd ? Date.parse(day.lunchEnd) : lunchStart && day.live ? now : null;
  const gaps = [];
  const open = {};
  for (const ev of events || []) {
    const t = Date.parse(ev.at);
    if (ev.kind === "exit") open.out = t;
    if (ev.kind === "return" && open.out) gaps.push(["out", open.out, t]), (open.out = null);
    if (ev.kind === "offline") open.off = t;
    if (ev.kind === "online" && open.off) gaps.push(["off", open.off, t]), (open.off = null);
  }
  if (open.out && end) gaps.push(["out", open.out, end]);
  if (open.off && end) gaps.push(["off", open.off, end]);
  const points = [shiftStart, shiftEnd, checkIn, end].filter((v) => Number.isFinite(v));
  if (points.length < 2) return null;
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const pct = (t) => ((t - lo) / (hi - lo || 1)) * 100;
  const seg = (a, b) => ({ left: `${pct(a)}%`, width: `${Math.max(1, pct(b) - pct(a))}%` });
  const outside = gaps.filter(([k]) => k === "out").reduce((s, [, a, b]) => s + (b - a) / 60000, 0);
  const keys = [
    shiftStart && shiftEnd && ["bg-slate-300 dark:bg-slate-500/50", `Shift ${day.shiftStart}–${day.shiftEnd}`],
    checkIn && ["bg-emerald-400", "Worked"],
    lunchStart && ["bg-amber-400", `Lunch ${hm(day.lunchMinutes || (lunchEnd ? (lunchEnd - lunchStart) / 60000 : 0))}`],
    outside > 0 && ["bg-rose-400", `Outside ${hm(outside)}`],
    offlineMinutes > 0 && ["bg-slate-500", `Offline ${hm(offlineMinutes)}`],
  ].filter(Boolean);
  return (
    <div className="mt-2.5">
      <div className="relative h-3 overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-[var(--border)]">
        {shiftStart && shiftEnd && <span className="absolute inset-y-0 bg-slate-200 dark:bg-slate-500/25" style={seg(shiftStart, shiftEnd)} title={`Shift ${day.shiftStart}–${day.shiftEnd}`} />}
        {checkIn && end && <span className="absolute inset-y-[3px] rounded-full bg-emerald-400" style={seg(checkIn, end)} title={`Worked ${timeRange(day.checkIn, day.checkOut, timezone)}`} />}
        {checkIn && !end && <span className="absolute inset-y-0 w-1.5 rounded-full bg-pink-500" style={{ left: `${pct(checkIn)}%` }} title={`In ${clock12(checkIn, timezone)}, no clock-out`} />}
        {lunchStart && lunchEnd && <span className="absolute inset-y-0 bg-amber-400" style={seg(lunchStart, lunchEnd)} title={`Lunch ${timeRange(day.lunchStart, day.lunchEnd, timezone)}`} />}
        {gaps.map(([kind, a, b]) => (
          <span key={`${kind}-${a}`} className={cn("absolute inset-y-0", kind === "out" ? "bg-rose-400" : "bg-slate-500")} style={seg(a, b)} title={`${kind === "out" ? "Outside the zone" : "Offline"} ${timeRange(a, b, timezone)}`} />
        ))}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] tabular-nums text-[var(--text-muted)]">
        <span className="whitespace-nowrap">{clock12(lo, timezone)}</span>
        <span className="flex min-w-0 flex-wrap justify-center gap-x-2.5 gap-y-0.5">
          {keys.map(([color, label]) => (
            <span key={label} className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className={cn("h-2 w-2 rounded-full", color)} />
              {label}
            </span>
          ))}
        </span>
        <span className="whitespace-nowrap">{clock12(hi, timezone)}</span>
      </div>
    </div>
  );
}

/** The clicked day, shown under the "My attendance" calendar (no popup). */
function SelectedDay({ token, day, employee, timezone, today, can, isSelf, onAction, refresh }) {
  const isToday = day.date === today;
  const now = useNow(isToday && (day.live || !day.checkIn));
  const key = `${employee.id}|${day.date}|${day.checkIn || ""}|${day.checkOut || ""}|${refresh}`;
  const [timeline, setTimeline] = useState({ key: "", data: null });
  useEffect(() => {
    if (!day.checkIn) return undefined;
    let active = true;
    hrm(token, `/attendance/day-timeline?${queryString({ employeeId: employee.id, date: day.date })}`)
      .then((r) => active && setTimeline({ key, data: r }))
      .catch(() => active && setTimeline({ key, data: null }));
    return () => {
      active = false;
    };
  }, [token, employee.id, day.date, day.checkIn, key]);
  const info = timeline.key === key ? timeline.data : null;
  const place = info?.attendance?.place || day.workMode || "—";
  const lunch = day.lunchStart ? timeRange(day.lunchStart, day.lunchEnd, timezone) : day.checkIn ? "Not taken" : "—";
  const values = [
    ["In", day.checkIn ? clock(day.checkIn, timezone) : "—", ""],
    ["Out", day.checkIn && !day.checkOut ? (day.live ? "Working" : "Not out") : day.checkOut ? clock(day.checkOut, timezone) : "—", ""],
    ["Lunch", lunch, day.lunchStart ? "text-amber-600" : ""],
    ["Worked", day.workedMinutes ? hm(day.workedMinutes) : "—", ""],
    ["Late", day.lateMinutes ? hm(day.lateMinutes) : "—", day.lateMinutes ? "text-orange-600" : ""],
    ["Early out", day.earlyMinutes ? hm(day.earlyMinutes) : "—", day.earlyMinutes ? "text-rose-600" : ""],
    ["Overtime", day.overtimeMinutes ? hm(day.overtimeMinutes) : "—", day.overtimeMinutes ? "text-sky-600" : ""],
    ["Location", place, ""],
  ];
  // Live line for today only.
  let live = null;
  if (isToday) {
    const shiftStart = zonedInstant(day.date, day.shiftStart, timezone);
    if (!day.checkIn)
      live = shiftStart && now < shiftStart
        ? ["text-[var(--text-muted)]", `Shift starts at ${clock12(shiftStart, timezone)}`]
        : ["text-amber-600", `Not clocked in yet${shiftStart ? ` · shift started at ${clock12(shiftStart, timezone)}` : ""}`];
    else if (day.live)
      live = day.lunchStart && !day.lunchEnd
        ? ["text-amber-600", `On lunch since ${clock12(day.lunchStart, timezone)}`]
        : ["text-emerald-600", `Working since ${clock12(day.checkIn, timezone)} · ${hm((now - Date.parse(day.checkIn)) / 60000 - (day.lunchMinutes || 0))} so far`];
  }
  const past = day.date <= today;
  const notes = [
    day.shift && shortShift(day.shift),
    day.unmarked && "Nothing recorded",
    day.leave && `${day.leave.fraction === 1 ? "Full day" : "Half day"} ${day.leave.paid ? "paid" : "unpaid"} leave`,
    info?.attendance?.autoCheckoutAt && `Auto clocked out at ${clock12(info.attendance.autoCheckoutAt, timezone)}`,
    day.checkIn && !day.lunchStart && day.lunchAllowance > 0 && `Lunch allowance ${day.lunchAllowance}m`,
  ].filter(Boolean);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-bold">{prettyDate(day.date)}</span>
          <Chip code={day.code} />
          <DayFlags day={day} size={13} />
        </div>
        {past && (
          <div className="flex gap-1.5">
            {can("hr_approve") && (
              <Button size="xs" variant="secondary" onClick={() => onAction("attendance-mark", { employeeId: employee.id, workDate: day.date })}>
                <PenLine size={12} /> Mark
              </Button>
            )}
            {isSelf && can("self_service") && (
              <Button size="xs" variant="secondary" onClick={() => onAction("regularization", { employeeId: employee.id, startDate: day.date, endDate: day.date, title: `Correction for ${day.date}` })}>
                <FilePenLine size={12} /> Request correction
              </Button>
            )}
          </div>
        )}
      </div>
      {live && (
        <p className={cn("mt-1 flex items-center gap-1.5 text-xs font-semibold", live[0])}>
          {day.live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
          {live[1]}
        </p>
      )}
      <DayTimeline day={day} events={info?.events} offlineMinutes={info?.attendance?.offlineMinutes || 0} timezone={timezone} now={now} />
      <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1.5 @md:grid-cols-4">
        {values.map(([label, value, color]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
            <dd className={cn("truncate text-[13px] font-semibold tabular-nums", color)} title={String(value)}>{value}</dd>
          </div>
        ))}
      </dl>
      {notes.length > 0 && <p className="mt-1.5 truncate text-[11px] text-[var(--text-muted)]" title={notes.join(" · ")}>{notes.join(" · ")}</p>}
    </div>
  );
}

/** Leave balance for the year and this month's leave / correction requests. */
function SideInfo({ token, employeeId, month, isSelf, can, onAction, refresh }) {
  const key = `${employeeId}|${month}|${refresh}`;
  const [side, setSide] = useState({ key: "", data: null });
  useEffect(() => {
    if (!employeeId) return undefined;
    let active = true;
    hrm(token, `/attendance/side?${queryString({ employeeId, month })}`)
      .then((r) => active && setSide({ key, data: r }))
      .catch(() => active && setSide({ key, data: null }));
    return () => {
      active = false;
    };
  }, [token, employeeId, month, key]);
  const data = side.key === key ? side.data : null;
  if (!data) return null;
  const paid = data.balances.find((b) => b.monthly) || data.balances.find((b) => b.paid);
  const others = data.balances.filter((b) => b !== paid && b.balance !== 0);
  const shown = data.requests.slice(0, 3);
  return (
    <div className="grid gap-2 @md:grid-cols-2">
      <div className="rounded-xl border border-[var(--border)] p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Leave balance · {month.slice(0, 4)}</p>
          {isSelf && can("self_service") && (
            <Button size="xs" variant="secondary" onClick={() => onAction("leave", { employeeId })}>
              <Plus size={12} /> Apply
            </Button>
          )}
        </div>
        {paid ? (
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold tabular-nums text-violet-600">{fmtDays(paid.balance)}</span>
            <span className="text-xs text-[var(--text-muted)]">
              {paid.name}
              {paid.monthly ? " · +1 every month" : ""}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-[var(--text-muted)]">No leave types set up.</p>
        )}
        {others.length > 0 && (
          <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{others.map((b) => `${b.name} ${fmtDays(b.balance)}`).join(" · ")}</p>
        )}
      </div>
      <div className="rounded-xl border border-[var(--border)] p-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {isSelf ? "My requests" : "Requests"} · {MONTHS[Number(month.slice(5)) - 1].slice(0, 3)}
        </p>
        {shown.length ? (
          <ul className="mt-1 space-y-1">
            {shown.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate" title={r.title}>
                  <span className="font-semibold">{r.kind === "leave" ? "Leave" : "Correction"}</span>
                  {r.startDate && (
                    <span className="text-[var(--text-muted)]"> · {r.endDate && r.endDate !== r.startDate ? `${dayMonth(r.startDate)}–${dayMonth(r.endDate)}` : dayMonth(r.startDate)}</span>
                  )}
                </span>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", REQUEST_TONE[r.status] || "bg-slate-200 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300")}>{r.status}</span>
              </li>
            ))}
            {data.requests.length > shown.length && <li className="text-[11px] text-[var(--text-muted)]">+{data.requests.length - shown.length} more</li>}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-[var(--text-muted)]">No leave or correction requests this month.</p>
        )}
      </div>
    </div>
  );
}

function MyAttendance({ token, metadata, employees, employeeId, month, setMonth, years, can, onAction, refresh }) {
  const timezone = metadata.policy.timezone || "Asia/Kolkata";
  const own = metadata.ownEmployeeId || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [picked, setPicked] = useState("");
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
  const avgIn = useMemo(() => {
    const ins = (row?.days || []).filter((d) => d.checkIn).map((d) => minuteOfDay(d.checkIn, timezone));
    return ins.length ? clockOfMinutes(ins.reduce((a, b) => a + b, 0) / ins.length) : "—";
  }, [row, timezone]);
  if (!chosen)
    return <Card className="p-5 text-sm text-[var(--text-muted)]">No employee profile is linked to your login, and there is no employee to show.</Card>;
  const firstWeekday = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7; // Monday first
  const t = row?.totals;
  const days = row?.days || data?.dates?.map((date) => ({ date })) || [];
  // The day shown under the calendar: the one clicked, else today, else the last day so far.
  const selected =
    days.find((d) => d.date === picked) ||
    days.find((d) => d.date === data?.today) ||
    [...days].reverse().find((d) => d.date <= (data?.today || "")) ||
    days[0];
  const isSelf = chosen === own;
  const tiles = t
    ? [
        ["Present", `${fmtDays(t.present)}/${fmtDays(t.workingDays)}`, "text-emerald-600"],
        ["Absent", t.absent, "text-rose-600"],
        ["Leave", fmtDays(t.leave), "text-violet-600"],
        ["Late", t.late, "text-orange-600"],
        ["Missed punch", t.missingPunch, "text-pink-600"],
        ["Worked", hm(t.workedMinutes), "text-[var(--text-main)]"],
        ["Overtime", hm(t.overtimeMinutes), "text-sky-600"],
        ["Avg check-in", avgIn, "text-[var(--text-main)]"],
      ]
    : [];
  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <div className="grid gap-3 xl:h-[clamp(600px,calc(100dvh-12.5rem),720px)] xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
        <Card className="@container flex flex-col gap-2.5 p-3 xl:min-h-0 xl:overflow-y-auto">
          <MonthPicker month={month} onChange={setMonth} years={years} />
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstWeekday }, (_, i) => <div key={`pad-${i}`} />)}
            {days.map((day) => {
              const style = CODES[day.code]?.cell;
              const isToday = day.date === data?.today;
              const isSelected = day.date === selected?.date;
              const times = day.checkIn ? `${shortClock(day.checkIn, timezone)}–${day.checkOut ? shortClock(day.checkOut, timezone) : day.live ? "…" : "?"}` : "";
              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={!row}
                  aria-pressed={isSelected}
                  onClick={() => setPicked(day.date)}
                  title={[prettyDate(day.date), CODES[day.code]?.label || "Nothing yet", times, day.lunchStart && `Lunch ${timeRange(day.lunchStart, day.lunchEnd, timezone)}`].filter(Boolean).join(" · ")}
                  className={cn(
                    "relative flex h-12 flex-col items-center justify-center gap-px rounded-[10px] border text-sm font-bold leading-none transition hover:brightness-95",
                    style || "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]",
                    isSelected && "ring-2 ring-[var(--primary)] ring-offset-1 ring-offset-[var(--surface)]",
                  )}
                >
                  {isToday && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" aria-label="Today" />}
                  {Number(day.date.slice(8))}
                  {times && <span className="hidden whitespace-nowrap text-[9px] font-medium tracking-tight tabular-nums opacity-80 sm:block">{times}</span>}
                  <DayFlags day={day} size={9} />
                </button>
              );
            })}
          </div>
          {selected && row && (
            <SelectedDay token={token} day={selected} employee={row.employee} timezone={timezone} today={data.today} can={can} isSelf={isSelf} onAction={onAction} refresh={refresh} />
          )}
        </Card>
        <Card className="@container flex flex-col overflow-hidden p-0 xl:min-h-0">
          {tiles.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 border-b border-[var(--border)] p-2 @md:grid-cols-4 @3xl:grid-cols-8">
              {tiles.map(([label, value, color]) => (
                <div key={label} className="min-w-0 rounded-xl bg-[var(--surface-2)] px-2 py-1.5">
                  <p className="truncate text-[11px] font-medium text-[var(--text-muted)]" title={label}>{label}</p>
                  <p className={cn("truncate text-sm font-bold tabular-nums", color)}>{value}</p>
                </div>
              ))}
            </div>
          )}
          {row && (
            <div className="border-b border-[var(--border)] p-2">
              <SideInfo token={token} employeeId={row.employee.id} month={month} isSelf={isSelf} can={can} onAction={onAction} refresh={refresh} />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  {["Date", "Shift", "In", "Out", "Lunch", "Hours", "Status", "Late", "Early out", "Overtime"].map((h) => (
                    // Shift only on wide screens, so In/Out/Late/Early/Overtime always fit.
                    <th key={h} className={cn("px-2.5 py-2 font-semibold", h === "Shift" && "hidden min-[1800px]:table-cell")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {listed.slice((page - 1) * limit, page * limit).map((d) => (
                  <tr key={d.date} className={cn("cursor-pointer hover:bg-[var(--hover-bg)]", d.date === selected?.date && "bg-[var(--hover-bg)]")} onClick={() => setPicked(d.date)}>
                    <td className="whitespace-nowrap px-2.5 py-2 font-semibold">{prettyDate(d.date)}</td>
                    <td className="hidden whitespace-nowrap px-2.5 py-2 text-[var(--text-muted)] min-[1800px]:table-cell" title={d.shift || ""}>{d.checkIn ? shortShift(d.shift) : "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2 tabular-nums">{d.checkIn ? clock(d.checkIn, timezone) : "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2 tabular-nums">{d.checkOut ? clock(d.checkOut, timezone) : d.checkIn ? (d.live ? "Working" : "—") : "—"}</td>
                    <td className={cn("whitespace-nowrap px-2.5 py-2 tabular-nums", d.lunchStart && "text-amber-600")} title={d.lunchMinutes ? hm(d.lunchMinutes) : ""}>{d.lunchStart ? timeRange(d.lunchStart, d.lunchEnd, timezone) : "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2 font-semibold tabular-nums">{d.workedMinutes ? hm(d.workedMinutes) : "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2">
                      <span className="inline-flex items-center gap-1.5"><Chip code={d.code} /><DayFlags day={d} size={12} /></span>
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-orange-600 tabular-nums">{d.lateMinutes ? hm(d.lateMinutes) : "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-rose-600 tabular-nums">{d.earlyMinutes ? hm(d.earlyMinutes) : "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-sky-600 tabular-nums">{d.overtimeMinutes ? hm(d.overtimeMinutes) : "—"}</td>
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

/** Checkbox list behind the filter icon in the chart's Employee header. Nothing changes until Apply. */
function EmployeeFilter({ employees, value, onApply, close }) {
  const [draft, setDraft] = useState(() => new Set(value));
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const shown = employees.filter((e) => !term || `${e.fullName} ${e.employeeNumber || ""}`.toLowerCase().includes(term));
  const allShown = shown.length > 0 && shown.every((e) => draft.has(e.id));
  const toggle = (id) =>
    setDraft((d) => {
      const next = new Set(d);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setDraft((d) => {
      const next = new Set(d);
      shown.forEach((e) => (allShown ? next.delete(e.id) : next.add(e.id)));
      return next;
    });
  const apply = () => {
    // Everyone ticked is the same as no filter.
    onApply(draft.size >= employees.length ? [] : [...draft]);
    close();
  };
  return (
    <div className="flex w-[280px] flex-col">
      <div className="border-b border-[var(--border)] p-3">
        <label className="relative block">
          <span className="sr-only">Search employees</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            autoFocus
            className="h-9 w-full rounded-full border border-[var(--input-border)] bg-[var(--surface)] pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)]"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="max-h-[260px] overflow-y-auto py-1">
        {shown.length ? (
          <>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm font-semibold hover:bg-[var(--hover-bg)]">
              <Checkbox checked={allShown} onChange={toggleAll} />
              Select all
            </label>
            {shown.map((e) => (
              <label key={e.id} className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-[var(--hover-bg)]">
                <Checkbox checked={draft.has(e.id)} onChange={() => toggle(e.id)} />
                <span className="min-w-0 truncate">{e.fullName}</span>
              </label>
            ))}
          </>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">No employee found.</p>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2.5">
        <button type="button" className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)]" onClick={() => setDraft(new Set())}>
          Clear all
        </button>
        <Button size="sm" onClick={apply}>
          Apply
        </Button>
      </div>
    </div>
  );
}

/** Employees x days for the month. */
function AttendanceChart({ token, filters, setSort, setEmployeeIds, employees, month, onDay, refresh }) {
  const { search, locationId, employeeIds, sort } = filters;
  const employeeKey = employeeIds.join(",");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [query, locationId, employeeKey, month, limit]);
  useEffect(() => {
    let active = true;
    hrm(token, `/attendance/month?${queryString({ month, search: query, locationId, employeeIds: employeeKey, sort, page, limit })}`)
      .then((r) => active && (setData(r), setError("")))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [token, month, query, locationId, employeeKey, sort, page, limit, refresh]);
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
                <th rowSpan={2} className="sticky left-0 z-20 w-[150px] min-w-[150px] max-w-[150px] border-b border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">Employee</span>
                    <button
                      type="button"
                      aria-label={sort === "asc" ? "Sorted A to Z, switch to Z to A" : "Sorted Z to A, switch to A to Z"}
                      title={sort === "asc" ? "A → Z" : "Z → A"}
                      className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]"
                      onClick={() => setSort((s) => (s === "asc" ? "desc" : "asc"))}
                    >
                      {sort === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                    </button>
                    <FloatingDropdown
                      align="start"
                      trigger={({ ref, toggle, open }) => (
                        <button
                          ref={ref}
                          type="button"
                          aria-label="Filter employees"
                          title={employeeIds.length ? `${employeeIds.length} selected` : "Filter employees"}
                          onClick={toggle}
                          className={cn(
                            "relative rounded-md p-1 transition",
                            employeeIds.length || open ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]",
                          )}
                        >
                          <ListFilter size={13} />
                          {employeeIds.length > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--primary)] px-0.5 text-[9px] font-bold leading-none text-white">{employeeIds.length}</span>
                          )}
                        </button>
                      )}
                    >
                      {({ close }) => <EmployeeFilter employees={employees} value={employeeIds} onApply={setEmployeeIds} close={close} />}
                    </FloatingDropdown>
                  </div>
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
                  <td className="sticky left-0 z-10 w-[150px] min-w-[150px] max-w-[150px] border-b border-r border-[var(--border)] bg-[var(--surface)] px-3 py-2 group-hover:bg-[var(--hover-bg)]">
                    <Link to={employeePath(r.employee)} title={`Open profile: ${r.employee.fullName}`} className="block truncate font-semibold text-[var(--primary)]! hover:underline!">
                      {r.employee.fullName}
                    </Link>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">{r.employee.employeeCode || r.employee.employeeNumber}</p>
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
  // Admins (Super Admin / company-wide HR) land on the chart; everyone else on their own calendar.
  const adminFirst = canChart && can("view_all");
  const [tab, setTab] = useState(adminFirst ? "chart" : "mine");
  const tabs = adminFirst
    ? [["chart", "Attendance chart"], ["mine", "My attendance"]]
    : [["mine", "My attendance"], ...(canChart ? [["chart", "Attendance chart"]] : [])];
  const [month, setMonth] = useState(today.slice(0, 7));
  const [employees, setEmployees] = useState([]);
  const [day, setDay] = useState(null);
  const [editor, setEditor] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const own = metadata.ownEmployeeId || "";
  const [mineEmployee, setMineEmployee] = useState(own);
  const [filters, setFilters] = useState({ search: "", locationId: "", employeeIds: [], sort: "asc" });
  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value ?? "" }));
  const setEmployeeIds = (ids) => setFilters((f) => ({ ...f, employeeIds: ids }));
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
          {tabs.map(([key, label]) => (
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
              <SearchableSelect
                aria-label="Employee"
                searchable
                value={filters.employeeIds.length === 1 ? filters.employeeIds[0] : filters.employeeIds.length ? "__many" : ""}
                onChange={(v) => v !== "__many" && setEmployeeIds(v ? [v] : [])}
                options={[
                  { value: "", label: "All employees" },
                  ...(filters.employeeIds.length > 1 ? [{ value: "__many", label: `${filters.employeeIds.length} employees` }] : []),
                  ...employees.map((e) => ({ value: e.id, label: e.fullName })),
                ]}
                triggerClassName={PILL}
              />
            </div>
            <div className="w-32 shrink-0">
              <SearchableSelect aria-label="Month" value={month.slice(5)} onChange={(v) => v && setMonth(`${month.slice(0, 4)}-${v}`)} options={MONTHS.map((name, i) => ({ value: String(i + 1).padStart(2, "0"), label: name }))} triggerClassName={PILL} />
            </div>
            <div className="w-24 shrink-0">
              <SearchableSelect aria-label="Year" value={month.slice(0, 4)} onChange={(v) => v && setMonth(`${v}-${month.slice(5)}`)} options={years.map((v) => ({ value: v, label: v }))} triggerClassName={PILL} />
            </div>
            <Button size="sm" variant="ghost" aria-label="Reset filters" title="Reset filters" onClick={() => setFilters({ search: "", locationId: "", employeeIds: [], sort: "asc" })}>
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
        <AttendanceChart token={token} filters={filters} employees={employees} setEmployeeIds={setEmployeeIds} setSort={(update) => setFilters((f) => ({ ...f, sort: typeof update === "function" ? update(f.sort) : update }))} month={month} refresh={refresh} onDay={(d, employee, isSelf) => setDay({ d, employee, isSelf })} />
      ) : (
        <MyAttendance token={token} metadata={metadata} employees={employees} employeeId={mineEmployee} month={month} setMonth={setMonth} years={years} can={can} refresh={refresh} onAction={(form, initial) => setEditor({ config: forms[form], initial })} />
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
