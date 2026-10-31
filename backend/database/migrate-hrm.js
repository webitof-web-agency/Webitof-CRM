const fs = require("node:fs");
const path = require("node:path");
const { withTransaction, closePool } = require("../config/db");
const { createId } = require("../utils/format");
const { PERMISSIONS, DEFAULT_POLICY, V2_POLICY_OVERRIDES } = require("../config/hrm");
async function migrate(db) {
  await db.query(
    "SELECT pg_advisory_xact_lock(hashtext('webitof-hrm-schema'))",
  );
  await db.query("SET LOCAL lock_timeout = '10s'");
  await db.query(fs.readFileSync(path.join(__dirname, "hrm.sql"), "utf8"));
  await db.query(
    "INSERT INTO hrm_settings(key,value) VALUES('policy',$1) ON CONFLICT DO NOTHING",
    [JSON.stringify(DEFAULT_POLICY)],
  );
  for (const p of PERMISSIONS)
    await db.query(
      `INSERT INTO permissions(id,code,name,module,action,description) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(code) DO NOTHING`,
      [createId("perm"), p.code, p.name, p.module, p.action, p.description],
    );
  await db.query(
    "INSERT INTO hrm_schema_versions(version) VALUES(1) ON CONFLICT DO NOTHING",
  );
  await db.query(fs.readFileSync(path.join(__dirname, "hrm_v2.sql"), "utf8"));
  const v2 = await db.query(
    "INSERT INTO hrm_schema_versions(version) VALUES(2) ON CONFLICT DO NOTHING RETURNING version",
  );
  // First v2 run only: add the new attendance policy keys and switch to the
  // "employees report today only; admins edit past days" rule. Later edits win.
  if (v2.rowCount)
    await db.query(
      "UPDATE hrm_settings SET value=$1::jsonb || value || $2::jsonb, updated_at=now() WHERE key='policy'",
      [JSON.stringify(DEFAULT_POLICY), JSON.stringify(V2_POLICY_OVERRIDES)],
    );
}
if (require.main === module)
  withTransaction(migrate)
    .then(() =>
      console.log(
        "HRM additive migration applied. Existing records and role grants preserved.",
      ),
    )
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(closePool);
module.exports = { migrate };
