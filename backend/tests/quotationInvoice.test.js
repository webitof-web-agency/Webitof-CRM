const test = require('node:test');
const assert = require('node:assert/strict');
const { buildQuotationInvoiceDraft, getQuotationSnapshot } = require('../services/quotationInvoice.service');

const settings = {
  company: { state: 'Chhattisgarh', country: 'India', gstin: '22AAAAA0000A1Z5' },
  gst: { gstRegistered: true, autoDetectTax: true, defaultRate: 18, lutEnabled: false }
};

const client = {
  id: 'client-1',
  state: 'Chhattisgarh',
  country: 'India',
  gstin: '22BBBBB0000B1Z5'
};

test('quotation snapshot reads structured discount and GST fields', () => {
  const snapshot = getQuotationSnapshot({
    title: 'Web quotation',
    eventType: 'quotation',
    description: [
      'Service: Website Development, Website AMC',
      'Amount: 10000',
      'Discount Type: percent',
      'Discount Value: 10',
      'GST Applicable: Yes',
      'GST Rate: 18',
      'Status: Approved'
    ].join('\n')
  }, {}, settings);

  assert.deepEqual(snapshot.serviceNames, ['Website Development', 'Website AMC']);
  assert.equal(snapshot.discountValue, 10);
  assert.equal(snapshot.gstApplicable, true);
  assert.equal(snapshot.status, 'Approved');
});

test('approved quotation becomes a multi-service invoice with discount and GST', () => {
  const draft = buildQuotationInvoiceDraft({
    quotation: {
      title: 'Web quotation',
      serviceNames: ['Website Development', 'Website AMC'],
      amount: 10000,
      discountType: 'percent',
      discountValue: 10,
      gstApplicable: true,
      gstRate: 18,
      status: 'Approved'
    },
    lead: {},
    client,
    services: [
      { id: 'service-web', name: 'Website Development', unit: 'Nos', sacCode: '998314' },
      { id: 'service-amc', name: 'Website AMC', unit: 'Nos', sacCode: '998313' }
    ],
    settings,
    invoiceDate: '2026-07-31',
    dueDate: '2026-08-15'
  });

  assert.equal(draft.items.length, 2);
  assert.equal(draft.items[0].rate, 5000);
  assert.equal(draft.items[1].rate, 5000);
  assert.equal(draft.discountAmount, 1000);
  assert.equal(draft.taxableAmount, 9000);
  assert.equal(draft.gstAmount, 1620);
  assert.equal(draft.totalAmount, 10620);
  assert.equal(draft.amountType, 'GST Extra');
});

test('quotation can create a no-tax invoice with a flat discount', () => {
  const draft = buildQuotationInvoiceDraft({
    quotation: {
      title: 'Support quotation',
      serviceNames: ['Support'],
      amount: 5000,
      discountType: 'flat',
      discountValue: 500,
      gstApplicable: false,
      gstRate: 0,
      status: 'Approved'
    },
    lead: {},
    client,
    services: [],
    settings,
    invoiceDate: '2026-07-31',
    dueDate: '2026-08-15'
  });

  assert.equal(draft.discountAmount, 500);
  assert.equal(draft.gstAmount, 0);
  assert.equal(draft.totalAmount, 4500);
  assert.equal(draft.amountType, 'No Tax');
});

test('itemized quotation preserves primary and add-on rates in the invoice', () => {
  const event = {
    title: 'E-commerce proposal',
    serviceNames: ['E-commerce Website Development', 'WhatsApp Business API Integration'],
    amount: 120000,
    discountType: 'percent',
    discountValue: 0,
    gstApplicable: false,
    gstRate: 0,
    status: 'Approved',
    items: [
      { serviceId: 'svc-ecommerce', name: 'E-commerce Website Development', qty: 1, rate: 95000, amount: 95000 },
      { serviceId: 'svc-whatsapp', name: 'WhatsApp Business API Integration', qty: 1, rate: 25000, amount: 25000, isAddon: true }
    ]
  };
  const snapshot = getQuotationSnapshot(event, {}, settings);
  const draft = buildQuotationInvoiceDraft({
    quotation: snapshot,
    lead: {},
    client,
    services: [
      { id: 'svc-ecommerce', name: 'E-commerce Website Development', unit: 'Project', sacCode: '998314' },
      { id: 'svc-whatsapp', name: 'WhatsApp Business API Integration', unit: 'Project', sacCode: '998314' }
    ],
    settings,
    invoiceDate: '2026-10-09',
    dueDate: '2026-10-24'
  });

  assert.equal(snapshot.items.length, 2);
  assert.equal(draft.items.length, 2);
  assert.equal(draft.items[0].rate, 95000);
  assert.equal(draft.items[1].rate, 25000);
  assert.equal(draft.totalAmount, 120000);
});
