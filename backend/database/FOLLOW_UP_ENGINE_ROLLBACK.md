# Advanced Follow-up Engine rollback

The migration is additive. The preferred production rollback is to deploy the previous application version, disable `FOLLOW_UP_AUTOMATION_CRON`, and retain the new tables so audit and follow-up history remain recoverable.

Before any physical table removal:

1. Export all `follow_up_*`, `follow_ups`, and `payment_promises` tables.
2. Confirm no previous-version code depends on the new central records.
3. Remove the follow-up route/job registration from the deployed application.
4. Drop only the new tables in reverse foreign-key order during a separately approved maintenance window.
5. The additive `notifications.idempotency_key` column may safely remain; removing it is unnecessary.

Existing `leads.follow_up_date`, lead events, invoices, payments, projects, clients, AMC, renewals, authentication, permissions, and notification data are never deleted or rewritten by this migration. Backfill records are identifiable through `source = 'backfill_review'` and can be soft-deleted (`deleted_at`) if an administrator rejects them.
