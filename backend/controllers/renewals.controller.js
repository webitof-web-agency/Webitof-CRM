const { createCrudController } = require('./crudController');
const renewalModel = require('../models/renewal.model');

module.exports = createCrudController(renewalModel, {
  defaultOrder: 'renewal_date ASC NULLS LAST'
});
