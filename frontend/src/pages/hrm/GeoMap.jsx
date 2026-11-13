import { useEffect, useRef, useState } from "react";
// Google Maps is optional: without VITE_GOOGLE_MAPS_API_KEY the coordinates are
// still editable as numbers and a "View on Google Maps" link is shown.
const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
let loader = null;
export function loadGoogleMaps() {
  if (!KEY) return Promise.reject(new Error("Map key missing"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  loader ??= new Promise((resolve, reject) => {
    const callback = "__webitofMapsReady";
    window[callback] = () => resolve(window.google.maps);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&callback=${callback}&loading=async`;
    script.async = true;
    script.onerror = () => {
      loader = null;
      reject(new Error("Google Maps failed to load"));
    };
    document.head.appendChild(script);
  });
  return loader;
}
export const mapsLink = (p) =>
  `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;
// Webitof head office (Currency Tower, Raipur): where an empty map opens.
const DEFAULT_CENTER = { lat: 21.238, lng: 81.67922 };
const present = (v) => v !== "" && v !== null && v !== undefined;
/** Great-circle distance in metres between two {latitude, longitude} points. */
export function distanceMeters(a, b) {
  const rad = (d) => (Number(d) * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}
/**
 * center: {latitude, longitude}; radius in metres; onPick(point) makes the map
 * editable (click / drag the marker). `others` draws extra fences for context.
 * fallback: {latitude, longitude} to open on while center is still empty.
 * people: live dots [{ id, latitude, longitude, color, lines: [title, ...details] }]; hovering a dot
 *   shows its lines. fitRequest: bump it to zoom the map to every fence and dot.
 */
// Live dots: a filled circle per person. Hover opens one shared info window built from text nodes
// (names and notes come from the database, so nothing is inserted as HTML).
function drawPeople(maps, s, people = []) {
  (s.people || []).forEach((m) => m.setMap(null));
  // headerDisabled: a hover card needs no close button.
  s.info ??= new maps.InfoWindow({ disableAutoPan: true, headerDisabled: true });
  s.people = people
    .filter((o) => Number.isFinite(Number(o.latitude)) && Number.isFinite(Number(o.longitude)))
    .map((o) => {
      const marker = new maps.Marker({
        map: s.map,
        position: { lat: Number(o.latitude), lng: Number(o.longitude) },
        zIndex: 1000,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: o.color || "#0ea5e9",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2.5,
        },
      });
      const content = document.createElement("div");
      content.style.cssText = "font:12px/1.45 system-ui,sans-serif;color:#0f172a;min-width:170px;padding:2px 2px 0";
      (o.lines || []).forEach((line, index) => {
        const row = document.createElement("div");
        row.textContent = line;
        if (index === 0) row.style.cssText = "font-weight:700;font-size:13px;margin-bottom:2px";
        else row.style.color = "#475569";
        content.appendChild(row);
      });
      marker.addListener("mouseover", () => {
        s.info.setContent(content);
        s.info.open({ map: s.map, anchor: marker });
      });
      marker.addListener("mouseout", () => s.info.close());
      marker.addListener("click", () => {
        s.info.setContent(content);
        s.info.open({ map: s.map, anchor: marker });
      });
      return marker;
    });
}
function fitAll(maps, s, position, others = [], people = []) {
  const bounds = new maps.LatLngBounds();
  bounds.extend(position);
  [...others, ...people].forEach((o) => {
    if (Number.isFinite(Number(o.latitude)) && Number.isFinite(Number(o.longitude)))
      bounds.extend({ lat: Number(o.latitude), lng: Number(o.longitude) });
  });
  s.map.fitBounds(bounds, 60);
  // One point (or several in one building) would zoom in to street furniture.
  maps.event.addListenerOnce(s.map, "idle", () => {
    if (s.map.getZoom() > 17) s.map.setZoom(17);
  });
}

export function GeoMap({ center, radius, onPick, others = [], height = 280, fallback = null, people = [], fitRequest = 0 }) {
  const box = useRef(null);
  const state = useRef({});
  const [error, setError] = useState(KEY ? "" : "missing");
  // Empty inputs are "no point yet", not 0,0 (Number("") is 0, which is in the Atlantic Ocean).
  const lat = present(center?.latitude) ? Number(center.latitude) : NaN;
  const lng = present(center?.longitude) ? Number(center.longitude) : NaN;
  const valid = Number.isFinite(lat) && Number.isFinite(lng);
  const fallbackLat = Number(fallback?.latitude);
  const fallbackLng = Number(fallback?.longitude);
  const start = Number.isFinite(fallbackLat) && Number.isFinite(fallbackLng) && present(fallback?.latitude)
    ? { lat: fallbackLat, lng: fallbackLng }
    : DEFAULT_CENTER;
  // Callers pass fresh arrays/functions every render (the clock page re-renders every second).
  // Keep the latest in refs and key the effect on content, so the map is not rebuilt or re-panned.
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const othersRef = useRef(others);
  othersRef.current = others;
  const othersKey = JSON.stringify((others || []).map((o) => [o.latitude, o.longitude, o.radiusMeters, o.color]));
  const peopleRef = useRef(people);
  peopleRef.current = people;
  const peopleKey = JSON.stringify((people || []).map((o) => [o.id, o.latitude, o.longitude, o.color, o.lines]));
  useEffect(() => {
    let active = true;
    if (!KEY) return undefined;
    loadGoogleMaps()
      .then((maps) => {
        if (!active || !box.current) return;
        const s = state.current;
        const position = valid ? { lat, lng } : start;
        if (!s.map) {
          s.map = new maps.Map(box.current, {
            center: position,
            zoom: 17,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
          s.marker = new maps.Marker({ map: s.map, position, draggable: Boolean(pickRef.current) });
          s.circle = new maps.Circle({
            map: s.map,
            center: position,
            radius: Number(radius) || 100,
            strokeColor: "#4f46e5",
            strokeWeight: 2,
            fillColor: "#4f46e5",
            fillOpacity: 0.12,
            clickable: false,
          });
          const pick = (e) =>
            s.onPick?.({
              latitude: Number(e.latLng.lat().toFixed(6)),
              longitude: Number(e.latLng.lng().toFixed(6)),
            });
          s.map.addListener("click", pick);
          s.marker.addListener("dragend", pick);
          s.others = [];
        }
        s.onPick = (point) => pickRef.current?.(point);
        s.marker.setPosition(position);
        s.circle.setCenter(position);
        s.circle.setRadius(Number(radius) || 100);
        // Pan when the point (or, with no point yet, the fallback such as a just-loaded office) moves.
        const positionKey = `${position.lat},${position.lng}`;
        if (s.positionKey !== positionKey) s.map.panTo(position);
        s.positionKey = positionKey;
        s.others.forEach((o) => o.setMap(null));
        s.others = (othersRef.current || [])
          .filter((o) => Number.isFinite(Number(o.latitude)))
          .map(
            (o) =>
              new maps.Circle({
                map: s.map,
                center: { lat: Number(o.latitude), lng: Number(o.longitude) },
                radius: Number(o.radiusMeters) || 100,
                strokeColor: o.color || "#10b981",
                strokeWeight: 1,
                fillColor: o.color || "#10b981",
                fillOpacity: 0.08,
                clickable: false,
              }),
          );
        drawPeople(maps, s, peopleRef.current);
        if (fitRequest && s.fitRequest !== fitRequest) {
          s.fitRequest = fitRequest;
          fitAll(maps, s, position, othersRef.current, peopleRef.current);
        }
        setError("");
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
    // start is derived from the fallback numbers listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radius, valid, othersKey, peopleKey, fitRequest, start.lat, start.lng]);
  if (error)
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4 text-center text-xs text-[var(--text-muted)]"
        style={{ height }}
      >
        <p>
          {error === "missing"
            ? "Add VITE_GOOGLE_MAPS_API_KEY in frontend/.env to pick locations on the map."
            : error}
        </p>
        {valid && (
          <a className="font-semibold text-[var(--primary)]" href={mapsLink({ latitude: lat, longitude: lng })} target="_blank" rel="noreferrer">
            View {lat.toFixed(5)}, {lng.toFixed(5)} on Google Maps ↗
          </a>
        )}
      </div>
    );
  return <div ref={box} className="w-full overflow-hidden rounded-xl border border-[var(--border)]" style={{ height }} />;
}
