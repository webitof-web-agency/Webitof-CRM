const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'projects',
  idPrefix: 'project',
  columns: [
    column({ key: 'clientId', db: 'client_id' }),
    column({ key: 'title', db: 'title' }),
    column({ key: 'projectType', db: 'project_type' }),
    column({ key: 'value', db: 'value', type: 'number' }),
    column({ key: 'startDate', db: 'start_date', type: 'date' }),
    column({ key: 'deadline', db: 'deadline', type: 'date' }),
    column({ key: 'status', db: 'status' }),
    column({ key: 'billingType', db: 'billing_type' }),
    column({ key: 'costEstimate', db: 'cost_estimate', type: 'number' }),
    column({ key: 'notes', db: 'notes' }),
    column({ key: 'labels', db: 'labels', type: 'json' })
  ],
  searchColumns: ['title', 'project_type', 'status']
});
