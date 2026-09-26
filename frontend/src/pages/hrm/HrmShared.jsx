import { useEffect, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/ui/EmptyState";
import { hrm, queryString, label } from "./hrmApi";
export const controlClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";
export function Field({
  name,
  title,
  type = "text",
  value,
  onChange,
  options = [],
  required = false,
  disabled = false,
  min,
  max,
  step,
  help,
}) {
  const id = `hrm-${name}`;
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold text-[var(--text-main)]"
      >
        {title || label(name)}
        {required ? " *" : ""}
      </label>
      {type === "select" ? (
        <select
          id={id}
          className={controlClass}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option
              key={typeof o === "string" ? o : o.value}
              value={typeof o === "string" ? o : o.value}
            >
              {typeof o === "string" ? o : o.label}
            </option>
          ))}
        </select>
      ) : type === "checkbox" ? (
        <input
          id={id}
          type="checkbox"
          className="h-5 w-5 accent-[var(--primary)]"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
      ) : type === "textarea" ? (
        <textarea
          id={id}
          className={controlClass}
          rows={4}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
          step={step ?? (type === "number" ? "any" : undefined)}
        />
      )}
      {help && <p className="mt-1 text-xs text-[var(--text-muted)]">{help}</p>}
    </div>
  );
}
export function Lookup({
  token,
  type = "employees",
  name,
  title,
  value,
  onChange,
  required = false,
  disabled = false,
}) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () =>
        hrm(token, `/lookups?${queryString({ type, search })}`)
          .then((r) => {
            if (active) {
              setRows(r.rows || []);
              setError("");
            }
          })
          .catch((e) => active && setError(e.message)),
      250,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [token, type, search]);
  return (
    <div className="space-y-1">
      <Field
        name={name}
        title={title}
        type="select"
        required={required}
        disabled={disabled}
        value={value}
        onChange={onChange}
        options={[
          ...(value && !rows.some((r) => r.id === value)
            ? [{ value, label: "Current selection" }]
            : []),
          ...rows.map((r) => ({
            value: r.id,
            label: r.fullName
              ? `${r.fullName} · ${r.employeeNumber}`
              : r.name || r.title,
          })),
        ]}
      />
      {!disabled && (
        <Input
          aria-label={`Search ${title || name}`}
          placeholder={`Search ${title || name}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs"
        />
      )}
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
export function HrmTable({
  rows = [],
  columns = [],
  total = 0,
  page = 1,
  onPage,
  loading,
  error,
  onRetry,
  actions,
}) {
  if (error)
    return (
      <Card className="p-6">
        <p role="alert" className="text-rose-600">
          {error}
        </p>
        <Button className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      </Card>
    );
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface-2)]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-[var(--text-muted)]"
                >
                  {col.title || label(col.key)}
                </th>
              ))}
              {actions && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <td
                      colSpan={columns.length + (actions ? 1 : 0)}
                      className="p-4"
                    >
                      <div className="h-5 animate-pulse rounded bg-[var(--surface-2)]" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--border)] hover:bg-[var(--hover-bg)]"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="max-w-xs px-4 py-3 text-[var(--text-main)]"
                      >
                        {col.render
                          ? col.render(row)
                          : typeof row[col.key] === "boolean"
                            ? row[col.key]
                              ? "Yes"
                              : "No"
                            : (row[col.key] ?? "—")}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {actions(row)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!loading && !rows.length && (
        <EmptyState
          title="No records yet"
          description="Records will appear here when this workflow is used."
        />
      )}
      <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-muted)]">
        <span>
          {total} records · Page {page}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1 || loading}
            onClick={() => onPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={page * 25 >= total || loading}
            onClick={() => onPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}
export function Status({ value }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${["Approved", "Active", "Done", "Completed", "Verified", "Posted", "Confirmed"].includes(value) ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : ["Rejected", "Missing", "Overloaded"].includes(value) ? "bg-rose-500/10 text-rose-700 dark:text-rose-400" : "bg-[var(--primary-subtle)] text-[var(--primary)]"}`}
    >
      {value || "Draft"}
    </span>
  );
}
export function ActionDialog({ action, onClose, onConfirm, busy }) {
  const [comment, setComment] = useState("");
  return (
    <Modal
      open={Boolean(action)}
      title={action?.title || "Confirm action"}
      onClose={busy ? () => {} : onClose}
      width="min(540px,95vw)"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(comment);
        }}
        className="space-y-5"
      >
        <p className="text-sm text-[var(--text-muted)]">
          {action?.description ||
            "This action will be recorded in the HR activity history."}
        </p>
        {action?.comment && (
          <Field
            name="reviewComment"
            title="Comment"
            type="textarea"
            value={comment}
            onChange={setComment}
            required={action.required}
          />
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
          <Button type="submit" loading={busy}>
            {action?.title || "Confirm"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function DetailValues({ data }) {
  if (!data) return null;
  return (
    <dl className="space-y-3">
      {Object.entries(data)
        .filter(
          ([k, v]) =>
            v != null &&
            ![
              "id",
              "employeeId",
              "createdBy",
              "reviewedBy",
              "version",
              "profile",
              "content",
            ].includes(k),
        )
        .map(([key, value]) => (
          <div key={key} className="border-b border-[var(--border)] pb-2">
            <dt className="text-xs font-semibold text-[var(--text-muted)]">
              {label(key)}
            </dt>
            <dd className="mt-1 break-words text-sm text-[var(--text-main)]">
              {typeof value === "object" ? (
                Array.isArray(value) ? (
                  value.map((v, i) => (
                    <div
                      key={i}
                      className="my-2 rounded-lg bg-[var(--surface-2)] p-3"
                    >
                      {typeof v === "object" ? (
                        <DetailValues data={v} />
                      ) : (
                        String(v)
                      )}
                    </div>
                  ))
                ) : (
                  <DetailValues data={value} />
                )
              ) : (
                String(value)
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
