import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Field } from "./HrmShared";
import { hrm, localDay } from "./hrmApi";

// Same lists as backend/services/hrm/access.js.
export const BLOCKED_STATUSES = ["Suspended", "Relieved", "Terminated", "Inactive"];
const WORKING_STATUSES = ["Upcoming Joining", "Active", "Probation", "Confirmed", "Notice Period"];
export const isBlockedStatus = (status) => BLOCKED_STATUSES.includes(status);

const COPY = {
  suspend: {
    title: "Suspend employee",
    button: "Suspend",
    text: "Use for a temporary stop, e.g. during an inquiry. The ERP login and Employee app stop working at once. Records stay as they are; Reinstate brings everything back.",
  },
  terminate: {
    title: "Terminate employment",
    button: "Terminate",
    text: "Ends employment now, without the notice period. The ERP login and Employee app stop working at once. Attendance, payroll and documents are kept, and exit checklist items are added for asset return and settlement.",
  },
  reinstate: {
    title: "Reinstate employee",
    button: "Reinstate",
    text: "Restores the employee and switches the ERP login back on (if HR had blocked it). Someone who had left rejoins on the same record and Employee ID.",
  },
};

// Suspend / Terminate / Reinstate with a required reason; every action is in the HR history.
export function EmploymentAccessDialog({ kind, employee, token, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [exitDate, setExitDate] = useState(() => localDay());
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = COPY[kind];
  const rejoining = kind === "reinstate" && employee.status !== "Suspended";

  async function submit(event) {
    event.preventDefault();
    if (!reason.trim()) return toast.error("Write the reason");
    setBusy(true);
    try {
      const body = { reason: reason.trim(), version: employee.version };
      if (kind === "terminate" && exitDate) body.exitDate = exitDate;
      if (kind === "reinstate" && status) body.status = status;
      const result = await hrm(token, `/employees/${employee.id}/${kind}`, { method: "POST", body });
      const login =
        result?.login === "blocked"
          ? " Login blocked."
          : result?.login === "restored"
            ? " Login restored."
            : result?.login === "disabled"
              ? " The login stays off: an admin disabled it in Users."
              : "";
      toast.success(`${copy.button} done.${login}`);
      onDone?.(result);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={rejoining ? "Rejoin employee" : copy.title} onClose={busy ? () => {} : onClose} width="min(520px,95vw)">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-[var(--text-muted)]">{copy.text}</p>
        {!employee.userId && (
          <p className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)]">
            This employee has no ERP login, so only the employment status changes.
          </p>
        )}
        {kind === "terminate" && (
          <Field
            name="exitDate"
            title="Last working date"
            type="date"
            value={exitDate}
            onChange={setExitDate}
            max={localDay()}
            min={employee.joiningDate}
            required
          />
        )}
        {kind === "reinstate" && (
          <Field
            name="reinstateStatus"
            title="Status after reinstating"
            type="select"
            value={status}
            onChange={setStatus}
            options={[{ value: "", label: "Status before the suspension / exit" }, ...WORKING_STATUSES]}
            required
          />
        )}
        <Field name="reason" title="Reason" type="textarea" value={reason} onChange={setReason} required maxLength={1000} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant={kind === "reinstate" ? "primary" : "danger"} loading={busy}>
            {rejoining ? "Rejoin" : copy.button}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Small badge under the status: can this employee sign in right now?
export function LoginBadge({ login }) {
  if (!login) return <span className="text-xs text-[var(--text-muted)]">No ERP login</span>;
  return login.active ? (
    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">Login active</span>
  ) : (
    <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600">
      {login.blockedByHr ? "Login blocked by HR" : "Login disabled"}
    </span>
  );
}
