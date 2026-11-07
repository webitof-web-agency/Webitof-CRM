const express = require('express');
const controller = require('../controllers/creditNotes.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

// Credit notes belong to invoices, so they use the invoice permissions: read to view, write to raise or cancel.
router.get('/', requirePermission('invoices.read'), controller.list);
router.get('/:id', requirePermission('invoices.read'), controller.getById);
router.post('/', requirePermission('invoices.write'), controller.create);
router.post('/:id/cancel', requirePermission('invoices.write'), controller.cancel);

module.exports = router;
