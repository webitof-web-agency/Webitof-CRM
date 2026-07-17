const { createCrudController } = require('./crudController');
const amcModel = require('../models/amc.model');

module.exports = createCrudController(amcModel, {
  defaultOrder: 'updated_at DESC'
});
