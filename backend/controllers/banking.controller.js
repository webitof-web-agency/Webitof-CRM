const { createCrudController } = require('./crudController');
const bankAccountModel = require('../models/bankAccount.model');
const bankTransactionModel = require('../models/bankTransaction.model');

const bankAccountsController = createCrudController(bankAccountModel, {
  defaultOrder: 'updated_at DESC'
});

const bankTransactionsController = createCrudController(bankTransactionModel, {
  defaultOrder: 'date DESC'
});

module.exports = {
  bankAccountsController,
  bankTransactionsController
};
