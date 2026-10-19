const c = require("./core");
const fileAssetModel = require("../../models/fileAsset.model");
const { readFileBuffer, removeFile, saveUpload } = require("../file.service");
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
    if (old?.employeeId) await c.employee(tx, user, old.employeeId);
    const own = e?.userId === user.id;
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
      } else {
        d[f.key] = c.text(value, f.label, 8000, f.required);
        if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          c.fail("Invalid email");
      }
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
    if (e.userId)
      await tx.query(
        "UPDATE users SET is_active=false,updated_at=now() WHERE id=$1",
        [e.userId],
      );
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
      { status: "Relieved", accessRevoked: Boolean(e.userId) },
      id,
    );
    return { relieved: true, accessRevoked: Boolean(e.userId) };
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
    // Stored through the active storage provider (local disk or Google Drive).
    const stored = await saveUpload({
      buffer: b,
      originalName: fileName,
      moduleName: "hrm",
      entityId: e.id,
      types: HRM_DOCUMENT_TYPES,
      maxBytes: 10485760,
      dbClient: tx,
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
async function document(user, id, { verify = false } = {}, db = null) {
  return c.transaction(async (tx) => {
    const meta = (
      await tx.query("SELECT employee_id FROM hrm_documents WHERE id=$1", [id])
    ).rows[0];
    if (!meta) c.fail("Document not found", 404);
    const e = await c.employee(tx, user, meta.employee_id);
    if (e.userId !== user.id) c.permit(user, "view_private");
    if (verify) {
      c.permit(user, "documents");
      const r = await c.update(tx, "hrm_documents", id, {
        status: "Verified",
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
  convertCandidate,
  offboard,
  letter,
  uploadDocument,
  document,
};
