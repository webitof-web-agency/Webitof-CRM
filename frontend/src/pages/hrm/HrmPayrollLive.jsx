import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, IndianRupee, ReceiptText, RefreshCw, Users } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { formatDate, formatINR } from "../../lib/format";
import { hrm } from "./hrmApi";
import { clock } from "./hrmTime";

const REFRESH_MS = 60000;
const money = (v) => formatINR(v, { decimals: 0 });
const monthLabel = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

function Tile({ icon: Icon, label, value, hint, tone = "text-[var(--primary)] bg-indigo-500/10" }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-wider text-[var(--text-muted)]">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
        {hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
    </div>
  );
}

/** "Payslip so far" for one employee, from the live calculation. */
function LivePayslip({ row, data, onClose }) {
  const lines = [
    ["Monthly salary", money(row.monthlySalary)],
    ["Working days this month", row.workingDays],
    ["Holidays this month", row.holidays],
    ["Days so far (till yesterday / today)", row.elapsedDays],
    ["Present", row.present],
    ["Half days", row.halfDays],
    ["Paid leave", row.paidLeave],
    ["Unpaid leave", row.unpaidLeave],
    ["Absent", row.absent],
    ["Not marked yet", row.unmarked],
    ["Working days left", row.remaining],
  ];
  return (
    <Modal open title="Live payslip" subtitle={`${row.fullName} · ${monthLabel(data.month)}`} width="min(560px, 95vw)" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--text-muted)]">Earned so far</p>
            <p className="text-xl font-bold">{money(row.earned.net)}</p>
            <p className="text-xs text-[var(--text-muted)]">Gross {money(row.earned.gross)} · Deductions {money(row.earned.deductions)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--text-muted)]">Expected for the month</p>
            <p className="text-xl font-bold">{money(row.projected.net)}</p>
            <p className="text-xs text-[var(--text-muted)]">If the remaining {row.remaining + row.unmarked} day(s) are paid</p>
          </div>
        </div>
        <dl className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)]">
          {lines.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-[var(--text-muted)]">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {row.unmarkedDates.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-amber-600">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            No attendance or leave on {row.unmarkedDates.map((d) => formatDate(d)).join(", ")}. Mark these in Attendance; until then they are not counted as earned.
          </p>
        )}
        <p className="text-xs text-[var(--text-muted)]">
          Live preview, not a payslip of record. The final payslip is created when HR runs payroll for {monthLabel(data.month)} after the month ends.
        </p>
      </div>
    </Modal>
  );
}

/** This month's payroll so far, per employee, refreshed every minute. */
export function HrmPayrollLive({ token, metadata, can }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [tick, setTick] = useState(0),
    [open, setOpen] = useState(null);
  const timezone = metadata.policy.timezone || "Asia/Kolkata";
  const allowed = can("view_salary");
  useEffect(() => {
    if (!allowed) return undefined;
    let active = true;
    hrm(token, "/payroll/live")
      .then((r) => active && (setData(r), setError("")))
      .catch((e) => active && setError(e.message));
    const timer = setInterval(() => !document.hidden && setTick((n) => n + 1), REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token, tick, allowed]);
  if (!allowed) return null;
  if (error) return <Card className="p-4 text-sm text-rose-600" role="alert">Live payroll: {error}</Card>;
  if (!data) return <Card className="h-40 animate-pulse bg-[var(--surface-2)]" aria-label="Loading live payroll" />;
  const t = data.totals;
  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live payroll · {monthLabel(data.month)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            1 – {formatDate(data.today)} so far · updated {clock(data.generatedAt, timezone)} · refreshes every minute
          </p>
        </div>
        <Button size="xs" variant="ghost" onClick={() => setTick((n) => n + 1)}>
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={IndianRupee} label="Earned so far" value={money(t.earnedNet)} hint="net, all employees" tone="text-emerald-600 bg-emerald-500/10" />
        <Tile icon={CalendarClock} label="Expected this month" value={money(t.projectedNet)} hint="if remaining days are paid" />
        <Tile icon={Users} label="Employees" value={t.employees} hint={t.missingSalary ? `${t.missingSalary} without salary` : "all have salary"} tone={t.missingSalary ? "text-rose-600 bg-rose-500/10" : undefined} />
        <Tile icon={AlertTriangle} label="Days not marked" value={t.unmarked} hint={t.unmarked ? "mark in Attendance" : "all marked"} tone={t.unmarked ? "text-amber-600 bg-amber-500/10" : "text-emerald-600 bg-emerald-500/10"} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--text-muted)]">
              <th className="py-2 pr-3 font-semibold">Employee</th>
              <th className="py-2 pr-3 font-semibold">Monthly</th>
              <th className="py-2 pr-3 font-semibold">Days</th>
              <th className="py-2 pr-3 font-semibold">Earned so far</th>
              <th className="py-2 pr-3 font-semibold">Expected</th>
              <th className="py-2 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {data.rows.map((r) => {
              const done = r.workingDays ? Math.round(((r.workingDays - r.remaining) / r.workingDays) * 100) : 0;
              return (
                <tr key={r.employeeId} className="align-top">
                  <td className="py-2.5 pr-3">
                    <p className="font-semibold">{r.fullName}</p>
                    <p className="text-xs text-[var(--text-muted)]">{r.employeeNumber} · {r.status}</p>
                  </td>
                  <td className="py-2.5 pr-3">
                    {r.missingSalary ? <span className="text-xs font-semibold text-rose-600">No salary set</span> : money(r.monthlySalary)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="mb-1 h-1.5 w-28 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${done}%` }} />
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {r.present} present{r.halfDays ? ` · ${r.halfDays} half` : ""}{r.paidLeave ? ` · ${r.paidLeave} leave` : ""}
                      {r.absent ? ` · ${r.absent} absent` : ""}{r.unpaidLeave ? ` · ${r.unpaidLeave} unpaid` : ""}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {r.remaining} left of {r.workingDays}{r.holidays ? ` · ${r.holidays} holiday${r.holidays > 1 ? "s" : ""}` : ""}
                      {r.unmarked ? <span className="font-semibold text-amber-600"> · {r.unmarked} not marked</span> : null}
                    </p>
                  </td>
                  <td className="py-2.5 pr-3 font-semibold">{r.missingSalary ? "—" : money(r.earned.net)}</td>
                  <td className="py-2.5 pr-3">{r.missingSalary ? "—" : money(r.projected.net)}</td>
                  <td className="py-2.5 text-right">
                    {!r.missingSalary && (
                      <Button size="xs" variant="secondary" onClick={() => setOpen(r)}>
                        <ReceiptText size={12} /> Live payslip
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!data.rows.length && <p className="py-4 text-center text-sm text-[var(--text-muted)]">No employees in this month.</p>}
      </div>
      {open && <LivePayslip row={open} data={data} onClose={() => setOpen(null)} />}
    </Card>
  );
}
