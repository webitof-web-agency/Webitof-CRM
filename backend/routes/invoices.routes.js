const express = require('express');
const controller = require('../controllers/invoices.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

// Public route (no auth required) — must be before requireAuth middleware
router.get('/public/:id', controller.getPublic);

router.get('/', requirePermission('invoices.read'), controller.list);
router.get('/service-catalog', requirePermission('invoices.read'), controller.listServiceCatalog);
router.post('/', requirePermission('invoices.write'), controller.create);
router.get('/:id', requirePermission('invoices.read'), controller.getById);
router.put('/:id', requirePermission('invoices.write'), controller.update);
router.delete('/:id', requirePermission('invoices.delete'), controller.remove);
router.post('/:id/send-email', requirePermission('invoices.read'), controller.sendEmail);

module.exports = router;
