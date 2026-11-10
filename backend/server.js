const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
require('dotenv').config();

const apiRoutes = require('./routes');
const notFound = require('./middlewares/notFound');
const { requireAuth, requirePermission } = require('./middlewares/auth');

const errorHandler = require('./middlewares/errorHandler');
const { ensureDatabase } = require('./config/initDb');
const { closePool } = require('./config/db');
const { scheduleAmcAutomation } = require('./services/amcAutomation.service');
const { scheduleRenewalAutomation } = require('./services/renewalAutomation.service');
const { scheduleOutsourcingAutomation } = require('./services/outsourcingAutomation.service');
const { registerSocketHub } = require('./services/socketHub.service');
const { createFollowUpScheduler } = require('./services/followUpEngine.service');
const { runScheduledBackupIfDue } = require('./services/googleDrive/backup.service');
const googleDriveController = require('./controllers/googleDrive.controller');
const maintenance = require('./services/maintenance.service');
const { maintenanceGate } = require('./middlewares/maintenance');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const API_PREFIX = process.env.API_PREFIX || '/api';

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/assets', express.static(path.join(__dirname, '../frontend/public/assets')));
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Webitof CRM backend is running',
    apiPrefix: API_PREFIX
  });
});

// Restores put the site in maintenance: every API call except status/health answers 503.
app.use(API_PREFIX, maintenanceGate);
app.use(API_PREFIX, apiRoutes);

// Kept for older clients; same behaviour as POST /api/google-drive/backups/run.
app.post(`${API_PREFIX.replace(/\/+$/, '')}/admin/backup/run`, requireAuth, requirePermission('settings.write'), googleDriveController.runBackupNow);

app.use(notFound);
app.use(errorHandler);

// A developer machine pointed at the live database sets both flags: SKIP_DB_SETUP leaves the
// schema and seed data alone (the deployed server owns migrations), and DISABLE_SCHEDULERS
// keeps local crons from mailing clients or marking attendance a second time.
const skipDbSetup = String(process.env.SKIP_DB_SETUP || '').toLowerCase() === 'true';
const disableSchedulers = String(process.env.DISABLE_SCHEDULERS || '').toLowerCase() === 'true';

// Anyone who knows JWT_SECRET can sign a session for any user, so a placeholder or short value
// is as good as no password. Loud on every start until it is replaced.
function warnWeakJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '');
  const placeholder = /change[-_ ]?this|changeme|secret|example|your[-_]/i.test(secret);
  if (secret.length >= 32 && !placeholder) return;
  const line = '!'.repeat(78);
  console.error(`${line}\nSECURITY: JWT_SECRET is a placeholder or shorter than 32 characters. Anyone who\n`
    + `knows it can sign in as any user. Set a long random value (openssl rand -hex 48)\n`
    + `and restart; everyone signs in again once.\n${line}`);
}

async function start() {
  warnWeakJwtSecret();
  maintenance.loadOnStartup();
  if (skipDbSetup) {
    console.log('SKIP_DB_SETUP=true: schema setup and seeding skipped');
  } else {
    await ensureDatabase();
  }
  // A restore that crashed after committing left the backup's Drive rows in place; put the current ones back.
  await require('./services/googleDrive/restore.service').reapplySavedSettings()
    .then((applied) => applied && console.warn('Drive connection settings from before an interrupted restore were put back.'))
    .catch((error) => console.error('Could not put back Drive settings after an interrupted restore:', error.message));
  const server = http.createServer(app);
  registerSocketHub(server, {
    origin: process.env.CORS_ORIGIN || true
  });
  server.listen(PORT, () => {
    console.log(`Webitof CRM API listening on port ${PORT}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (disableSchedulers) {
    console.log('DISABLE_SCHEDULERS=true: backup, AMC, renewal, outsourcing, follow-up and HRM crons are off');
    return;
  }
  require('./services/hrm/automation').schedule();

  // ─── Daily Database Backup ──────────────────────────────────────────────────
  // Checked every 15 minutes; runs once per IST date at or after GDRIVE_BACKUP_HOUR_IST.
  const backupCycle = () => {
    if (maintenance.skipDuringMaintenance('Backup')) return;
    runScheduledBackupIfDue()
      .then((result) => {
        if (result.status === 'FAILED') console.error('Scheduled backup failed:', result.error);
        else if (result.status === 'SUCCESS') console.log(`Scheduled backup uploaded: ${result.fileName}`);
      })
      .catch((error) => console.error('Backup schedule check failed:', error.message));
  };
  backupCycle();
  setInterval(backupCycle, 15 * 60 * 1000).unref();

  try {
    const AMC_AUTOMATION_SCHEDULE = process.env.AMC_AUTOMATION_CRON || '15 9 * * *';
    scheduleAmcAutomation({ schedule: AMC_AUTOMATION_SCHEDULE, timezone: 'Asia/Kolkata' });
    console.log(`✅ AMC automation scheduled — runs at ${AMC_AUTOMATION_SCHEDULE} (Asia/Kolkata)`);
  } catch (automationErr) {
    console.error('⚠️  Could not start AMC automation cron:', automationErr.message);
  }

  try {
    const RENEWAL_AUTOMATION_SCHEDULE = process.env.RENEWAL_AUTOMATION_CRON || '20 9 * * *';
    scheduleRenewalAutomation({ schedule: RENEWAL_AUTOMATION_SCHEDULE, timezone: 'Asia/Kolkata' });
    console.log(`✅ Renewal automation scheduled — runs at ${RENEWAL_AUTOMATION_SCHEDULE} (Asia/Kolkata)`);
  } catch (automationErr) {
    console.error('⚠️  Could not start renewal automation cron:', automationErr.message);
  }

  try {
    const OUTSOURCING_AUTOMATION_SCHEDULE = process.env.OUTSOURCING_AUTOMATION_CRON || '35 9 * * *';
    scheduleOutsourcingAutomation({ schedule: OUTSOURCING_AUTOMATION_SCHEDULE, timezone: 'Asia/Kolkata' });
    console.log(`✅ Outsourcing automation scheduled — runs at ${OUTSOURCING_AUTOMATION_SCHEDULE} (Asia/Kolkata)`);
  } catch (automationErr) {
    console.error('⚠️  Could not start outsourcing automation cron:', automationErr.message);
  }

  try {
    const FOLLOW_UP_AUTOMATION_SCHEDULE = process.env.FOLLOW_UP_AUTOMATION_CRON || '*/10 * * * *';
    const FOLLOW_UP_TIMEZONE = process.env.FOLLOW_UP_TIMEZONE || 'Asia/Kolkata';
    createFollowUpScheduler({ schedule: FOLLOW_UP_AUTOMATION_SCHEDULE, timezone: FOLLOW_UP_TIMEZONE });
    console.log(`Advanced follow-up automation scheduled at ${FOLLOW_UP_AUTOMATION_SCHEDULE} (${FOLLOW_UP_TIMEZONE})`);
  } catch (automationErr) {
    console.error('Could not start follow-up automation cron:', automationErr.message);
  }

}

if (require.main === module) {
  start().catch((error) => {
    console.error('Failed to start backend:', error);
    process.exit(1);
  });
}

module.exports = app;
