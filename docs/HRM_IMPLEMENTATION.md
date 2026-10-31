# HRM implementation map

## Pre-implementation audit (7 September 2026)

The working tree was clean. The live PostgreSQL catalog was inspected in a read-only transaction. It contains 48 public tables and no employee, attendance, leave, worklog, resource-allocation or recruitment tables. The checked-in `crm.db` and `frontend/assets/js` are legacy artifacts; the running application is Express/CommonJS + pg and React 19/Vite/Tailwind 4 with a hash router. The frontend README describes the old prototype and is not an architecture reference.

| Area | Existing implementation | HRM integration decision |
| --- | --- | --- |
| Authentication | JWT, `requireAuth`, `users`, `user_roles` | Keep login and user identity. Optional unique employee-to-user relation; no second credential system. |
| Authorization | `permissions`, `role_permissions`, `hasPermission`, role editor | Add granular assignable HRM permissions. Enforce employee/team/project scope in SQL and action services. No automatic grants to existing ordinary roles. |
| Employees/finance | User contact fields and current `salary`; expense `employee_id` already references **users** | Keep this FK and salary field. Separate effective-dated HR compensation; finance postings use the linked user where available. Never infer historical salary from current salary. |
| Organization | `master_items` with typed payloads | Reuse for departments, designations, teams, locations, employment types, shifts and leave types. Validate each reference against its master type. |
| Projects/tasks | `projects.payload.activities` tasks (`assignedTo`, `collaborators`, status, deadlines); `lead_events` shared tasks | Read both through an adapter. Keep existing task editors and IDs; link work entries by source and project. No second task table. |
| CRM/clients/leads | Controllers/repositories and lead pipeline access | Reference existing clients/projects. Do not expose CRM commercial payloads in HR lookups. |
| Finance | Salary/reimbursement expenses; finance service and project profitability | Post approved reimbursements/payroll once to existing expenses. HR costing is an additional explicitly scoped report; preserve existing report semantics. |
| Files | Drive adapter, `file_assets`; public media proxy and optional globally public uploads | Confidential HR attachments must not use that public path. Use protected HR blob storage with authenticated download and strict size/type checks. |
| Notifications/jobs | `notifications`, Socket.IO, mailer, node-cron and automation logs | Transactional in-app notifications; explicit opt-in HR scheduler with idempotent daily reminders. No external email by default. |
| Audit/history | Follow-up-specific audit tables, workflow logs; no general audit | Append-only HR audit and effective-dated employment/salary snapshots. Do not reuse follow-up audit entities. |
| Settings/date handling | `app_settings` company data; PostgreSQL DATE parser; date-only frontend helpers | Reuse company data for letters. HR policy is versioned separately; calendar dates remain strings, instants use timestamptz, policy timezone is explicit. |
| UI | Shared Card, Button, Input, Modal, Tabs, StatCard, EmptyState, toast; client-paged Table | Reuse primitives and design tokens. HR table uses server pagination; forms organized by sections. Existing tables remain unchanged. |
| Reporting | Server finance analytics, CSV exporter, jsPDF/html2pdf invoice tooling | Centralize HR calculations, bounded date ranges, scoped CSV and print/PDF views. No new analytics package. |

## Risks and deployment rules

- Existing initialization also seeds demos and repairs legacy schemas. The HR migration must run independently in a transaction and must not invoke general initialization.
- New schema is additive, with restrictive FKs, indexes, unique constraints and defaults. Never backfill every login as an employee or copy a current salary into past dates.
- Existing user/project APIs accept flexible JSON. HR endpoints use allowlists and never spread user or salary payloads into responses.
- Existing expense salary fallback is all-or-nothing; HR finance posting must be explicit and documented. Existing reports are not silently rewritten.
- Existing public Drive proxy cannot provide document confidentiality. Private blobs have no public URL.
- Approved work reports, timesheets and payroll need locks and transactional approval. Repeated approvals must not deduct leave/post expenses twice.
- No project-wide tenancy key exists. This extension follows the existing single-company database model; it does not claim multi-tenant isolation.

## Dependency order

1. Additive migration, permissions, scoped repository, validated policy/masters, employee profile/history.
2. Attendance, shifts, regularization, holiday/leave ledger, private documents.
3. Single work-entry source, daily reports/approval, derived timesheets, existing task adapter, allocation.
4. Capacity/calendar/utilization/compliance and explainable employee/team/company analytics.
5. Effective-dated compensation, locked payroll snapshots, reimbursement expense posting and project costing.
6. Recruitment, onboarding/offboarding, skills/goals/reviews/assets/helpdesk and company-setting-based letters.
7. Dashboard, calendar/tracking, exports, in-app automation, role/regression/integration verification.

Implementation and validation evidence are recorded below as work completes.

## v2 — location-verified workday (employee app), 30 October 2026

Schema `database/hrm_v2.sql` (additive, applied by `migrate-hrm.js` as version 2; on first install it also sets `allowBackdatedReports=false`):
`hrm_geofences` (office / employee home, Pending → Approved), `hrm_attendance_events` (clock, job, lunch, slot, exit/return, offline/online), `hrm_alerts` (admin decision queue), `hrm_devices` (FCM tokens); new attendance columns (work mode, job start/end, lunch, last ping, offline/outside/idle minutes, auto checkout, summary, override); work entries gain `source`, `slot_start/end`, `edit_count`; reports gain `edit_count`, `admin_edited_*`.

Rules (all server-side, server clock):
- Clock-in needs a GPS fix within `maxGpsAccuracyMeters`; mock locations are rejected. Office fence → WFO, approved home fence → WFH, otherwise blocked; *Client Visit* needs a reason and opens an alert. The web check-in button is disabled while `geofenceRequired` is on.
- Work time = job start → job end minus lunch. A report slot is due every `reportIntervalMinutes` of working time; lunch pauses it. Minutes past `due + slotGraceMinutes` are idle. Duplicate (copy-pasted) text from the last 7 days and text shorter than `minSlotReportChars` are rejected.
- Lunch: once per day inside `lunchWindowStart–End`; minutes over `lunchMaxMinutes` open a `lunch_overrun` alert.
- Pings every `pingIntervalMinutes`; no ping for `offlineAfterMinutes` during a running job = offline (alert + offline minutes). Leaving the session's fence during shift hours (not on lunch) = `geofence_breach` alert; returning closes it and adds outside minutes.
- Employees edit only today's draft entries (each edit increments counts + audit). Past days: admin only via `PUT /hrm/work-reports/admin`.
- After `reportDeadline` (23:59): open sessions are closed, drafts with entries auto-submitted, days without a report marked **Absent** (`override.auto=true`) with critical notifications to employee and reviewers. Admin override: `POST /hrm/attendance/override` (payroll reads the final status: Absent = 0, Half Day = 0.5).
- Half-day leave with `details.fromTime` for today: on approval the session closes at that time (or `auto_checkout_at` is set) and the day is Half Day.

Endpoints: employee `GET /hrm/me/today`, `POST /hrm/me/{clock-in,job,lunch,slots,check-out,ping,home-geofence,devices}`, `PUT /hrm/me/entries/:id`, `POST /hrm/me/alerts/:id/explain`; admin `GET /hrm/live`, `GET /hrm/day`, `GET|POST|PUT /hrm/geofences`, `POST /hrm/geofences/:id/action`, `GET /hrm/alerts`, `POST /hrm/alerts/:id/action`.

Automation: `HRM_AUTOMATION_ENABLED=true` runs `automation.realtime()` on `HRM_REALTIME_CRON` (default every 5 min, no user id needed) — slot/lunch reminders, missed slots, offline alerts, half-day auto clock-out, deadline processing (idempotent via `hrm_automation_runs`).

Push: set `FIREBASE_SERVICE_ACCOUNT_PATH` to a Firebase service-account JSON; notifications created by HRM are then also sent via FCM HTTP v1 after the transaction commits. Without it only in-app notifications (and the app's local reminders) are used.

Web employee workday: *HRM → My day* (`/app/hrm/my-day`, also on the overview for employees) runs the same flow as the app with browser location (`client: "web"`, stored as attendance `source=web`); pings run only while the tab is open, so a closed tab shows as offline. `allowWebAttendance=false` limits clock-in to the app. Employees without `dashboard.view` land on My day after login.

Web: HRM overview shows the live board, alert queue and home-location approvals (map); *Work locations* manages office geofences (`VITE_GOOGLE_MAPS_API_KEY`). Policy keys are editable under *Policies & organization*.

Demo data: `npm run seed:hrm-demo` (refuses databases named `*prod*`). Tests: `node --test tests/hrm.workday.test.js`.
