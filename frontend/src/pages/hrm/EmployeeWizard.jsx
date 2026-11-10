import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { confirmAction } from '../../lib/confirm';
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Eye, Plus, Trash2, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { Field, Status } from "./HrmShared";
import { INDIA_STATE_NAMES, getCitiesByState } from "../../data/indiaLocations";
import { clean, valid, latestBirthDate } from "../../lib/fieldRules";
import { hrm, localDay } from "./hrmApi";
import {
  EMPLOYEE_STATUSES,
  GENDERS,
  PHOTO_CATEGORY,
  RELATIONSHIPS,
  WORK_MODES,
  departmentsFor,
  designationsFor,
  documentSides,
  hourlyRate,
  masterLists,
  money,
  openDocument,
  useDocumentImage,
} from "./employeeShared";

const OTHER_CITY = "__other__";
// Every employee address is in India; the field is shown read-only and always saved as India.
const COUNTRY = "India";
const EMPTY_PROFILE = {
  dob: "",
  gender: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: COUNTRY,
  postalCode: "",
  emergencyName: "",
  emergencyRelationship: "",
  emergencyPhone: "",
};
const EMPTY_FINANCIAL = {
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  ifsc: "",
  bankBranch: "",
  pan: "",
  uan: "",
  hoursPerDay: "",
  daysPerWeek: "",
};
const PHOTO_MAX = 2 * 1024 * 1024;
const DOC_MAX = 5 * 1024 * 1024;
const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"];
let rowKey = 0;
const ErrorsContext = createContext({});

function FieldError({ name }) {
  const message = useContext(ErrorsContext)[name];
  return message ? (
    <p className="mt-1 text-xs font-medium text-rose-600" role="alert">
      {message}
    </p>
  ) : null;
}

// A form field with its validation message underneath (module level so inputs keep focus).
function F({ k, error = k, ...props }) {
  return (
    <div>
      <Field name={k} {...props} />
      <FieldError name={error} />
    </div>
  );
}
// `back` is used only for two-sided documents (Aadhaar): `file` is then the front side.
const newRow = (typeId = "") => ({ key: ++rowKey, typeId, file: null, back: null, expiresOn: "" });

// Create / edit an employee in five steps. Fixed lists (gender, status, relationship) are in
// code; branch, department, designation, employment type, shift, attendance policy and
// document types come from HRM masters.
export function EmployeeWizard({ token, metadata, masters, can, employeeId, candidateId = "", candidate = null, onDone, onCancel }) {
  const editing = Boolean(employeeId);
  // Joining a candidate: same form, but it saves through the candidate conversion endpoint so the
  // candidate record is marked Joined and linked to the new employee.
  const converting = !editing && Boolean(candidateId);
  const lists = useMemo(() => masterLists(masters), [masters]);
  const canPrivate = can("manage_private");
  const canSalary = can("manage_salary");
  const steps = [
    "Personal",
    "Employment",
    ...(canPrivate ? ["Contact"] : []),
    ...(canSalary ? ["Banking"] : []),
    "Documents",
  ];
  const [step, setStep] = useState(0);
  // Steps confirmed with Next (shown with a tick). Tabs move freely between steps; the full
  // form is still validated on save, which jumps to the first step that needs fixing.
  const [done, setDone] = useState(() => new Set());
  const [customCity, setCustomCity] = useState(false);
  const [loaded, setLoaded] = useState(!editing);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [original, setOriginal] = useState(null);
  const [form, setForm] = useState({
    fullName: candidate?.title || "",
    companyEmail: candidate?.details?.email || "",
    phone: candidate?.details?.phone || "",
    employeeCode: "",
    password: "",
    userId: "",
    locationId: "",
    departmentId: "",
    designationId: "",
    joiningDate: localDay(metadata.policy.timezone),
    employmentTypeId: "",
    status: "Active",
    shiftId: "",
    attendancePolicyId: lists.attendancePolicies[0]?.id || "",
    managerId: "",
    workMode: "Office",
    teamId: "",
    probationEnd: "",
    contractEnd: "",
    exitDate: "",
  });
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [financial, setFinancial] = useState(EMPTY_FINANCIAL);
  const [salary, setSalary] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [documents, setDocuments] = useState([]);
  const [rows, setRows] = useState(() =>
    editing
      ? []
      : lists.documentTypes.filter((t) => t.payload?.defaultOnCreate).map((t) => newRow(t.id)),
  );
  const [managers, setManagers] = useState([]);
  const [users, setUsers] = useState([]);
  const existingPhoto = useDocumentImage(token, original?.photoDocumentId);

  useEffect(() => {
    hrm(token, "/lookups?type=employees")
      .then((r) => setManagers((r.rows || []).filter((e) => e.id !== employeeId)))
      .catch(() => setManagers([]));
    // Logins not yet linked to any employee; also offered when editing an employee without one.
    hrm(token, "/lookups?type=users")
      .then((r) => setUsers(r.rows || []))
      .catch(() => setUsers([]));
  }, [token, employeeId]);

  useEffect(() => {
    if (!editing) return undefined;
    let active = true;
    Promise.all([
      hrm(token, `/employees/${employeeId}`),
      can("view_private") ? hrm(token, `/employees/${employeeId}/private`).catch(() => null) : null,
      can("view_salary")
        ? hrm(token, `/resources/salary-history?employeeId=${employeeId}&limit=50`).catch(() => null)
        : null,
      hrm(token, `/resources/documents?employeeId=${employeeId}&limit=100`).catch(() => null),
    ])
      .then(([employee, priv, salaries, docs]) => {
        if (!active) return;
        setOriginal(employee);
        setForm((f) => ({
          ...f,
          ...Object.fromEntries(Object.keys(f).map((k) => [k, employee[k] ?? f[k] ?? ""])),
          password: "",
          userId: employee.userId || "",
        }));
        const savedProfile = { ...EMPTY_PROFILE, ...(priv?.profile || employee.profile || {}) };
        setProfile({ ...savedProfile, country: COUNTRY });
        setFinancial({ ...EMPTY_FINANCIAL, ...(priv?.financial || {}) });
        const latest = (salaries?.rows || []).sort((a, b) =>
          String(b.effectiveDate).localeCompare(String(a.effectiveDate)),
        )[0];
        setSalary(latest ? String(Number(latest.monthlyCost)) : "");
        setDocuments((docs?.rows || []).filter((d) => d.category !== PHOTO_CATEGORY));
        setLoaded(true);
      })
      .catch((e) => active && setLoadError(e.message));
    return () => {
      active = false;
    };
  }, [token, employeeId, editing, can]);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  // Hours default from the chosen attendance policy until HR types their own.
  const policy = lists.find(form.attendancePolicyId);
  const hoursPerDay = financial.hoursPerDay || policy?.payload?.hoursPerDay || "";
  const daysPerWeek = financial.daysPerWeek || policy?.payload?.daysPerWeek || "";
  const rate = hourlyRate(salary, hoursPerDay, daysPerWeek);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const setP = (key) => (value) => setProfile((p) => ({ ...p, [key]: value }));
  const setF = (key) => (value) => setFinancial((p) => ({ ...p, [key]: value }));
  const departments = departmentsFor(lists, form.locationId);
  const designations = designationsFor(lists, form.departmentId);
  const branchFirst = lists.branches.length > 0 && !form.locationId;
  const departmentFirst = lists.departments.length > 0 && !form.departmentId;
  const options = (items) => items.map((m) => ({ value: m.id, label: m.name }));
  const hasLogin = Boolean(original?.userId || form.userId);
  // Addresses are Indian (country is fixed): the state comes from a list and a state saved
  // earlier in another spelling stays selectable instead of being dropped.
  const stateOptions = [
    ...INDIA_STATE_NAMES,
    ...(profile.state && !INDIA_STATE_NAMES.includes(profile.state) ? [profile.state] : []),
  ];
  const pickState = (state) => {
    setCustomCity(false);
    setProfile((p) => ({
      ...p,
      state,
      city: !p.city || getCitiesByState(state).includes(p.city) ? p.city : "",
    }));
  };
  // City is a list of the state's cities with an "Other" choice that opens a text box. A city
  // saved earlier that is not in the list opens in the text box so it is not lost.
  const profileCities = getCitiesByState(profile.state);
  const cityAsText =
    customCity ||
    (Boolean(profile.state) && profileCities.length === 0) ||
    (Boolean(profile.city) && !profileCities.includes(profile.city));
  const pickCity = (value) => {
    if (value === OTHER_CITY) {
      setCustomCity(true);
      setP("city")("");
    } else setP("city")(value);
  };
  // Linking a login fills the blanks from it, so the employee email matches the login email.
  const linkLogin = (userId) => {
    const picked = users.find((u) => u.id === userId);
    setForm((f) => ({
      ...f,
      userId,
      ...(picked && !f.fullName.trim() ? { fullName: clean.name(picked.name) } : {}),
      ...(picked && !f.companyEmail.trim() ? { companyEmail: clean.email(picked.email) } : {}),
      ...(picked && !f.phone.trim() && picked.phone ? { phone: clean.phone(picked.phone) } : {}),
    }));
  };

  function validate(name) {
    const e = {};
    const need = (key, value, title) => {
      if (!String(value ?? "").trim()) e[key] = `${title} is required`;
    };
    if (name === "Personal") {
      need("fullName", form.fullName, "Full name");
      if (form.fullName.trim() && !valid.name(form.fullName)) e.fullName = "Use letters, spaces and . ' - only";
      if (!valid.email(form.companyEmail)) e.companyEmail = "Enter a valid email";
      if (!valid.phone(form.phone)) e.phone = "Enter 10 to 15 digits";
      if (canPrivate) {
        need("dob", profile.dob, "Date of birth");
        if (profile.dob && profile.dob > latestBirthDate(localDay())) e.dob = "Must be at least 14 years old";
        need("gender", profile.gender, "Gender");
      }
      if (form.password && form.password.length < 8) e.password = "At least 8 characters";
      if (photo && photo.size > PHOTO_MAX) e.photo = "Photo must be 2 MB or smaller";
    }
    if (name === "Employment") {
      if (lists.branches.length) need("locationId", form.locationId, "Branch");
      if (lists.departments.length) need("departmentId", form.departmentId, "Department");
      if (lists.designations.length) need("designationId", form.designationId, "Designation");
      need("joiningDate", form.joiningDate, "Date of joining");
      if (lists.employmentTypes.length) need("employmentTypeId", form.employmentTypeId, "Employment type");
      need("status", form.status, "Employee status");
    }
    if (name === "Contact") {
      need("addressLine1", profile.addressLine1, "Address line 1");
      need("city", profile.city, "City");
      need("state", profile.state, "State");
      need("postalCode", profile.postalCode, "PIN code");
      if (profile.postalCode && !valid.pin(profile.postalCode)) e.postalCode = "PIN code must be 6 digits";
      need("emergencyName", profile.emergencyName, "Emergency contact name");
      if (profile.emergencyName.trim() && !valid.name(profile.emergencyName))
        e.emergencyName = "Use letters, spaces and . ' - only";
      need("emergencyRelationship", profile.emergencyRelationship, "Relationship");
      if (!valid.phone(profile.emergencyPhone)) e.emergencyPhone = "Enter 10 to 15 digits";
    }
    if (name === "Banking") {
      if (financial.ifsc && !valid.ifsc(financial.ifsc)) e.ifsc = "IFSC looks like HDFC0001234";
      if (financial.pan && !valid.pan(financial.pan)) e.pan = "PAN looks like ABCDE1234F";
      if (financial.accountNumber && !valid.accountNumber(financial.accountNumber))
        e.accountNumber = "Account number is 9–18 digits";
      if (financial.uan && !valid.uan(financial.uan)) e.uan = "UAN is 12 digits";
      if (financial.accountHolderName?.trim() && !valid.name(financial.accountHolderName))
        e.accountHolderName = "Use letters, spaces and . ' - only";
      if (salary !== "" && !(Number(salary) >= 0)) e.salary = "Enter a valid amount";
      if (hoursPerDay !== "" && !(Number(hoursPerDay) >= 1 && Number(hoursPerDay) <= 24))
        e.hoursPerDay = "1 to 24";
      if (daysPerWeek !== "" && !(Number(daysPerWeek) >= 1 && Number(daysPerWeek) <= 7))
        e.daysPerWeek = "1 to 7";
    }
    if (name === "Documents") {
      const checkFile = (file, key, what) => {
        if (!file) e[key] = `Choose the ${what} or remove this row`;
        else if (file.size > DOC_MAX) e[key] = "File must be 5 MB or smaller";
        else if (!DOC_TYPES.includes(file.type)) e[key] = "Only PDF, JPG or PNG";
      };
      rows.forEach((r) => {
        if (!r.typeId) e[`doc-type-${r.key}`] = "Choose a document type";
        if (documentSides(lists.find(r.typeId))) {
          checkFile(r.file, `doc-file-${r.key}`, "front side");
          checkFile(r.back, `doc-back-${r.key}`, "back side");
        } else checkFile(r.file, `doc-file-${r.key}`, "file");
      });
    }
    setErrors(e);
    if (Object.keys(e).length) toast.error("Please fix the highlighted fields");
    return Object.keys(e).length === 0;
  }

  function goToStep(i) {
    setErrors({});
    setStep(i);
  }

  function nextStep() {
    if (!validate(current)) return;
    setDone((d) => new Set(d).add(current));
    setStep(step + 1);
  }

  async function upload(file, employee, title, category, expiresOn = "") {
    const data = new FormData();
    data.append("employeeId", employee);
    data.append("title", title);
    data.append("category", category);
    if (expiresOn) data.append("expiresOn", expiresOn);
    data.append("file", file);
    return hrm(token, "/documents", { method: "POST", formData: data });
  }

  async function submit() {
    for (let i = 0; i < steps.length; i += 1)
      if (!validate(steps[i])) {
        setDone(new Set(steps.slice(0, i)));
        setStep(i);
        return;
      }
    setBusy(true);
    const today = localDay(metadata.policy.timezone);
    const failures = [];
    try {
      const body = {
        fullName: form.fullName.trim(),
        companyEmail: form.companyEmail.trim(),
        phone: form.phone.trim(),
        employeeCode: form.employeeCode.trim(),
        locationId: form.locationId,
        departmentId: form.departmentId,
        designationId: form.designationId,
        joiningDate: form.joiningDate,
        employmentTypeId: form.employmentTypeId,
        status: form.status,
        shiftId: form.shiftId,
        attendancePolicyId: form.attendancePolicyId,
        managerId: form.managerId,
        workMode: form.workMode,
        teamId: form.teamId || null,
        probationEnd: form.probationEnd || null,
        contractEnd: form.contractEnd || null,
        exitDate: form.exitDate || null,
        ...(form.userId && !original?.userId ? { userId: form.userId } : {}),
        ...(canPrivate ? { profile } : {}),
        ...(canSalary
          ? {
              financial: {
                ...financial,
                ifsc: financial.ifsc.toUpperCase(),
                pan: financial.pan.toUpperCase(),
                hoursPerDay: hoursPerDay === "" ? "" : Number(hoursPerDay),
                daysPerWeek: daysPerWeek === "" ? "" : Number(daysPerWeek),
              },
              ...(salary !== "" ? { salary: { monthlyCost: Number(salary) } } : {}),
            }
          : {}),
        ...(form.password && !hasLogin
          ? { login: { email: form.companyEmail.trim(), password: form.password } }
          : {}),
      };
      let saved;
      if (editing) {
        let photoDocumentId = original.photoDocumentId || "";
        if (photo) {
          try {
            photoDocumentId = (await upload(photo, employeeId, PHOTO_CATEGORY, PHOTO_CATEGORY)).id;
          } catch (e) {
            failures.push(`Photo: ${e.message}`);
          }
        }
        saved = await hrm(token, `/employees/${employeeId}`, {
          method: "PUT",
          body: {
            ...body,
            photoDocumentId,
            version: original.version,
            effectiveDate: today,
            reason: "Updated from the employee form",
          },
        });
        if (photo && original.photoDocumentId && photoDocumentId !== original.photoDocumentId)
          hrm(token, `/documents/${original.photoDocumentId}`, { method: "DELETE" }).catch(() => {});
      } else {
        saved = await hrm(token, converting ? `/candidates/${encodeURIComponent(candidateId)}/convert` : "/employees", {
          method: "POST",
          body,
        });
        if (photo) {
          try {
            const doc = await upload(photo, saved.id, PHOTO_CATEGORY, PHOTO_CATEGORY);
            saved = await hrm(token, `/employees/${saved.id}`, {
              method: "PUT",
              body: {
                photoDocumentId: doc.id,
                version: saved.version,
                effectiveDate: today,
                reason: "Profile photo added",
              },
            });
          } catch (e) {
            failures.push(`Photo: ${e.message}`);
          }
        }
      }
      for (const r of rows) {
        const type = lists.find(r.typeId);
        const name = type?.name || "Document";
        // Two-sided documents become two files: "Aadhaar Card Front" and "Aadhaar Card Back".
        const parts = documentSides(type)
          ? [[r.file, `${name} Front`], [r.back, `${name} Back`]]
          : [[r.file, name]];
        for (const [file, title] of parts) {
          try {
            await upload(file, saved.id, title, name, r.expiresOn);
          } catch (e) {
            failures.push(`${title}: ${e.message}`);
          }
        }
      }
      if (failures.length)
        toast.warning(`Employee saved, but some files were not uploaded: ${failures.join("; ")}`, {
          duration: 10000,
        });
      else toast.success(editing ? "Employee updated" : converting ? "Candidate joined as an employee" : "Employee created");
      // The password is optional, so say plainly when the person still cannot sign in.
      if (!saved.userId)
        toast.warning("No login was created, so this employee cannot sign in yet. Edit the employee and set a password.", {
          duration: 10000,
        });
      onDone(saved);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const err = (key) => <FieldError name={key} />;
  const masterEmpty = (items, what) =>
    items.length === 0 ? (
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        No {what} yet.{" "}
        {can("manage_settings") && (
          <Link className="text-[var(--primary)] underline" to="/app/hrm/settings">
            Add in Policies & organization
          </Link>
        )}
      </p>
    ) : null;

  if (loadError)
    return (
      <Card className="p-6">
        <p role="alert" className="text-rose-600">
          {loadError}
        </p>
      </Card>
    );
  if (!loaded) return <Card className="h-60 animate-pulse" />;

  const current = steps[step];
  const photoSrc = photoPreview || existingPhoto;

  return (
    <ErrorsContext.Provider value={errors}>
    <div className="space-y-5">
      <PageHeader
        eyebrow="Employees"
        title={editing ? `Edit ${original?.fullName || "employee"}` : converting ? "Employee from candidate" : "Create Employee"}
        description={editing ? "Update the employee's details." : "Add a new employee to your organization."}
      >
        <Button variant="secondary" onClick={onCancel}>
          <ArrowLeft size={16} /> Back
        </Button>
      </PageHeader>

      <Card className="p-5 sm:p-6">
        <ol className="mb-6 flex items-center gap-2 overflow-x-auto pb-1" aria-label="Steps">
          {steps.map((name, i) => (
            <li key={name} className="flex min-w-fit flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => goToStep(i)}
                className="flex items-center gap-2"
                aria-current={i === step ? "step" : undefined}
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full border-2 text-sm font-semibold ${
                    i !== step && done.has(name)
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : i === step
                        ? "border-emerald-500 text-emerald-600"
                        : "border-[var(--border)] text-[var(--text-muted)]"
                  }`}
                >
                  {i !== step && done.has(name) ? <Check size={16} /> : i + 1}
                </span>
                <span
                  className={`text-sm font-medium ${i === step ? "text-emerald-600" : done.has(name) ? "text-[var(--text-main)]" : "text-[var(--text-muted)]"}`}
                >
                  {name}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span className={`h-px min-w-6 flex-1 ${done.has(name) ? "bg-emerald-500" : "bg-[var(--border)]"}`} />
              )}
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <h2 className="border-b border-[var(--border)] px-5 py-4 text-lg font-bold">
            {
              {
                Personal: "Basic Information",
                Employment: "Employment Details",
                Contact: "Contact Information",
                Banking: "Banking & Salary",
                Documents: "Documents",
              }[current]
            }
          </h2>
          <div className="space-y-4 p-5">
            {current === "Personal" && (
              // Three per row on wide screens: identity, personal details, login, then the photo.
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <F
                  k="fullName"
                  title="Full Name"
                  value={form.fullName}
                  onChange={(v) => set("fullName")(clean.name(v))}
                  required
                  disabled={converting && Boolean(candidate?.title)}
                />
                <F k="companyEmail" title="Email" type="email" value={form.companyEmail} onChange={set("companyEmail")} required />
                <F k="phone" title="Phone Number" type="tel" value={form.phone} onChange={set("phone")} required />
                {canPrivate && (
                  <F k="dob" title="Date of Birth" type="date" value={profile.dob} onChange={setP("dob")} required max={latestBirthDate(localDay())} />
                )}
                {canPrivate && (
                  <fieldset>
                    <legend className="mb-1.5 text-xs font-semibold">Gender *</legend>
                    <div className="flex flex-wrap gap-4 py-2.5">
                      {GENDERS.map((g) => (
                        <label key={g} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="gender"
                            className="h-4 w-4 accent-emerald-600"
                            checked={profile.gender === g}
                            onChange={() => setP("gender")(g)}
                          />
                          {g}
                        </label>
                      ))}
                    </div>
                    {err("gender")}
                  </fieldset>
                )}
                <div>
                  <F k="employeeCode" title="Employee Code" value={form.employeeCode} onChange={(v) => set("employeeCode")(clean.employeeCode(v))} maxLength={40} />
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Optional: staff or biometric device number.</p>
                </div>
                {original?.userId ? (
                  <div>
                    <span className="mb-1.5 block text-xs font-semibold">Login</span>
                    <p className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--text-muted)]">
                      This employee already has an ERP login. Change the password from Users.
                    </p>
                  </div>
                ) : hasLogin ? (
                  <div>
                    <span className="mb-1.5 block text-xs font-semibold">Login</span>
                    <p className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--text-muted)]">
                      The selected ERP login will be linked. Its roles stay as they are; HRM self service is
                      added if they do not include it.
                    </p>
                  </div>
                ) : (
                  <div>
                    <F
                      k="password"
                      title="Password"
                      type="password"
                      value={form.password}
                      onChange={set("password")}
                    />
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Creates a login (web and Employee app) with the email above. Leave blank to skip.
                    </p>
                  </div>
                )}
                {!original?.userId && !form.password && users.length > 0 && (
                  <Field
                    name="userId"
                    title="Or link an existing ERP login"
                    type="select"
                    options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                    value={form.userId}
                    onChange={linkLogin}
                    searchable
                  />
                )}
                <Field
                  name="employeeNumber"
                  title="Employee ID"
                  value={original?.employeeNumber || "Auto-generated on save"}
                  disabled
                  onChange={() => {}}
                />
                <div className="md:col-span-2 lg:col-span-3">
                  <span className="mb-1.5 block text-xs font-semibold">Profile Image</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
                      {photoSrc ? (
                        <img src={photoSrc} alt="Profile preview" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-[var(--text-muted)]">No image</span>
                      )}
                    </div>
                    <div className="min-w-60 flex-1 lg:max-w-md">
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        aria-label="Profile image"
                        className="block w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                        onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                      />
                      <p className="mt-1 text-xs text-[var(--text-muted)]">JPG or PNG, max 2 MB.</p>
                      {err("photo")}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {current === "Employment" && (
              // Three per row on wide screens: organisation, employment terms, schedule, reporting, dates.
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <F
                    k="locationId"
                    title="Branch"
                    type="select"
                    options={options(lists.branches)}
                    value={form.locationId}
                    onChange={(v) => setForm((f) => ({ ...f, locationId: v, departmentId: "", designationId: "" }))}
                    required={lists.branches.length > 0}
                  />
                  {masterEmpty(lists.branches, "branches")}
                </div>
                <div>
                  <F
                    k="departmentId"
                    title={branchFirst ? "Department (select branch first)" : "Department"}
                    type="select"
                    options={options(departments)}
                    value={form.departmentId}
                    disabled={branchFirst}
                    onChange={(v) => setForm((f) => ({ ...f, departmentId: v, designationId: "" }))}
                    required={lists.departments.length > 0}
                  />
                  {masterEmpty(lists.departments, "departments")}
                </div>
                <div>
                  <F
                    k="designationId"
                    title={departmentFirst ? "Designation (select department first)" : "Designation"}
                    type="select"
                    options={options(designations)}
                    value={form.designationId}
                    disabled={departmentFirst}
                    onChange={set("designationId")}
                    searchable
                    required={lists.designations.length > 0}
                  />
                  {masterEmpty(lists.designations, "designations")}
                </div>
                <div>
                  <F
                    k="employmentTypeId"
                    title="Employment Type"
                    type="select"
                    options={options(lists.employmentTypes)}
                    value={form.employmentTypeId}
                    onChange={set("employmentTypeId")}
                    required={lists.employmentTypes.length > 0}
                  />
                  {masterEmpty(lists.employmentTypes, "employment types")}
                </div>
                <F
                  k="status"
                  title="Employee Status"
                  type="select"
                  options={EMPLOYEE_STATUSES}
                  value={form.status}
                  onChange={set("status")}
                  required
                />
                <F k="joiningDate" title="Date of Joining" type="date" value={form.joiningDate} onChange={set("joiningDate")} required />
                <F k="shiftId" title="Shift" type="select" options={options(lists.shifts)} value={form.shiftId} onChange={set("shiftId")} />
                <F
                  k="attendancePolicyId"
                  title="Attendance Policy"
                  type="select"
                  options={options(lists.attendancePolicies)}
                  value={form.attendancePolicyId}
                  onChange={set("attendancePolicyId")}
                />
                <F k="workMode" title="Work Mode" type="select" options={WORK_MODES} value={form.workMode} onChange={set("workMode")} />
                <F
                  k="managerId"
                  title="Reporting Manager"
                  type="select"
                  options={managers.map((m) => ({ value: m.id, label: `${m.fullName} (${m.employeeNumber})` }))}
                  value={form.managerId}
                  onChange={set("managerId")}
                  searchable
                />
                {lists.teams.length > 0 && (
                  <F k="teamId" title="Team" type="select" options={options(lists.teams)} value={form.teamId} onChange={set("teamId")} />
                )}
                <F k="probationEnd" title="Probation Ends" type="date" value={form.probationEnd} onChange={set("probationEnd")} />
                <F k="contractEnd" title="Contract Ends" type="date" value={form.contractEnd} onChange={set("contractEnd")} />
                {editing && (
                  <F
                    k="exitDate"
                    title="Last Working Day"
                    type="date"
                    value={form.exitDate}
                    onChange={set("exitDate")}
                    min={form.joiningDate}
                  />
                )}
              </div>
            )}

            {current === "Contact" && (
              <>
                {/* Location first (country → state → city → PIN), then the street address. */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <F k="country" title="Country" value={COUNTRY} onChange={() => {}} disabled required />
                  <F
                    k="state"
                    title="State"
                    type="select"
                    options={stateOptions}
                    value={profile.state}
                    onChange={pickState}
                    searchable
                    required
                  />
                  {cityAsText ? (
                    <div>
                      <F k="city" title="City" value={profile.city} onChange={setP("city")} required />
                      {profileCities.length > 0 && (
                        <button
                          type="button"
                          className="mt-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                          onClick={() => {
                            setCustomCity(false);
                            setP("city")("");
                          }}
                        >
                          Pick from list
                        </button>
                      )}
                    </div>
                  ) : (
                    <F
                      k="city"
                      title="City"
                      type="select"
                      options={[...profileCities, { value: OTHER_CITY, label: "Other (type the city)" }]}
                      value={profile.city}
                      onChange={pickCity}
                      searchable
                      disabled={!profile.state}
                      help={profile.state ? undefined : "Select the state first."}
                      required
                    />
                  )}
                  <F k="postalCode" title="PIN Code" value={profile.postalCode} onChange={(v) => setP("postalCode")(clean.pin(v))} inputMode="numeric" maxLength={6} required />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <F k="addressLine1" title="Address Line 1" value={profile.addressLine1} onChange={setP("addressLine1")} required />
                  <F k="addressLine2" title="Address Line 2" value={profile.addressLine2} onChange={setP("addressLine2")} />
                </div>
                <h3 className="border-t border-[var(--border)] pt-4 font-semibold">Emergency Contact</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <F k="emergencyName" title="Name" value={profile.emergencyName} onChange={(v) => setP("emergencyName")(clean.name(v))} required />
                  <F
                    k="emergencyRelationship"
                    title="Relationship"
                    type="select"
                    options={RELATIONSHIPS}
                    value={profile.emergencyRelationship}
                    onChange={setP("emergencyRelationship")}
                    required
                  />
                  <F k="emergencyPhone" title="Phone Number" type="tel" value={profile.emergencyPhone} onChange={setP("emergencyPhone")} required />
                </div>
              </>
            )}

            {current === "Banking" && (
              <>
                <p className="text-xs text-[var(--text-muted)]">
                  Optional — fill now or later from the employee profile.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <F k="accountHolderName" title="Account Holder Name" value={financial.accountHolderName} onChange={(v) => setF("accountHolderName")(clean.name(v))} />
                  <F k="bankName" title="Bank Name" value={financial.bankName} onChange={setF("bankName")} />
                  <F k="bankBranch" title="Bank Branch" value={financial.bankBranch} onChange={setF("bankBranch")} />
                  <F k="ifsc" title="IFSC Code" value={financial.ifsc} onChange={(v) => setF("ifsc")(clean.ifsc(v))} maxLength={11} />
                  <F k="accountNumber" title="Account Number" value={financial.accountNumber} onChange={(v) => setF("accountNumber")(clean.accountNumber(v))} inputMode="numeric" maxLength={18} />
                  <F k="pan" title="PAN" value={financial.pan} onChange={(v) => setF("pan")(clean.pan(v))} maxLength={10} />
                  <F k="uan" title="UAN (PF)" value={financial.uan} onChange={(v) => setF("uan")(clean.uan(v))} inputMode="numeric" maxLength={12} />
                </div>
                <h3 className="border-t border-[var(--border)] pt-4 font-semibold">Hours & Rates</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <F k="salary" title="Base Salary (monthly, ₹)" type="number" min="0" step="0.01" value={salary} onChange={setSalary} />
                  <F k="hoursPerDay" title="Hours Per Day" type="number" min="1" max="24" step="0.25" value={hoursPerDay} onChange={setF("hoursPerDay")} />
                  <F k="daysPerWeek" title="Days Per Week" type="number" min="1" max="7" step="0.5" value={daysPerWeek} onChange={setF("daysPerWeek")} />
                  <div>
                    <Field name="ratePerHour" title="Rate Per Hour" value={rate == null ? "" : money(rate)} disabled onChange={() => {}} />
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Monthly × 12 ÷ (52 × days × hours)</p>
                  </div>
                </div>
              </>
            )}

            {current === "Documents" && (
              <>
                {documents.length > 0 && (
                  <>
                    <h3 className="font-semibold">Existing Documents</h3>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {documents.map((d) => (
                        <div key={d.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] p-3">
                          <div>
                            <p className="font-medium">{d.category}</p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {d.expiresOn ? `Expires ${d.expiresOn}` : "No expiry date"}
                            </p>
                            <div className="mt-2">
                              <Status value={d.status} />
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="secondary" aria-label={`View ${d.category}`} onClick={() => openDocument(token, d).catch((e) => toast.error(e.message))}>
                              <Eye size={15} />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              aria-label={`Delete ${d.category}`}
                              onClick={async () => {
                                if (!(await confirmAction({ title: 'Delete document?', description: `${d.category} will be removed.`, confirmText: 'Delete', type: 'danger' }))) return;
                                try {
                                  await hrm(token, `/documents/${d.id}`, { method: "DELETE" });
                                  setDocuments((list) => list.filter((x) => x.id !== d.id));
                                  toast.success("Document deleted");
                                } catch (e) {
                                  toast.error(e.message);
                                }
                              }}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <h3 className="pt-2 font-semibold">Add New Documents</h3>
                  </>
                )}
                {rows.length > 0 && (
                  <p className="text-xs text-[var(--text-muted)]">PDF, JPG or PNG, max 5 MB each.</p>
                )}
                {/* One line per document: type, file, expiry, remove. */}
                {rows.map((r, i) => (
                  <div
                    key={r.key}
                    className="grid items-start gap-3 rounded-xl border border-[var(--border)] p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_auto]"
                  >
                      <F
                        k={`doc-type-${r.key}`}
                        title="Document Type"
                        type="select"
                        options={options(lists.documentTypes)}
                        value={r.typeId}
                        onChange={(v) => setRows((list) => list.map((x) => (x.key === r.key ? { ...x, typeId: v } : x)))}
                        required
                      />
                      {/* Two-sided documents (Aadhaar) ask for the front and the back separately. */}
                      <div className={documentSides(lists.find(r.typeId)) ? "grid gap-3 sm:grid-cols-2" : ""}>
                        {(documentSides(lists.find(r.typeId))
                          ? [["file", "doc-file", "Front side"], ["back", "doc-back", "Back side"]]
                          : [["file", "doc-file", "File"]]
                        ).map(([field, prefix, caption]) => (
                          <div key={field}>
                            <label className="mb-1.5 block text-xs font-semibold" htmlFor={`${prefix}-${r.key}`}>
                              {caption} *
                            </label>
                            <input
                              id={`${prefix}-${r.key}`}
                              type="file"
                              accept="application/pdf,image/png,image/jpeg"
                              className="block w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                              onChange={(e) =>
                                setRows((list) =>
                                  list.map((x) => (x.key === r.key ? { ...x, [field]: e.target.files?.[0] || null } : x)),
                                )
                              }
                            />
                            {err(`${prefix}-${r.key}`)}
                          </div>
                        ))}
                      </div>
                      <Field
                        name={`doc-expiry-${r.key}`}
                        title="Expiry Date"
                        type="date"
                        value={r.expiresOn}
                        onChange={(v) => setRows((list) => list.map((x) => (x.key === r.key ? { ...x, expiresOn: v } : x)))}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="md:mt-7"
                        aria-label={`Remove document ${i + 1}`}
                        onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
                      >
                        <X size={15} />
                      </Button>
                  </div>
                ))}
                {lists.documentTypes.length === 0 && masterEmpty(lists.documentTypes, "document types")}
                <Button variant="secondary" onClick={() => setRows((list) => [...list, newRow()])}>
                  <Plus size={16} /> Add Document
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-between gap-3">
          <Button variant="secondary" onClick={() => (step === 0 ? onCancel() : setStep(step - 1))} disabled={busy}>
            <ArrowLeft size={16} /> {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={nextStep}>
              Next <ArrowRight size={16} />
            </Button>
          ) : (
            <Button onClick={submit} loading={busy}>
              {editing ? "Update Employee" : "Create Employee"}
            </Button>
          )}
        </div>
      </Card>
    </div>
    </ErrorsContext.Provider>
  );
}
