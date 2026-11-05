// Outsourcing reminders must not repeat every day: one approval alert per record, one due/overdue
// email per due date, none once overdue past the grace limit. Mail, settings and the database are stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');

const mailer = require('../services/mailer.service');
const sent = [];
mailer.resolveSmtpConfig = async () => ({ host: 'stub' });
mailer.sendMail = async (mail) => { sent.push(mail); };

const outsourcingModel = require('../models/outsourcingExpense.model');
const masterItemModel = require('../models/masterItem.model');
const logModel = require('../models/workflowAutomationLog.model');
const settingsModel = require('../models/settings.model');

settingsModel.getSettings = async () => ({ company: { email: 'finance@example.test' }, invoice: {} });
masterItemModel.listByType = async () => [];
logModel.create = async () => ({});

const { businessDate } = require('../utils/format');
const { runOutsourcingAutomation } = require('../services/outsourcingAutomation.service');

function dayOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return businessDate(date);
}

// Keeps a stored copy of the record, like the database would between runs.
function useRecords(records) {
  const store = new Map(records.map((record) => [record.id, { ...record }]));
  outsourcingModel.list = async () => [...store.values()].map((record) => ({ ...record }));
  outsourcingModel.update = async (id, patch) => { store.set(id, { ...store.get(id), ...patch }); };
  return store;
}

test('an unpaid payable sends one reminder per due date, not one per run', async () => {
  sent.length = 0;
  useRecords([{ id: 'o1', title: 'Hosting', approvalStatus: 'Approved', paymentStatus: 'Pending', dueDate: dayOffset(2), reminderDays: 7, totalAmount: 1000 }]);
  await runOutsourcingAutomation();
  await runOutsourcingAutomation();
  await runOutsourcingAutomation();
  assert.equal(sent.length, 1);
});

test('a pending approval alerts finance once', async () => {
  sent.length = 0;
  useRecords([{ id: 'o2', title: 'Design work', approvalStatus: 'Pending', paymentStatus: 'Paid', dueDate: dayOffset(30), reminderDays: 7 }]);
  await runOutsourcingAutomation();
  await runOutsourcingAutomation();
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /approval pending/i);
});

test('payables overdue past the grace limit stop sending emails', async () => {
  sent.length = 0;
  useRecords([{ id: 'o3', title: 'Old invoice', approvalStatus: 'Approved', paymentStatus: 'Pending', dueDate: dayOffset(-90), reminderDays: 7 }]);
  const result = await runOutsourcingAutomation();
  assert.equal(sent.length, 0);
  assert.match(result.results[0].warnings.join(' '), /limit/);
});

test('record text is escaped in the email body', async () => {
  sent.length = 0;
  useRecords([{ id: 'o4', title: '<script>alert(1)</script>', approvalStatus: 'Approved', paymentStatus: 'Pending', dueDate: dayOffset(1), reminderDays: 7, vendorName: '<b>Vendor</b>' }]);
  await runOutsourcingAutomation();
  assert.equal(sent.length, 1);
  assert.ok(!sent[0].html.includes('<script>'));
  assert.ok(!sent[0].html.includes('<b>Vendor</b>'));
  assert.match(sent[0].html, /&lt;b&gt;Vendor&lt;\/b&gt;/);
});
