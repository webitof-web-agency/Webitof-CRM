// After the first page has loaded, the code of the pages people open most is fetched quietly in the
// background, one at a time, so opening them later is instant. Skipped on "data saver" or 2G
// connections. These are the same modules App.jsx lazy-loads, so nothing is downloaded twice.
const MOST_USED = [
  () => import('../pages/DashboardPage'),
  () => import('../pages/LeadsPage'),
  () => import('../pages/followups/FollowUpsPage'),
  () => import('../pages/clients/ClientsListPage'),
  () => import('../pages/hrm/HrmPage'),
  () => import('../pages/invoices/InvoicesListPage'),
  () => import('../pages/projects/ProjectsListPage'),
  () => import('../pages/payments/PaymentsListPage')
];

let started = false;

function whenIdle(callback) {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(callback, { timeout: 4000 });
  else setTimeout(callback, 1500);
}

export function prefetchMostUsedPages() {
  if (started || typeof window === 'undefined') return;
  const connection = navigator.connection;
  if (connection?.saveData || /2g/.test(connection?.effectiveType || '')) return;
  started = true;
  const queue = [...MOST_USED];
  const next = () => {
    const load = queue.shift();
    if (!load) return;
    whenIdle(() => {
      load().catch(() => {}).finally(next);
    });
  };
  // Give the current page a head start.
  setTimeout(next, 2500);
}
