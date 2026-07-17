const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'lead_contacts',
  idPrefix: 'lead-contact',
  columns: [
    column({ key: 'leadId', db: 'lead_id' }),
    column({ key: 'firstName', db: 'first_name' }),
    column({ key: 'lastName', db: 'last_name' }),
    column({ key: 'email', db: 'email' }),
    column({ key: 'phone', db: 'phone' }),
    column({ key: 'jobTitle', db: 'job_title' }),
    column({ key: 'gender', db: 'gender' }),
    column({ key: 'notes', db: 'notes' })
  ],
  searchColumns: ['first_name', 'last_name', 'email', 'phone', 'job_title']
});
