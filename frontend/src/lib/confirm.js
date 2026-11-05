// Promise-based confirmation that uses the app's own dialog (components/overlays/ConfirmHost.jsx)
// instead of the browser's window.confirm. Falls back to window.confirm if the host is not mounted.
//
//   if (!(await confirmAction({ title: 'Delete call log?', description: 'This cannot be undone.', confirmText: 'Delete', type: 'danger' }))) return;
let listener = null;

export function registerConfirmHost(fn) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function confirmAction(options) {
  const opts = typeof options === 'string' ? { description: options } : (options || {});
  if (!listener) {
    return Promise.resolve(window.confirm(opts.description || opts.title || 'Are you sure?'));
  }
  return new Promise((resolve) => listener({ ...opts, resolve }));
}
