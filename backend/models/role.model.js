const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'roles',
  idPrefix: 'role',
  columns: [
    column({ key: 'code', db: 'code' }),
    column({ key: 'name', db: 'name' }),
    column({ key: 'description', db: 'description' }),
    column({ key: 'isSystem', db: 'is_system', type: 'boolean' }),
    column({ key: 'isActive', db: 'is_active', type: 'boolean' })
  ],
  searchColumns: ['code', 'name', 'description']
});
