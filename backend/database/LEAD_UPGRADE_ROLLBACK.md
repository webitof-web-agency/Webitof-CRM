# Lead management upgrade rollback

The migration is additive: it creates nullable columns, safe defaults, indexes, a sequence, and `lead_conversion_mappings`. It does not rename or remove existing lead data.

The recommended production rollback is application-only:

1. Deploy the previous application version.
2. Leave the added database objects in place. Older repositories ignore unknown columns and payload keys.
3. Keep a database backup from immediately before migration until the release is accepted.

Do not drop the new columns or conversion mappings during an emergency rollback because that would discard data written after deployment. A destructive cleanup, if ever required, must be a separately reviewed maintenance migration after exporting the new lead data.
