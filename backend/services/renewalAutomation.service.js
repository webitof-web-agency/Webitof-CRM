const renewalModel = require('../models/renewal.model');
const clientModel = require('../models/client.model');
const workflowAutomationLogModel = require('../models/workflowAutomationLog.model');
const { createId, round2, toNumber } = require('../utils/format');
const { resolveSmtpConfig, sendMail } = require('./mailer.service');

function normalizeDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  return text ? text.slice(0, 10) : null;
}

function addDays(dateValue, days = 0) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function daysUntil(dateValue, fromDate = new Date()) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  const base = new Date(fromDate);
  if (Number.isNaN(target.getTime()) || Number.isNaN(base.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  base.setHours(0, 0, 0, 0);
  return Math.ceil((target - base) / (1000 * 60 * 60 * 24));
}

function getRenewalTitle(record = {}) {
  return String(
    record.title
    || record.domainName
    || record.hostingName
    || record.packageName
    || record.softwareName
    || record.category
    || 'Renewal'
  ).trim();
}

function getRenewalDueDate(record = {}) {
  return normalizeDate(record.reminderDate || record.renewalDate || record.expiryDate);
}

function getRenewalReminderDays(record = {}) {
  return Math.max(1, toNumber(record.reminderDays ?? record.payload?.reminderDays ?? 30, 30));
}

function summarizeRenewal(record = {}) {
  const dueDate = getRenewalDueDate(record);
  const daysRemaining = dueDate ? daysUntil(dueDate) : null;
  const reminderDays = getRenewalReminderDays(record);
  const baseStatus = String(record.status || 'Pending').trim() || 'Pending';
  const renewalStatus = ['Renewed', 'Cancelled'].includes(baseStatus)
    ? baseStatus
    : daysRemaining == null
      ? baseStatus
      : daysRemaining < 0
        ? 'Expired'
        : daysRemaining <= reminderDays
          ? 'Due Soon'
          : 'Upcoming';

  return {
    ...record,
    title: getRenewalTitle(record),
    renewalDate: normalizeDate(record.renewalDate),
    expiryDate: normalizeDate(record.expiryDate),
    reminderDate: normalizeDate(record.reminderDate),
    dueDate,
    daysRemaining,
    reminderDays,
    autoRenewal: Boolean(record.autoRenewal),
    status: baseStatus,
    renewalStatus,
    alertState: renewalStatus === 'Expired'
      ? 'Expired'
      : renewalStatus === 'Due Soon'
        ? 'Alert'
        : record.autoRenewal
          ? 'Auto Renewal'
          : 'Manual'
  };
}

async function recordLog(entry = {}) {
  if (!entry.moduleName || !entry.entityId || !entry.runId || !entry.action) return null;
  try {
    return await workflowAutomationLogModel.create({
      id: createId('wflog'),
      moduleName: entry.moduleName,
      entityId: entry.entityId,
      runId: entry.runId,
      runSource: entry.runSource || 'manual',
      action: entry.action,
      status: entry.status || 'Success',
      dueDate: entry.dueDate || null,
      referenceId: entry.referenceId || null,
      referenceName: entry.referenceName || '',
      message: entry.message || '',
      payload: entry.payload || {}
    });
  } catch (error) {
    console.error('[Renewals] Failed to write automation log:', error.message);
    return null;
  }
}

async function sendRenewalReminder({ renewal, client, dueDate }) {
  const smtp = await resolveSmtpConfig();
  if (!smtp) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  const recipient = String(client?.email || '').trim();
  if (!recipient) {
    return { sent: false, reason: 'Client email missing' };
  }

  const title = getRenewalTitle(renewal);
  const amount = Number(renewal.renewalPrice || renewal.renewalCost || renewal.clientCharge || renewal.purchasePrice || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const subject = `Renewal reminder: ${title}${dueDate ? ` due on ${dueDate}` : ''}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <p>Hello ${client.companyName || client.name || 'Client'},</p>
      <p>This is a renewal reminder for <strong>${title}</strong>${dueDate ? ` due on <strong>${dueDate}</strong>` : ''}.</p>
      <p>Estimated amount: <strong>Rs. ${amount}</strong></p>
      ${renewal.remarks ? `<p>Notes: ${String(renewal.remarks)}</p>` : ''}
      <p>Please review the renewal timeline and take action if needed.</p>
    </div>
  `;

  await sendMail({
    to: recipient,
    subject,
    html,
    text: `Renewal reminder for ${title}${dueDate ? ` due on ${dueDate}` : ''}. Estimated amount: Rs. ${amount}.`
  });

  return { sent: true, reason: '' };
}

function getLatestRunSummary(logs = []) {
  if (!logs.length) {
    return {
      runId: null,
      runSource: null,
      startedAt: null,
      remindersSent: 0,
      alertsSent: 0,
      skipped: 0,
      failures: 0,
      events: 0,
      affectedRecords: 0
    };
  }

  const latestRunId = logs[0]?.runId || null;
  const latestRunLogs = latestRunId ? logs.filter((item) => item.runId === latestRunId) : [];
  const remindersSent = latestRunLogs.filter((item) => item.action === 'reminder_sent').length;
  const alertsSent = latestRunLogs.filter((item) => ['due_soon_alert', 'expired_alert'].includes(item.action)).length;
  const skipped = latestRunLogs.filter((item) => item.action === 'skipped').length;
  const failures = latestRunLogs.filter((item) => String(item.status || '').trim() === 'Error' || String(item.action || '').includes('failed')).length;
  const affectedRecords = new Set(latestRunLogs.map((item) => item.entityId).filter(Boolean)).size;

  return {
    runId: latestRunId,
    runSource: latestRunLogs[0]?.runSource || null,
    startedAt: latestRunLogs[0]?.createdAt || null,
    remindersSent,
    alertsSent,
    skipped,
    failures,
    events: latestRunLogs.length,
    affectedRecords
  };
}

async function buildRenewalAutomationSummary() {
  const [renewals, logs] = await Promise.all([
    renewalModel.list({ orderBy: 'renewal_date ASC NULLS LAST, created_at ASC' }),
    workflowAutomationLogModel.list({ where: { moduleName: 'renewals' }, orderBy: 'created_at DESC' })
  ]);

  const summaryRows = renewals.map(summarizeRenewal);
  const dueSoon = summaryRows.filter((item) => item.renewalStatus === 'Due Soon').length;
  const overdue = summaryRows.filter((item) => item.renewalStatus === 'Expired').length;
  const autoRenewalEnabled = summaryRows.filter((item) => item.autoRenewal).length;
  const manualOnly = summaryRows.filter((item) => !item.autoRenewal).length;

  return {
    ...getLatestRunSummary(logs),
    total: summaryRows.length,
    dueSoon,
    overdue,
    autoRenewalEnabled,
    manualOnly,
    rows: summaryRows.slice(0, 25)
  };
}

async function runRenewalAutomation({ dryRun = false, runSource = 'manual' } = {}) {
  const [renewals, clients] = await Promise.all([
    renewalModel.list({ orderBy: 'renewal_date ASC NULLS LAST, created_at ASC' }),
    clientModel.list({ orderBy: 'created_at ASC' })
  ]);

  const clientMap = new Map(clients.map((item) => [String(item.id), item]));
  const today = normalizeDate(new Date()) || new Date().toISOString().slice(0, 10);
  const runId = createId('renewrun');
  const results = [];
  let remindersSent = 0;
  let alertsSent = 0;
  let skipped = 0;
  let failures = 0;

  for (const renewal of renewals) {
    const dueDate = getRenewalDueDate(renewal);
    const reminderDays = getRenewalReminderDays(renewal);
    const daysRemaining = dueDate ? daysUntil(dueDate, today) : null;
    const client = renewal.clientId ? clientMap.get(String(renewal.clientId)) || null : null;
    const baseStatus = String(renewal.status || 'Pending').trim() || 'Pending';
    const computedStatus = ['Renewed', 'Cancelled'].includes(baseStatus)
      ? baseStatus
      : daysRemaining == null
        ? baseStatus
        : daysRemaining < 0
          ? 'Expired'
          : daysRemaining <= reminderDays
            ? 'Due Soon'
            : 'Upcoming';
    const reminderAlreadySent = normalizeDate(renewal.lastReminderSentForDate) === dueDate;
    const wantsReminder = computedStatus === 'Due Soon' || computedStatus === 'Expired';
    const title = getRenewalTitle(renewal);
    const result = {
      renewalId: renewal.id,
      title,
      dueDate,
      daysRemaining,
      status: computedStatus,
      reminderSent: false,
      warnings: []
    };

    if (baseStatus === 'Cancelled') {
      skipped += 1;
      results.push(result);
      if (!dryRun) {
        await recordLog({
          moduleName: 'renewals',
          entityId: renewal.id,
          runId,
          runSource,
          action: 'skipped',
          status: 'Warning',
          dueDate,
          referenceName: title,
          message: 'Renewal cancelled',
          payload: { reason: 'Cancelled' }
        });
      }
      continue;
    }

    if (wantsReminder && !reminderAlreadySent) {
      alertsSent += 1;
      if (!dryRun) {
        try {
          const reminderResult = await sendRenewalReminder({ renewal, client, dueDate });
          if (reminderResult.sent) {
            remindersSent += 1;
            result.reminderSent = true;
            await recordLog({
              moduleName: 'renewals',
              entityId: renewal.id,
              runId,
              runSource,
              action: 'reminder_sent',
              status: 'Success',
              dueDate,
              referenceName: title,
              message: `Renewal reminder sent for ${dueDate || 'next due date'}`,
              payload: { dueDate, reminderDays, clientId: renewal.clientId }
            });
          } else {
            failures += 1;
            result.warnings.push(reminderResult.reason);
            await recordLog({
              moduleName: 'renewals',
              entityId: renewal.id,
              runId,
              runSource,
              action: 'reminder_failed',
              status: 'Warning',
              dueDate,
              referenceName: title,
              message: reminderResult.reason || 'Reminder skipped',
              payload: { dueDate, reminderDays, clientId: renewal.clientId }
            });
          }
        } catch (error) {
          failures += 1;
          result.warnings.push(`Reminder failed: ${error.message}`);
          await recordLog({
            moduleName: 'renewals',
            entityId: renewal.id,
            runId,
            runSource,
            action: 'reminder_failed',
            status: 'Error',
            dueDate,
            referenceName: title,
            message: error.message,
            payload: { dueDate, reminderDays, clientId: renewal.clientId }
          });
        }
      } else {
        result.reminderSent = true;
      }
    } else if (computedStatus === 'Upcoming') {
      if (!dryRun) {
        await recordLog({
          moduleName: 'renewals',
          entityId: renewal.id,
          runId,
          runSource,
          action: 'checked',
          status: 'Success',
          dueDate,
          referenceName: title,
          message: 'Renewal checked and not yet due',
          payload: { dueDate, reminderDays }
        });
      }
    }

    if (computedStatus === 'Expired' && !reminderAlreadySent) {
      alertsSent += 1;
      if (!dryRun) {
        await recordLog({
          moduleName: 'renewals',
          entityId: renewal.id,
          runId,
          runSource,
          action: 'expired_alert',
          status: 'Warning',
          dueDate,
          referenceName: title,
          message: 'Renewal is expired',
          payload: { dueDate, reminderDays, daysRemaining }
        });
      }
    }

    if (dryRun) {
      result.reminderSent = wantsReminder && !reminderAlreadySent;
    } else {
      const patch = {
        lastAutomationRunAt: new Date().toISOString(),
        status: computedStatus,
        lastReminderSentAt: result.reminderSent ? new Date().toISOString() : renewal.lastReminderSentAt || null,
        lastReminderSentForDate: result.reminderSent ? dueDate : renewal.lastReminderSentForDate || null
      };
      await renewalModel.update(renewal.id, patch);
    }

    if (!result.reminderSent && result.warnings.length === 0 && computedStatus === baseStatus) {
      skipped += 1;
    }

    results.push(result);
  }

  return {
    success: true,
    runId,
    runSource,
    today,
    remindersSent,
    alertsSent,
    skipped,
    failures,
    count: renewals.length,
    results
  };
}

function scheduleRenewalAutomation({ schedule = process.env.RENEWAL_AUTOMATION_CRON || '20 9 * * *', timezone = 'Asia/Kolkata' } = {}) {
  const cron = require('node-cron');
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid renewal automation cron schedule: ${schedule}`);
  }

  return cron.schedule(schedule, () => {
    console.log('\n[Renewals] Scheduled automation triggered...');
    runRenewalAutomation({ runSource: 'cron' })
      .then((result) => {
        console.log(`[Renewals] Automation complete. reminders=${result.remindersSent}, alerts=${result.alertsSent}, skipped=${result.skipped}`);
      })
      .catch((error) => {
        console.error('[Renewals] Automation failed:', error.message);
      });
  }, { timezone });
}

module.exports = {
  buildRenewalAutomationSummary,
  runRenewalAutomation,
  scheduleRenewalAutomation,
  summarizeRenewal
};
