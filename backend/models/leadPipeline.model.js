const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'lead_pipelines',
  idPrefix: 'pipe',
  columns: [
    column({ key: 'name', db: 'name' }),
    column({ key: 'code', db: 'code' }),
    column({ key: 'description', db: 'description' }),
    column({ key: 'color', db: 'color' }),
    column({ key: 'sortOrder', db: 'sort_order', type: 'number' }),
    column({ key: 'isActive', db: 'is_active', type: 'boolean' })
  ],
  searchColumns: ['name', 'code', 'description']
});
