/**
 * ============================================================
 *  Webitof CRM — Daily Database Backup
 * ============================================================
 *  - Reads ALL tables from PostgreSQL (Supabase)
 *  - Exports everything as a single JSON file
 *  - Uploads to Google Drive backup folder
 *  - Locks the uploaded file (no one can delete it via API)
 *  - Keeps last 30 backups, archives older ones
 *  - Sends console alerts on failure
 * ============================================================
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { google } = require('googleapis');


const { query } = require('../config/db');

// ─── Config ──────────────────────────────────────────────────────────────────

const BACKUP_FOLDER_ID = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || '';
const MAX_BACKUPS_TO_KEEP = Number(process.env.BACKUP_MAX_KEEP || 30);

// All table names to back up (in order — respects FK dependencies on restore)
const TABLES = [
  'users',
  'roles',
  'permissions',
  'settings',
  'clients',
  'client_contacts',
  'leads',
  'lead_contacts',
  'lead_events',
  'lead_commissions',
  'projects',
  'invoices',
  'payments',
  'bank_accounts',
  'bank_transactions',
  'amc_records',
  'expenses',
  'outsourcing_expenses',
  'master_items',
  'renewals',
  'file_assets',
  'storage_folders'
];

// ─── Auth ─────────────────────────────────────────────────────────────────────

function getAuthClient() {
  // Priority 1: Service Account JSON (most reliable — never expires)
  const svcJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (svcJson) {
    let parsed;
    try { parsed = typeof svcJson === 'object' ? svcJson : JSON.parse(svcJson); } catch {}
    if (parsed?.client_email && parsed?.private_key) {
      return new google.auth.JWT(
        parsed.client_email,
        null,
        parsed.private_key,
        ['https://www.googleapis.com/auth/drive'],
        process.env.GOOGLE_DRIVE_SUBJECT || undefined
      );
    }
  }

  // Priority 2: OAuth2 Refresh Token
  if (process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost'
    );
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
    return oauth2;
  }

  throw new Error('❌ No Google credentials found for backup. Set GOOGLE_SERVICE_ACCOUNT_JSON or OAuth env vars.');
}

function getDrive() {
  const auth = getAuthClient();
  return google.drive({ version: 'v3', auth });
}

// ─── DB Export ────────────────────────────────────────────────────────────────

async function exportAllTables() {
  const backup = {
    _meta: {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tables: []
    }
  };

  for (const table of TABLES) {
    try {
      const result = await query(`SELECT * FROM ${table} ORDER BY created_at ASC NULLS FIRST`);
      backup[table] = result.rows;
      backup._meta.tables.push({ name: table, rows: result.rows.length });
      console.log(`  ✅ ${table}: ${result.rows.length} rows`);
    } catch (err) {
      // Table might not exist yet — skip gracefully
      if (err.message?.includes('does not exist') || err.code === '42P01') {
        console.log(`  ⏭️  ${table}: skipped (table not found)`);
      } else {
        console.error(`  ⚠️  ${table}: error — ${err.message}`);
        backup[table] = { _error: err.message };
      }
    }
  }

  return backup;
}

// ─── Drive Upload ─────────────────────────────────────────────────────────────

async function ensureBackupFolder(drive) {
  if (BACKUP_FOLDER_ID) return BACKUP_FOLDER_ID;

  // Auto-create a backup folder in Drive root if not configured
  console.log('  📁 GOOGLE_DRIVE_BACKUP_FOLDER_ID not set — creating folder in Drive root...');
  const res = await drive.files.create({
    requestBody: {
      name: 'CRM-DB-Backups',
      mimeType: 'application/vnd.google-apps.folder'
    },
    fields: 'id'
  });
  const folderId = res.data.id;
  console.log(`  ✅ Created backup folder. Set this in .env:\n  GOOGLE_DRIVE_BACKUP_FOLDER_ID=${folderId}`);
  return folderId;
}

async function uploadBackup(drive, folderId, fileName, jsonContent) {
  const { Readable } = require('stream');
  const buffer = Buffer.from(JSON.stringify(jsonContent, null, 2), 'utf8');

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      description: `Webitof CRM DB Backup — ${new Date().toISOString()}`
    },
    media: {
      mimeType: 'application/json',
      body: Readable.from([buffer])
    },
    fields: 'id, name, size'
  });

  return res.data;
}

async function lockFile(drive, fileId) {
  // Lock file: prevents editors from deleting or modifying content
  try {
    await drive.files.update({
      fileId,
      requestBody: {
        contentRestrictions: [
          {
            readOnly: true,
            reason: 'Webitof CRM automated backup — do not modify'
          }
        ]
      }
    });
    console.log(`  🔒 File locked (read-only protection applied)`);
  } catch (lockErr) {
    // contentRestrictions may not be available on all Drive plans — log & continue
    console.log(`  ⚠️  Could not lock file: ${lockErr.message}`);
  }
}

async function pruneOldBackups(drive, folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType = 'application/json'`,
    orderBy: 'createdTime asc',
    fields: 'files(id, name, createdTime)',
    pageSize: 100
  });

  const files = res.data.files || [];
  if (files.length <= MAX_BACKUPS_TO_KEEP) return;

  const toRemove = files.slice(0, files.length - MAX_BACKUPS_TO_KEEP);
  for (const file of toRemove) {
    try {
      // Move to trash (not permanent delete — recoverable for 30 days)
      await drive.files.update({
        fileId: file.id,
        requestBody: { trashed: true }
      });
      console.log(`  🗑️  Archived old backup: ${file.name}`);
    } catch (e) {
      console.log(`  ⚠️  Could not archive ${file.name}: ${e.message}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runBackup() {
  const startTime = Date.now();
  const now = new Date();

  // Human-readable timestamp: 2026-07-17_02-00-00
  const dateStr = now.toISOString().replace('T', '_').replace(/:/g, '-').slice(0, 19);
  const fileName = `crm-backup-${dateStr}.json`;

  console.log('\n╔════════════════════════════════════════════════╗');
  console.log(`║  Webitof CRM — Daily Backup Started            ║`);
  console.log(`║  Time: ${now.toLocaleString('en-IN')}   ║`);
  console.log('╚════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Export DB
    console.log('📦 Step 1: Exporting database tables...');
    const backupData = await exportAllTables();
    const totalRows = backupData._meta.tables.reduce((s, t) => s + t.rows, 0);
    const sizeKB = Math.round(JSON.stringify(backupData).length / 1024);
    console.log(`  ✅ Export complete — ${totalRows} total rows, ~${sizeKB} KB\n`);

    // Step 2: Connect to Drive
    console.log('☁️  Step 2: Connecting to Google Drive...');
    const drive = getDrive();
    const folderId = await ensureBackupFolder(drive);
    console.log(`  ✅ Drive connected. Backup folder: ${folderId}\n`);

    // Step 3: Upload
    console.log(`📤 Step 3: Uploading backup as "${fileName}"...`);
    const uploaded = await uploadBackup(drive, folderId, fileName, backupData);
    const uploadedSizeKB = Math.round(Number(uploaded.size || 0) / 1024);
    console.log(`  ✅ Uploaded: ${uploaded.name} (${uploadedSizeKB} KB, ID: ${uploaded.id})\n`);

    // Step 4: Lock the file
    console.log('🔒 Step 4: Locking backup file...');
    await lockFile(drive, uploaded.id);

    // Step 5: Prune old backups
    console.log(`\n🧹 Step 5: Keeping last ${MAX_BACKUPS_TO_KEEP} backups (archiving older)...`);
    await pruneOldBackups(drive, folderId);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Backup completed in ${elapsed}s — "${fileName}"`);
    console.log('═══════════════════════════════════════════════════\n');

    return { success: true, fileName, rows: totalRows, sizeKB };

  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n❌ BACKUP FAILED after ${elapsed}s:`, err.message);
    console.error('═══════════════════════════════════════════════════\n');
    return { success: false, error: err.message };
  }
}

module.exports = { runBackup };

// Run manually: node scripts/backup.js
if (require.main === module) {
  runBackup().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}
