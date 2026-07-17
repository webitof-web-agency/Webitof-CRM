const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'permissions',
  idPrefix: 'perm',
  columns: [
    column({ key: 'code', db: 'code' }),
    column({ key: 'name', db: 'name' }),
    column({ key: 'module', db: 'module' }),
    column({ key: 'action', db: 'action' }),
    column({ key: 'description', db: 'description' }),
    column({ key: 'isActive', db: 'is_active', type: 'boolean' })
  ],
  searchColumns: ['code', 'name', 'module', 'action']
});
