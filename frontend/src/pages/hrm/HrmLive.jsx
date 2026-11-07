import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, MapPin, Radio, RefreshCw } from "lucide-react";
import { request } from "../../api/client";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Field, Status, ActionDialog } from "./HrmShared";
import { GeoMap } from "./GeoMap";
import { hrm, localDay } from "./hrmApi";
import { hm, clock, EVENT_LABELS, ALERT_LABELS } from "./hrmTime";
import { SimpleTable } from "../../components/ui/SimpleTable";

const ALERT_ACTIONS = [
  ["ignore", "Ignore", false],
  ["explain", "Ask explanation", true],
  ["warn", "Warn", true],
  ["half-day", "Mark half day", false],
  ["absent", "Mark absent", false],
  ["checkout", "Force clock-out", false],
];
const stateTone = {
  Working: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "On lunch": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "Reviewing summary": "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  Absent: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};
function Pill({ children, tone }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tone || "bg-[var(--surface-2)] text-[var(--text-muted)]"}`}>
      {children}
    </span>
  );
}
/** Live workday board for admins/managers: who is working, lunch, offline, alerts, approvals. */
export function HrmLive({ token, metadata, can }) {
  const tz = metadata.policy.timezone;
  const [live, setLive] = useState(null),
    [alerts, setAlerts] = useState([]),
    [homes, setHomes] = useState([]),
    [error, setError] = useState(""),
    [stale, setStale] = useState(""),
    [day, setDay] = useState(null),
    [action, setAction] = useState(null),
    [busy, setBusy] = useState(false),
    [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((n) => n + 1), []);
  const loadedOnce = useRef(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      hrm(token, "/live"),
      hrm(token, "/alerts?status=open"),
      hrm(token, "/geofences?kind=home&status=Pending"),
    ])
      .then(([l, a, h]) => {
        if (!active) return;
        setLive(l);
        setAlerts(a);
        setHomes(h);
        setError("");
        setStale("");
        loadedOnce.current = true;
      })
      .catch((e) => {
        if (!active) return;
        // After the first load a failed refresh keeps the board and shows a small notice instead.
        if (loadedOnce.current) setStale(e.message);
        else setError(e.message);
      });
    // Do not poll hidden tabs.
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token, tick, load]);
  async function run(path, body, success) {
    setBusy(true);
    try {
      await hrm(token, path, { method: "POST", body });
      toast.success(success);
      setAction(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <Card className="p-5">
        <p role="alert" className="text-sm text-rose-600">{error}</p>
        <Button className="mt-3" size="sm" onClick={load}>Retry</Button>
      </Card>
    );
  if (!live) return <Card className="h-40 animate-pulse bg-[var(--surface-2)]" />;
  const rows = live.rows;
  const counts = {
    working: rows.filter((r) => r.state === "Working").length,
    lunch: rows.filter((r) => r.state === "On lunch").length,
    offline: rows.filter((r) => r.offline).length,
    notIn: rows.filter((r) => r.state === "Not clocked in").length,
  };
  return (
    <div className="space-y-5">
      {stale && (
        <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Could not refresh the live board ({stale}). Showing the last data; retrying every 30 seconds.
        </p>
      )}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Radio size={16} className="text-emerald-500" /> Live workday · {live.date}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {counts.working} working · {counts.lunch} on lunch · {counts.offline} offline · {counts.notIn} not clocked in.
              Reports every {live.policy.reportIntervalMinutes} min · lunch {live.policy.lunchWindowStart}–{live.policy.lunchWindowEnd} (max {live.policy.lunchMaxMinutes} min).
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
        <SimpleTable
          bordered={false}
          textSize="sm"
          rowKey="employeeId"
          rows={rows}
          columns={[
            {
              key: "employee",
              label: "Employee",
              render: (r) => (
                <>
                  <span className="font-semibold">{r.fullName}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{r.employeeNumber} · {r.designation || "—"}</span>
                </>
              ),
            },
            {
              key: "state",
              label: "Status",
              render: (r) => (
                <div className="flex flex-wrap gap-1">
                  <Pill tone={stateTone[r.state]}>{r.state}</Pill>
                  {r.offline && <Pill tone="bg-rose-500/10 text-rose-700 dark:text-rose-400">Offline</Pill>}
                </div>
              ),
            },
            {
              key: "mode",
              label: "Mode",
              render: (r) => (
                <>
                  {r.workMode || "—"}
                  {r.source && <span className="block text-xs text-[var(--text-muted)]">{r.source === "web" ? "Web" : r.source === "app" ? "App" : r.source}</span>}
                </>
              ),
            },
            { key: "worked", label: "Worked", className: "tabular-nums", render: (r) => (r.summary ? hm(r.summary.workedMinutes) : "—") },
            {
              key: "lunch",
              label: "Lunch",
              className: "tabular-nums",
              render: (r) => (
                <>
                  {r.summary?.lunchMinutes ? hm(r.summary.lunchMinutes) : "—"}
                  {r.summary?.lunchOverrunMinutes > 0 && <span className="block text-xs text-rose-600">+{r.summary.lunchOverrunMinutes} min over</span>}
                </>
              ),
            },
            {
              key: "next",
              label: "Next report",
              className: "tabular-nums",
              render: (r) =>
                r.slot ? (
                  r.slot.onLunch ? "Paused" : r.slot.overdue ? <span className="font-semibold text-rose-600">Overdue</span> : clock(r.slot.dueAt, tz)
                ) : "—",
            },
            {
              key: "idle",
              label: "Idle / offline",
              className: "tabular-nums",
              render: (r) => (r.summary ? `${hm(r.summary.idleMinutes)} / ${hm(r.summary.offlineMinutes)}` : "—"),
            },
            { key: "alerts", label: "Alerts", render: (r) => (r.openAlerts ? <Pill tone="bg-amber-500/10 text-amber-700 dark:text-amber-400">{r.openAlerts}</Pill> : "—") },
            {
              key: "report",
              label: "Report",
              render: (r) => (
                <>
                  {r.reportStatus ? <Status value={r.reportStatus} /> : "—"}
                  {r.reportEdits > 0 && <span className="block text-xs text-[var(--text-muted)]">edited {r.reportEdits}×</span>}
                </>
              ),
            },
            {
              key: "day",
              label: "",
              render: (r) => (
                <Button size="xs" variant="secondary" onClick={() => setDay({ employeeId: r.employeeId, date: live.date })}>
                  Day
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={16} className="text-amber-500" /> Attendance alerts ({alerts.length})
          </h2>
          {!alerts.length && <p className="text-sm text-[var(--text-muted)]">No open alerts. Zone exits, offline apps, fake GPS, long lunches and auto-absent days appear here.</p>}
          {alerts.map((a) => (
            <div key={a.id} className="space-y-2 rounded-xl border border-[var(--border)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {ALERT_LABELS[a.kind] || a.kind} · {a.workDate} · {clock(a.openedAt, tz)}
                    {a.closedAt ? ` → back ${clock(a.closedAt, tz)}` : ""}
                    {a.details?.outsideMinutes ? ` (${a.details.outsideMinutes} min outside)` : ""}
                  </p>
                </div>
                <Status value={a.status} />
              </div>
              {a.explanation && <p className="rounded-lg bg-[var(--surface-2)] p-2 text-xs">“{a.explanation}”</p>}
              <div className="flex flex-wrap gap-1.5">
                {ALERT_ACTIONS.filter(([k]) => k !== "checkout" || ["geofence_breach", "offline", "mock_location"].includes(a.kind))
                  .filter(([k]) => !["half-day", "absent"].includes(k) || can("hr_approve"))
                  .map(([key, title, comment]) => (
                    <Button
                      key={key}
                      size="xs"
                      variant={key === "ignore" ? "ghost" : ["absent", "checkout"].includes(key) ? "destructive" : "secondary"}
                      onClick={() =>
                        setAction({
                          title,
                          comment: true,
                          required: comment,
                          description: `${title} for “${a.title}”. The employee is notified and the decision is audited.`,
                          path: `/alerts/${a.id}/action`,
                          body: { action: key },
                        })
                      }
                    >
                      {title}
                    </Button>
                  ))}
                <Button size="xs" variant="ghost" onClick={() => setDay({ employeeId: a.employeeId, date: a.workDate })}>
                  View day
                </Button>
              </div>
            </div>
          ))}
        </Card>
        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <MapPin size={16} className="text-[var(--primary)]" /> Work-from-home locations awaiting approval ({homes.length})
          </h2>
          {!homes.length && <p className="text-sm text-[var(--text-muted)]">When an employee registers a home location in the app it appears here once. After approval, clock-in inside that radius is automatically WFH.</p>}
          {homes.map((h) => (
            <HomeApproval key={h.id} home={h} busy={busy} onAction={(body, msg) => run(`/geofences/${h.id}/action`, body, msg)} />
          ))}
        </Card>
      </div>
      {action && (
        <ActionDialog
          action={action}
          busy={busy}
          onClose={() => setAction(null)}
          onConfirm={(comment) => run(action.path, { ...action.body, comment: comment || undefined }, `${action.title} done`)}
        />
      )}
      {day && <DayReview token={token} tz={tz} can={can} initial={day} onClose={() => { setDay(null); load(); }} />}
    </div>
  );
}
function HomeApproval({ home, busy, onAction }) {
  const [radius, setRadius] = useState(home.radiusMeters);
  const [point, setPoint] = useState({ latitude: home.latitude, longitude: home.longitude });
  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] p-3">
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span className="font-semibold">{home.employeeName} · {home.employeeNumber}</span>
        <span className="text-xs text-[var(--text-muted)]">GPS ±{home.requestAccuracy ?? "?"} m · {home.address || "No address given"}</span>
      </div>
      <GeoMap center={point} radius={radius} onPick={setPoint} height={200} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-32">
          <Field name={`radius-${home.id}`} title="Radius (m)" type="number" min={20} max={5000} value={radius} onChange={(v) => setRadius(v)} />
        </div>
        <Button size="sm" loading={busy} onClick={() => onAction({ action: "approve", radiusMeters: Number(radius), ...point }, "Home location approved")}>
          Approve
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            const comment = window.prompt("Reason for rejecting this home location");
            if (comment) onAction({ action: "reject", comment }, "Home location rejected");
          }}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
const STATUSES = ["Present", "WFH", "Business Visit", "Half Day", "Absent", "Leave", "Holiday", "Week Off", "Comp Off"];
/** One employee's day: summary, timeline, slot entries with edit counts, admin override & back-dated report edit. */
export function DayReview({ token, tz, can, initial, onClose }) {
  const [date, setDate] = useState(initial.date || localDay(tz));
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [override, setOverride] = useState({ status: "", comment: "" }),
    [editing, setEditing] = useState(null),
    [projects, setProjects] = useState([]),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setData(null);
    setEditing(null);
    setOverride({ status: "", comment: "" });
    hrm(token, `/day?employeeId=${encodeURIComponent(initial.employeeId)}&date=${date}`)
      .then((r) => active && (setData(r), setError("")))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [token, initial.employeeId, date, refresh]);
  useEffect(() => {
    request("/projects", { token })
      .then((r) => setProjects((Array.isArray(r.data) ? r.data : r.data?.rows || []).map((p) => ({ value: p.id, label: p.title }))))
      .catch(() => setProjects([]));
  }, [token]);
  async function save(method, path, body, msg) {
    setBusy(true);
    try {
      await hrm(token, path, { method, body });
      toast.success(msg);
      setEditing(null);
      setOverride({ status: "", comment: "" });
      setRefresh((n) => n + 1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  const s = data?.summary;
  const stats = s
    ? [
        ["Worked", hm(s.workedMinutes)],
        ["Productive", hm(s.productiveMinutes)],
        ["Lunch", `${hm(s.lunchMinutes)}${s.lunchOverrunMinutes ? ` (+${s.lunchOverrunMinutes})` : ""}`],
        ["Online / offline", `${hm(s.onlineMinutes)} / ${hm(s.offlineMinutes)}`],
        ["Idle (late reports)", hm(s.idleMinutes)],
        ["Outside zone", hm(s.outsideMinutes)],
        ["Slots", `${s.slotsSubmitted} / ${s.slotsExpected} expected · ${s.slotsMissed} missed`],
        ["Entry edits", `${s.edits}`],
      ]
    : [];
  return (
    <Modal open title={data ? `${data.employee.fullName} · ${date}` : "Employee day"} subtitle={data?.attendance ? `${data.attendance.status} · ${data.attendance.workMode || "—"}` : "No attendance recorded"} onClose={onClose}>
      <div className="space-y-5">
        <div className="max-w-xs">
          <Field name="dayDate" title="Date" type="date" value={date} max={localDay(tz)} onChange={setDate} />
        </div>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        {!data && !error && <div className="h-32 animate-pulse rounded-xl bg-[var(--surface-2)]" />}
        {data && (
          <>
            {s && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {stats.map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-[var(--surface-2)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">{k}</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{v}</p>
                  </div>
                ))}
              </div>
            )}
            {data.attendance?.override && (
              <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                {data.attendance.override.auto ? "Automatic" : "Admin"} override: {data.attendance.override.from || "—"} → {data.attendance.override.to} · {data.attendance.override.comment}
              </p>
            )}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Work report {data.report && <Status value={data.report.status} />} {data.report?.editCount > 0 && <span className="text-xs font-normal text-[var(--text-muted)]">· report edited {data.report.editCount}×{data.report.adminEditedAt ? " (incl. admin)" : ""}</span>}</h3>
              {!data.entries.length && <p className="text-sm text-[var(--text-muted)]">No work entries for this date.</p>}
              {data.entries.map((x) => (
                <div key={x.id} className="rounded-xl border border-[var(--border)] p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                    <span className="tabular-nums">
                      {x.slotStart ? `${clock(x.slotStart, tz)}–${clock(x.slotEnd, tz)}` : "Manual"} · {hm(x.minutes)} · {x.projectTitle || "No project"}
                    </span>
                    <span className="flex gap-1">
                      <Pill>{x.source}</Pill>
                      {x.editCount > 0 && <Pill tone="bg-amber-500/10 text-amber-700 dark:text-amber-400">edited {x.editCount}×</Pill>}
                    </span>
                  </div>
                  <p className="mt-1.5">{x.description}</p>
                  {x.blocker && <p className="mt-1 text-xs text-rose-600">Blocker: {x.blocker}</p>}
                </div>
              ))}
              {can("hr_approve") && !editing && (
                <Button size="sm" variant="secondary" onClick={() => setEditing({ comment: "", entries: data.entries.map((x) => ({ id: x.id, description: x.description, minutes: x.minutes, projectId: x.projectId || "", billable: x.billable, completion: x.completion, blocker: x.blocker })), remove: [] })}>
                  {data.entries.length ? "Edit report (admin)" : "Add back-dated report (admin)"}
                </Button>
              )}
              {editing && (
                <form
                  className="space-y-3 rounded-xl border border-[var(--primary)]/30 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save("PUT", "/work-reports/admin", {
                      employeeId: initial.employeeId,
                      workDate: date,
                      comment: editing.comment,
                      remove: editing.remove,
                      entries: editing.entries.map((x) => ({ ...x, id: x.id || undefined, minutes: Number(x.minutes), projectId: x.projectId || null })),
                    }, "Report saved by admin");
                  }}
                >
                  <p className="text-xs text-[var(--text-muted)]">Only admins can create or change past reports. Every change is counted and audited, and the employee is notified.</p>
                  {editing.entries.map((x, i) => {
                    const set = (k, v) => setEditing((ed) => ({ ...ed, entries: ed.entries.map((y, j) => (j === i ? { ...y, [k]: v } : y)) }));
                    return (
                      <div key={x.id || `new-${i}`} className="grid gap-2 rounded-lg bg-[var(--surface-2)] p-2 md:grid-cols-[1fr_110px_200px_auto]">
                        <Field name={`d-${i}`} title="Work done" value={x.description} onChange={(v) => set("description", v)} required />
                        <Field name={`m-${i}`} title="Minutes" type="number" min={1} max={1440} value={x.minutes} onChange={(v) => set("minutes", v)} required />
                        <Field name={`p-${i}`} title="Project" type="select" options={projects} value={x.projectId} onChange={(v) => set("projectId", v)} />
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          className="self-end"
                          onClick={() => setEditing((ed) => ({ ...ed, entries: ed.entries.filter((_, j) => j !== i), remove: x.id ? [...ed.remove, x.id] : ed.remove }))}
                        >
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                  <Button type="button" size="xs" variant="secondary" onClick={() => setEditing((ed) => ({ ...ed, entries: [...ed.entries, { description: "", minutes: 60, projectId: "" }] }))}>
                    + Add entry
                  </Button>
                  <Field name="adminComment" title="Reason for admin edit" value={editing.comment} onChange={(v) => setEditing((ed) => ({ ...ed, comment: v }))} required />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" loading={busy}>Save report</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </form>
              )}
            </section>
            {can("hr_approve") && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Override attendance</h3>
                <form
                  className="grid gap-2 md:grid-cols-[180px_1fr_auto]"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save("POST", "/attendance/override", { employeeId: initial.employeeId, workDate: date, ...override }, "Attendance updated");
                  }}
                >
                  <Field name="ovStatus" title="Set status" type="select" options={STATUSES} value={override.status} onChange={(v) => setOverride((o) => ({ ...o, status: v }))} required />
                  <Field name="ovComment" title="Reason" value={override.comment} onChange={(v) => setOverride((o) => ({ ...o, comment: v }))} required />
                  <Button type="submit" size="sm" className="self-end" loading={busy}>Apply</Button>
                </form>
              </section>
            )}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Timeline</h3>
              {!data.events.length && <p className="text-sm text-[var(--text-muted)]">No app events.</p>}
              <ol className="space-y-1 border-l border-[var(--border)] pl-4 text-sm">
                {data.events
                  .filter((e) => e.kind !== "slot_prompt")
                  .map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[var(--primary)]" />
                      <span className="tabular-nums text-[var(--text-muted)]">{clock(e.at, tz)}</span> · {EVENT_LABELS[e.kind] || e.kind}
                      {e.distanceMeters != null && <span className="text-xs text-[var(--text-muted)]"> ({e.distanceMeters} m)</span>}
                      {e.details?.minutes != null && <span className="text-xs text-[var(--text-muted)]"> · {e.details.minutes} min</span>}
                    </li>
                  ))}
              </ol>
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
