import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Field, Lookup } from "./HrmShared";
import { hrm, localDay } from "./hrmApi";
const get = (obj, key) => key.split(".").reduce((v, k) => v?.[k], obj);
function set(obj, key, value) {
  const parts = key.split(".");
  if (parts.length === 1) return { ...obj, [key]: value };
  return { ...obj, [parts[0]]: { ...obj[parts[0]], [parts[1]]: value } };
}
export function HrmForm({
  token,
  config,
  initial,
  metadata,
  masters,
  employeeId,
  can,
  onClose,
  onSaved,
}) {
  const today = localDay(metadata.policy.timezone);
  const [data, setData] = useState(() => ({
    ...(config.endpoint==='/employees'?{status:'Draft',workMode:'Office',...(initial?{effectiveDate:today}:{})}:{}),
    ...config.defaults,
    ...initial,
    employeeId: initial?.employeeId || employeeId || "",
    currency: initial?.currency || metadata.policy.currency,
    ...(config.endpoint==='/leave-grants'?{year:Number(today.slice(0,4))}:{}),
  }));
  const [section, setSection] = useState("Identity");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fields = config.fields.filter(
    (f) => !f.permission || can(f.permission),
  );
  const sections = [...new Set(fields.map((f) => f.section).filter(Boolean))];
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const missing=fields.find(f=>f.required&&(get(data,f.name)==null||get(data,f.name)===''));
      if(missing){if(missing.section)setSection(missing.section);throw new Error(`${missing.title} is required`);}
      let body = { ...config.defaults };
      for (const f of fields) {
        let value = get(data, f.name);
        if (value === "" || value == null) {
          if (f.type === "checkbox") value = false;
          else if (initial && ["lookup", "master", "date"].includes(f.type))
            value = null;
          else continue;
        }
        if (f.type === "datetime-local" && value)
          value = new Date(value).toISOString();
        body = set(body, f.name, value);
      }
      if (initial?.version) body.version = initial.version;
      if (config.endpoint === "/leave-grants" && !body.sourceKey)
        body.sourceKey = crypto.randomUUID();
      if (config.endpoint === "/allocations") delete body.version;
      if (config.endpoint === "/salary-history")
        body.components = data.components || [];
      const result = await hrm(
        token,
        `${config.endpoint}${initial?.id ? `/${initial.id}` : ""}`,
        { method: initial?.id ? "PUT" : "POST", body },
      );
      onSaved(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title={`${initial ? "Edit" : "New"} ${config.title}`}
      onClose={busy ? () => {} : onClose}
      width="min(820px,95vw)"
    >
      <form onSubmit={save} className="space-y-5">
        {sections.length > 0 && (
          <div className="flex gap-2">
            {sections.map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={section === s ? "primary" : "secondary"}
                onClick={() => setSection(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-600"
          >
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {fields
            .filter((f) => !f.section || f.section === section)
            .map((f) =>
              f.type === "lookup" ? (
                <Lookup
                  key={f.name}
                  token={token}
                  type={f.lookup}
                  name={f.name}
                  title={f.title}
                  value={get(data, f.name)}
                  onChange={(v) => setData((d) => set(d, f.name, v))}
                  required={f.required}
                  disabled={f.name === "userId" && Boolean(initial)}
                />
              ) : (
                <Field
                  key={f.name}
                  {...f}
                  type={f.type === "master" ? "select" : f.type}
                  options={
                    f.type === "master"
                      ? masters
                          .filter(
                            (m) =>
                              m.type ===
                                (f.master === "expense_category"
                                  ? "expense_category"
                                  : `hrm_${f.master}`) && m.isActive,
                          )
                          .map((m) => ({ value: m.id, label: m.name }))
                      : f.options
                  }
                  value={get(data, f.name)}
                  onChange={(v) => setData((d) => set(d, f.name, v))}
                />
              ),
            )}
        </div>
        {config.endpoint === "/timesheets" && (
          <p className="text-sm text-[var(--text-muted)]">
            Approved daily work reports in this period will be included
            automatically.
          </p>
        )}
        {config.endpoint === "/salary-history" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Monthly salary components</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Enter company-approved earning, deduction and employer components.
              Payroll uses these configured amounts.
            </p>
            {(data.components || []).map((component, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-3"
              >
                <Field
                  name={`componentName${i}`}
                  title="Component"
                  required
                  value={component.name}
                  onChange={(v) =>
                    setData((d) => ({
                      ...d,
                      components: d.components.map((x, n) =>
                        n === i ? { ...x, name: v } : x,
                      ),
                    }))
                  }
                />
                <Field
                  name={`componentType${i}`}
                  title="Type"
                  type="select"
                  options={["earning", "deduction", "employer"]}
                  value={component.type}
                  onChange={(v) =>
                    setData((d) => ({
                      ...d,
                      components: d.components.map((x, n) =>
                        n === i ? { ...x, type: v } : x,
                      ),
                    }))
                  }
                />
                <Field
                  name={`componentAmount${i}`}
                  title="Monthly amount"
                  type="number"
                  min={0}
                  required
                  value={component.amount}
                  onChange={(v) =>
                    setData((d) => ({
                      ...d,
                      components: d.components.map((x, n) =>
                        n === i ? { ...x, amount: v } : x,
                      ),
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setData((d) => ({
                      ...d,
                      components: d.components.filter((_, n) => n !== i),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setData((d) => ({
                  ...d,
                  components: [
                    ...(d.components || []),
                    { name: "", type: "earning", amount: 0 },
                  ],
                }))
              }
            >
              Add component
            </Button>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          {sections.length > 0 && section !== sections.at(-1) ? (
            <Button
              type="button"
              onClick={() =>
                setSection(sections[sections.indexOf(section) + 1])
              }
            >
              Next section
            </Button>
          ) : (
            <Button type="submit" loading={busy}>
              Save {config.title}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
export function WorkReportForm({
  token,
  metadata,
  masters,
  employeeId,
  initial,
  onClose,
  onSaved,
}) {
  const [data, setData] = useState(
    initial || {
      employeeId: employeeId || "",
      workDate: localDay(metadata.policy.timezone),
      summary: "",
      entries: [{ description: "", minutes: 480, billable: false }],
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));
  const setEntry = (i, k, v) =>
    setData((d) => ({
      ...d,
      entries: d.entries.map((e, n) =>
        n === i
          ? {
              ...e,
              [k]: v,
              ...(k === "projectId" ? { taskId: null, taskSource: null } : {}),
            }
          : e,
      ),
    }));
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const keys = [
        "projectId",
        "clientId",
        "taskId",
        "taskSource",
        "categoryId",
        "description",
        "completed",
        "inProgress",
        "blocker",
        "minutes",
        "billable",
        "completion",
        "priority",
        "evidenceUrl",
        "reference",
        "remarks",
      ];
      const body = {
        employeeId: data.employeeId,
        workDate: data.workDate,
        summary: data.summary,
        entries: data.entries.map((e) =>
          Object.fromEntries(
            keys
              .filter((k) => e[k] != null && e[k] !== "")
              .map((k) => [k, e[k]]),
          ),
        ),
        ...(initial ? { version: initial.version } : {}),
      };
      const r = await hrm(
        token,
        `/work-reports${initial ? `/${initial.id}` : ""}`,
        { method: initial ? "PUT" : "POST", body },
      );
      onSaved(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title="Daily work report"
      onClose={busy ? () => {} : onClose}
      width="min(1000px,96vw)"
    >
      <form className="space-y-5" onSubmit={save}>
        {error && (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Lookup
            token={token}
            name="reportEmployee"
            title="Employee"
            value={data.employeeId}
            onChange={(v) => set("employeeId", v)}
            required
          />
          <Field
            name="workDate"
            title="Work date"
            type="date"
            required
            value={data.workDate}
            disabled={Boolean(initial)}
            onChange={(v) => set("workDate", v)}
          />
        </div>
        <Field
          name="summary"
          title="Daily summary"
          type="textarea"
          value={data.summary}
          onChange={(v) => set("summary", v)}
        />
        {data.entries.map((entry, i) => (
          <WorkEntry
            key={i}
            entry={entry}
            index={i}
            token={token}
            employeeId={data.employeeId}
            masters={masters}
            onChange={(k, v) => setEntry(i, k, v)}
            onRemove={() =>
              set(
                "entries",
                data.entries.filter((_, n) => n !== i),
              )
            }
          />
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              set("entries", [
                ...data.entries,
                { description: "", minutes: 60, billable: false },
              ])
            }
          >
            Add work entry
          </Button>
          <span className="text-sm font-semibold">
            Total:{" "}
            {(
              data.entries.reduce((s, e) => s + Number(e.minutes || 0), 0) / 60
            ).toFixed(2)}{" "}
            hours
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          This work feeds your timesheet, utilization and project contribution.
          Save a draft, then submit it from the report list.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save draft
          </Button>
        </div>
      </form>
    </Modal>
  );
}
import { useEffect } from "react";
function WorkEntry({
  entry,
  index,
  token,
  employeeId,
  masters,
  onChange,
  onRemove,
}) {
  const [tasks, setTasks] = useState([]);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    if (employeeId && entry.projectId)
      hrm(
        token,
        `/tasks?employeeId=${encodeURIComponent(employeeId)}&projectId=${encodeURIComponent(entry.projectId)}`,
      )
        .then((r) => active && setTasks(r))
        .catch(() => active && setTasks([]));
    else setTasks([]);
    return () => {
      active = false;
    };
  }, [token, employeeId, entry.projectId]);
  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex justify-between">
        <h3 className="text-sm font-semibold">Work entry {index + 1}</h3>
        <Button variant="ghost" size="sm" type="button" onClick={onRemove}>
          Remove
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Lookup
          token={token}
          name={`entryProject${index}`}
          title="Project"
          type="projects"
          value={entry.projectId}
          onChange={(v) => onChange("projectId", v)}
        />
        <Field
          name={`task${index}`}
          title="Assigned task"
          type="select"
          options={tasks.map((t) => ({
            value: `${t.source}:${t.id}`,
            label: t.title,
          }))}
          value={entry.taskId ? `${entry.taskSource}:${entry.taskId}` : ""}
          onChange={(v) => {
            const t = tasks.find((t) => `${t.source}:${t.id}` === v);
            onChange("taskId", t?.id || null);
            onChange("taskSource", t?.source || null);
          }}
        />
        <Field
          name={`description${index}`}
          title="Work description"
          type="textarea"
          required
          value={entry.description}
          onChange={(v) => onChange("description", v)}
        />
        <div className="space-y-3">
          <Field
            name={`minutes${index}`}
            title="Duration (minutes)"
            type="number"
            min={1}
            max={1440}
            step={1}
            required
            value={entry.minutes}
            onChange={(v) => onChange("minutes", Number(v))}
          />
          <Field
            name={`billable${index}`}
            title="Billable"
            type="checkbox"
            value={entry.billable}
            onChange={(v) => onChange("billable", v)}
          />
          <Field
            name={`blocker${index}`}
            title="Blocker / issue"
            value={entry.blocker}
            onChange={(v) => onChange("blocker", v)}
          />
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "Hide" : "Add"} completion, evidence and context
      </Button>
      {expanded && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["completed", "Work completed"],
            ["inProgress", "Work in progress"],
            ["evidenceUrl", "Evidence / commit / PR link"],
            ["reference", "Ticket reference"],
            ["remarks", "Remarks"],
          ].map(([key, title]) => (
            <Field
              key={key}
              name={`${key}${index}`}
              title={title}
              value={entry[key]}
              onChange={(v) => onChange(key, v)}
            />
          ))}
          <Field
            name={`completion${index}`}
            title="Completion (%)"
            type="number"
            min={0}
            max={100}
            value={entry.completion || 0}
            onChange={(v) => onChange("completion", v)}
          />
          <Field
            name={`priority${index}`}
            title="Priority"
            type="select"
            options={["Low", "Medium", "High", "Urgent"]}
            value={entry.priority || "Medium"}
            onChange={(v) => onChange("priority", v)}
          />
          <Field
            name={`category${index}`}
            title="Work category"
            type="select"
            options={masters
              .filter((m) => m.type === "hrm_work_category")
              .map((m) => ({ value: m.id, label: m.name }))}
            value={entry.categoryId}
            onChange={(v) => onChange("categoryId", v)}
          />
        </div>
      )}
    </div>
  );
}
