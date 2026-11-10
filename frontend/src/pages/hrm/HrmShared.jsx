import { useEffect, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { SearchableSelect } from "../../components/forms/SearchableSelect";
import { clean } from "../../lib/fieldRules";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/ui/EmptyState";
import { SimpleTable } from "../../components/ui/SimpleTable";
import { Badge } from "../../components/ui/Badge";
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
  suggestions,
  searchable = false,
  inputMode,
  maxLength,
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
        // The app's themed pop-up for every HRM dropdown; the search box shows for long lists
        // (or always when `searchable`). Optional fields get a "None" choice to clear them.
        <SearchableSelect
          id={id}
          value={value ?? ""}
          onChange={(next) => onChange(next ?? "")}
          options={[
            ...(required ? [] : [{ value: "", label: "— None —" }]),
            ...options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)),
          ]}
          placeholder="Select…"
          searchable={searchable || "auto"}
          searchPlaceholder={`Search ${String(title || label(name)).toLowerCase()}…`}
          disabled={disabled}
          triggerClassName="py-2.5 text-sm"
          listClassName="max-h-52"
        />
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
          disabled={disabled}
        />
      ) : type === "password" ? (
        <PasswordInput
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          maxLength={maxLength}
          required={required}
          disabled={disabled}
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value ?? ""}
          // Phones keep only digits and a leading +; emails lose spaces and go lower-case.
          onChange={(e) =>
            onChange(type === "tel" ? clean.phone(e.target.value) : type === "email" ? clean.email(e.target.value) : e.target.value)
          }
          inputMode={inputMode ?? (type === "tel" ? "tel" : undefined)}
          maxLength={maxLength}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
          step={step ?? (type === "number" ? "any" : undefined)}
          list={suggestions?.length ? `${id}-list` : undefined}
          autoComplete={suggestions?.length ? "off" : undefined}
        />
      )}
      {/* Free text with a pick list: choose a suggestion or type a value that is not listed. */}
      {suggestions?.length ? (
        <datalist id={`${id}-list`}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
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
      <SimpleTable
        bordered={false}
        roomy
        textSize="sm"
        loading={loading}
        rows={rows}
        rowActions={actions}
        columns={columns.map((col) => ({
          key: col.key,
          label: col.title || label(col.key),
          className: "max-w-xs",
          render:
            col.render ||
            ((row) =>
              typeof row[col.key] === "boolean" ? (row[col.key] ? "Yes" : "No") : (row[col.key] ?? "—")),
        }))}
      />
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
const STATUS_SUCCESS = ["Approved", "Active", "Done", "Completed", "Verified", "Posted", "Confirmed"];
const STATUS_DANGER = ["Rejected", "Missing", "Overloaded"];
export function Status({ value }) {
  const tone = STATUS_SUCCESS.includes(value) ? "success" : STATUS_DANGER.includes(value) ? "danger" : "primary";
  return (
    <Badge tone={tone} className="whitespace-nowrap">
      {value || "Draft"}
    </Badge>
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
