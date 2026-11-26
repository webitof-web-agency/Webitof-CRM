const express = require('express');
const controller = require('../controllers/settings.controller');
const storageController = require('../controllers/storageSettings.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/storage', requirePermission('settings.read'), storageController.get);
router.put('/storage', requirePermission('settings.write'), storageController.update);
router.post('/storage/test', requirePermission('settings.write'), storageController.test);
router.get('/email', requirePermission('settings.read'), controller.fetchEmailStatus);
router.post('/email/test', requirePermission('settings.write'), controller.sendEmailTest);
// Lead/client/project/invoice/payment pages need statuses, labels, templates and company details
// from here; settings hold no secrets (SMTP logins are env-only), so module readers may load it.
router.get(
  '/',
  requirePermission('settings.read', 'leads.read', 'clients.read', 'projects.read', 'invoices.read', 'payments.read'),
  controller.fetchSettings
);
router.put('/', requirePermission('settings.write'), controller.saveSettings);

module.exports = router;
