import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Building2, Clock3, Crosshair, ExternalLink, Home, Maximize2, Pencil, Plus } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Field, Status } from "./HrmShared";
import { GeoMap, distanceMeters, mapsLink } from "./GeoMap";
import { hrm } from "./hrmApi";
import { clock } from "./hrmTime";
import { formatDate } from "../../lib/format";
import { cn } from "../../lib/cn";

const blank = (radius) => ({ label: "", address: "", latitude: "", longitude: "", radiusMeters: radius, locationId: "", status: "Approved" });
// Below this an office fence is smaller than everyday GPS drift indoors, so staff inside the
// building are often refused clock-in.
const SMALL_OFFICE_RADIUS = 50;
// Map colours: the selected fence uses the map's own indigo marker + circle.
const COLORS = { office: "#4f46e5", home: "#10b981", pending: "#f59e0b" };
// Live employee dots.
const LIVE = { working: "#0ea5e9", outside: "#ef4444", lunch: "#a855f7", offline: "#94a3b8" };
const MODE_LABELS = { WFO: "Work from office", WFH: "Work from home", "Client Visit": "Client visit" };
const LIVE_REFRESH_MS = 30000;

function minutesAgo(iso) {
  if (!iso) return "";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`;
}
/** One dot per clocked-in employee whose app has reported a position today. */
function livePeople(rows = [], timezone) {
  return rows
    .filter((r) => r.location)
    .map((r) => {
      const l = r.location;
      const color = r.offline ? LIVE.offline : l.inside === false ? LIVE.outside : r.state === "On lunch" ? LIVE.lunch : LIVE.working;
      const lines = [
        `${r.fullName}${r.employeeNumber ? ` (${r.employeeNumber})` : ""}`,
        [r.state, MODE_LABELS[r.workMode] || r.workMode].filter(Boolean).join(" · "),
        `Clocked in ${clock(r.clockIn, timezone)}`,
        `Last location ${clock(l.at, timezone)} (${minutesAgo(l.at)})${r.offline ? " · app offline" : ""}`,
        [l.accuracy != null ? `GPS ±${l.accuracy} m` : "", l.inside === true ? "inside work zone" : l.inside === false ? "OUTSIDE work zone" : ""].filter(Boolean).join(" · "),
      ].filter(Boolean);
      return { id: r.employeeId, latitude: l.latitude, longitude: l.longitude, color, lines, offline: r.offline, outside: l.inside === false };
    });
}

/** Why a home location needs a second look: it overlaps an office, or its GPS fix was too rough. */
function homeWarnings(home, offices) {
  const notes = [];
  for (const office of offices) {
    if (office.status !== "Approved") continue;
    const apart = distanceMeters(home, office);
    if (apart < Number(office.radiusMeters) + Number(home.radiusMeters))
      notes.push(`Overlaps ${office.label} (${apart} m away): a clock-in near the office can count as Work From Home`);
  }
  if (home.requestAccuracy != null && Number(home.requestAccuracy) > Number(home.radiusMeters))
    notes.push(`Registered with GPS accuracy ±${home.requestAccuracy} m, wider than its ${home.radiusMeters} m radius`);
  return notes;
}
const officeWarnings = (office) =>
  office.status === "Approved" && office.radiusMeters < SMALL_OFFICE_RADIUS
    ? [`Radius ${office.radiusMeters} m is very small: staff inside the building may be refused clock-in (100–200 m is usual).`]
    : [];
const coords = (p) => `${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}`;

/** Office fields + map, used in the Add / Edit popup. */
function OfficeForm({ form, setForm, onSubmit, busy, masters, offices, fallback, submitLabel, onCancel }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const prefix = form.id ? "edit" : "office";
  function pickMyLocation() {
    if (!navigator.geolocation) return toast.error("Location is unavailable in this browser");
    navigator.geolocation.getCurrentPosition(
      (p) => setForm((f) => ({ ...f, latitude: Number(p.coords.latitude.toFixed(6)), longitude: Number(p.coords.longitude.toFixed(6)) })),
      (err) => toast.error(err.message),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  return (
    <form className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]" onSubmit={onSubmit}>
      <div className="space-y-3">
        <Field name={`${prefix}Label`} title="Office name" value={form.label} onChange={(v) => set("label", v)} required />
        <Field name={`${prefix}Address`} title="Address" value={form.address} onChange={(v) => set("address", v)} />
        <div className="grid grid-cols-2 gap-3">
          <Field name={`${prefix}Lat`} title="Latitude" type="number" value={form.latitude} onChange={(v) => set("latitude", v)} required />
          <Field name={`${prefix}Lng`} title="Longitude" type="number" value={form.longitude} onChange={(v) => set("longitude", v)} required />
        </div>
        <Field name={`${prefix}Radius`} title="Radius (metres)" type="number" min={20} max={5000} value={form.radiusMeters} onChange={(v) => set("radiusMeters", v)} required help={
            Number(form.radiusMeters) && Number(form.radiusMeters) < SMALL_OFFICE_RADIUS
              ? `Under ${SMALL_OFFICE_RADIUS} m is smaller than normal GPS drift indoors, so staff inside may be refused clock-in. Keep 100–200 m for a building.`
              : "Keep 100–200 m for a building; GPS tolerance is added automatically."
          } />
        <div className="grid grid-cols-2 gap-3">
          <Field
            name={`${prefix}Location`}
            title="Organization location"
            type="select"
            options={masters.filter((m) => m.type === "hrm_location").map((m) => ({ value: m.id, label: m.name }))}
            value={form.locationId}
            onChange={(v) => set("locationId", v)}
          />
          <Field name={`${prefix}Status`} title="Status" type="select" options={["Approved", "Retired"]} value={form.status} onChange={(v) => set("status", v)} required />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" loading={busy}>{submitLabel}</Button>
          <Button type="button" variant="secondary" onClick={pickMyLocation}>
            <Crosshair size={14} /> Use my location
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-[var(--text-muted)]">Click the map or drag the pin to set the office centre.</p>
        <GeoMap
          center={{ latitude: form.latitude, longitude: form.longitude }}
          radius={form.radiusMeters}
          onPick={(p) => setForm((f) => ({ ...f, ...p }))}
          others={offices.filter((o) => o.id !== form.id && o.status === "Approved")}
          fallback={fallback}
          height={400}
        />
      </div>
    </form>
  );
}

function Stat({ icon: Icon, label, value, hint, tone = "primary" }) {
  const tones = {
    primary: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    danger: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  };
  return (
    <Card className="flex items-center gap-3 px-4 py-3">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-wider text-[var(--text-muted)] sm:truncate">{label}</p>
        <p className="text-lg font-bold leading-tight text-[var(--text-main)]">
          {value}
          {hint && <span className="ml-1.5 text-xs font-medium text-[var(--text-muted)]">{hint}</span>}
        </p>
      </div>
    </Card>
  );
}

function Warnings({ notes }) {
  if (!notes.length) return null;
  return (
    <div className="mt-1.5 space-y-0.5">
      {notes.map((note) => (
        <p key={note} className="flex items-start gap-1 text-xs leading-snug text-amber-600 dark:text-amber-400">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {note}
        </p>
      ))}
    </div>
  );
}

const HOME_FILTERS = [
  ["all", "All"],
  ["Pending", "Pending"],
  ["Approved", "Approved"],
  ["other", "Rejected / reset"],
];

/** Office geofences (WFO) and employee home geofences (WFH). */
export function HrmGeofences({ token, metadata, masters, can }) {
  const defaultRadius = metadata.policy.defaultOfficeRadiusMeters || 150;
  const [rows, setRows] = useState([]),
    [editing, setEditing] = useState(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [homeBusy, setHomeBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [focusId, setFocusId] = useState(""),
    [homeFilter, setHomeFilter] = useState("all"),
    [live, setLive] = useState(null),
    [fitRequest, setFitRequest] = useState(0);
  const manage = can("manage_settings");
  const approve = can("approve");
  // The live board is open to approvers and to anyone who can see team or all employees.
  const canLive = approve || can("hr_approve") || can("view_team") || can("view_all");
  const timezone = metadata.policy.timezone || "Asia/Kolkata";
  useEffect(() => {
    if (!canLive) return undefined;
    let active = true;
    const load = () =>
      hrm(token, "/live")
        .then((r) => active && setLive(r))
        .catch(() => {}); // the map still shows fences without the live layer
    load();
    // Do not poll hidden tabs.
    const timer = setInterval(() => !document.hidden && load(), LIVE_REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token, canLive]);
  useEffect(() => {
    let active = true;
    hrm(token, "/geofences")
      .then((r) => active && (setRows(r), setError(""), setLoaded(true)))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [token, refresh]);

  const offices = useMemo(() => rows.filter((r) => r.kind === "office"), [rows]);
  const homes = useMemo(() => rows.filter((r) => r.kind === "home"), [rows]);
  const homeNotes = useMemo(
    () => new Map(homes.map((h) => [h.id, ["Rejected", "Retired"].includes(h.status) ? [] : homeWarnings(h, offices)])),
    [homes, offices],
  );
  const approvedOffices = offices.filter((o) => o.status === "Approved");
  const pending = homes.filter((h) => h.status === "Pending");
  const warningCount = offices.reduce((n, o) => n + officeWarnings(o).length, 0) + [...homeNotes.values()].filter((n) => n.length).length;
  // An empty form and the overview open on an existing office, not on 0,0.
  const mapFallback = approvedOffices[0] || offices[0] || null;
  const focus = rows.find((r) => r.id === focusId) || mapFallback;
  const visibleHomes = homes.filter((h) =>
    homeFilter === "all" ? true : homeFilter === "other" ? ["Rejected", "Retired"].includes(h.status) : h.status === homeFilter,
  );
  const people = useMemo(() => livePeople(live?.rows, timezone), [live, timezone]);
  const clockedIn = (live?.rows || []).filter((r) => r.clockIn && !r.clockOut).length;
  const outsideNow = people.filter((p) => p.outside).length;
  const overviewOthers = rows
    .filter((r) => r.id !== focus?.id && !["Rejected", "Retired"].includes(r.status))
    .map((r) => ({ ...r, color: r.kind === "office" ? COLORS.office : r.status === "Pending" ? COLORS.pending : COLORS.home }));

  // Saves the add / edit popup. Errors show as a toast and the popup stays open with what was typed.
  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { id, ...body } = editing;
      const saved = await hrm(token, `/geofences${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        body: { ...body, latitude: Number(body.latitude), longitude: Number(body.longitude), radiusMeters: Number(body.radiusMeters), locationId: body.locationId || null },
      });
      toast.success(id ? "Office location updated" : "Office location added");
      setEditing(null);
      if (saved?.id) setFocusId(saved.id);
      setRefresh((n) => n + 1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }
  async function homeAction(row, action) {
    const comment = action === "approve" ? "" : window.prompt(action === "reject" ? "Reason for rejection" : "Reason for resetting this home location");
    if (action !== "approve" && !comment) return;
    if (homeBusy) return;
    setHomeBusy(true);
    try {
      await hrm(token, `/geofences/${row.id}/action`, { method: "POST", body: { action, comment: comment || undefined } });
      toast.success("Location updated");
      setRefresh((n) => n + 1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setHomeBusy(false);
    }
  }
  const editOffice = (o) =>
    setEditing({ id: o.id, label: o.label, address: o.address || "", latitude: o.latitude, longitude: o.longitude, radiusMeters: o.radiusMeters, locationId: o.locationId || "", status: o.status });

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Building2} label="Offices" value={approvedOffices.length} hint={offices.length > approvedOffices.length ? `of ${offices.length}` : "active"} />
        <Stat icon={Home} label="Home locations" value={homes.filter((h) => h.status === "Approved").length} hint="approved" tone="success" />
        <Stat icon={Clock3} label="Awaiting review" value={pending.length} hint={pending.length ? "home requests" : "all clear"} tone={pending.length ? "warning" : "success"} />
        <Stat icon={AlertTriangle} label="Need attention" value={warningCount} hint={warningCount ? "see notes below" : "no issues"} tone={warningCount ? "danger" : "success"} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <h2 className="text-sm font-semibold">Offices <span className="text-[var(--text-muted)]">({offices.length})</span></h2>
              {manage && (
                <Button size="xs" variant="secondary" onClick={() => setEditing(blank(defaultRadius))}>
                  <Plus size={13} /> Add
                </Button>
              )}
            </div>
            {loaded && !offices.length && (
              <p className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">Add at least one office so employees can clock in from the app.</p>
            )}
            <ul className="divide-y divide-[var(--border)]">
              {offices.map((o) => (
                <li
                  key={o.id}
                  className={cn("cursor-pointer px-4 py-3 transition-colors hover:bg-[var(--hover-bg)]", focus?.id === o.id && "bg-[var(--hover-bg)]")}
                  onClick={() => setFocusId(o.id)}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS.office }} />
                        <span className="truncate">{o.label}</span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{[o.address, o.locationName].filter(Boolean).join(" · ") || "No address"}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-semibold">{o.radiusMeters} m radius</span>
                        <a className="inline-flex items-center gap-1 text-[var(--primary)]" href={mapsLink(o)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          {coords(o)} <ExternalLink size={11} />
                        </a>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                      <Status value={o.status} />
                      {manage && (
                        <Button size="xs" variant="secondary" aria-label={`Edit ${o.label}`} onClick={(e) => { e.stopPropagation(); editOffice(o); }}>
                          <Pencil size={12} /> Edit
                        </Button>
                      )}
                    </div>
                  </div>
                  <Warnings notes={officeWarnings(o)} />
                </li>
              ))}
            </ul>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <h2 className="text-sm font-semibold">Employee home locations <span className="text-[var(--text-muted)]">({homes.length})</span></h2>
              <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter home locations">
                {HOME_FILTERS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={homeFilter === key}
                    onClick={() => setHomeFilter(key)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                      homeFilter === key ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--hover-bg)]",
                    )}
                  >
                    {label}
                    {key === "Pending" && pending.length ? ` (${pending.length})` : ""}
                  </button>
                ))}
              </div>
            </div>
            {loaded && !visibleHomes.length && (
              <p className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                {homes.length ? "No home locations in this view." : "Employees register their home once from the Webitof Employee app."}
              </p>
            )}
            <ul className="divide-y divide-[var(--border)]">
              {visibleHomes.map((h) => {
                const notes = homeNotes.get(h.id) || [];
                return (
                  <li
                    key={h.id}
                    className={cn("cursor-pointer px-4 py-3 transition-colors hover:bg-[var(--hover-bg)]", focus?.id === h.id && "bg-[var(--hover-bg)]")}
                    onClick={() => setFocusId(h.id)}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: h.status === "Pending" ? COLORS.pending : COLORS.home }} />
                          <span className="truncate">{h.employeeName}</span>
                          <span className="text-xs font-normal text-[var(--text-muted)]">{h.employeeNumber}</span>
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                          <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-semibold text-[var(--text-main)]">{h.radiusMeters} m radius</span>
                          <span>GPS ±{h.requestAccuracy ?? "?"} m</span>
                          <a className="inline-flex items-center gap-1 text-[var(--primary)]" href={mapsLink(h)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                            {coords(h)} <ExternalLink size={11} />
                          </a>
                          {h.reviewedAt && <span>Reviewed {formatDate(h.reviewedAt)}{h.comment ? ` · ${h.comment}` : ""}</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end" onClick={(e) => e.stopPropagation()}>
                        <Status value={h.status} />
                        {h.status === "Pending" && approve && (
                          <>
                            <Button size="xs" disabled={homeBusy} onClick={() => homeAction(h, "approve")}>Approve</Button>
                            <Button size="xs" variant="secondary" disabled={homeBusy} onClick={() => homeAction(h, "reject")}>Reject</Button>
                          </>
                        )}
                        {h.status === "Approved" && approve && (
                          <Button size="xs" variant="ghost" disabled={homeBusy} onClick={() => homeAction(h, "retire")}>Reset</Button>
                        )}
                      </div>
                    </div>
                    <Warnings notes={notes} />
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <Card className="space-y-2 p-3 xl:sticky xl:top-20">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Map</p>
              <p className="truncate text-sm font-semibold">
                {focus ? `${focus.kind === "office" ? focus.label : `${focus.employeeName} · home`} · ${focus.radiusMeters} m` : "No locations yet"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
              {[["Office", COLORS.office], ["Home", COLORS.home], ["Pending", COLORS.pending]].map(([label, color]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}
                </span>
              ))}
              {canLive &&
                [["Working", LIVE.working], ["Outside zone", LIVE.outside], ["Lunch", LIVE.lunch], ["Offline", LIVE.offline]].map(([label, color]) => (
                  <span key={label} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: color }} /> {label}
                  </span>
                ))}
              <Button size="xs" variant="ghost" onClick={() => setFitRequest((n) => n + 1)} aria-label="Show every location on the map">
                <Maximize2 size={12} /> Show all
              </Button>
            </div>
          </div>
          {canLive && live && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
              <span>{clockedIn} clocked in</span>
              <span>{people.length} on map</span>
              {outsideNow > 0 && <span className="font-semibold text-rose-600">{outsideNow} outside zone</span>}
              <span className="text-[var(--text-muted)]">updated {clock(live.serverTime, timezone)} · hover a dot for details</span>
            </p>
          )}
          <GeoMap
            center={focus ? { latitude: focus.latitude, longitude: focus.longitude } : null}
            radius={focus?.radiusMeters}
            others={overviewOthers}
            fallback={mapFallback}
            people={people}
            fitRequest={fitRequest}
            height={520}
          />
          <p className="px-1 text-xs text-[var(--text-muted)]">Click an office or home on the left to centre it here. Employee dots show where the app last reported each clocked-in person (refreshes every 30 s).</p>
        </Card>
      </div>

      {editing && (
        <Modal
          open
          title={editing.id ? "Edit office location" : "Add office location"}
          subtitle={editing.id ? editing.label : undefined}
          width="min(1100px, 95vw)"
          onClose={() => !saving && setEditing(null)}
        >
          <OfficeForm
            form={editing}
            setForm={(update) => setEditing((current) => (typeof update === "function" ? update(current) : update))}
            onSubmit={submit}
            busy={saving}
            masters={masters}
            offices={offices}
            fallback={mapFallback}
            submitLabel={editing.id ? "Save changes" : "Add office"}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}
