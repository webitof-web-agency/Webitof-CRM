import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { hrm } from "./hrmApi";
import { HrmCollection } from "./HrmCollection";
import { HrmDashboard } from "./HrmDashboard";
import { HrmSettings } from "./HrmSettings";
import { HrmGeofences } from "./HrmGeofences";
import { HrmMyDay } from "./HrmMyDay";
import { EmployeeProfile } from "./EmployeeProfile";
import { EmployeeWizard } from "./EmployeeWizard";
import { employeePath, useEmployeeId } from "./employeeShared";
import { HrmRecruitment } from "./HrmRecruitment";
const sections = [
  ["overview", "Overview"],
  ["my-day", "My day", "self_service"],
  ["employees", "Employees"],
  ["attendance", "Attendance"],
  ["geofences", "Work locations", "approve"],
  ["leave", "Leave"],
  ["holidays", "Holidays"],
  ["work-reports", "Work reports"],
  ["timesheets", "Timesheets"],
  ["allocations", "Resource allocation"],
  ["analytics", "Employee analytics"],
  ["reimbursement", "Reimbursements"],
  ["payroll", "Payroll"],
  ["salary-history", "Compensation", "view_salary"],
  ["recruitment", "Recruitment pipeline", "recruitment"],
  ["job", "Job openings", "recruitment"],
  ["candidate", "Candidates", "recruitment"],
  ["interview", "Interviews", "recruitment"],
  ["onboarding", "Onboarding"],
  ["goal", "Goals / OKRs"],
  ["review", "Performance"],
  ["skill", "Skills"],
  ["asset", "Assets", "assets"],
  ["documents", "Documents"],
  ["resignation", "Resignations"],
  ["offboarding", "Offboarding"],
  ["helpdesk", "HR helpdesk"],
  ["regularization", "Regularization"],
  ["payroll_adjustment", "Payroll adjustments", "payroll"],
  ["audit", "Activity history", "audit"],
  ["settings", "Policies & organization"],
];
export function HrmPage() {
  const { token, user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const path = params["*"] || "overview";
  const [kind, id, sub] = path.split("/");
  const [metadata, setMetadata] = useState(null),
    [masters, setMasters] = useState([]),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const can = useCallback(
    (action) => hasPermission(`hrm.${action}`),
    [hasPermission],
  );
  const reload = useCallback(() => setRefresh((n) => n + 1), []);
  // Profile URLs are readable (mallika-paik-EMP-12); old id URLs still work.
  const employee = useEmployeeId(token, kind === "employees" && id !== "new" ? id : "");
  useEffect(() => {
    let active = true;
    Promise.all([hrm(token, "/meta"), hrm(token, "/lookups?type=masters")])
      .then(([meta, m]) => {
        if (active) {
          setMetadata(meta);
          setMasters(m.rows);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [token, refresh]);
  if (error)
    return (
      <Card className="p-6">
        <h1 className="text-xl font-semibold">HRM is unavailable</h1>
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {error}
        </p>
        <Button className="mt-4" onClick={reload}>
          Retry
        </Button>
      </Card>
    );
  if (!metadata)
    return (
      <div className="space-y-4" aria-label="Loading HRM">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="h-28 animate-pulse bg-[var(--surface-2)]" />
        ))}
      </div>
    );
  const props = { token, metadata, masters, can };
  const available = sections.filter(
    ([, , permission]) => !permission || can(permission),
  );
  return (
    <div className="space-y-6">
      {kind === "employees" && id === "new" && can("manage_employees") ? (
        <EmployeeWizard
          {...props}
          candidateId={searchParams.get("candidate") || ""}
          candidate={location.state?.candidate || null}
          onDone={(saved) => navigate(employeePath(saved))}
          onCancel={() => navigate("/app/hrm/employees")}
        />
      ) : kind === "employees" && id && id !== "new" && !employee.id ? (
        // A readable URL (mallika-paik-EMP-12) is still being turned into the employee id.
        <Card className="p-5" role={employee.error ? "alert" : "status"}>
          {employee.error || "Loading employee…"}
        </Card>
      ) : kind === "employees" && id && sub === "edit" && can("manage_employees") ? (
        <EmployeeWizard
          {...props}
          key={employee.id}
          employeeId={employee.id}
          onDone={(saved) => navigate(employeePath(saved))}
          onCancel={() => navigate(`/app/hrm/employees/${id}`)}
        />
      ) : kind === "employees" && id === "new" ? (
        <Card className="p-5">You do not have permission to add employees.</Card>
      ) : kind === "employees" && id ? (
        <EmployeeProfile key={employee.id} {...props} id={employee.id} tab={sub || ""} />
      ) : ["overview", "analytics"].includes(kind) ? (
        <HrmDashboard key={kind} {...props} analytics={kind === "analytics"} />
      ) : kind === "settings" ? (
        <HrmSettings {...props} onReload={reload} />
      ) : kind === "my-day" && !metadata.ownEmployeeId ? (
        <Card className="p-5">
          No employee profile is linked to your login, so there is no workday to track.
        </Card>
      ) : kind === "my-day" && can("self_service") ? (
        <div className="space-y-5">
          <PageHeader
            eyebrow="Attendance"
            title="My day"
            description="Clock in, report your work every hour, take lunch and close the day — the same workday as the Webitof Employee app."
          />
          <HrmMyDay token={token} />
        </div>
      ) : kind === "recruitment" && can("recruitment") ? (
        <HrmRecruitment {...props} />
      ) : kind === "geofences" && (can("approve") || can("manage_settings")) ? (
        <HrmGeofences {...props} />
      ) : available.some(([key]) => key === kind) ? (
        <HrmCollection key={kind} {...props} kind={kind} />
      ) : (
        <Card className="p-5">
          This HR workspace is unavailable for your role.
        </Card>
      )}
    </div>
  );
}
