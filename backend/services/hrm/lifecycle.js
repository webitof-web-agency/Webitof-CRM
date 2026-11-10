const c = require("./core");
const fileAssetModel = require("../../models/fileAsset.model");
const { readFileBuffer, removeFile, saveUpload } = require("../file.service");
const { EMPLOYEE_FOLDER_ROOT, employeeFolder } = require("../../utils/uploadPath");
const rules = require("./validators");
const access = require("./access");
const HRM_DOCUMENT_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};
const { RECORDS } = require("../../config/hrmRecords");
async function record(user, kind, body, id = null, db = null) {
  const config = RECORDS[kind];
  if (!config) c.fail("Unknown HR record", 404);
  c.allow(body, [
    "employeeId",
    "projectId",
    "parentId",
    "title",
    "status",
    "startDate",
    "endDate",
    "details",
    "version",
  ]);
  return c.transaction(async (tx) => {
    const old = id
      ? c.camel(
          (
            await tx.query(
              "SELECT * FROM hrm_records WHERE id=$1 AND kind=$2 AND archived_at IS NULL FOR UPDATE",
              [id, kind],
            )
          ).rows[0],
        )
      : null;
    if (id && !old) c.fail("Record not found", 404);
    if (old) c.optimistic(old, body);
    const e = body.employeeId
      ? await c.employee(tx, user, body.employeeId, { lock: true })
      : null;
    const previousEmployee = old?.employeeId ? await c.employee(tx, user, old.employeeId) : null;
    // Authorize against the record's current owner too, so re-pointing it cannot dodge the self checks.
    const own = e?.userId === user.id || previousEmployee?.userId === user.id;
    if (!(config.self && own && c.can(user, "self_service")))
      c.permit(user, config.permission);
    if (config.sensitive) c.permit(user, "view_salary");
    if (!config.global && !e) c.fail("Employee is required");
    const status = c.choice(
      body.status || old?.status || config.statuses[0],
      config.statuses,
      "Status",
    );
    if (kind === "candidate" && status === "Joined" && old?.status !== "Joined")
      c.fail("Use Convert to employee to complete joining");
    if (kind === "payroll_adjustment") {
      if (status === "Processed")
        c.fail("Payroll marks adjustments as processed automatically");
      if (old?.status === "Processed")
        c.fail("Processed adjustments are immutable", 409);
      if (status === "Approved") {
        c.permit(user, "approve_payroll");
        if (!old) c.fail("Save the adjustment first; a different approver must then approve it", 403);
        if (own || old?.createdBy === user.id)
          c.fail("Adjustments require an independent approver", 403);
      }
    }
    if (kind === "review" && own)
      c.fail(
        "Manager reviews must be completed by another authorized reviewer",
        403,
      );
    if (old?.status === "Published")
      c.fail("Published reviews are immutable; create a new review", 409);
    const details = body.details || {};
    c.allow(
      details,
      config.fields.map((f) => f.key),
    );
    const d = {};
    for (const f of config.fields) {
      const value = details[f.key];
      if (value == null || value === "") {
        if (f.required) c.fail(`${f.label} is required`);
        continue;
      }
      if (f.type === "number")
        d[f.key] = c.number(value, f.label, f.min ?? 0, f.max ?? 1e9);
      else if (f.type === "select")
        d[f.key] = c.choice(value, f.options, f.label);
      else if (f.type === "date") d[f.key] = c.date(value, f.label);
      else if (f.type === "master") {
        await c.master(tx, value, f.masterType, true);
        d[f.key] = value;
      } else if (f.type === "email") d[f.key] = rules.email(value, f.label, f.required);
      else if (f.type === "tel") d[f.key] = rules.phone(value, f.label, f.required);
      else d[f.key] = c.text(value, f.label, 8000, f.required);
    }
    const startDate = c.date(body.startDate, "Start date", true),
      endDate = c.date(body.endDate, "Due date", true);
    if (startDate && endDate && endDate < startDate)
      c.fail("Due date precedes start date");
    if (body.projectId) {
      const project = await tx.query("SELECT id FROM projects WHERE id=$1", [
        body.projectId,
      ]);
      if (!project.rowCount) c.fail("Invalid project");
      if (!c.can(user, "view_all")) {
        const permitted = await tx.query(
          "SELECT id FROM hrm_allocations WHERE employee_id=$1 AND project_id=$2 AND archived_at IS NULL",
          [e?.id, body.projectId],
        );
        if (!permitted.rowCount) c.fail("Project outside employee scope", 403);
      }
    }
    if (body.parentId) {
      const parent = (
        await tx.query(
          "SELECT * FROM hrm_records WHERE id=$1 AND archived_at IS NULL",
          [body.parentId],
        )
      ).rows[0];
      if (
        !parent ||
        (kind === "candidate" && parent.kind !== "job") ||
        (kind === "interview" && parent.kind !== "candidate")
      )
        c.fail("Invalid parent record");
      if (parent.employee_id) await c.employee(tx, user, parent.employee_id);
    }
    if (kind === "asset" && status === "Assigned" && !e)
      c.fail("Select the assigned employee");
    if (
      kind === "asset" &&
      old?.status === "Assigned" &&
      old.employeeId !== e?.id
    )
      c.fail("Record the asset return before reassignment");
    const values = {
      kind,
      employeeId: e?.id || null,
      projectId: body.projectId || null,
      parentId: body.parentId || null,
      title: c.text(body.title, "Title", 200, true),
      status,
      startDate,
      endDate,
      details: JSON.stringify(d),
    };
    const saved = old
      ? await c.update(tx, "hrm_records", id, {
          ...values,
          version: old.version + 1,
          updatedAt: new Date(),
        })
      : await c.insert(tx, "hrm_records", { ...values, createdBy: user.id });
    await c.audit(
      tx,
      user,
      kind,
      saved.id,
      old ? "updated" : "created",
      old,
      saved,
      e?.id || null,
      Boolean(config.sensitive),
    );
    return saved;
  }, db);
}
async function convertCandidate(user, id, body, db = null) {
  c.permit(user, "recruitment");
  return c.transaction(async (tx) => {
    const candidate = c.camel(
      (
        await tx.query(
          "SELECT * FROM hrm_records WHERE id=$1 AND kind='candidate' FOR UPDATE",
          [id],
        )
      ).rows[0],
    );
    if (!candidate) c.fail("Candidate not found", 404);
    if (!["Selected", "Offer"].includes(candidate.status))
      c.fail("Only selected/offered candidates can join", 409);
    const employee = await require("./employees").save(
      user,
      {
        ...body,
        fullName: candidate.title,
        companyEmail: body.companyEmail || null,
      },
      null,
      tx,
    );
    await c.update(tx, "hrm_records", id, {
      employeeId: employee.id,
      status: "Joined",
      updatedAt: new Date(),
      version: candidate.version + 1,
    });
    await c.audit(
      tx,
      user,
      "candidate",
      id,
      "joined",
      candidate,
      { employeeId: employee.id },
      employee.id,
    );
    return employee;
  }, db);
}
// Recruitment board: open jobs with candidate counts, and the candidates of one job (or the ones not
// tied to any job) with their latest interview. Read-only; stage changes go through moveCandidate.
async function recruitmentPipeline(user, q = {}, db = c.dbDefault) {
  c.permit(user, "recruitment");
  const includeClosed = q.includeClosed === "true";
  const jobs = (
    await db.query(
      `SELECT j.id,j.title,j.status,j.details,j.created_at,
              count(k.id)::int AS candidates,
              count(k.id) FILTER (WHERE k.status='Joined')::int AS joined
         FROM hrm_records j
         LEFT JOIN hrm_records k ON k.parent_id=j.id AND k.kind='candidate' AND k.archived_at IS NULL
        WHERE j.kind='job' AND j.archived_at IS NULL ${includeClosed ? "" : "AND j.status<>'Closed'"}
        GROUP BY j.id
        ORDER BY (j.status='Open') DESC,j.created_at DESC
        LIMIT 100`,
    )
  ).rows.map(c.camel);
  const unassigned = (
    await db.query(
      "SELECT count(*)::int AS n FROM hrm_records WHERE kind='candidate' AND archived_at IS NULL AND parent_id IS NULL",
    )
  ).rows[0].n;
  const requested = String(q.jobId || "");
  const selectedJobId =
    requested === "none"
      ? "none"
      : jobs.some((j) => j.id === requested)
        ? requested
        : jobs[0]?.id || (unassigned ? "none" : "");
  let candidates = [];
  if (selectedJobId) {
    const values = [];
    const scope = selectedJobId === "none" ? "k.parent_id IS NULL" : (values.push(selectedJobId), "k.parent_id=$1");
    candidates = (
      await db.query(
        `SELECT k.id,k.title,k.status,k.details,k.parent_id,k.version,k.created_at,k.updated_at,
                i.id AS interview_id,i.status AS interview_status,
                i.details->>'scheduledAt' AS interview_at,i.details->>'interviewer' AS interviewer
           FROM hrm_records k
           LEFT JOIN LATERAL (
             SELECT id,status,details FROM hrm_records i
              WHERE i.kind='interview' AND i.parent_id=k.id AND i.archived_at IS NULL
              ORDER BY i.created_at DESC LIMIT 1
           ) i ON true
          WHERE k.kind='candidate' AND k.archived_at IS NULL AND ${scope}
          ORDER BY k.updated_at DESC
          LIMIT 300`,
        values,
      )
    ).rows.map(c.camel);
  }
  return {
    stages: RECORDS.candidate.statuses,
    jobs,
    unassigned,
    selectedJobId,
    candidates,
    truncated: candidates.length >= 300,
  };
}
// Moves a candidate between stages without touching anything else on the record (a normal record
// update replaces the whole record). Joining happens only through the employee conversion.
async function moveCandidate(user, id, body, db = null) {
  c.permit(user, "recruitment");
  c.allow(body, ["status", "version"]);
  return c.transaction(async (tx) => {
    const old = c.camel(
      (
        await tx.query(
          "SELECT * FROM hrm_records WHERE id=$1 AND kind='candidate' AND archived_at IS NULL FOR UPDATE",
          [id],
        )
      ).rows[0],
    );
    if (!old) c.fail("Candidate not found", 404);
    c.optimistic(old, body);
    const status = c.choice(body.status, RECORDS.candidate.statuses, "Stage");
    if (old.status === "Joined") c.fail("A candidate who has joined cannot be moved", 409);
    if (status === "Joined") c.fail("Use Convert to employee to complete joining");
    if (status === old.status) return old;
    const saved = await c.update(tx, "hrm_records", id, {
      status,
      version: old.version + 1,
      updatedAt: new Date(),
    });
    await c.audit(tx, user, "candidate", id, "stage-moved", old, saved);
    return saved;
  }, db);
}
async function offboard(user, id, db = null) {
  c.permit(user, "manage_employees", "hr_approve");
  if (!c.can(user, "hr_approve")) c.fail("Final HR approval required", 403);
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, id, { lock: true });
    if (
      e.status !== "Notice Period" ||
      !e.exitDate ||
      e.exitDate > c.today(await c.policy(tx))
    )
      c.fail(
        "Employee must be on notice and have reached the last working date",
      );
    const pending = await tx.query(
      "SELECT id FROM hrm_records WHERE employee_id=$1 AND ((kind='offboarding' AND status<>'Done') OR (kind='asset' AND status='Assigned')) AND archived_at IS NULL",
      [id],
    );
    if (pending.rowCount)
      c.fail("Complete the exit checklist and asset returns first");
    const updated = await c.update(tx, "hrm_employees", id, {
      status: "Relieved",
      version: e.version + 1,
      updatedAt: new Date(),
    });
    const login = await access.syncLogin(tx, user, updated);
    await c.insert(tx, "hrm_employment_history", {
      employeeId: e.id,
      effectiveDate: e.exitDate,
      snapshot: JSON.stringify({ ...updated, profile: undefined }),
      reason: "Offboarding completed",
      createdBy: user.id,
    });
    await c.audit(
      tx,
      user,
      "employees",
      id,
      "relieved",
      { status: e.status },
      { status: "Relieved", accessRevoked: login.login === "blocked" },
      id,
    );
    return { relieved: true, accessRevoked: login.login === "blocked" };
  }, db);
}
async function letter(user, employeeId, templateId, db = c.dbDefault) {
  const e = await c.employee(db, user, employeeId);
  if (e.userId !== user.id) c.permit(user, "manage_employees");
  const template = await c.master(db, templateId, "letter_template", true);
  const content = String(template.payload.content || "");
  if (!content) c.fail("Letter template is empty");
  const company =
    (
      await db.query(
        "SELECT company FROM app_settings ORDER BY created_at LIMIT 1",
      )
    ).rows[0]?.company || {};
  const m = (
    await db.query(
      "SELECT id,name FROM master_items WHERE id=ANY($1::text[])",
      [[e.departmentId, e.designationId].filter(Boolean)],
    )
  ).rows;
  const data = {
    employee_name: e.fullName,
    employee_id: e.employeeNumber,
    designation: m.find((m) => m.id === e.designationId)?.name || "",
    department: m.find((m) => m.id === e.departmentId)?.name || "",
    joining_date: e.joiningDate,
    company_name: company.name || "",
    last_working_date: e.exitDate || "",
  };
  if (content.includes("{{salary}}")) {
    c.permit(user, "view_salary");
    data.salary =
      (
        await db.query(
          "SELECT monthly_cost,currency FROM hrm_salary_history WHERE employee_id=$1 AND effective_date<=$2 ORDER BY effective_date DESC LIMIT 1",
          [e.id, c.today(await c.policy(db))],
        )
      ).rows.map((s) => `${s.currency} ${s.monthly_cost}`)[0] || "";
  }
  const unknown = [...content.matchAll(/{{(\w+)}}/g)]
    .map((m) => m[1])
    .filter((k) => !(k in data));
  if (unknown.length)
    c.fail(`Unknown template placeholders: ${unknown.join(", ")}`);
  return {
    title: template.name,
    employeeId: e.id,
    content: content.replace(/{{(\w+)}}/g, (_, key) => data[key] || ""),
  };
}
async function uploadDocument(user, body, file, db = null) {
  c.permit(user, "self_service", "manage_employees");
  return c.transaction(async (tx) => {
    const e = await c.employee(tx, user, body.employeeId);
    if (e.userId !== user.id) c.permit(user, "manage_employees");
    if (!file?.buffer?.length || file.buffer.length > 10485760)
      c.fail("Upload a document up to 10 MB");
    const types = ["application/pdf", "image/jpeg", "image/png"];
    if (!types.includes(file.mimetype))
      c.fail("Only PDF, JPEG and PNG documents are supported");
    const b = file.buffer;
    const valid =
      file.mimetype === "application/pdf"
        ? b.subarray(0, 5).toString() === "%PDF-"
        : file.mimetype === "image/png"
          ? b
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : b[0] === 255 && b[1] === 216 && b[2] === 255;
    if (!valid) c.fail("File content does not match its type");
    const fileName = require("node:path")
      .basename(file.originalname)
      .replace(/[\r\n]/g, "");
    const extension = require("node:path").extname(fileName).toLowerCase();
    if (HRM_DOCUMENT_TYPES[extension] !== file.mimetype)
      c.fail("File extension does not match its type");
    const title = c.text(body.title, "Document title", 200, true);
    const category = c.text(body.category, "Document category", 100, true);
    const expiresOn = c.date(body.expiresOn, "Expiry date", true);
    // Stored through the active storage provider (local disk or Google Drive), all in one
    // folder per employee and named after the document and the person, e.g.
    // HRM/Employees/Mallika-Paik-EMP-12/aadhaar-card-mallika-paik.pdf. Later uploads reuse the
    // employee's first folder, so a renamed employee's documents stay together. Folders of the
    // older hrm/employees/... layout are not reused: new documents go to the current one.
    const existingFolder = (
      await tx.query(
        "SELECT folder_key FROM file_assets WHERE module_name='hrm' AND entity_id=$1 AND folder_key LIKE $2 ORDER BY created_at LIMIT 1",
        [e.id, `${EMPLOYEE_FOLDER_ROOT}/%`],
      )
    ).rows[0]?.folder_key;
    const stored = await saveUpload({
      buffer: b,
      originalName: fileName,
      moduleName: "hrm",
      entityId: e.id,
      types: HRM_DOCUMENT_TYPES,
      maxBytes: 10485760,
      dbClient: tx,
      folderPath: existingFolder || employeeFolder(e),
      fileBaseName: `${title} ${e.fullName}`,
    });
    let r;
    try {
      r = await c.insert(tx, "hrm_documents", {
        employeeId: e.id,
        title,
        category,
        fileName,
        mimeType: file.mimetype,
        sizeBytes: b.length,
        content: null,
        fileAssetId: stored.id,
        expiresOn,
        createdBy: user.id,
      });
    } catch (error) {
      await removeFile(stored);
      throw error;
    }
    delete r.content;
    await c.audit(
      tx,
      user,
      "documents",
      r.id,
      "uploaded",
      null,
      { title: r.title, category: r.category },
      e.id,
      true,
    );
    return r;
  }, db);
}
async function document(
  user,
  id,
  { verify = false, reject = null, remove = false } = {},
  db = null,
) {
  return c.transaction(async (tx) => {
    const meta = (
      await tx.query("SELECT employee_id FROM hrm_documents WHERE id=$1", [id])
    ).rows[0];
    if (!meta) c.fail("Document not found", 404);
    const e = await c.employee(tx, user, meta.employee_id);
    if (e.userId !== user.id) c.permit(user, "view_private");
    if (reject) {
      c.permit(user, "documents");
      c.allow(reject, ["comment"]);
      const r = await c.update(tx, "hrm_documents", id, {
        status: "Rejected",
        reviewComment: c.text(reject.comment, "Rejection reason", 500, true),
        verifiedBy: user.id,
      });
      delete r.content;
      await c.audit(tx, user, "documents", id, "rejected", null, { status: "Rejected", comment: r.reviewComment }, e.id, true);
      return r;
    }
    if (remove) {
      c.permit(user, "manage_employees", "documents");
      const r = c.camel(
        (
          await tx.query(
            "DELETE FROM hrm_documents WHERE id=$1 RETURNING id,title,category",
            [id],
          )
        ).rows[0],
      );
      // A deleted photo must not stay linked as the employee's picture.
      await tx.query(
        "UPDATE hrm_employees SET photo_document_id=NULL WHERE photo_document_id=$1",
        [id],
      );
      await c.audit(tx, user, "documents", id, "deleted", { title: r.title, category: r.category }, null, e.id, true);
      return { deleted: true };
    }
    if (verify) {
      c.permit(user, "documents");
      const r = await c.update(tx, "hrm_documents", id, {
        status: "Verified",
        reviewComment: null,
        verifiedBy: user.id,
      });
      delete r.content;
      await c.audit(
        tx,
        user,
        "documents",
        id,
        "verified",
        null,
        { status: "Verified" },
        e.id,
        true,
      );
      return r;
    }
    const r = c.camel(
      (await tx.query("SELECT * FROM hrm_documents WHERE id=$1", [id])).rows[0],
    );
    if (!r.content && r.fileAssetId) {
      const asset = await fileAssetModel.findById(r.fileAssetId, tx);
      r.content = asset ? await readFileBuffer(asset) : null;
      if (!r.content) c.fail("Document file could not be read from storage", 502);
    }
    await c.audit(
      tx,
      user,
      "documents",
      id,
      "downloaded",
      null,
      { title: r.title },
      e.id,
      true,
    );
    return r;
  }, db);
}
module.exports = {
  record,
  recruitmentPipeline,
  moveCandidate,
  convertCandidate,
  offboard,
  letter,
  uploadDocument,
  document,
};
