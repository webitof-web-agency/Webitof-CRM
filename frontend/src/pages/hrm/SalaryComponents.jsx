import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { Input } from "../../components/ui/Input";
import { Trash2 } from "lucide-react";

export const COMPONENT_TYPES = [
  { value: "earning", label: "Earning (paid to the employee)" },
  { value: "deduction", label: "Deduction (withheld from pay)" },
  { value: "employer", label: "Employer cost (not in take-home)" },
];

const sum = (rows, type) =>
  rows.filter((r) => r.type === type).reduce((n, r) => n + (Number(r.amount) || 0), 0);
const money = (value) => Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Monthly employer cost implied by a component list: what is paid out plus employer-side costs. */
export const suggestedMonthlyCost = (rows = []) => sum(rows, "earning") + sum(rows, "employer");

/**
 * Editor for a salary component list: [{ name, type, amount }]. Used for salary structure templates
 * and for each employee's salary revision. Amounts are per month.
 */
export function SalaryComponents({ value = [], onChange, currency = "INR" }) {
  const rows = Array.isArray(value) ? value : [];
  const update = (index, patch) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const earnings = sum(rows, "earning");
  const deductions = sum(rows, "deduction");
  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          No components. Without earnings, payroll pays the monthly cost as a single amount and has no deductions.
        </p>
      )}
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_12rem_8rem_auto]">
          <Input
            aria-label={`Component ${index + 1} name`}
            placeholder="e.g. Basic, HRA, PF"
            value={row.name || ""}
            onChange={(e) => update(index, { name: e.target.value })}
            required
          />
          <select
            aria-label={`Component ${index + 1} type`}
            className="w-full rounded-[var(--radius-input,0.625rem)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-main)]"
            value={row.type || "earning"}
            onChange={(e) => update(index, { type: e.target.value })}
          >
            {COMPONENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <Input
            aria-label={`Component ${index + 1} monthly amount`}
            type="number"
            min="0"
            step="any"
            placeholder="Per month"
            value={row.amount ?? ""}
            onChange={(e) => update(index, { amount: e.target.value === "" ? "" : Number(e.target.value) })}
            required
          />
          <IconButton
            tone="danger"
            title={`Remove component ${index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <Trash2 size={15} />
          </IconButton>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onChange([...rows, { name: "", type: "earning", amount: "" }])}
          disabled={rows.length >= 50}
        >
          Add component
        </Button>
        {rows.length > 0 && (
          <p className="text-xs text-[var(--text-muted)]">
            Earnings {currency} {money(earnings)} · Deductions {currency} {money(deductions)} · Take-home {currency}{" "}
            {money(earnings - deductions)}
          </p>
        )}
      </div>
    </div>
  );
}
