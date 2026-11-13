// Page-load progress for the centred spinner (GlobalLoader).
//
// A "phase" starts when the app boots and on every route change. While a phase is open, every API
// request and every lazily loaded page chunk counts as a task. The percentage is the share of tasks
// finished, eased by a slow time-based trickle so it keeps moving while one big request is in
// flight. The phase ends once every task has finished and nothing new started for a moment, so the
// page's follow-up requests (a list, then its details) are part of the same load.
//
// Requests started outside a phase (polling, saving a form, background refresh) are not tracked, so
// the spinner never covers the page for those.
const SETTLE_MS = 180; // quiet time after the last task before the load counts as done
const MAX_PHASE_MS = 20000; // a hung request must not keep the spinner up forever
const IDLE_END_MS = 250; // a page that starts no task at all ends its phase after this

let phase = null;
let listeners = new Set();
let state = { active: false, percent: 0, startedAt: 0 };

function emit() {
  state = phase
    ? { active: true, percent: phase.percent, startedAt: phase.startedAt }
    : { active: false, percent: state.percent, startedAt: state.startedAt };
  listeners.forEach((listener) => listener(state));
}

function computePercent() {
  if (!phase) return 100;
  const { total, done, startedAt } = phase;
  const real = total ? (done / total) * 100 : 0;
  // Time-based trickle approaching 90 %: 1 - e^(-t/2.5 s).
  const trickle = 90 * (1 - Math.exp(-(performance.now() - startedAt) / 2500));
  return Math.min(98, Math.max(phase.percent, Math.round(Math.max(real * 0.95, trickle))));
}

function scheduleEnd(delay) {
  clearTimeout(phase.endTimer);
  phase.endTimer = setTimeout(() => {
    if (!phase || phase.done < phase.total) return;
    finishPhase();
  }, delay);
}

function finishPhase() {
  if (!phase) return;
  clearTimeout(phase.endTimer);
  clearTimeout(phase.maxTimer);
  clearInterval(phase.ticker);
  phase = null;
  state = { ...state, percent: 100 };
  emit();
}

/** Start a page-load phase (app boot, route change). An open phase keeps its counts. */
export function beginLoadingPhase({ initialPercent = 0 } = {}) {
  if (phase) return;
  phase = { total: 0, done: 0, percent: initialPercent, startedAt: performance.now() };
  phase.lastRise = performance.now();
  phase.ticker = setInterval(() => {
    if (!phase) return;
    const next = computePercent();
    const now = performance.now();
    // Never sit still while waiting: creep +1 every 350 ms up to 98 %.
    if (next > phase.percent) {
      phase.percent = next;
      phase.lastRise = now;
    } else if (phase.percent < 98 && now - phase.lastRise > 350) {
      phase.percent += 1;
      phase.lastRise = now;
    }
    emit();
  }, 120);
  phase.maxTimer = setTimeout(finishPhase, MAX_PHASE_MS);
  scheduleEnd(IDLE_END_MS);
  emit();
}

/** Count `promise` towards the current phase, if one is open. Returns the promise unchanged. */
export function trackLoading(promise) {
  if (!phase) return promise;
  const current = phase;
  current.total += 1;
  clearTimeout(current.endTimer);
  const settle = () => {
    if (phase !== current) return;
    current.done += 1;
    current.percent = computePercent();
    emit();
    if (current.done >= current.total) scheduleEnd(SETTLE_MS);
  };
  promise.then(settle, settle);
  return promise;
}

/** A task that lasts until the returned function is called (e.g. a Suspense fallback on screen). */
export function startLoadingTask() {
  let finish;
  trackLoading(new Promise((resolve) => { finish = resolve; }));
  let called = false;
  return () => {
    if (called) return;
    called = true;
    finish?.();
  };
}

/** Raise the open phase to at least `percent` (the boot loader hands over its last value). */
export function raiseLoadingPercent(percent) {
  if (!phase || !(percent > phase.percent)) return;
  phase.percent = Math.min(98, Math.round(percent));
  phase.lastRise = performance.now();
  emit();
}

export function subscribeLoading(listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function getLoadingState() {
  return state;
}
