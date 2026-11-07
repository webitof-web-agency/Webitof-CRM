// Invoice numbers are handed out under a lock, from the numbers actually saved. Models and the transaction are stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../config/db');
const log = [];
const db = {
  async query(sql) {
    log.push(sql.replace(/\s+/g, ' ').trim());
    return { rows: [], rowCount: 0 };
  }
};
config.withTransaction = async (work) => work(db);

const invoiceModel = require('../models/invoice.model');
const clientModel = require('../models/client.model');
const paymentModel = require('../models/payment.model');
const settingsModel = require('../models/settings.model');
const masterItemModel = require('../models/masterItem.model');
const notifications = require('../services/notification.service');
const followUps = require('../services/followUpEngine.service');

let listCalls = 0;
let created = null;
invoiceModel.list = async () => {
  listCalls += 1;
  // The first read (while the request is being prepared) is stale; by the time the lock is held, INV-006 exists.
  return [{ invoiceNumber: listCalls === 1 ? 'INV-005' : 'INV-006' }];
};
invoiceModel.create = async (body) => {
  log.push('create');
  created = { id: 'inv_new', ...body };
  return created;
};
invoiceModel.findById = async () => created;
invoiceModel.update = async () => created;
clientModel.findById = async () => ({ id: 'c1', state: 'Delhi' });
masterItemModel.listByType = async () => []; // the service catalogue (rate locks) is not under test
paymentModel.list = async () => [];
settingsModel.getSettings = async () => ({ invoice: { prefix: 'INV' }, gst: {}, company: {} });
notifications.notifyBusinessEvent = async () => {};
followUps.ensureEntityFollowUp = async () => ({});
followUps.handleBusinessTrigger = async () => ({});

const controller = require('../controllers/invoices.controller');

function create(body) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, body: payload });
      }
    };
    controller.create(
      { user: { id: 'u1', permissions: ['invoices.write'] }, body: { clientId: 'c1', status: 'Draft', amountType: 'No Tax', items: [{ description: 'Work', quantity: 1, rate: 100 }], ...body } },
      res,
      reject
    );
  });
}

test.beforeEach(() => {
  log.length = 0;
  listCalls = 0;
  created = null;
});

test('the next number is worked out after the lock, from the numbers actually saved', async () => {
  const { status } = await create({});
  assert.equal(status, 201);
  const lockAt = log.findIndex((entry) => /pg_advisory_xact_lock\(hashtext\('webitof-invoice-number'\)\)/.test(entry));
  const createAt = log.indexOf('create');
  assert.ok(lockAt >= 0 && lockAt < createAt, 'the lock is taken before the invoice is saved');
  assert.equal(created.invoiceNumber, 'INV-007', 'not the stale INV-006 computed before the lock');
});

test('a number the user typed is kept as it is', async () => {
  const { status } = await create({ invoiceNumber: 'CUSTOM-9' });
  assert.equal(status, 201);
  assert.equal(created.invoiceNumber, 'CUSTOM-9');
  assert.ok(listCalls <= 1, 'no second sequence read inside the lock for a supplied number');
});
