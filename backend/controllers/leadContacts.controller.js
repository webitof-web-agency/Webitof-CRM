const { createCrudController } = require('./crudController');
const leadContactModel = require('../models/leadContact.model');

module.exports = createCrudController(leadContactModel, {
  defaultOrder: 'updated_at DESC'
});
