const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'workflow_automation_logs',
  idPrefix: 'wflog',
  columns: [
    column({ key: 'moduleName', db: 'module_name' }),
    column({ key: 'entityId', db: 'entity_id' }),
    column({ key: 'runId', db: 'run_id' }),
    column({ key: 'runSource', db: 'run_source' }),
    column({ key: 'action', db: 'action' }),
    column({ key: 'status', db: 'status' }),
    column({ key: 'dueDate', db: 'due_date', type: 'date' }),
    column({ key: 'referenceId', db: 'reference_id' }),
    column({ key: 'referenceName', db: 'reference_name' }),
    column({ key: 'message', db: 'message' }),
    column({ key: 'payload', db: 'payload', type: 'json' })
  ],
  searchColumns: ['module_name', 'action', 'status', 'reference_name', 'message', 'run_source']
});
