import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crosshair } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { Field, Status } from "./HrmShared";
import { GeoMap, mapsLink } from "./GeoMap";
import { hrm } from "./hrmApi";
import { formatDate } from "../../lib/format";
const blank = (radius) => ({ label: "", address: "", latitude: "", longitude: "", radiusMeters: radius, locationId: "", status: "Approved" });
/** Office geofences (WFO) and employee home geofences (WFH). */
export function HrmGeofences({ token, metadata, masters, can }) {
  const [rows, setRows] = useState([]),
    [form, setForm] = useState(blank(metadata.policy.defaultOfficeRadiusMeters || 150)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const manage = can("manage_settings");
  useEffect(() => {
    hrm(token, "/geofences")
      .then((r) => (setRows(r), setError("")))
      .catch((e) => setError(e.message));
  }, [token, refresh]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const offices = rows.filter((r) => r.kind === "office");
  const homes = rows.filter((r) => r.kind === "home");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { id, ...body } = form;
      await hrm(token, `/geofences${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        body: { ...body, latitude: Number(body.latitude), longitude: Number(body.longitude), radiusMeters: Number(body.radiusMeters), locationId: body.locationId || null },
      });
      toast.success("Office location saved");
      setForm(blank(metadata.policy.defaultOfficeRadiusMeters || 150));
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function homeAction(row, action) {
    const comment = action === "approve" ? "" : window.prompt(action === "reject" ? "Reason for rejection" : "Reason for resetting this home location");
    if (action !== "approve" && !comment) return;
    try {
      await hrm(token, `/geofences/${row.id}/action`, { method: "POST", body: { action, comment: comment || undefined } });
      toast.success("Location updated");
      setRefresh((n) => n + 1);
    } catch (err) {
      toast.error(err.message);
    }
  }
  function pickMyLocation() {
    if (!navigator.geolocation) return toast.error("Location is unavailable in this browser");
    navigator.geolocation.getCurrentPosition(
      (p) => setForm((f) => ({ ...f, latitude: Number(p.coords.latitude.toFixed(6)), longitude: Number(p.coords.longitude.toFixed(6)) })),
      (err) => toast.error(err.message),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Attendance"
        title="Work locations & geofences"
        description="Clock-in inside an office radius is Work From Office. Inside an approved home radius it is Work From Home. Outside both, clock-in is blocked (client visits need a reason and are reviewed)."
      />
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {manage && (
        <Card className="p-5">
          <form className="grid gap-5 lg:grid-cols-[1fr_1.2fr]" onSubmit={submit}>
            <div className="space-y-4">
              <h2 className="font-semibold">{form.id ? "Edit office" : "Add office location"}</h2>
              <Field name="officeLabel" title="Office name" value={form.label} onChange={(v) => set("label", v)} required />
              <Field name="officeAddress" title="Address" value={form.address} onChange={(v) => set("address", v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field name="officeLat" title="Latitude" type="number" value={form.latitude} onChange={(v) => set("latitude", v)} required />
                <Field name="officeLng" title="Longitude" type="number" value={form.longitude} onChange={(v) => set("longitude", v)} required />
              </div>
              <Field name="officeRadius" title="Radius (metres)" type="number" min={20} max={5000} value={form.radiusMeters} onChange={(v) => set("radiusMeters", v)} required help="Keep 100–200 m for a building; GPS tolerance is added automatically." />
              <Field
                name="officeLocation"
                title="Organization location (optional)"
                type="select"
                options={masters.filter((m) => m.type === "hrm_location").map((m) => ({ value: m.id, label: m.name }))}
                value={form.locationId}
                onChange={(v) => set("locationId", v)}
              />
              <Field name="officeStatus" title="Status" type="select" options={["Approved", "Retired"]} value={form.status} onChange={(v) => set("status", v)} />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={busy}>{form.id ? "Save office" : "Add office"}</Button>
                <Button type="button" variant="secondary" onClick={pickMyLocation}>
                  <Crosshair size={14} /> Use my location
                </Button>
                {form.id && (
                  <Button type="button" variant="ghost" onClick={() => setForm(blank(metadata.policy.defaultOfficeRadiusMeters || 150))}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-muted)]">Click the map or drag the pin to set the office centre.</p>
              <GeoMap
                center={{ latitude: form.latitude, longitude: form.longitude }}
                radius={form.radiusMeters}
                onPick={(p) => setForm((f) => ({ ...f, ...p }))}
                others={offices.filter((o) => o.id !== form.id && o.status === "Approved")}
                height={380}
              />
            </div>
          </form>
        </Card>
      )}
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Offices ({offices.length})</h2>
        {!offices.length && <p className="text-sm text-[var(--text-muted)]">Add at least one office so employees can clock in from the app.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {offices.map((o) => (
            <div key={o.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] p-3 text-sm">
              <div>
                <p className="font-semibold">{o.label}</p>
                <p className="text-xs text-[var(--text-muted)]">{o.address || "—"}</p>
                <a className="text-xs text-[var(--primary)]" href={mapsLink(o)} target="_blank" rel="noreferrer">
                  {o.latitude.toFixed(5)}, {o.longitude.toFixed(5)} · {o.radiusMeters} m ↗
                </a>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Status value={o.status} />
                {manage && (
                  <Button size="xs" variant="secondary" onClick={() => setForm({ id: o.id, label: o.label, address: o.address || "", latitude: o.latitude, longitude: o.longitude, radiusMeters: o.radiusMeters, locationId: o.locationId || "", status: o.status })}>
                    Edit
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Employee home locations ({homes.length})</h2>
        <p className="text-xs text-[var(--text-muted)]">Employees register their home once from the app. Pending requests can also be approved, with the radius adjusted on a map, from the HRM overview.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-[var(--text-muted)]">
              <tr>{["Employee", "Location", "Radius", "GPS accuracy", "Status", "Reviewed", ""].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {homes.map((h) => (
                <tr key={h.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{h.employeeName}<span className="block text-xs text-[var(--text-muted)]">{h.employeeNumber}</span></td>
                  <td className="px-3 py-2"><a className="text-[var(--primary)]" href={mapsLink(h)} target="_blank" rel="noreferrer">{h.latitude.toFixed(5)}, {h.longitude.toFixed(5)} ↗</a></td>
                  <td className="px-3 py-2">{h.radiusMeters} m</td>
                  <td className="px-3 py-2">±{h.requestAccuracy ?? "?"} m</td>
                  <td className="px-3 py-2"><Status value={h.status} /></td>
                  <td className="px-3 py-2 text-xs">{formatDate(h.reviewedAt)}{h.comment ? ` · ${h.comment}` : ""}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {h.status === "Pending" && can("approve") && (
                        <>
                          <Button size="xs" onClick={() => homeAction(h, "approve")}>Approve</Button>
                          <Button size="xs" variant="secondary" onClick={() => homeAction(h, "reject")}>Reject</Button>
                        </>
                      )}
                      {h.status === "Approved" && can("approve") && (
                        <Button size="xs" variant="ghost" onClick={() => homeAction(h, "retire")}>Reset</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
