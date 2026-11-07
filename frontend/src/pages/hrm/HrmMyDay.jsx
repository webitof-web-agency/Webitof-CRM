import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clock,
  Coffee,
  Home,
  LogIn,
  LogOut,
  MapPin,
  NotebookPen,
  Play,
  Square,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Field, Status, controlClass } from "./HrmShared";
import { GeoMap } from "./GeoMap";
import { hrm } from "./hrmApi";
import { hm, clock, EVENT_LABELS } from "./hrmTime";
import { ConfirmModal } from "../../components/ui/ConfirmModal";

// The employee workday on the web — same server rules as the mobile app:
// location-verified clock-in, job timer, hourly reports, lunch, pings, summary.
const MIN = 60000;
const errorCode = (e) => e?.payload?.details?.code || null;
const stopwatch = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const two = (v) => String(v).padStart(2, "0");
  return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
};
function distance(a, b) {
  const rad = (d) => (Number(d) * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}
function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser cannot share location."));
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: Number(p.coords.latitude.toFixed(6)),
          longitude: Number(p.coords.longitude.toFixed(6)),
          accuracy: Math.round(p.coords.accuracy),
          isMock: false,
        }),
      (e) =>
        reject(
          new Error(
            e.code === 1
              ? "Location permission is blocked. Allow location for this site in the browser address bar."
              : "Could not get your location. Turn on Wi-Fi / location services and retry.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}
function localMinutes(date, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return Number(p.hour) * 60 + Number(p.minute);
}
const hhmm = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
function notifyBrowser(title, body, tag) {
  try {
    if (document.hidden && "Notification" in window && Notification.permission === "granted")
      new Notification(title, { body, tag, renotify: true });
  } catch {
    // Notifications are best-effort.
  }
}

export function HrmMyDay({ token }) {
  const [t, setT] = useState(null),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now()),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false);
  const skew = useRef(0);
  const prompted = useRef({});
  const lastFix = useRef(null);
  const lastWarn = useRef(0);

  const load = useCallback(async () => {
    try {
      const r = await hrm(token, "/me/today");
      skew.current = Date.parse(r.serverTime) - Date.now();
      setT(r);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [token]);
  const merge = useCallback((day) => setT((cur) => ({ ...cur, ...day })), []);
  useEffect(() => {
    load();
    const onVisible = () => !document.hidden && load();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => setNow(Date.now() + skew.current), 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [load]);

  const a = t?.attendance;
  const p = t?.policy;
  const open = Boolean(a?.checkIn && !a?.checkOut);
  const running = open && a?.jobStartedAt && !a?.jobEndedAt;
  const onLunch = Boolean(a?.lunchStartedAt && !a?.lunchEndedAt);

  // Location pings while the job runs (tab open). Closing the tab shows as offline.
  const pingIntervalMinutes = p?.pingIntervalMinutes;
  useEffect(() => {
    if (!running || !pingIntervalMinutes) return undefined;
    const ping = async () => {
      try {
        // Never re-send an old position: it would hide offline and out-of-zone alerts from reviewers.
        let fix;
        try {
          fix = await locate();
        } catch (error) {
          if (Date.now() - lastWarn.current > 10 * MIN) {
            lastWarn.current = Date.now();
            toast.warning(`${error.message} Location pings are paused until it works.`);
          }
          return;
        }
        lastFix.current = fix;
        const r = await hrm(token, "/me/ping", { method: "POST", body: fix });
        if (r.active === false) load();
        else if (r.slot) merge({ slot: r.slot });
      } catch {
        // Next ping retries.
      }
    };
    ping();
    const id = setInterval(ping, Math.max(1, pingIntervalMinutes) * MIN);
    return () => clearInterval(id);
  }, [running, pingIntervalMinutes, token, load, merge]);

  async function act(path, body, success) {
    setBusy(true);
    try {
      const r = await hrm(token, path, { method: "POST", body });
      merge(r);
      if (success) toast.success(success);
      return null;
    } catch (e) {
      toast.error(e.message);
      return errorCode(e) || "ERROR";
    } finally {
      setBusy(false);
    }
  }
  const slotEntry = (final = false) =>
    setModal({
      type: "entry",
      title: final ? "Last work update" : "Work report",
      subtitle: t?.slot ? `Since ${clock(t.slot.slotStart, p.timezone)} · ${hm(t.slot.workedMinutes)} worked` : null,
      onSubmit: async (body) => {
        const r = final
          ? await hrm(token, "/me/job", { method: "POST", body: { action: "end", finalEntry: body } })
          : await hrm(token, "/me/slots", { method: "POST", body });
        merge(r);
        toast.success(final ? "Job ended. Review your day." : "Report submitted");
        if (final) setTimeout(() => setModal({ type: "summary" }), 0);
      },
    });

  // Popups: slot due, lunch time, lunch over.
  useEffect(() => {
    if (!t || !p || !running || modal || busy) return;
    const due = t.slot?.dueAt;
    if (!onLunch && due && now >= Date.parse(due) && prompted.current.slot !== due) {
      prompted.current.slot = due;
      notifyBrowser("Time to submit your work report", `What did you work on in the last ${p.reportIntervalMinutes} minutes?`, "slot");
      slotEntry();
      return;
    }
    const mins = localMinutes(new Date(now), p.timezone);
    if (!a.lunchStartedAt && mins >= hhmm(p.lunchWindowStart) && mins < hhmm(p.lunchWindowEnd) && prompted.current.lunch !== t.workDate) {
      prompted.current.lunch = t.workDate;
      notifyBrowser("Lunch time", `Start lunch before ${p.lunchWindowEnd}. Allowed ${p.lunchMaxMinutes} min.`, "lunch");
      setModal({
        type: "confirm",
        title: "Lunch time",
        message: `Start your lunch now? You have ${p.lunchMaxMinutes} minutes; lunch can start until ${p.lunchWindowEnd}.`,
        ok: "Start lunch",
        onOk: () => act("/me/lunch", { action: "start" }, "Lunch started"),
      });
      return;
    }
    if (onLunch && now > Date.parse(a.lunchStartedAt) + p.lunchMaxMinutes * MIN && prompted.current.lunchEnd !== t.workDate) {
      prompted.current.lunchEnd = t.workDate;
      notifyBrowser("Lunch time is over", "End lunch to resume work. Extra time is flagged.", "lunch-end");
      setModal({
        type: "confirm",
        title: "Lunch time is over",
        message: "End lunch and resume work? Extra lunch time is flagged to your admin.",
        ok: "End lunch",
        onOk: () => act("/me/lunch", { action: "end" }, "Welcome back! Timer resumed."),
      });
    }
  }, [now, t, p, a, running, onLunch, modal, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error)
    return (
      <Card className="p-5">
        <p role="alert" className="text-sm text-rose-600">{error}</p>
        <Button className="mt-3" size="sm" onClick={load}>Retry</Button>
      </Card>
    );
  if (!t) return <Card className="h-56 animate-pulse bg-[var(--surface-2)]" />;

  const tz = p.timezone;
  let timer = 0;
  let state = "Not clocked in";
  let sub = `Shift ${p.shiftStart}–${p.shiftEnd}`;
  if (a?.checkOut) {
    state = "Day complete";
    timer = (t.summary?.workedMinutes || 0) * MIN;
    sub = `${clock(a.checkIn, tz)} → ${clock(a.checkOut, tz)}`;
  } else if (a?.status === "Absent" && !a.checkIn) {
    state = "Marked absent";
  } else if (open && !a.jobStartedAt) {
    state = "Clocked in · job not started";
    sub = `Clocked in at ${clock(a.checkIn, tz)}`;
  } else if (open) {
    const end = a.jobEndedAt ? Date.parse(a.jobEndedAt) : now;
    const lunch = a.lunchStartedAt ? (a.lunchEndedAt ? Date.parse(a.lunchEndedAt) : now) - Date.parse(a.lunchStartedAt) : 0;
    timer = end - Date.parse(a.jobStartedAt) - lunch;
    state = onLunch ? "On lunch" : a.jobEndedAt ? "Job ended · review summary" : "Working";
    sub = onLunch
      ? `Lunch ${stopwatch(now - Date.parse(a.lunchStartedAt))} of ${p.lunchMaxMinutes} min`
      : a.jobEndedAt
        ? `Ended at ${clock(a.jobEndedAt, tz)}`
        : `Started ${clock(a.jobStartedAt, tz)}${a.lunchStartedAt ? ` · lunch ${hm(t.summary?.lunchMinutes)}` : ""}`;
  }
  const mins = localMinutes(new Date(now), tz);
  const inLunchWindow = mins >= hhmm(p.lunchWindowStart) && mins < hhmm(p.lunchWindowEnd);
  const editable = ["Draft", "Revision Requested"].includes(t.report?.status || "Draft") && !a?.checkOut;
  const s = t.summary;
  const ghost = "!bg-white/10 !text-white !border-white/40 hover:!bg-white/20";
  const white = "!bg-white !text-[var(--primary)] hover:!bg-white/90";

  return (
    <div className="space-y-4">
      {!p.allowWebAttendance && (
        <Banner tone="amber">Web attendance is turned off by HR. Use the Webitof Employee app to clock in.</Banner>
      )}
      {t.staleSession && <Banner tone="amber">A session from {t.staleSession.workDate} is still open; it closes automatically at the report deadline.</Banner>}
      {t.leaveToday.map((l) => (
        <Banner key={l.id} tone="sky">Leave today: {l.title} ({l.status}){l.details?.fromTime ? ` · from ${l.details.fromTime}` : ""}</Banner>
      ))}
      {a?.autoCheckoutAt && open && <Banner tone="amber">Half-day leave approved: you will be clocked out at {clock(a.autoCheckoutAt, tz)}.</Banner>}

      <div className="rounded-3xl bg-gradient-to-br from-[#0077ed] via-[var(--primary)] to-[#005bb5] p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">{state}</span>
          <span className="text-sm font-bold">
            {a?.workMode === "WFO" ? "Office" : a?.workMode || ""}
            {a?.source === "web" ? " · Web" : a?.source === "app" ? " · App" : ""}
          </span>
        </div>
        <p className="mt-4 text-5xl font-extrabold tabular-nums tracking-tight">{stopwatch(timer)}</p>
        <p className="mt-1 text-sm text-white/75">{sub}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {(!a?.checkIn && a?.status !== "Absent") && (
            <Button className={white} disabled={!p.allowWebAttendance} onClick={() => setModal({ type: "clockin" })}>
              <LogIn size={16} /> Clock in
            </Button>
          )}
          {open && !a.jobStartedAt && (
            <>
              <Button
                className={white}
                loading={busy}
                onClick={async () => {
                  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
                  await act("/me/job", { action: "start" }, `Job started. Reports are due every ${p.reportIntervalMinutes} min.`);
                }}
              >
                <Play size={16} /> Start job
              </Button>
              <Button
                variant="outline"
                className={ghost}
                onClick={() =>
                  setModal({
                    type: "confirm",
                    title: "Clock out without starting the job?",
                    message: "No working time is counted today and, without a report, the day is marked Absent.",
                    ok: "Clock out",
                    onOk: () => act("/me/check-out", { summary: "" }, "Clocked out"),
                  })
                }
              >
                Clock out without working
              </Button>
            </>
          )}
          {running && !onLunch && (
            <>
              <Button className={white} onClick={() => slotEntry()}>
                <NotebookPen size={16} /> Report now
              </Button>
              <Button
                variant="outline"
                className={ghost}
                disabled={Boolean(a.lunchStartedAt) || !inLunchWindow || busy}
                onClick={() => act("/me/lunch", { action: "start" }, "Lunch started")}
              >
                <Coffee size={16} /> {a.lunchStartedAt ? "Lunch done" : inLunchWindow ? "Start lunch" : `Lunch ${p.lunchWindowStart}–${p.lunchWindowEnd}`}
              </Button>
              <Button
                variant="outline"
                className={ghost}
                onClick={() =>
                  setModal({
                    type: "confirm",
                    title: "End job for today?",
                    message: "The timer stops now. You will review the day summary and then clock out.",
                    ok: "End job",
                    onOk: async () => {
                      if ((t.slot?.workedMinutes || 0) >= 5 || !t.entries.length) slotEntry(true);
                      else {
                        const code = await act("/me/job", { action: "end" }, "Job ended");
                        if (!code) setModal({ type: "summary" });
                      }
                    },
                  })
                }
              >
                <Square size={16} /> End job
              </Button>
            </>
          )}
          {onLunch && (
            <Button className={white} loading={busy} onClick={() => act("/me/lunch", { action: "end" }, "Lunch ended")}>
              <Coffee size={16} /> End lunch
            </Button>
          )}
          {open && a.jobEndedAt && (
            <Button className={white} onClick={() => setModal({ type: "summary" })}>
              Review day & clock out
            </Button>
          )}
          {a?.checkOut && (
            <Button variant="outline" className={ghost} onClick={() => setModal({ type: "summary" })}>
              View day summary
            </Button>
          )}
        </div>
      </div>

      {running && t.slot && <SlotCard slot={t.slot} now={now} tz={tz} interval={p.reportIntervalMinutes} />}

      {s && a?.jobStartedAt && (
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">Today so far</h3>
          <Stats
            items={[
              ["Reports", `${s.slotsSubmitted} / ${s.slotsExpected}`, s.slotsMissed ? `${s.slotsMissed} missed` : ""],
              ["Lunch", hm(s.lunchMinutes), s.lunchOverrunMinutes ? `+${s.lunchOverrunMinutes} min over` : ""],
              ["Idle (late reports)", hm(s.idleMinutes)],
              ["Offline", hm(s.offlineMinutes)],
            ]}
          />
        </Card>
      )}

      {t.alerts
        .filter((x) => x.status === "Explanation Requested")
        .map((x) => (
          <Card key={x.id} className="space-y-2 border-amber-500/40 p-5">
            <h3 className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} className="text-amber-500" /> Explanation requested</h3>
            <p className="text-sm">{x.title}</p>
            {x.comment && <p className="text-xs text-[var(--text-muted)]">HR: {x.comment}</p>}
            <Button size="sm" variant="secondary" onClick={() => setModal({ type: "explain", alert: x })}>Explain</Button>
          </Card>
        ))}

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Today&apos;s work reports</h3>
          {t.report && <Status value={t.report.status} />}
        </div>
        {!t.entries.length && <p className="text-sm text-[var(--text-muted)]">Your hourly updates appear here after you start the job.</p>}
        <EntryList entries={t.entries} tz={tz} onEdit={editable ? (x) => editEntry(x) : null} />
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-start gap-3">
          <Home size={18} className={t.home?.status === "Approved" ? "text-emerald-500" : "text-[var(--text-muted)]"} />
          <div>
            <p className="font-semibold">Work from home location</p>
            <p className="text-sm text-[var(--text-muted)]">
              {t.home
                ? t.home.status === "Approved"
                  ? `Approved (${t.home.radiusMeters} m). Clock-in from home is automatic WFH.`
                  : "Waiting for admin approval."
                : t.homeRejected
                  ? `Rejected${t.homeRejected.comment ? `: ${t.homeRejected.comment}` : ""}. Register again.`
                  : "Register your home location once to work from home."}
            </p>
          </div>
        </div>
        {t.home?.status !== "Approved" && (
          <Button size="sm" variant="secondary" onClick={() => setModal({ type: "home" })}>
            <MapPin size={14} /> {t.home ? "Update location" : "Register home"}
          </Button>
        )}
      </Card>

      {modal?.type === "clockin" && (
        <ClockInModal
          today={t}
          onClose={() => setModal(null)}
          onDone={(r) => {
            merge(r);
            setModal(null);
            toast.success('Clocked in. Click "Start job" when you begin work.');
          }}
          onNeedHome={() => setModal({ type: "home" })}
          token={token}
          lastFix={lastFix}
        />
      )}
      {modal?.type === "entry" && (
        <EntryModal token={token} {...modal} minChars={p.minSlotReportChars} onClose={() => setModal(null)} />
      )}
      {modal?.type === "confirm" && (
        <ConfirmModal
          open
          title={modal.title}
          description={modal.message}
          confirmText={modal.ok}
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            setModal(null);
            await modal.onOk();
          }}
        />
      )}
      {modal?.type === "summary" && (
        <SummaryModal
          today={t}
          editable={editable}
          onEdit={editEntry}
          onClose={() => setModal(null)}
          onClockOut={async (note) => {
            const code = await act("/me/check-out", { summary: note }, "Clocked out. Report submitted.");
            if (!code) setModal(null);
          }}
          busy={busy}
        />
      )}
      {modal?.type === "home" && (
        <HomeModal
          token={token}
          today={t}
          onClose={() => setModal(null)}
          onDone={(home) => {
            setT((cur) => ({ ...cur, home }));
            setModal(null);
            toast.success("Sent for approval. You will be notified.");
          }}
        />
      )}
      {modal?.type === "explain" && (
        <ExplainModal
          alert={modal.alert}
          onClose={() => setModal(null)}
          onSend={async (text) => {
            await hrm(token, `/me/alerts/${modal.alert.id}/explain`, { method: "POST", body: { explanation: text } });
            toast.success("Sent to HR");
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );

  function editEntry(x) {
    const back = modal?.type === "summary";
    setModal({
      type: "entry",
      title: "Edit work update",
      initial: x,
      onSubmit: async (body) => {
        merge(await hrm(token, `/me/entries/${x.id}`, { method: "PUT", body }));
        toast.success("Update saved (edit counted)");
        if (back) setTimeout(() => setModal({ type: "summary" }), 0);
      },
    });
  }
}

function Banner({ tone, children }) {
  const tones = {
    amber: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    sky: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
  };
  return <div className={`rounded-xl p-3 text-sm ${tones[tone]}`}>{children}</div>;
}
function Stats({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(([k, v, hint]) => (
        <div key={k} className="rounded-xl bg-[var(--surface-2)] p-3">
          <p className="text-xs text-[var(--text-muted)]">{k}</p>
          <p className="mt-1 font-semibold tabular-nums">{v}</p>
          {hint && <p className="text-xs text-rose-600">{hint}</p>}
        </div>
      ))}
    </div>
  );
}
function SlotCard({ slot, now, tz, interval }) {
  const due = Date.parse(slot.dueAt);
  const overdue = now > Date.parse(slot.graceEndsAt);
  const text = slot.onLunch
    ? "Report timer paused for lunch"
    : overdue
      ? "Report overdue — idle time is being counted"
      : now >= due
        ? "Report due now"
        : `Next report in ${stopwatch(due - now)}`;
  return (
    <Card className="flex items-center gap-3 p-4">
      <Clock size={20} className={overdue ? "text-rose-600" : "text-[var(--primary)]"} />
      <div>
        <p className={`font-semibold ${overdue ? "text-rose-600" : ""}`}>{text}</p>
        <p className="text-xs text-[var(--text-muted)]">
          Due {clock(slot.dueAt, tz)} · every {interval} min · {hm(slot.workedMinutes)} in this slot
        </p>
      </div>
    </Card>
  );
}
function EntryList({ entries, tz, onEdit }) {
  return (
    <div className="divide-y divide-[var(--border)]">
      {entries.map((x) => (
        <div key={x.id} className="flex items-start gap-3 py-3 text-sm">
          <span className="w-28 shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
            {x.slotStart ? `${clock(x.slotStart, tz)}–${clock(x.slotEnd, tz)}` : x.source}
            <br />
            {hm(x.minutes)}
          </span>
          <div className="min-w-0 flex-1">
            <p>{x.description}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {x.projectTitle || "No project"}
              {Number(x.completion) > 0 ? ` · ${Number(x.completion)}%` : ""}
              {x.editCount > 0 && <span className="ml-1 text-amber-600">· edited {x.editCount}×</span>}
              {x.blocker && <span className="ml-1 text-rose-600">· blocker</span>}
            </p>
          </div>
          {onEdit && (
            <Button size="xs" variant="ghost" onClick={() => onEdit(x)}>Edit</Button>
          )}
        </div>
      ))}
    </div>
  );
}
function ClockInModal({ today, token, onClose, onDone, onNeedHome, lastFix }) {
  const [mode, setMode] = useState("auto"),
    [reason, setReason] = useState(""),
    [fix, setFix] = useState(null),
    [gpsError, setGpsError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(() => {
    setGpsError("");
    locate()
      .then((f) => {
        lastFix.current = f;
        setFix(f);
      })
      .catch((e) => setGpsError(e.message));
  }, [lastFix]);
  useEffect(() => refresh(), [refresh]);
  const fences = [
    ...today.offices.map((o) => ({ ...o, color: "#4f46e5" })),
    ...(today.home?.status === "Approved" ? [{ ...today.home, color: "#10b981" }] : []),
  ];
  async function submit() {
    setBusy(true);
    try {
      onDone(await hrm(token, "/me/clock-in", { method: "POST", body: { ...fix, mode, client: "web", reason: mode === "Client Visit" ? reason : undefined } }));
    } catch (e) {
      toast.error(e.message);
      if (errorCode(e) === "HOME_REQUIRED") onNeedHome();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title="Clock in" subtitle="Inside the office zone it is Work From Office; inside your approved home zone it is Work From Home." onClose={onClose} width="min(720px,95vw)">
      <div className="space-y-4">
        <GeoMap center={fix || today.offices[0]} radius={fix?.accuracy || 50} others={fences} height={260} />
        {gpsError ? (
          <p className="text-sm text-rose-600">{gpsError}</p>
        ) : !fix ? (
          <p className="text-sm text-[var(--text-muted)]">Getting your location…</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {fences.map((f) => (
              <li key={f.id}>
                {f.kind === "home" ? "Home" : f.label}: <b>{distance(fix, f)} m</b> away (zone {f.radiusMeters} m)
              </li>
            ))}
            <li className={fix.accuracy > today.policy.maxGpsAccuracyMeters ? "text-rose-600" : "text-[var(--text-muted)]"}>
              Location accuracy ±{fix.accuracy} m
              {fix.accuracy > today.policy.maxGpsAccuracyMeters && ` — too weak (needs ${today.policy.maxGpsAccuracyMeters} m). Turn on Wi-Fi or use the mobile app.`}
            </li>
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {[
            ["auto", "Auto detect"],
            ["WFO", "Office"],
            ["WFH", "Work from home"],
            ["Client Visit", "Client visit"],
          ].map(([v, label]) => (
            <Button key={v} size="sm" variant={mode === v ? "primary" : "secondary"} onClick={() => setMode(v)}>
              {label}
            </Button>
          ))}
        </div>
        {mode === "WFH" && !today.home && <p className="text-sm text-amber-600">Register your home location once; after admin approval WFH clock-in is automatic.</p>}
        {mode === "Client Visit" && (
          <Field name="visitReason" title="Client / purpose of visit" type="textarea" value={reason} onChange={setReason} required help="Client visits are reviewed by your admin." />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={refresh}>Refresh location</Button>
          <Button loading={busy} disabled={!fix || (mode === "Client Visit" && reason.trim().length < 10)} onClick={submit}>
            <LogIn size={16} /> Clock in
          </Button>
        </div>
      </div>
    </Modal>
  );
}
function EntryModal({ token, title, subtitle, initial, minChars, onSubmit, onClose }) {
  const [projects, setProjects] = useState([]),
    [v, setV] = useState({
      description: initial?.description || "",
      projectId: initial?.projectId || "",
      completion: Number(initial?.completion || 0),
      blocker: initial?.blocker || "",
      evidenceUrl: initial?.evidenceUrl || "",
      billable: initial ? Boolean(initial.billable) : true,
    }),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    hrm(token, "/lookups?type=projects")
      .then((r) => setProjects(r.rows.map((x) => ({ value: x.id, label: x.name }))))
      .catch(() => setProjects([]));
  }, [token]);
  const set = (k, val) => setV((o) => ({ ...o, [k]: val }));
  const length = v.description.trim().length;
  return (
    <Modal open title={title} subtitle={subtitle || undefined} onClose={initial ? onClose : () => {}} width="min(640px,95vw)">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSubmit({
              description: v.description.trim(),
              projectId: v.projectId || null,
              completion: Number(v.completion),
              blocker: v.blocker.trim() || null,
              evidenceUrl: v.evidenceUrl.trim() || null,
              billable: v.billable,
            });
            onClose();
          } catch (err) {
            toast.error(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {initial?.editCount > 0 && <p className="text-xs text-amber-600">Edited {initial.editCount}× already — visible to admin.</p>}
        <Field name="entryProject" title="Project" type="select" options={projects} value={v.projectId} onChange={(x) => set("projectId", x)} />
        <div>
          <label htmlFor="entryDesc" className="mb-1.5 block text-xs font-semibold">What did you work on? *</label>
          <textarea
            id="entryDesc"
            rows={4}
            className={controlClass}
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Be specific: feature, ticket, outcome. Copy-pasted text is rejected."
          />
          <p className={`mt-1 text-xs ${length >= minChars ? "text-emerald-600" : "text-amber-600"}`}>{length} / {minChars} characters minimum</p>
        </div>
        <div>
          <label htmlFor="entryCompletion" className="mb-1.5 block text-xs font-semibold">Task completion: {v.completion}%</label>
          <input id="entryCompletion" type="range" min={0} max={100} step={10} value={v.completion} onChange={(e) => set("completion", e.target.value)} className="w-full accent-[var(--primary)]" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="entryBlocker" title="Blocker (optional)" value={v.blocker} onChange={(x) => set("blocker", x)} />
          <Field name="entryEvidence" title="PR / ticket / Figma link (https)" value={v.evidenceUrl} onChange={(x) => set("evidenceUrl", x)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={v.billable} onChange={(e) => set("billable", e.target.checked)} />
          Billable client work
        </label>
        <div className="flex justify-end gap-2">
          {initial && <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>}
          <Button type="submit" loading={busy} disabled={length < minChars}>{initial ? "Save changes" : "Submit report"}</Button>
        </div>
      </form>
    </Modal>
  );
}
function SummaryModal({ today, editable, onEdit, onClose, onClockOut, busy }) {
  const [note, setNote] = useState("");
  const a = today.attendance;
  const s = today.summary;
  const tz = today.policy.timezone;
  const canClockOut = a && a.checkIn && !a.checkOut && (a.jobEndedAt || !a.jobStartedAt);
  return (
    <Modal open title={a?.checkOut ? "Day summary" : "Review your day"} subtitle={today.workDate} onClose={onClose}>
      <div className="space-y-5">
        {s && (
          <Stats
            items={[
              ["Worked", hm(s.workedMinutes), ""],
              ["Productive", hm(s.productiveMinutes), ""],
              ["Lunch", hm(s.lunchMinutes), s.lunchOverrunMinutes ? `+${s.lunchOverrunMinutes} min over` : ""],
              ["Online / offline", `${hm(s.onlineMinutes)} / ${hm(s.offlineMinutes)}`, ""],
              ["Idle (late reports)", hm(s.idleMinutes), ""],
              ["Outside zone", hm(s.outsideMinutes), ""],
              ["Reports", `${s.slotsSubmitted} / ${s.slotsExpected}`, s.slotsMissed ? `${s.slotsMissed} missed` : ""],
              ["Edits", `${s.edits}`, ""],
            ]}
          />
        )}
        <section>
          <h3 className="mb-2 text-sm font-semibold">What you did today {today.report && <Status value={today.report.status} />}</h3>
          <EntryList entries={today.entries} tz={tz} onEdit={editable ? onEdit : null} />
          {editable && <p className="mt-2 text-xs text-[var(--text-muted)]">Every change is counted and shown to your admin. After today only an admin can change this report.</p>}
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Timeline</h3>
          <ol className="space-y-1 border-l border-[var(--border)] pl-4 text-sm">
            {today.events
              .filter((e) => EVENT_LABELS[e.kind] && !["slot_prompt", "lunch_prompt", "lunch_end_prompt"].includes(e.kind))
              .map((e) => (
                <li key={e.id}>
                  <span className="tabular-nums text-[var(--text-muted)]">{clock(e.at, tz)}</span> · {EVENT_LABELS[e.kind]}
                </li>
              ))}
          </ol>
        </section>
        {canClockOut && (
          <>
            <Field name="dayNote" title="Day summary note (optional)" type="textarea" value={note} onChange={setNote} />
            <div className="flex justify-end">
              <Button loading={busy} onClick={() => onClockOut(note.trim())}>
                <LogOut size={16} /> Submit report & clock out
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
function HomeModal({ token, today, onClose, onDone }) {
  const [fix, setFix] = useState(null),
    [address, setAddress] = useState(""),
    [gpsError, setGpsError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(() => {
    setGpsError("");
    locate().then(setFix).catch((e) => setGpsError(e.message));
  }, []);
  useEffect(() => refresh(), [refresh]);
  const max = today.policy.maxGpsAccuracyMeters;
  return (
    <Modal open title="Work from home location" subtitle="Register once from inside your home; your admin approves the radius." onClose={onClose} width="min(640px,95vw)">
      <div className="space-y-4">
        <GeoMap center={fix || today.home || today.offices[0]} radius={today.home?.radiusMeters || 100} height={260} />
        {gpsError ? (
          <p className="text-sm text-rose-600">{gpsError}</p>
        ) : fix ? (
          <p className={`text-sm ${fix.accuracy > max ? "text-rose-600" : "text-emerald-600"}`}>
            Location accuracy ±{fix.accuracy} m {fix.accuracy > max ? `— too weak (needs ${max} m). Use the mobile app or turn on Wi-Fi.` : "— good"}
          </p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Getting your location…</p>
        )}
        <Field name="homeAddress" title="Home address (optional)" value={address} onChange={setAddress} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={refresh}>Refresh location</Button>
          <Button
            loading={busy}
            disabled={!fix}
            onClick={async () => {
              setBusy(true);
              try {
                onDone(await hrm(token, "/me/home-geofence", { method: "POST", body: { ...fix, address: address.trim() || undefined } }));
              } catch (e) {
                toast.error(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <MapPin size={16} /> {today.home ? "Update pending location" : "Request approval"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
function ExplainModal({ alert, onClose, onSend }) {
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal open title="Your explanation" subtitle={alert.title} onClose={onClose} width="min(520px,95vw)">
      <div className="space-y-4">
        <Field name="explanation" title="Explanation" type="textarea" value={text} onChange={setText} required />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={busy}
            disabled={!text.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onSend(text.trim());
              } catch (e) {
                toast.error(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Send
          </Button>
        </div>
      </div>
    </Modal>
  );
}
