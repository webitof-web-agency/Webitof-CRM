const express = require('express');
const controller = require('../controllers/reports.controller');
const { requirePermission } = require('../middlewares/auth');

const router = express.Router();

router.get('/dashboard', requirePermission('reports.view'), controller.dashboardSummary);
router.get('/profit-loss', requirePermission('reports.view'), controller.profitLoss);
router.get('/gst', requirePermission('reports.view'), controller.gstSummary);
router.get('/pending-payables', requirePermission('reports.view'), controller.pendingPayables);
router.get('/ca-audit', requirePermission('reports.view'), controller.caAudit);
router.get('/payroll', requirePermission('reports.view'), controller.payrollSummary);
router.get('/renewals', requirePermission('reports.view'), controller.renewalDashboard);

module.exports = router;
