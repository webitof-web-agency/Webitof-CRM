const express = require('express');
const controller = require('../controllers/finance.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/summary', requirePermission('reports.view'), controller.summary);
router.get('/ledger', requirePermission('reports.view'), controller.ledger);
router.get('/reconciliation', requirePermission('reports.view'), controller.reconciliation);

module.exports = router;
