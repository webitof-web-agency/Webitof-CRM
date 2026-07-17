const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const apiRoutes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const { ensureDatabase } = require('./config/initDb');
const { closePool } = require('./config/db');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const API_PREFIX = process.env.API_PREFIX || '/api';

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Webitof CRM backend is running',
    apiPrefix: API_PREFIX
  });
});

app.use(API_PREFIX, apiRoutes);
app.use(notFound);
app.use(errorHandler);

// ─── Manual Backup Trigger (Admin only) ───────────────────────────────────────
app.post(`${API_PREFIX}/admin/backup/run`, async (req, res) => {
  try {
    const { runBackup } = require('./scripts/backup');
    console.log('📦 Manual backup triggered via API');
    runBackup(); // fire and forget
    res.json({ success: true, message: 'Backup started in background' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function start() {
  await ensureDatabase();
  const server = app.listen(PORT, () => {
    console.log(`Webitof CRM API listening on port ${PORT}`);
  });

  // ─── Daily Backup Cron ──────────────────────────────────────────────────────
  // Runs every day at 11:55 PM IST — backs up entire DB to Google Drive
  const hasDriveCreds = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID
    || process.env.GOOGLE_DRIVE_REFRESH_TOKEN
    || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (hasDriveCreds) {
    try {
      const cron = require('node-cron');
      const { runBackup } = require('./scripts/backup');
      const BACKUP_SCHEDULE = process.env.BACKUP_CRON_SCHEDULE || '55 23 * * *'; // 11:55 PM daily

      cron.schedule(BACKUP_SCHEDULE, () => {
        console.log('\n🕐 Scheduled daily backup triggered...');
        runBackup().then(result => {
          if (!result.success) console.error('❌ Scheduled backup failed:', result.error);
        }).catch(err => {
          console.error('❌ Backup cron error:', err.message);
        });
      }, { timezone: 'Asia/Kolkata' });

      console.log(`✅ Daily DB backup scheduled — runs at 11:55 PM IST every night`);
    } catch (cronErr) {
      console.error('⚠️  Could not start backup cron:', cronErr.message);
    }
  } else {
    console.log('ℹ️  Backup cron skipped — configure GOOGLE_DRIVE_BACKUP_FOLDER_ID in .env');
  }
  // ────────────────────────────────────────────────────────────────────────────

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
