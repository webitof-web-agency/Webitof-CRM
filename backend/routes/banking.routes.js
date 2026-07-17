const express = require('express');
const { bankAccountsController, bankTransactionsController } = require('../controllers/banking.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/accounts', requirePermission('banking.read'), bankAccountsController.list);
router.post('/accounts', requirePermission('banking.write'), bankAccountsController.create);
router.get('/accounts/:id', requirePermission('banking.read'), bankAccountsController.getById);
router.put('/accounts/:id', requirePermission('banking.write'), bankAccountsController.update);
router.delete('/accounts/:id', requirePermission('banking.delete'), bankAccountsController.remove);

router.get('/transactions', requirePermission('banking.read'), bankTransactionsController.list);
router.post('/transactions', requirePermission('banking.write'), bankTransactionsController.create);
router.get('/transactions/:id', requirePermission('banking.read'), bankTransactionsController.getById);
router.put('/transactions/:id', requirePermission('banking.write'), bankTransactionsController.update);
router.delete('/transactions/:id', requirePermission('banking.delete'), bankTransactionsController.remove);

module.exports = router;
