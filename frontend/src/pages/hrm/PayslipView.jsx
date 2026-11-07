import { toast } from "sonner";
import { Card } from "../../components/ui/Card";
import { SimpleTable } from "../../components/ui/SimpleTable";
import { formatDate } from "../../lib/format";
import { Status } from "./HrmShared";

function money(value, currency = "INR") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
const percent = (fraction) => `${Math.round(Number(fraction) * 100)}%`;

/** Readable payslip: who, which month, what was earned and deducted, and the per-day basis. */
export function PayslipView({ data }) {
  const calc = data.calculation || {};
  const days = Array.isArray(calc.days) ? calc.days : [];
  const currency = data.currency || "INR";
  const adjustments = Array.isArray(calc.adjustmentIds) ? calc.adjustmentIds.length : 0;
  const unpaidDays = days.filter((d) => Number(d.paidFraction) < 1).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-[var(--text-main)]">{calc.employeeName || "Employee"}</p>
          <p className="text-xs text-[var(--text-muted)]">
            {calc.employeeNumber} · {formatDate(data.startDate)} to {formatDate(data.endDate)}
          </p>
        </div>
        <Status value={data.status} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Gross pay", money(data.gross, currency), "text-[var(--text-main)]"],
          ["Deductions", money(data.deductions, currency), "text-rose-600 dark:text-rose-400"],
          ["Net pay", money(data.net, currency), "text-emerald-700 dark:text-emerald-400"],
        ].map(([title, value, tone]) => (
          <Card key={title} className="p-3">
            <p className="text-xs font-semibold text-[var(--text-muted)]">{title}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${tone}`}>{value}</p>
          </Card>
        ))}
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        {days.length} working day{days.length === 1 ? "" : "s"} counted
        {unpaidDays ? `, ${unpaidDays} paid in part` : ""}
        {adjustments ? ` · ${adjustments} approved adjustment${adjustments === 1 ? "" : "s"} included` : ""}.
      </p>
      {days.length > 0 && (
        <div className="max-h-72 overflow-y-auto">
          <SimpleTable
            compact
            stickyHeader
            rowKey="date"
            rows={days}
            columns={[
              { key: "date", label: "Date", nowrap: true, render: (d) => formatDate(d.date) },
              { key: "hours", label: "Hours", className: "tabular-nums", render: (d) => Number(d.scheduledHours).toFixed(1) },
              { key: "paid", label: "Paid", className: "tabular-nums", render: (d) => percent(d.paidFraction) },
              { key: "gross", label: "Gross", align: "right", className: "tabular-nums", render: (d) => money(d.gross, currency) },
              { key: "ded", label: "Deductions", align: "right", className: "tabular-nums", render: (d) => money(d.deductions, currency) },
            ]}
          />
        </div>
      )}
    </div>
  );
}

/** Payslip PDF with the same sections as the screen (the generic exporter printed raw keys). */
export async function exportPayslipPdf(data) {
  try {
    const { jsPDF } = await import("jspdf");
    const calc = data.calculation || {};
    const currency = data.currency || "INR";
    // jsPDF's built-in fonts have no rupee glyph; print the ISO code instead.
    const text = (value) => `${currency} ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const pdf = new jsPDF();
    let y = 20;
    pdf.setFontSize(17);
    pdf.text("Payslip", 16, y);
    y += 9;
    pdf.setFontSize(11);
    pdf.text(`${calc.employeeName || ""}  (${calc.employeeNumber || ""})`, 16, y);
    y += 6;
    pdf.setFontSize(10);
    pdf.text(`Period: ${formatDate(data.startDate)} to ${formatDate(data.endDate)}    Status: ${data.status || ""}`, 16, y);
    y += 10;
    for (const [title, value] of [
      ["Gross pay", data.gross],
      ["Deductions", data.deductions],
      ["Net pay", data.net],
    ]) {
      pdf.text(title, 16, y);
      pdf.text(text(value), 194, y, { align: "right" });
      y += 6;
    }
    y += 4;
    pdf.setFontSize(9);
    const header = () => {
      pdf.text("Date", 16, y);
      pdf.text("Hours", 62, y);
      pdf.text("Paid", 85, y);
      pdf.text("Gross", 150, y, { align: "right" });
      pdf.text("Deductions", 194, y, { align: "right" });
      y += 5;
    };
    header();
    for (const d of Array.isArray(calc.days) ? calc.days : []) {
      if (y > 280) {
        pdf.addPage();
        y = 20;
        header();
      }
      pdf.text(formatDate(d.date), 16, y);
      pdf.text(Number(d.scheduledHours).toFixed(1), 62, y);
      pdf.text(percent(d.paidFraction), 85, y);
      pdf.text(text(d.gross), 150, y, { align: "right" });
      pdf.text(text(d.deductions), 194, y, { align: "right" });
      y += 5;
    }
    const name = String(calc.employeeNumber || calc.employeeName || "payslip").toLowerCase().replace(/\W+/g, "-");
    pdf.save(`payslip-${name}-${String(data.startDate || "").slice(0, 7)}.pdf`);
  } catch (e) {
    toast.error(e.message);
  }
}
