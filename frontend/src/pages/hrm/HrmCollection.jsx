import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { Modal } from "../../components/ui/Modal";
import {
  Field,
  HrmTable,
  Status,
  ActionDialog,
  DetailValues,
} from "./HrmShared";
import { HrmForm, WorkReportForm } from "./HrmForm";
import { forms, recordForm } from "./hrmForms";
import { hrm, queryString, downloadHrm, label, localDay } from "./hrmApi";
const titles = {
  employees: "Employee directory",
  attendance: "Attendance",
  leave: "Leave requests",
  regularization: "Attendance regularization",
  "work-reports": "Daily work reports",
  timesheets: "Timesheets",
  allocations: "Project allocation",
  reimbursement: "Reimbursements",
  resignation: "Resignations",
  helpdesk: "HR helpdesk",
  documents: "Document vault",
  payroll: "Payroll & payslips",
  "salary-history": "Salary history",
  holidays: "Holiday calendar",
  history: "Employment history",
  audit: "HR activity",
};
const requestKinds = [
  "leave",
  "regularization",
  "reimbursement",
  "resignation",
  "helpdesk",
];
const dateKinds = [
  "attendance",
  "work-reports",
  "timesheets",
  "allocations",
  ...requestKinds,
];
export function HrmCollection({
  kind,
  token,
  metadata,
  masters,
  can,
  employeeId = "",
  onChange,
}) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const [result, setResult] = useState({ rows: [], total: 0 }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState(null),
    [detail, setDetail] = useState(null),
    [action, setAction] = useState(null),
    [busy, setBusy] = useState(false);
  const config = forms[kind] || recordForm(kind, metadata);
  const ownId = metadata.ownEmployeeId;
  const chosenEmployee = employeeId || ownId;
  const resource = requestKinds.includes(kind) ? "requests" : kind;
  const reload = useCallback(() => {
    setRefresh((n) => n + 1);
    onChange?.();
  }, [onChange]);
  useEffect(() => {
    setPage(1);
    setStatus("");
    setSearch("");
  }, [kind, employeeId]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      const endpoint =
        kind === "employees"
          ? "/employees"
          : kind === "payroll"
            ? "/payroll"
            : kind === "holidays"
              ? "/holidays"
              : `/resources/${resource}`;
      hrm(
        token,
        `${endpoint}?${queryString({ page, search, status, employeeId, startDate: start, endDate: end, kind: requestKinds.includes(kind) ? kind : null })}`,
      )
        .then((r) => {
          if (active) {
            setResult({ ...r, total: r.total ?? r.rows.length });
            setError("");
          }
        })
        .catch((e) => active && setError(e.message))
        .finally(() => active && setLoading(false));
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    kind,
    resource,
    token,
    page,
    search,
    status,
    employeeId,
    start,
    end,
    refresh,
  ]);
  async function perform(comment) {
    setBusy(true);
    try {
      await hrm(token, action.path, {
        method: action.method || "POST",
        body: { ...action.body, ...(action.comment ? { comment } : {}) },
      });
      toast.success("HR record updated");
      setAction(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  const act = (title, path, body, comment = false, description) =>
    setAction({
      title,
      path,
      body,
      comment,
      required: comment && ["Reject", "Request revision"].includes(title),
      description,
    });
  const columns =
    kind === "employees"
      ? [
          {
            key: "fullName",
            title: "Employee",
            render: (r) => (
              <Link
                className="font-semibold text-[var(--primary)]"
                to={`/app/hrm/employees/${r.id}`}
              >
                {r.fullName}
                <span className="mt-0.5 block text-xs font-normal text-[var(--text-muted)]">
                  {r.employeeNumber}
                </span>
              </Link>
            ),
          },
          { key: "departmentName" },
          { key: "designationName" },
          { key: "managerName" },
          { key: "workMode" },
          { key: "status", render: (r) => <Status value={r.status} /> },
          { key: "joiningDate" },
        ]
      : kind === "attendance"
        ? [
            { key: "employeeName" },
            { key: "workDate" },
            { key: "status", render: (r) => <Status value={r.status} /> },
            {
              key: "checkIn",
              render: (r) =>
                r.checkIn
                  ? new Date(r.checkIn).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—",
            },
            {
              key: "checkOut",
              render: (r) =>
                r.checkOut
                  ? new Date(r.checkOut).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—",
            },
            {
              key: "workedMinutes",
              title: "Hours",
              render: (r) => (Number(r.workedMinutes) / 60).toFixed(2),
            },
            { key: "lateMinutes" },
            {
              key: "lockedAt",
              title: "Payroll lock",
              render: (r) => (r.lockedAt ? "Locked" : "Open"),
            },
          ]
        : kind === "work-reports"
          ? [
              { key: "employeeName" },
              { key: "workDate" },
              { key: "summary" },
              {
                key: "minutes",
                title: "Hours",
                render: (r) => (Number(r.minutes) / 60).toFixed(2),
              },
              { key: "status", render: (r) => <Status value={r.status} /> },
            ]
          : kind === "allocations"
            ? [
                { key: "employeeName" },
                {
                  key: "projectId",
                  title: "Project",
                  render: (r) => (
                    <Link
                      className="text-[var(--primary)]"
                      to={`/app/projects/${r.projectId}`}
                    >
                      {r.role}
                    </Link>
                  ),
                },
                { key: "percent", title: "Allocation %" },
                { key: "startDate" },
                { key: "endDate" },
                { key: "plannedHours" },
                { key: "billable" },
              ]
            : kind === "payroll"
              ? [
                  { key: "employeeName" },
                  { key: "startDate" },
                  { key: "endDate" },
                  { key: "gross" },
                  { key: "deductions" },
                  { key: "net" },
                  { key: "currency" },
                  { key: "status", render: (r) => <Status value={r.status} /> },
                ]
              : kind === "salary-history"
                ? [
                    { key: "employeeName" },
                    { key: "effectiveDate" },
                    { key: "monthlyCost" },
                    { key: "currency" },
                    { key: "reason" },
                  ]
                : kind === "holidays"
                  ? [{ key: "name" }, { key: "workDate" }, { key: "optional" }]
                  : kind === "documents"
                    ? [
                        { key: "employeeName" },
                        { key: "title" },
                        { key: "category" },
                        { key: "expiresOn" },
                        {
                          key: "status",
                          render: (r) => <Status value={r.status} />,
                        },
                      ]
                    : kind === "history"
                      ? [
                          { key: "employeeName" },
                          { key: "effectiveDate" },
                          { key: "reason" },
                        ]
                      : kind === "audit"
                        ? [
                            { key: "action" },
                            { key: "entity" },
                            { key: "employeeName" },
                            {
                              key: "createdAt",
                              render: (r) =>
                                new Date(r.createdAt).toLocaleString(),
                            },
                          ]
                        : [
                            { key: "employeeName" },
                            {
                              key: "title",
                              title: kind === "timesheets" ? "Period" : "Title",
                              render: (r) =>
                                r.title || `${r.startDate} – ${r.endDate}`,
                            },
                            { key: "startDate" },
                            { key: "endDate" },
                            {
                              key: "status",
                              render: (r) => <Status value={r.status} />,
                            },
                          ];
  const canCreate =
    kind === "work-reports"
      ? can("self_service")
      : config &&
        (can(config.permission) || (config.self && can("self_service")));
  function actions(row) {
    const own = row.employeeId === ownId;
    const pending = ["Submitted", "Reviewed", "Manager Approved"].includes(
      row.status,
    );
    const editAllowed =
      kind === "employees"
        ? can("manage_employees")
        : config &&
          (can(config.permission) ||
            (config.self && own && can("self_service")));
    return (
      <>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            try {
              setDetail(
                kind === "work-reports"
                  ? await hrm(token, `/work-reports/${row.id}`)
                  : kind === "payroll"
                    ? await hrm(token, `/payslips/${row.id}`)
                    : row,
              );
            } catch (e) {
              toast.error(e.message);
            }
          }}
        >
          View
        </Button>
        {editAllowed &&
          !["Approved", "Posted", "Processed", "Published", "Joined"].includes(
            row.status,
          ) &&
          !["salary-history"].includes(kind) &&
          (!requestKinds.includes(kind) ||
            ["Draft", "Revision Requested"].includes(row.status)) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditor({ config, initial: row })}
            >
              Edit
            </Button>
          )}
        {kind === "work-reports" &&
          own &&
          ["Draft", "Revision Requested"].includes(row.status) &&
          can("self_service") && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    setEditor({
                      work: true,
                      initial: await hrm(token, `/work-reports/${row.id}`),
                    });
                  } catch (e) {
                    toast.error(e.message);
                  }
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  act("Submit report", `/work-reports/${row.id}/action`, {
                    action: "submit",
                  })
                }
              >
                Submit
              </Button>
            </>
          )}
        {kind === "work-reports" && !own && pending && can("approve") && (
          <>
            <Button
              size="sm"
              onClick={() =>
                act(
                  "Approve report",
                  `/work-reports/${row.id}/action`,
                  { action: "approve" },
                  true,
                )
              }
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                act(
                  "Request revision",
                  `/work-reports/${row.id}/action`,
                  { action: "revise" },
                  true,
                )
              }
            >
              Revision
            </Button>
          </>
        )}
        {requestKinds.includes(kind) &&
          pending &&
          !own &&
          can(
            row.status === "Manager Approved"
              ? kind === "reimbursement"
                ? "finance"
                : "hr_approve"
              : "approve",
          ) && (
            <>
              <Button
                size="sm"
                onClick={() =>
                  act(
                    "Approve request",
                    `/requests/${row.id}/action`,
                    { action: "approve" },
                    true,
                  )
                }
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  act(
                    "Reject",
                    `/requests/${row.id}/action`,
                    { action: "reject" },
                    true,
                  )
                }
              >
                Reject
              </Button>
            </>
          )}
        {requestKinds.includes(kind) && pending && own && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              act("Cancel request", `/requests/${row.id}/action`, {
                action: "cancel",
              })
            }
          >
            Cancel
          </Button>
        )}
        {kind === "timesheets" &&
          row.status === "Submitted" &&
          !own &&
          can("approve") && (
            <>
              <Button
                size="sm"
                onClick={() =>
                  act(
                    "Approve timesheet",
                    `/timesheets/${row.id}/action`,
                    { status: "Approved" },
                    true,
                  )
                }
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  act(
                    "Request revision",
                    `/timesheets/${row.id}/action`,
                    { status: "Revision Requested" },
                    true,
                  )
                }
              >
                Revision
              </Button>
            </>
          )}
        {kind === "documents" && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                downloadHrm(
                  token,
                  `/documents/${row.id}/download`,
                  row.fileName,
                ).catch((e) => toast.error(e.message))
              }
            >
              Download
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                navigator.clipboard
                  .writeText(row.id)
                  .then(() => toast.success("Document ID copied"))
                  .catch(() => toast.error("Copy is unavailable"))
              }
            >
              Copy ID
            </Button>
            {can("documents") && row.status !== "Verified" && (
              <Button
                size="sm"
                onClick={() =>
                  act("Verify document", `/documents/${row.id}/verify`, {})
                }
              >
                Verify
              </Button>
            )}
          </>
        )}
        {kind === "payroll" &&
          ["Draft", "Reviewed", "Approved"].includes(row.status) &&
          can(
            row.status === "Draft"
              ? "payroll"
              : row.status === "Reviewed"
                ? "approve_payroll"
                : "finance",
          ) && (
            <Button
              size="sm"
              onClick={() =>
                act(
                  row.status === "Draft"
                    ? "Review payroll"
                    : row.status === "Reviewed"
                      ? "Approve payroll"
                      : "Post to finance",
                  `/payroll/${row.runId}/action`,
                  {
                    action:
                      row.status === "Draft"
                        ? "review"
                        : row.status === "Reviewed"
                          ? "approve"
                          : "post",
                  },
                  false,
                  row.status === "Approved"
                    ? "This posts the entire approved run as salary expenses in the existing finance ledger."
                    : "This action applies to the whole payroll run.",
                )
              }
            >
              {row.status === "Draft"
                ? "Review run"
                : row.status === "Reviewed"
                  ? "Approve run"
                  : "Post run"}
            </Button>
          )}
        {kind === "candidate" &&
          ["Selected", "Offer"].includes(row.status) &&
          can("manage_employees") && (
            <Button
              size="sm"
              onClick={() =>
                setEditor({
                  config: {
                    ...forms.employees,
                    title: "Employee from candidate",
                    endpoint: `/candidates/${row.id}/convert`,
                  },
                })
              }
            >
              Convert to employee
            </Button>
          )}
      </>
    );
  }
  return (
    <div className="space-y-4">
      <PageHeader
        title={titles[kind] || metadata.records[kind]?.label || label(kind)}
        description={
          kind === "timesheets"
            ? "Generated from approved daily work reports."
            : kind === "documents"
              ? "Private employee documents and receipts with authenticated downloads."
              : kind === "salary-history"
                ? "Effective-dated compensation. Each revision preserves the previous record."
                : "Manage records within your assigned HR scope."
        }
      >
        <div className="flex flex-wrap gap-2">
          {canCreate && (
            <Button
              onClick={() =>
                setEditor(kind === "work-reports" ? { work: true } : { config })
              }
            >
              New {config?.title || "report"}
            </Button>
          )}
          {kind === "leave" && can("hr_approve") && (
            <Button
              variant="secondary"
              onClick={() => setEditor({ config: forms["leave-grant"] })}
            >
              Allocate leave
            </Button>
          )}
          {kind === "attendance" && can("hr_approve") && (
            <Button
              variant="secondary"
              onClick={() => setEditor({ config: forms["attendance-mark"] })}
            >
              Mark attendance
            </Button>
          )}
          {kind === "attendance" && can("self_service") && (
            <Button
              variant="secondary"
              onClick={() => setEditor({ config: forms.regularization })}
            >
              Request correction
            </Button>
          )}
          {kind === "documents" &&
            (can("self_service") || can("manage_employees")) && (
              <Button onClick={() => setEditor({ document: true })}>
                Upload document
              </Button>
            )}
          {kind === "payroll" && can("payroll") && can("view_salary") && (
            <Button onClick={() => setEditor({ payroll: true })}>
              Prepare payroll
            </Button>
          )}
          {can("export") &&
            [
              "employees",
              "attendance",
              "work-reports",
              "timesheets",
              "allocations",
              "requests",
              "documents",
              "salary-history",
            ].includes(resource) && (
              <Button
                variant="secondary"
                onClick={() =>
                  downloadHrm(
                    token,
                    `/export/${resource}?${queryString({ employeeId, search, status, startDate: start, endDate: end, kind: requestKinds.includes(kind) ? kind : null })}`,
                    `hrm-${kind}.csv`,
                  ).catch((e) => toast.error(e.message))
                }
              >
                Export CSV
              </Button>
            )}
        </div>
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          name="recordSearch"
          title="Search employee / title"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
        />
        {dateKinds.includes(kind) && (
          <>
            <Field
              name="fromDate"
              title="From date"
              type="date"
              value={start}
              onChange={(v) => {
                setStart(v);
                setPage(1);
              }}
            />
            <Field
              name="toDate"
              title="To date"
              type="date"
              value={end}
              onChange={(v) => {
                setEnd(v);
                setPage(1);
              }}
            />
          </>
        )}
      </div>
      <HrmTable
        {...result}
        page={page}
        loading={loading}
        error={error}
        columns={columns}
        onPage={setPage}
        onRetry={reload}
        actions={actions}
      />
      {editor?.work ? (
        <WorkReportForm
          token={token}
          metadata={metadata}
          masters={masters}
          employeeId={chosenEmployee}
          initial={editor.initial}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            reload();
            toast.success("Draft saved");
          }}
        />
      ) : editor?.document ? (
        <DocumentForm
          token={token}
          employeeId={chosenEmployee}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            reload();
          }}
        />
      ) : editor?.payroll ? (
        <PayrollForm
          token={token}
          employeeId={chosenEmployee}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            reload();
          }}
        />
      ) : editor?.config ? (
        <HrmForm
          token={token}
          metadata={metadata}
          masters={masters}
          employeeId={chosenEmployee}
          initial={editor.initial}
          config={editor.config}
          can={can}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            reload();
            toast.success("Saved");
          }}
        />
      ) : null}
      {detail && (
        <Modal open title="HR record details" onClose={() => setDetail(null)}>
          <DetailValues data={detail} />
          {kind === "payroll" && (
            <Button
              className="mt-4"
              onClick={() => exportPdf("Payslip", detail)}
            >
              Download PDF
            </Button>
          )}
        </Modal>
      )}
      {action && (
        <ActionDialog
          action={action}
          onClose={() => setAction(null)}
          onConfirm={perform}
          busy={busy}
        />
      )}
    </div>
  );
}
import { Lookup } from "./HrmShared";
function DocumentForm({ token, employeeId, onClose, onSaved }) {
  const [data, setData] = useState({
    employeeId,
    title: "",
    category: "",
    expiresOn: "",
  });
  const [file, setFile] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal open title="Upload private document" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const formData = new FormData();
            for (const [k, v] of Object.entries(data))
              formData.append(k, v || "");
            formData.append("file", file);
            await hrm(token, "/documents", { method: "POST", formData });
            toast.success("Document uploaded");
            onSaved();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <p role="alert" className="text-rose-600">
            {error}
          </p>
        )}
        <Lookup
          token={token}
          name="documentEmployee"
          title="Employee"
          value={data.employeeId}
          onChange={(v) => setData((d) => ({ ...d, employeeId: v }))}
          required
        />
        {[
          ["title", "Title", "text"],
          ["category", "Category", "text"],
          ["expiresOn", "Expiry date", "date"],
        ].map(([name, title, type]) => (
          <Field
            key={name}
            name={name}
            title={title}
            type={type}
            value={data[name]}
            required={name !== "expiresOn"}
            onChange={(v) => setData((d) => ({ ...d, [name]: v }))}
          />
        ))}
        <label className="block text-sm">
          PDF, PNG or JPEG · up to 10 MB
          <input
            className="mt-2 block w-full text-sm"
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            required
            onChange={(e) => setFile(e.target.files[0])}
          />
        </label>
        <Button type="submit" loading={busy}>
          Upload
        </Button>
      </form>
    </Modal>
  );
}
function PayrollForm({ token, employeeId, onClose, onSaved }) {
  const [ids, setIds] = useState(employeeId ? [employeeId] : []),
    [selected, setSelected] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal open title="Prepare payroll" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await hrm(token, "/payroll", {
              method: "POST",
              body: { startDate: start, endDate: end, employeeIds: ids },
            });
            onSaved();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <p role="alert" className="text-rose-600">
            {error}
          </p>
        )}
        <p className="text-sm text-[var(--text-muted)]">
          Select a completed month. Attendance, leave and effective salaries
          must be resolved before the payroll snapshot can be locked.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            name="payrollStart"
            title="Month start"
            type="date"
            required
            value={start}
            onChange={setStart}
          />
          <Field
            name="payrollEnd"
            title="Month end"
            type="date"
            required
            value={end}
            onChange={setEnd}
          />
        </div>
        <Lookup
          token={token}
          name="payrollEmployee"
          title="Add employee"
          value={selected}
          onChange={(v) => {
            setSelected(v);
            if (v) setIds((a) => [...new Set([...a, v])]);
          }}
        />
        <p className="text-sm">{ids.length} employees selected</p>
        {ids.map((id) => (
          <div key={id} className="flex items-center justify-between text-xs">
            <span>{id}</span>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setIds((a) => a.filter((x) => x !== id))}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button type="submit" loading={busy} disabled={!ids.length}>
          Lock attendance & create draft
        </Button>
      </form>
    </Modal>
  );
}
export async function exportPdf(title, data) {
  try {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFontSize(17);
    pdf.text(title, 16, 20);
    pdf.setFontSize(10);
    let y = 31;
    function line(text) {
      const lines = pdf.splitTextToSize(String(text), 177);
      for (const value of lines) {
        if (y > 278) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(value, 16, y);
        y += 5;
      }
    }
    function walk(o, depth = 0) {
      for (const [k, v] of Object.entries(o || {})) {
        if (
          v == null ||
          [
            "id",
            "employeeId",
            "runId",
            "expenseId",
            "createdBy",
            "reviewedBy",
            "salaryHistoryId",
          ].includes(k)
        )
          continue;
        if (typeof v === "object") {
          line(`${" ".repeat(depth)}${label(k)}`);
          if (Array.isArray(v))
            v.forEach((x) =>
              typeof x === "object" ? walk(x, depth + 1) : line(x),
            );
          else walk(v, depth + 1);
        } else line(`${label(k)}: ${v}`);
      }
    }
    walk(data);
    pdf.save(`${title.toLowerCase().replace(/\W+/g, "-")}.pdf`);
  } catch (e) {
    toast.error(e.message);
  }
}
