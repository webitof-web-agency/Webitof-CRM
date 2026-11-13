import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { beginLoadingPhase, raiseLoadingPercent, startLoadingTask, subscribeLoading } from '../../lib/loadingProgress';

const SHOW_AFTER_MS = 200; // fast loads finish before the spinner would appear: no flicker
const HIDE_AFTER_MS = 260; // let "100 %" show for a moment before fading out
const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The ring + percentage. Same look as the boot loader in index.html. */
export function ProgressRing({ percent, label = 'Loading' }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/90 px-7 py-6 shadow-2xl backdrop-blur-md"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={RADIUS} fill="none" strokeWidth="5" className="stroke-[var(--border)]" />
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            className="stroke-[var(--primary)] transition-[stroke-dashoffset] duration-200 ease-out"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - value / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-[var(--text-main)]">
          {value}%
        </span>
      </div>
      <p className="text-xs font-medium text-[var(--text-muted)]">{label}…</p>
    </div>
  );
}

/**
 * Centred spinner with percentage while a page loads (its code and its data). Mounted once at
 * the app root. It does not block clicks, and loads that finish within 200 ms never show it.
 */
export function GlobalLoader() {
  const [view, setView] = useState({ visible: false, percent: 0 });
  const timers = useRef({});
  useEffect(() => {
    // Picks up from the boot loader in index.html, which ran before React.
    const boot = document.getElementById('boot-loader');
    const bootPercent = Number(window.__webitofBootPercent || 0);
    if (boot) boot.remove();
    // Continue from where the boot loader got to, never jumping back.
    raiseLoadingPercent(bootPercent);
    if (bootPercent) setView({ visible: true, percent: bootPercent });
    const t = timers.current;
    const unsubscribe = subscribeLoading((s) => {
      if (s.active) {
        clearTimeout(t.hide);
        const elapsed = performance.now() - s.startedAt;
        if (elapsed >= SHOW_AFTER_MS || bootPercent) {
          setView({ visible: true, percent: s.percent });
        } else if (!t.show) {
          t.show = setTimeout(() => {
            t.show = null;
            setView((v) => ({ ...v, visible: true }));
          }, SHOW_AFTER_MS - elapsed);
          setView((v) => ({ ...v, percent: s.percent }));
        } else {
          setView((v) => ({ ...v, percent: s.percent }));
        }
      } else {
        clearTimeout(t.show);
        t.show = null;
        setView((v) => (v.visible ? { visible: true, percent: 100 } : v));
        t.hide = setTimeout(() => setView({ visible: false, percent: 0 }), HIDE_AFTER_MS);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(t.show);
      clearTimeout(t.hide);
    };
  }, []);
  if (!view.visible) return null;
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[45] flex items-center justify-center bg-[var(--background)]/35 backdrop-blur-[1.5px] animate-in fade-in duration-150"
      aria-live="polite"
    >
      <ProgressRing percent={view.percent} />
    </div>
  );
}

/** Starts a load phase on every page change, so that page's code and data drive the spinner. */
export function RouteLoadingTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    beginLoadingPhase();
  }, [pathname]);
  return null;
}

/** Suspense fallback: counts as a loading task while the page's code downloads. */
export function SuspenseLoading() {
  useEffect(() => startLoadingTask(), []);
  return <div className="min-h-[50vh]" aria-busy="true" />;
}
