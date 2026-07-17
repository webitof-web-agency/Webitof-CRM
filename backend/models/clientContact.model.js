const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'client_contacts',
  idPrefix: 'client-contact',
  columns: [
    column({ key: 'clientId', db: 'client_id' }),
    column({ key: 'firstName', db: 'first_name' }),
    column({ key: 'lastName', db: 'last_name' }),
    column({ key: 'email', db: 'email' }),
    column({ key: 'phone', db: 'phone' }),
    column({ key: 'jobTitle', db: 'job_title' }),
    column({ key: 'gender', db: 'gender' }),
    column({ key: 'notes', db: 'notes' }),
    column({ key: 'isPrimary', db: 'is_primary', type: 'boolean' })
  ],
  searchColumns: ['first_name', 'last_name', 'email', 'phone', 'job_title']
});
