import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Clock,
  CalendarCheck,
  CheckSquare,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Field, Lookup, HrmTable, Status } from "./HrmShared";
import { hrm, localDay, queryString } from "./hrmApi";
export function HrmDashboard({
  token,
  metadata,
  can,
  masters,
  analytics = false,
  employeeId = "",
}) {
  const today = localDay(metadata.policy.timezone);
  const [filters, setFilters] = useState({
    startDate: `${today.slice(0, 7)}-01`,
    endDate: today,
    employeeId,
  });
  const [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const set = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    hrm(
      token,
      `/${analytics ? "analytics" : "dashboard"}?${queryString({ ...filters, page })}`,
    )
      .then((r) => {
        if (active) {
          setData(r);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token, filters, page, refresh, analytics]);
  async function clock(action) {
    try {
      await hrm(token, "/attendance/clock", {
        method: "POST",
        body: { employeeId: metadata.ownEmployeeId, action },
      });
      toast.success("Attendance updated");
      setRefresh((n) => n + 1);
    } catch (e) {
      toast.error(e.message);
    }
  }
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="People & delivery"
        title={analytics ? "Employee analytics" : "HRM overview"}
        description={
          analytics
            ? "Capacity, work consistency and contribution, with separate explainable measures."
            : "Workforce operations connected to projects and finance."
        }
      >
        {!analytics && metadata.ownEmployeeId && can("self_service") && (
          <div className="flex flex-wrap gap-2">
            {[
              ["check-in", "Check in"],
              ["break-start", "Start break"],
              ["break-end", "End break"],
              ["check-out", "Check out"],
            ].map(([action, title]) => (
              <Button
                key={action}
                variant={action === "check-in" ? "primary" : "secondary"}
                size="sm"
                onClick={() => clock(action)}
              >
                {title}
              </Button>
            ))}
          </div>
        )}
      </PageHeader>
      <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          name="analyticsStart"
          title="From date"
          type="date"
          value={filters.startDate}
          onChange={(v) => set("startDate", v)}
        />
        <Field
          name="analyticsEnd"
          title="To date"
          type="date"
          value={filters.endDate}
          onChange={(v) => set("endDate", v)}
        />
        <Field
          name="analyticsDepartment"
          title="Department"
          type="select"
          value={filters.departmentId}
          options={masters
            .filter((m) => m.type === "hrm_department")
            .map((m) => ({ value: m.id, label: m.name }))}
          onChange={(v) => set("departmentId", v)}
        />
        <Lookup
          token={token}
          name="analyticsEmployee"
          title="Employee"
          value={filters.employeeId}
          onChange={(v) => set("employeeId", v)}
        />
      </Card>
      {error && (
        <Card className="p-5">
          <p role="alert" className="text-rose-600">
            {error}
          </p>
          <Button onClick={() => setRefresh((n) => n + 1)}>Retry</Button>
        </Card>
      )}
      {loading && !data && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card
              key={i}
              className="h-36 animate-pulse bg-[var(--surface-2)]"
            />
          ))}
        </div>
      )}
      {data &&
        (analytics ? (
          <AnalyticsBody
            data={data}
            can={can}
            loading={loading}
            page={page}
            onPage={setPage}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Employees"
                value={data.totalEmployees}
                helper="Within your HR scope"
                icon={Users}
              />
              <StatCard
                title="Working now"
                value={data.attendance.reduce((s, a) => s + a.working, 0)}
                helper={`Live attendance · ${data.today}`}
                icon={Clock}
              />
              <StatCard
                title="Pending requests"
                value={data.pending.reduce((s, a) => s + a.count, 0)}
                helper="Manager and HR approval queues"
                icon={CheckSquare}
              />
              <StatCard
                title="Logged hours"
                value={(
                  data.trend.reduce((s, d) => s + d.minutes, 0) / 60
                ).toFixed(1)}
                helper={`${data.startDate} to ${data.endDate}`}
                icon={BarChart3}
              />
            </div>
            <div className="grid gap-5 xl:grid-cols-3">
              <Card className="space-y-4 p-5 xl:col-span-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">
                    Work hours & billable contribution
                  </h2>
                  <Link
                    className="text-xs text-[var(--primary)]"
                    to="/app/hrm/work-reports"
                  >
                    View reports
                  </Link>
                </div>
                <HoursChart rows={data.trend} />
                <p className="text-xs text-[var(--text-muted)]">
                  Submitted, reviewed and approved reports. Blue represents
                  billable work.
                </p>
              </Card>
              <Card className="space-y-4 p-5">
                <h2 className="font-semibold">Department headcount</h2>
                {data.departments.length ? (
                  data.departments.map((d) => (
                    <div key={d.name}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{d.name}</span>
                        <strong>{d.count}</strong>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--surface-2)]">
                        <div
                          className="h-2 rounded-full bg-[var(--primary)]"
                          style={{
                            width: `${(d.count / Math.max(1, data.totalEmployees)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">
                    Create employee profiles to see your workforce distribution.
                  </p>
                )}
              </Card>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <Summary
                title="Employment status"
                rows={data.headcount.map((x) => ({
                  name: x.status,
                  count: x.count,
                }))}
              />
              <Summary
                title="Today’s attendance"
                rows={data.attendance.map((x) => ({
                  name: x.status,
                  count: x.count,
                }))}
              />
              <Summary
                title="Approval queue"
                rows={data.pending.map((x) => ({
                  name: `${x.kind} · ${x.status}`,
                  count: x.count,
                }))}
              />
            </div>
            <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <h2 className="font-semibold">Your daily workflow</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Check in, work on your assigned tasks, save a daily report,
                  then check out.
                </p>
              </div>
              <Link
                className="text-sm font-semibold text-[var(--primary)]"
                to="/app/hrm/work-reports"
              >
                Open work reports →
              </Link>
            </Card>
          </>
        ))}
    </div>
  );
}
function Summary({ title, rows }) {
  return (
    <Card className="space-y-3 p-5">
      <h2 className="font-semibold">{title}</h2>
      {rows.length ? (
        rows.map((r, i) => (
          <div
            key={i}
            className="flex justify-between gap-2 border-b border-[var(--border)] py-2 text-sm"
          >
            <span className="capitalize">{r.name}</span>
            <strong>{r.count}</strong>
          </div>
        ))
      ) : (
        <p className="text-sm text-[var(--text-muted)]">
          No records in this view.
        </p>
      )}
    </Card>
  );
}
function HoursChart({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  return (
    <div className="overflow-x-auto">
      <div
        className="flex min-h-52 items-end gap-2 pt-4"
        role="img"
        aria-label="Daily total hours with billable hours highlighted"
      >
        {rows.length ? (
          rows.map((r) => (
            <div
              key={r.workDate}
              className="min-w-8 flex-1 text-center"
              title={`${r.workDate}: ${(r.minutes / 60).toFixed(1)} hours, ${(r.billableMinutes / 60).toFixed(1)} billable`}
            >
              <div
                className="relative mx-auto w-full max-w-12 rounded-t bg-[var(--primary-subtle)]"
                style={{ height: `${Math.max(2, (r.minutes / max) * 150)}px` }}
              >
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t bg-[var(--primary)]"
                  style={{
                    height: `${r.minutes ? (r.billableMinutes / r.minutes) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="mt-2 block text-[10px] text-[var(--text-muted)]">
                {r.workDate.slice(8)}
              </span>
              <span className="block text-[10px]">
                {(r.minutes / 60).toFixed(1)}h
              </span>
            </div>
          ))
        ) : (
          <p className="my-auto w-full py-12 text-center text-sm text-[var(--text-muted)]">
            No submitted work in this period.
          </p>
        )}
      </div>
    </div>
  );
}
function AnalyticsBody({ data, can, loading, page, onPage }) {
  const [selected, setSelected] = useState(null);
  const row = selected
    ? data.rows.find((e) => e.id === selected)
    : data.rows.length === 1
      ? data.rows[0]
      : null;
  return (
    <>
      <p className="text-xs text-[var(--text-muted)]">
        Utilization = productive project hours ÷ available working hours.
        Capacity excludes approved leave, holidays and dates outside employment.
        Missing reports are measured through yesterday. No overall performance
        score is assigned.
      </p>
      <HrmTable
        rows={data.rows}
        total={data.total}
        page={page}
        onPage={onPage}
        loading={loading}
        columns={[
          {
            key: "fullName",
            title: "Employee",
            render: (r) => (
              <button
                className="text-left font-semibold text-[var(--primary)]"
                onClick={() => setSelected(r.id)}
              >
                {r.fullName}
                <span className="block text-xs font-normal">
                  {r.departmentName || "Unassigned"}
                </span>
              </button>
            ),
          },
          { key: "availableHours" },
          { key: "allocatedHours" },
          { key: "loggedHours" },
          { key: "billableHours" },
          {
            key: "utilization",
            title: "Utilization",
            render: (r) => (
              <span>
                {r.utilization.percent == null
                  ? "—"
                  : `${r.utilization.percent}%`}
                <span className="mt-1 block text-xs text-[var(--text-muted)]">
                  {r.utilization.context}
                </span>
              </span>
            ),
          },
          {
            key: "reportCompliance",
            title: "Report compliance",
            render: (r) =>
              r.reportCompliance == null ? "—" : `${r.reportCompliance}%`,
          },
          { key: "missingReports" },
          {
            key: "goalCompletion",
            render: (r) =>
              r.goalCompletion == null ? "—" : `${r.goalCompletion}%`,
          },
        ]}
      />
      {row && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Attendance"
              value={
                row.attendanceRate == null ? "—" : `${row.attendanceRate}%`
              }
              helper={`${row.lateCheckIns} late arrivals`}
              icon={CalendarCheck}
            />
            <StatCard
              title="Project utilization"
              value={
                row.utilization.percent == null
                  ? "—"
                  : `${row.utilization.percent}%`
              }
              helper={row.utilization.context}
              icon={BarChart3}
            />
            <StatCard
              title="Report consistency"
              value={
                row.reportCompliance == null ? "—" : `${row.reportCompliance}%`
              }
              helper={`${row.missingReports} missing · ${row.lateReports} late`}
              icon={CheckSquare}
            />
            <StatCard
              title="Manager rating"
              value={row.managerRating ?? "—"}
              helper="Published reviews in the selected period"
              icon={Users}
            />
          </div>
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">
              {row.fullName} · work calendar
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
              {row.calendar.map((d) => (
                <div
                  key={d.date}
                  className="min-w-0 rounded-xl border border-[var(--border)] p-2"
                >
                  <span className="text-xs font-semibold">
                    {d.date.slice(5)}
                  </span>
                  <p className="my-1 text-sm">
                    {d.loggedHours}h{" "}
                    <span className="text-xs text-[var(--text-muted)]">
                      / {d.hours}h
                    </span>
                  </p>
                  <span
                    className={`block truncate text-[10px] ${d.status === "Missing" ? "text-rose-600" : d.status === "Low hours" ? "text-amber-600" : d.hours === 0 ? "text-blue-600" : "text-emerald-600"}`}
                    title={d.status}
                  >
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <div className="grid gap-5 md:grid-cols-2">
            <Summary
              title="Project contribution by logged hours"
              rows={row.projects.map((p) => ({
                name: p.projectId
                  ? `${p.contribution}% · Project contribution`
                  : "Internal work",
                count: `${p.hours} h`,
              }))}
            />
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Capacity context</h2>
              <p className="text-sm">
                {row.remainingCapacity} hours remain after planned allocation.
              </p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {row.nonBillableHours} non-billable hours · {row.overtimeHours}{" "}
                attendance overtime hours.
              </p>
              {row.cost && can("view_salary") && (
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <p className="font-semibold">
                    Approved project cost: {row.cost.currency}{" "}
                    {row.cost.approvedProjectCost}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {row.cost.basis}
                  </p>
                  {row.cost.unpricedDates.length > 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      {row.cost.unpricedDates.length} work dates need salary
                      history before cost can be calculated.
                    </p>
                  )}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
