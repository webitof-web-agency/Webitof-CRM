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

app.use(API_PREFIX, apiRoutes);

// Kept for older clients; same behaviour as POST /api/google-drive/backups/run.
app.post(`${API_PREFIX.replace(/\/+$/, '')}/admin/backup/run`, requireAuth, requirePermission('settings.write'), googleDriveController.runBackupNow);

app.use(notFound);
app.use(errorHandler);

async function start() {
  await ensureDatabase();
  require('./services/hrm/automation').schedule();
  const server = http.createServer(app);
  registerSocketHub(server, {
    origin: process.env.CORS_ORIGIN || true
  });
  server.listen(PORT, () => {
    console.log(`Webitof CRM API listening on port ${PORT}`);
  });

  // ─── Daily Database Backup ──────────────────────────────────────────────────
  // Checked every 15 minutes; runs once per IST date at or after GDRIVE_BACKUP_HOUR_IST.
  const backupCycle = () => {
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

  const shutdown = async () => {
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Failed to start backend:', error);
    process.exit(1);
  });
}

module.exports = app;
