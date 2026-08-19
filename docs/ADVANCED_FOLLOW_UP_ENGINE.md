# Advanced Follow-up Engine

## Architecture analysis

Webitof CRM uses an Express/CommonJS API, PostgreSQL through `pg`, additive boot-time SQL initialization, repository-style models, middleware RBAC, a shared immutable-style `lead_events` activity stream, notification records plus Socket.IO, and `node-cron` jobs. The frontend is React 19, React Router, Vite, Tailwind utilities, and the existing UI component library.

The previous follow-up implementation was limited to date/time fields on leads and clients plus `lead_events` reminders. The new engine keeps those fields and events for compatibility, then links new lead reminders to the central polymorphic follow-up record. No existing table, route, field, permission, or workflow was removed or renamed.

## Impacted files

- Foundation: `backend/database/follow-up-engine.sql`, `backend/models/followUp.model.js`, `backend/services/followUpEngine.service.js`, `backend/controllers/followUps.controller.js`, `backend/routes/followUps.routes.js`, and `backend/routes/followUpConfig.routes.js`.
- Application wiring: `backend/config/initDb.js`, `backend/config/rbac.js`, `backend/routes/index.js`, `backend/server.js`, `backend/services/notification.service.js`, and `backend/.env.example`.
- Business integrations: `backend/controllers/leads.controller.js`, `backend/controllers/leadEvents.controller.js`, `backend/controllers/invoices.controller.js`, `backend/controllers/payments.controller.js`, and `backend/controllers/masters.controller.js`.
- Frontend: `frontend/src/pages/followups/FollowUpsPage.jsx`, `frontend/src/components/followups/FollowUpModals.jsx`, `frontend/src/api/client.js`, `frontend/src/App.jsx`, `frontend/src/config/navigation.js`, `frontend/src/components/layout/Sidebar.jsx`, `frontend/src/components/guards/PermissionRoute.jsx`, and `frontend/src/pages/MastersPage.jsx`.
- Operations and verification: `backend/database/apply-follow-up-schema.js`, `backend/database/backfill-follow-ups.js`, `backend/database/seed-follow-ups.js`, `backend/database/FOLLOW_UP_ENGINE_ROLLBACK.md`, `backend/tests/followUpEngine.test.js`, `backend/tests/followUpEngine.integration.js`, and `backend/tests/followUpApi.smoke.js`.

## Domain and schema

The additive schema is in `backend/database/follow-up-engine.sql` and includes:

- `follow_ups`: polymorphic related record, scheduling, priority explanation, ownership, automation references, recurrence, completion, acknowledgement, escalation, optimistic version, and soft delete.
- Immutable/audit-safe records: `follow_up_status_history`, `follow_up_reschedule_history`, `follow_up_audit_logs`, `follow_up_escalation_logs`.
- Automation: `follow_up_templates`, `follow_up_sequences`, `follow_up_sequence_steps`, `follow_up_sequence_enrollments`, `follow_up_sequence_executions`, `follow_up_automation_rules`, `follow_up_automation_executions`, `follow_up_escalation_rules`.
- Delivery: `follow_up_reminders`, `follow_up_notification_logs`, and an additive idempotency key on existing `notifications`.
- Business support: `follow_up_settings` and `payment_promises`.

All dates that represent an instant use `timestamptz`. Business defaults use `Asia/Kolkata`; the setting remains configurable. Indexes cover due/status, assignee/due, priority, related entity, team, sequence execution, reminder execution, and promise dates.

## Backend behavior

`backend/services/followUpEngine.service.js` owns the business rules:

- Server-side pagination, filters, search, sorting and own/team/all visibility.
- Explainable priority calculation from value, age, attempts, promise and renewal risk.
- Transactional create, edit, start, complete-and-create-next, reschedule, snooze, reassign, escalate, acknowledge, soft delete and restore.
- Mandatory actual outcome, communication result and discussion note.
- Mandatory next action and next due date for active related records, with a separate override permission.
- Immutable status, reschedule, escalation and audit histories.
- One-at-a-time recurrence generation to prevent uncontrolled rows.
- Idempotent reminder notifications, sequence enrollments/executions and automation runs.
- Event-driven `When -> Conditions -> Actions` rules with versioned idempotency. Safe built-in actions create follow-ups, start/stop sequences, escalate, change priority, add tags and send internal in-app notifications; unsupported provider actions are recorded without attempting an external side effect.
- No-follow-up protection for leads, quotations, invoices, promises, renewals, inactive assignees, repeated reschedules, waiting records and high-value overdue work.
- Indian business hours, company holidays, INR display data and payment-promise risk.

Lead creation always creates a first-contact follow-up. A supplied lead follow-up date is respected; otherwise the first-contact SLA is 15 minutes. Existing lead reminder events are still created and carry the central `followUpId`.

Quotation `Sent` starts the default quotation sequence; `Approved`/`Rejected` stops it. Approved quotation invoice creation also creates a payment follow-up. Standalone non-draft invoice creation creates a payment follow-up. A fully paid invoice auto-closes its open follow-ups, fulfills pending payment promises, and preserves audit history. The background cycle creates upcoming renewal and missed-promise follow-ups without sending customer messages.

## API

Authenticated routes:

- `GET/POST /api/follow-ups`
- `GET/PATCH/DELETE /api/follow-ups/:id`
- `POST /api/follow-ups/:id/start|complete|reschedule|snooze|reassign|escalate|acknowledge|restore`
- `GET /api/follow-ups/today|overdue|attention-required|calendar|analytics|options|related-search|export`
- `POST /api/follow-ups/bulk`
- `GET/PUT /api/follow-ups/settings`
- `POST /api/follow-ups/automation/run`
- `GET/POST /api/follow-ups/payment-promises`
- `GET/POST/PATCH /api/follow-up-templates`
- `GET/POST/PATCH /api/follow-up-sequences`
- `GET/POST/PATCH /api/follow-up-automation-rules`
- `GET/POST/PATCH /api/follow-up-escalation-rules`

Errors follow the existing `{ success: false, message, details? }` response convention. Edit requests may include `version`; a stale version returns HTTP 409.

## Permissions

The existing RBAC catalog now includes own/team/all view, create, edit-own/edit-any, complete, reschedule, reassign, bulk assign, escalate, configuration management, analytics, export, delete/restore, audit viewing and next-action override permissions. Admin receives all catalog permissions. Sales receives operational follow-up permissions. Accountant receives finance-relevant operational permissions. All enforcement is server-side; UI permission checks only improve presentation.

## Frontend

`/app/follow-ups` provides:

- Today command center for overdue, due-now, due-today, upcoming, high/critical, waiting, unassigned, no-response and missing-action queues.
- Server-paginated list with search and filters.
- Month calendar, Kanban and workload views.
- Attention Required categories and one-click suggested follow-up creation.
- Analytics for completion, ageing, status, priority, outcome, type and employee workload.
- Reusable add/edit form with related-record search, past-date warning, recurrence and unsaved-change protection.
- Mandatory completion and reasoned reschedule/snooze dialogs.
- Direct call, WhatsApp and email actions when related contact data exists.
- Admin editors for templates, ordered sequences, automation conditions/actions and escalation levels, plus manual job execution and settings management.

## Background job

`FOLLOW_UP_AUTOMATION_CRON` defaults to every ten minutes. `FOLLOW_UP_TIMEZONE` defaults to `Asia/Kolkata`. Each cycle runs in a transaction and processes bounded batches for reminders, escalation, sequence steps, renewal risks and missed payment promises. Unsupported outbound channels are logged as skipped; customer communication is not sent automatically by this engine.

## Migration and backfill

Boot-time initialization applies the additive SQL when `AUTO_INIT_DB=true`.

For an explicit deployment migration (also safe to rerun):

```powershell
cd backend
npm run migrate:follow-up-schema
```

For existing data:

```powershell
cd backend
npm run backfill:follow-ups
```

This is report-only. It lists candidate active leads, sent/viewed quotations, outstanding invoices and upcoming renewals. After administrator review:

```powershell
npm run backfill:follow-ups:apply
```

Applied records use `source = 'backfill_review'`; no client messages are sent. Development-only seed data requires the explicit `npm run seed:follow-ups` confirmation flag embedded in the package script and covers overdue/due/critical/waiting/completed work, multiple assignees, invoice/renewal follow-ups and a missed payment promise.

## Rollback

The production-safe rollback is application rollback plus disabling the follow-up cron while retaining the additive tables and their audit data. Detailed physical rollback precautions are in `backend/database/FOLLOW_UP_ENGINE_ROLLBACK.md`. Existing business fields and events remain compatible with the previous application version.

## Verification

Automated coverage includes due status, priority explanation, active-record next-action rules, condition evaluation, reminder timing, escalation thresholds, recurrence, business hours, retry scheduling, IST parsing, transactionally creating/rescheduling/completing/creating-next, reminder creation and audit history.

Manual QA checklist:

1. Create a lead with and without a supplied follow-up time; confirm a central first-call record and legacy timeline reminder.
2. Verify own/team/all visibility with sales, manager and admin users.
3. Create a follow-up from lead, client, invoice, project and renewal searches.
4. Complete an active lead follow-up without a next action; confirm validation blocks it.
5. Complete with a next action; confirm both records, linked IDs, lead fields and timeline are committed together.
6. Reschedule and snooze; confirm required reason, original due date and counts.
7. Run the automation cycle twice; confirm reminders and sequence steps are not duplicated.
8. Send/approve a quotation; confirm sequence enrollment, stop condition, invoice and payment follow-up.
9. Record full invoice payment; confirm open invoice follow-ups become `Auto-Closed` and audit history remains.
10. Create a missed payment promise and upcoming renewal; run automation and check Attention Required.
11. Verify CSV export and audit detail are inaccessible without their permissions.
12. Verify keyboard navigation, mobile layouts, loading/error/empty states and IST/INR formatting.

## Current limitations

- The repository has no native support-ticket, branch/company tenant, employee leave, push, WhatsApp provider, browser-notification service worker, telephony provider or queue system. The polymorphic `Custom` relation and job abstraction are ready for those modules, but provider-specific delivery is intentionally not mocked.
- Calendar currently provides a responsive month command view; drag-and-drop is deferred until the project adopts a drag-and-drop dependency/design convention.
- Template, sequence, automation-rule and escalation-rule definitions are API/UI-manageable. The current structured JSON condition/action editor is intentionally dependency-free; a visual branching canvas can be added without schema changes.
- Analytics are live SQL aggregates across the full permitted filtered data set. Long-period warehousing, Excel/PDF exports and cached materialized dashboards should be introduced only when real data volume justifies them.
