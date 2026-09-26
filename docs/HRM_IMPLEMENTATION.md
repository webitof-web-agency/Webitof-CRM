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
