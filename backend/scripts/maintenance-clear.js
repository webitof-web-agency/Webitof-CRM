// Server shell escape hatch: take the site out of maintenance when nobody can sign in to do it,
// or a restore is stuck. Usage (on the server): npm run maintenance:clear
const maintenance = require('../services/maintenance.service');

maintenance.loadOnStartup();
const before = maintenance.get();
if (!before.active) {
  console.log('The site is not in maintenance.');
  process.exit(0);
}
maintenance.clear({ id: 'cli' }, { force: true });
console.log(`Maintenance cleared (was: ${before.outcome || before.phase}). Restart the app: pm2 restart WebitofCRM-backend`);
console.log(before.error ? `Last restore error: ${before.error}` : 'No error was recorded.');
