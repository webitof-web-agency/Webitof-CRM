import { useEffect, useState } from "react";
import { hrm } from "./hrmApi";

// Fixed lists (static): these never change per company.
export const GENDERS = ["Male", "Female", "Other"];
export const RELATIONSHIPS = [
  "Spouse",
  "Parent",
  "Sibling",
  "Child",
  "Friend",
  "Relative",
  "Other",
];
export const EMPLOYEE_STATUSES = [
  "Upcoming Joining",
  "Active",
  "Probation",
  "Confirmed",
  "Notice Period",
  "Suspended",
  "Relieved",
  "Terminated",
  "Inactive",
  "Draft",
];
export const WORK_MODES = ["Office", "Remote", "Hybrid"];
export const PHOTO_CATEGORY = "Profile Photo";

// Two-sided ID cards (Aadhaar by default) are uploaded as separate Front and Back files.
// The document type's "frontBack" setting decides; without it, an Aadhaar type is two-sided.
export function documentSides(type) {
  const flag = type?.payload?.frontBack;
  const twoSided = flag == null ? /aadhaa?r/i.test(type?.name || "") : Boolean(flag);
  return twoSided ? ["Front", "Back"] : null;
}

// Readable profile link: /app/hrm/employees/mallika-paik-EMP-12 (the server resolves the
// trailing employee number). Falls back to the id when the number is not known yet.
export function employeeRef(e) {
  if (!e?.employeeNumber) return e?.id || "";
  const name = String(e.fullName || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return name ? `${name}-${e.employeeNumber}` : e.employeeNumber;
}

export const employeePath = (e, suffix = "") => `/app/hrm/employees/${employeeRef(e)}${suffix}`;

// Turns a profile URL segment (readable ref or id) into the employee id.
export function useEmployeeId(token, ref) {
  const isId = /^hrm_[a-z0-9]+$/i.test(ref || "");
  const [state, setState] = useState(() => ({ ref, id: isId ? ref : "", error: "" }));
  useEffect(() => {
    if (!ref || isId) {
      setState({ ref, id: ref || "", error: "" });
      return undefined;
    }
    let active = true;
    setState({ ref, id: "", error: "" });
    hrm(token, `/employees/resolve/${encodeURIComponent(ref)}`)
      .then((r) => active && setState({ ref, id: r.id, error: "" }))
      .catch((e) => active && setState({ ref, id: "", error: e.message || "Employee not found" }));
    return () => {
      active = false;
    };
  }, [token, ref, isId]);
  return state.ref === ref ? state : { ref, id: isId ? ref : "", error: "" };
}

// Company-managed lists (dynamic) come from HRM masters, edited under Policies & organization.
export function masterLists(masters) {
  const of = (type) =>
    masters
      .filter((m) => m.type === `hrm_${type}` && m.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
  return {
    branches: of("location"),
    departments: of("department"),
    designations: of("designation"),
    employmentTypes: of("employment_type"),
    teams: of("team"),
    shifts: of("shift"),
    attendancePolicies: of("attendance_policy"),
    documentTypes: of("document_type").filter((m) => !m.payload?.system),
    letters: of("letter_template"),
    name: (id) => masters.find((m) => m.id === id)?.name || "",
    find: (id) => masters.find((m) => m.id === id) || null,
  };
}

// Departments may belong to a branch and designations to a department; unlinked ones apply everywhere.
export const departmentsFor = (lists, branchId) =>
  lists.departments.filter(
    (d) => !d.payload?.branchId || d.payload.branchId === branchId,
  );
export const designationsFor = (lists, departmentId) =>
  lists.designations.filter(
    (d) => !d.payload?.departmentId || d.payload.departmentId === departmentId,
  );

// Hourly cost from a monthly salary: 52 weeks / 12 months.
export function hourlyRate(monthly, hoursPerDay, daysPerWeek) {
  const m = Number(monthly),
    h = Number(hoursPerDay),
    d = Number(daysPerWeek);
  if (!(m > 0 && h > 0 && d > 0)) return null;
  return (m * 12) / (52 * d * h);
}

export const money = (value) =>
  value == null || value === ""
    ? "-"
    : `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Documents are served with the Bearer header only, so images become object URLs.
export async function documentBlob(token, id) {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL || "/api"}/hrm/documents/${id}/download`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Could not open the document");
  }
  return response.blob();
}

export function useDocumentImage(token, id) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!id) {
      setUrl("");
      return undefined;
    }
    let active = true,
      objectUrl = "";
    documentBlob(token, id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => active && setUrl(""));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, id]);
  return url;
}

export async function openDocument(token, doc) {
  const blob = await documentBlob(token, doc.id);
  const url = URL.createObjectURL(new Blob([blob], { type: doc.mimeType }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Certificates are generated from letter templates; Word gets a simple .doc (HTML) file.
export async function downloadLetter(token, employeeId, template, format) {
  const letter = await hrm(
    token,
    `/employees/${employeeId}/letter?templateId=${encodeURIComponent(template.id)}`,
  );
  const fileBase = `${letter.title}`.replace(/[^\w\- ]+/g, "").trim() || "letter";
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFontSize(11);
    let y = 22;
    for (const paragraph of String(letter.content).split("\n")) {
      for (const line of paragraph ? pdf.splitTextToSize(paragraph, 175) : [""]) {
        if (y > 280) {
          pdf.addPage();
          y = 22;
        }
        pdf.text(line, 18, y);
        y += 6;
      }
    }
    pdf.save(`${fileBase}.pdf`);
    return;
  }
  const escape = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<html><head><meta charset="utf-8"><title>${escape(letter.title)}</title></head><body style="font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.5">${String(
    letter.content,
  )
    .split("\n")
    .map((p) => `<p>${escape(p) || "&nbsp;"}</p>`)
    .join("")}</body></html>`;
  const url = URL.createObjectURL(
    new Blob(["﻿", html], { type: "application/msword" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase}.doc`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
