import { useEffect, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { SimpleTable } from "../../components/ui/SimpleTable";
import { formatDate, formatDateTime } from "../../lib/format";
import { Field, Status } from "./HrmShared";
import { hrm, localDay, queryString } from "./hrmApi";
import { ALERT_LABELS } from "./hrmTime";

const dayOffset = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const ACTION_LABELS = {
  ignore: "Ignored",
  explain: "Explanation asked",
  warn: "Warned",
  "half-day": "Marked half day",
  absent: "Marked absent",
  checkout: "Force clock-out",
  override: "Attendance overridden",
};

/** Browse resolved and past alerts by date range and type. Loads only once opened. */
export function AlertHistory({ token, tz }) {
  const today = localDay(tz);
  const [open, setOpen] = useState(false),
    [from, setFrom] = useState(dayOffset(today, -7)),
    [to, setTo] = useState(today),
    [kind, setKind] = useState(""),
    [rows, setRows] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open) return undefined;
    if (from && to && from > to) {
      setError("The start date is after the end date.");
      return undefined;
    }
    let active = true;
    setError("");
    setRows(null);
    hrm(token, `/alerts?${queryString({ from, to, kind })}`)
      .then((r) => active && setRows(r))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [open, token, from, to, kind]);
  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Alert history</h2>
          <p className="text-xs text-[var(--text-muted)]">Past and resolved alerts, with what was done about them.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Hide history" : "Show history"}
        </Button>
      </div>
      {open && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field name="alertFrom" title="From" type="date" value={from} max={to || undefined} onChange={setFrom} />
            <Field name="alertTo" title="To" type="date" value={to} min={from || undefined} max={today} onChange={setTo} />
            <Field
              name="alertKind"
              title="Type"
              type="select"
              value={kind}
              options={Object.entries(ALERT_LABELS).map(([value, text]) => ({ value, label: text }))}
              onChange={setKind}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
          )}
          {!error && rows === null && <div className="h-24 animate-pulse rounded-xl bg-[var(--surface-2)]" />}
          {rows && (
            <>
              <SimpleTable
                rows={rows}
                emptyText="No alerts in this period."
                columns={[
                  { key: "date", label: "Day", nowrap: true, render: (a) => formatDate(a.workDate) },
                  {
                    key: "employee",
                    label: "Employee",
                    render: (a) => (
                      <>
                        {a.employeeName}
                        <span className="block text-[var(--text-muted)]">{a.employeeNumber}</span>
                      </>
                    ),
                  },
                  {
                    key: "alert",
                    label: "Alert",
                    render: (a) => (
                      <>
                        <span className="font-semibold">{ALERT_LABELS[a.kind] || a.kind}</span>
                        <span className="block max-w-xs text-[var(--text-muted)]">{a.title}</span>
                      </>
                    ),
                  },
                  { key: "status", label: "Status", render: (a) => <Status value={a.status === "Resolved" ? "Completed" : a.status} /> },
                  {
                    key: "outcome",
                    label: "Outcome",
                    render: (a) => (
                      <>
                        {a.action ? ACTION_LABELS[a.action] || a.action : a.status === "Resolved" ? "Resolved automatically" : "—"}
                        {a.comment && <span className="block max-w-xs text-[var(--text-muted)]">“{a.comment}”</span>}
                        {(a.actionAt || a.closedAt) && (
                          <span className="block text-[var(--text-muted)]">{formatDateTime(a.actionAt || a.closedAt)}</span>
                        )}
                      </>
                    ),
                  },
                ]}
              />
              {rows.length >= 200 && (
                <p className="text-xs text-[var(--text-muted)]">Showing the latest 200. Narrow the dates to see older ones.</p>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}
