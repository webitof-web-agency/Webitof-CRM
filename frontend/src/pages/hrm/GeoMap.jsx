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
/**
 * center: {latitude, longitude}; radius in metres; onPick(point) makes the map
 * editable (click / drag the marker). `others` draws extra fences for context.
 */
export function GeoMap({ center, radius, onPick, others = [], height = 280 }) {
  const box = useRef(null);
  const state = useRef({});
  const [error, setError] = useState(KEY ? "" : "missing");
  const lat = Number(center?.latitude);
  const lng = Number(center?.longitude);
  const valid = Number.isFinite(lat) && Number.isFinite(lng);
  useEffect(() => {
    let active = true;
    if (!KEY) return undefined;
    loadGoogleMaps()
      .then((maps) => {
        if (!active || !box.current) return;
        const s = state.current;
        const position = valid ? { lat, lng } : { lat: 28.6139, lng: 77.209 };
        if (!s.map) {
          s.map = new maps.Map(box.current, {
            center: position,
            zoom: 17,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
          s.marker = new maps.Marker({ map: s.map, position, draggable: Boolean(onPick) });
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
        s.onPick = onPick;
        s.marker.setPosition(position);
        s.circle.setCenter(position);
        s.circle.setRadius(Number(radius) || 100);
        if (valid) s.map.panTo(position);
        s.others.forEach((o) => o.setMap(null));
        s.others = others
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
        setError("");
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [lat, lng, radius, valid, onPick, others]);
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
