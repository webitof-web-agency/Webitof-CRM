const outsourcingModel = require('../models/outsourcingExpense.model');
const masterItemModel = require('../models/masterItem.model');
const workflowAutomationLogModel = require('../models/workflowAutomationLog.model');
const { getSettings } = require('../models/settings.model');
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

function getOutsourcingTitle(record = {}) {
  return String(record.workType || record.vendorName || record.description || 'Outsourcing').trim();
}

function getOutsourcingDueDate(record = {}, settings = {}) {
  const defaultDueDays = toNumber(settings?.invoice?.defaultDueDays ?? 15, 15);
  return normalizeDate(record.dueDate || addDays(record.expenseDate || new Date(), defaultDueDays));
}

function getOutsourcingReminderDays(record = {}) {
  return Math.max(1, toNumber(record.reminderDays ?? record.payload?.reminderDays ?? 7, 7));
}

function summarizeOutsourcing(record = {}, settings = {}) {
  const dueDate = getOutsourcingDueDate(record, settings);
  const daysRemaining = dueDate ? daysUntil(dueDate) : null;
  const approvalStatus = String(record.approvalStatus || 'Pending').trim() || 'Pending';
  const paymentStatus = String(record.paymentStatus || 'Pending').trim() || 'Pending';
  const reminderDays = getOutsourcingReminderDays(record);
  const amount = round2(record.totalAmount || record.baseAmount || 0);

  return {
    ...record,
    title: getOutsourcingTitle(record),
    dueDate,
    daysRemaining,
    reminderDays,
    approvalStatus,
    paymentStatus,
    totalAmount: amount,
    alertState: approvalStatus === 'Pending'
      ? 'Pending Approval'
      : paymentStatus === 'Paid'
        ? 'Paid'
        : daysRemaining == null
          ? 'Open'
          : daysRemaining < 0
            ? 'Overdue'
            : daysRemaining <= reminderDays
              ? 'Due Soon'
              : 'Scheduled'
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
    console.error('[Outsourcing] Failed to write automation log:', error.message);
    return null;
  }
}

async function sendFinanceAlert({ subject, html, text }) {
  const smtp = await resolveSmtpConfig();
  const settings = await getSettings();
  const recipient = String(settings?.company?.email || '').trim();
  if (!smtp || !recipient) {
    return { sent: false, reason: !smtp ? 'SMTP not configured' : 'Company email missing' };
  }

  await sendMail({ to: recipient, subject, html, text });
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
  const remindersSent = latestRunLogs.filter((item) => ['approval_reminder_sent', 'payment_reminder_sent'].includes(item.action)).length;
  const alertsSent = latestRunLogs.filter((item) => ['approval_alert', 'due_alert', 'overdue_alert'].includes(item.action)).length;
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

async function buildOutsourcingAutomationSummary() {
  const [records, settings, logs] = await Promise.all([
    outsourcingModel.list({ orderBy: 'expense_date DESC, created_at DESC' }),
    getSettings(),
    workflowAutomationLogModel.list({ where: { moduleName: 'outsourcing' }, orderBy: 'created_at DESC' })
  ]);

  const summaryRows = records.map((record) => summarizeOutsourcing(record, settings || {}));
  const pendingApproval = summaryRows.filter((item) => item.approvalStatus === 'Pending').length;
  const dueSoon = summaryRows.filter((item) => item.paymentStatus !== 'Paid' && item.daysRemaining != null && item.daysRemaining <= item.reminderDays && item.daysRemaining >= 0).length;
  const overdue = summaryRows.filter((item) => item.paymentStatus !== 'Paid' && item.daysRemaining != null && item.daysRemaining < 0).length;
  const paid = summaryRows.filter((item) => item.paymentStatus === 'Paid').length;

  return {
    ...getLatestRunSummary(logs),
    total: summaryRows.length,
    pendingApproval,
    dueSoon,
    overdue,
    paid,
    rows: summaryRows.slice(0, 25)
  };
}

async function runOutsourcingAutomation({ dryRun = false, runSource = 'manual' } = {}) {
  const [records, settings, vendors] = await Promise.all([
    outsourcingModel.list({ orderBy: 'expense_date DESC, created_at DESC' }),
    getSettings(),
    masterItemModel.listByType('vendor')
  ]);

  const vendorMap = new Map(vendors.map((item) => [String(item.id), item]));
  const today = normalizeDate(new Date()) || new Date().toISOString().slice(0, 10);
  const runId = createId('outsrc');
  const results = [];
  let remindersSent = 0;
  let alertsSent = 0;
  let skipped = 0;
  let failures = 0;

  for (const record of records) {
    const dueDate = getOutsourcingDueDate(record, settings || {});
    const reminderDays = getOutsourcingReminderDays(record);
    const daysRemaining = dueDate ? daysUntil(dueDate, today) : null;
    const approvalStatus = String(record.approvalStatus || 'Pending').trim() || 'Pending';
    const paymentStatus = String(record.paymentStatus || 'Pending').trim() || 'Pending';
    const title = getOutsourcingTitle(record);
    const vendor = record.vendorId ? vendorMap.get(String(record.vendorId)) || null : null;
    const vendorEmail = String(vendor?.payload?.email || vendor?.payload?.contactEmail || '').trim();
    const result = {
      outsourcingId: record.id,
      title,
      dueDate,
      daysRemaining,
      approvalStatus,
      paymentStatus,
      reminderSent: false,
      warnings: []
    };

    if (approvalStatus === 'Pending') {
      alertsSent += 1;
      if (!dryRun) {
        const subject = `Outsourcing approval pending: ${title}`;
        const html = `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
            <p>Hello team,</p>
            <p>An outsourcing record <strong>${title}</strong> is waiting for approval.</p>
            <p>Amount: <strong>Rs. ${Number(record.totalAmount || record.baseAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
            <p>Vendor: <strong>${record.vendorName || vendor?.name || '-'}</strong></p>
          </div>
        `;
        const alertResult = await sendFinanceAlert({
          subject,
          html,
          text: `Outsourcing approval pending for ${title}.`
        });
        if (alertResult.sent) {
          await recordLog({
            moduleName: 'outsourcing',
            entityId: record.id,
            runId,
            runSource,
            action: 'approval_alert',
            status: 'Success',
            dueDate,
            referenceName: title,
            message: 'Approval alert sent to finance inbox',
            payload: { dueDate, vendorId: record.vendorId, vendorEmail }
          });
        } else {
          failures += 1;
          result.warnings.push(alertResult.reason);
          await recordLog({
            moduleName: 'outsourcing',
            entityId: record.id,
            runId,
            runSource,
            action: 'approval_alert_failed',
            status: 'Warning',
            dueDate,
            referenceName: title,
            message: alertResult.reason || 'Approval alert skipped',
            payload: { dueDate, vendorId: record.vendorId, vendorEmail }
          });
        }
      }
    }

    if (paymentStatus !== 'Paid' && dueDate && daysRemaining != null && daysRemaining <= reminderDays) {
      alertsSent += 1;
      const action = daysRemaining < 0 ? 'overdue_alert' : 'due_alert';
      if (!dryRun) {
        try {
          const reminderSubject = `Outsourcing payable ${daysRemaining < 0 ? 'overdue' : 'due soon'}: ${title}`;
          const reminderHtml = `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
              <p>Hello team,</p>
              <p>Outsourcing payable for <strong>${title}</strong> is ${daysRemaining < 0 ? 'overdue' : 'due soon'}.</p>
              <p>Due date: <strong>${dueDate}</strong></p>
              <p>Status: <strong>${paymentStatus}</strong></p>
              <p>Vendor: <strong>${record.vendorName || vendor?.name || '-'}</strong></p>
              <p>Amount: <strong>Rs. ${Number(record.totalAmount || record.baseAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
            </div>
          `;
          const reminderResult = await sendFinanceAlert({
            subject: reminderSubject,
            html: reminderHtml,
            text: `Outsourcing payable for ${title} is ${daysRemaining < 0 ? 'overdue' : 'due soon'}. Due date: ${dueDate}.`
          });
          if (reminderResult.sent) {
            remindersSent += 1;
            result.reminderSent = true;
            await recordLog({
              moduleName: 'outsourcing',
              entityId: record.id,
              runId,
              runSource,
              action,
              status: 'Success',
              dueDate,
              referenceName: title,
              message: `${action.replaceAll('_', ' ')} sent`,
              payload: { dueDate, reminderDays, vendorId: record.vendorId, vendorEmail }
            });
          } else {
            failures += 1;
            result.warnings.push(reminderResult.reason);
            await recordLog({
              moduleName: 'outsourcing',
              entityId: record.id,
              runId,
              runSource,
              action: `${action}_failed`,
              status: 'Warning',
              dueDate,
              referenceName: title,
              message: reminderResult.reason || 'Reminder skipped',
              payload: { dueDate, reminderDays, vendorId: record.vendorId, vendorEmail }
            });
          }
        } catch (error) {
          failures += 1;
          result.warnings.push(`Reminder failed: ${error.message}`);
          await recordLog({
            moduleName: 'outsourcing',
            entityId: record.id,
            runId,
            runSource,
            action: `${action}_failed`,
            status: 'Error',
            dueDate,
            referenceName: title,
            message: error.message,
            payload: { dueDate, reminderDays, vendorId: record.vendorId, vendorEmail }
          });
        }
      } else {
        result.reminderSent = true;
      }
    }

    if (approvalStatus !== 'Pending' && paymentStatus === 'Paid') {
      skipped += 1;
      if (!dryRun) {
        await recordLog({
          moduleName: 'outsourcing',
          entityId: record.id,
          runId,
          runSource,
          action: 'skipped',
          status: 'Success',
          dueDate,
          referenceName: title,
          message: 'Already approved and paid',
          payload: { dueDate, reminderDays, vendorId: record.vendorId, vendorEmail }
        });
      }
    }

    if (!dryRun) {
      await outsourcingModel.update(record.id, {
        lastAutomationRunAt: new Date().toISOString(),
        dueDate,
        reminderDays,
        approvalStatus,
        paymentStatus,
        lastReminderSentAt: result.reminderSent ? new Date().toISOString() : record.lastReminderSentAt || null,
        lastReminderSentForDate: result.reminderSent ? dueDate : record.lastReminderSentForDate || null
      });
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
    count: records.length,
    results
  };
}

function scheduleOutsourcingAutomation({ schedule = process.env.OUTSOURCING_AUTOMATION_CRON || '35 9 * * *', timezone = 'Asia/Kolkata' } = {}) {
  const cron = require('node-cron');
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid outsourcing automation cron schedule: ${schedule}`);
  }

  return cron.schedule(schedule, () => {
    console.log('\n[Outsourcing] Scheduled automation triggered...');
    runOutsourcingAutomation({ runSource: 'cron' })
      .then((result) => {
        console.log(`[Outsourcing] Automation complete. reminders=${result.remindersSent}, alerts=${result.alertsSent}, skipped=${result.skipped}`);
      })
      .catch((error) => {
        console.error('[Outsourcing] Automation failed:', error.message);
      });
  }, { timezone });
}

module.exports = {
  buildOutsourcingAutomationSummary,
  runOutsourcingAutomation,
  scheduleOutsourcingAutomation,
  summarizeOutsourcing
};
