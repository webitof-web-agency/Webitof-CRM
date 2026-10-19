const express = require('express');
const leadsRoutes = require('./leads.routes');
const leadPipelinesRoutes = require('./leadPipelines.routes');
const leadContactsRoutes = require('./leadContacts.routes');
const leadEventsRoutes = require('./leadEvents.routes');
const eventsRoutes = require('./events.routes');
const clientContactsRoutes = require('./clientContacts.routes');
const clientsRoutes = require('./clients.routes');
const projectsRoutes = require('./projects.routes');
const invoicesRoutes = require('./invoices.routes');
const paymentsRoutes = require('./payments.routes');
const expensesRoutes = require('./expenses.routes');
const outsourcingRoutes = require('./outsourcing.routes');
const leadCommissionsRoutes = require('./leadCommissions.routes');
const bankingRoutes = require('./banking.routes');
const financeRoutes = require('./finance.routes');
const amcRoutes = require('./amc.routes');
const renewalsRoutes = require('./renewals.routes');
const mastersRoutes = require('./masters.routes');
const settingsRoutes = require('./settings.routes');
const reportsRoutes = require('./reports.routes');
const filesRoutes = require('./files.routes');
const notificationsRoutes = require('./notifications.routes');
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const rolesRoutes = require('./roles.routes');
const permissionsRoutes = require('./permissions.routes');
const followUpsRoutes = require('./followUps.routes');
const followUpConfigRoutes = require('./followUpConfig.routes');
const callLogsRoutes = require('./callLogs.routes');
const callLogsController = require('../controllers/callLogs.controller');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Webitof CRM API is running',
    timestamp: new Date().toISOString()
  });
});

const filesController = require('../controllers/files.controller');
const googleDriveController = require('../controllers/googleDrive.controller');
const { requirePermission } = require('../middlewares/auth');

// File ids are random 128-bit values, so these links work in <img>/<audio> without a session.
router.get('/files/:id/view', filesController.viewFile);
router.get('/files/drive/:driveFileId/view', filesController.viewLegacyDriveFile);
// Google redirects the browser here; the signed OAuth state is what authorizes it.
router.get('/google-drive/oauth/callback', googleDriveController.oauthCallback);

router.use('/auth', authRoutes);

// Public routes (no auth required)
const invoicesPublicRouter = express.Router();
const invoicesController = require('../controllers/invoices.controller');
invoicesPublicRouter.get('/public/:id', invoicesController.getPublic);
router.use('/invoices', invoicesPublicRouter);
const settingsController = require('../controllers/settings.controller');
router.get('/settings/public', settingsController.fetchPublicSettings);
// Public audio playback routes so HTML5 <audio> players and downloads load seamlessly
router.get('/call-logs/recordings/:filename', callLogsController.streamRecording);
router.get('/call-logs/recordings/:filename/download', callLogsController.downloadRecording);
router.get('/calls/recordings/:filename', callLogsController.streamRecording);

router.use(requireAuth);
router.use('/call-logs', callLogsRoutes);
router.use('/calls', callLogsRoutes);
router.use('/hrm', require('./hrm.routes'));
router.use('/events', eventsRoutes);
router.use('/leads', leadsRoutes);
router.use('/lead-pipelines', leadPipelinesRoutes);
router.use('/lead-contacts', leadContactsRoutes);
router.use('/lead-events', leadEventsRoutes);
router.use('/client-contacts', clientContactsRoutes);
router.use('/clients', clientsRoutes);
router.use('/projects', projectsRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/payments', paymentsRoutes);
router.use('/expenses', expensesRoutes);
router.use('/outsourcing', outsourcingRoutes);
router.use('/lead-commissions', leadCommissionsRoutes);
router.use('/banking', bankingRoutes);
router.use('/finance', financeRoutes);
router.use('/amc', amcRoutes);
router.use('/renewals', renewalsRoutes);
router.use('/masters', mastersRoutes);
router.use('/settings', settingsRoutes);
router.use('/reports', reportsRoutes);
router.use('/files', filesRoutes);
router.use('/google-drive', require('./googleDrive.routes'));
router.get('/backup/download', requirePermission('settings.write'), googleDriveController.downloadLocalBackup);
router.use('/notifications', notificationsRoutes);
router.use('/users', usersRoutes);
router.use('/roles', rolesRoutes);
router.use('/permissions', permissionsRoutes);
router.use('/follow-ups', followUpsRoutes);
router.use('/follow-up-templates', followUpConfigRoutes.templates);
router.use('/follow-up-sequences', followUpConfigRoutes.sequences);
router.use('/follow-up-automation-rules', followUpConfigRoutes.automationRules);
router.use('/follow-up-escalation-rules', followUpConfigRoutes.escalationRules);

module.exports = router;
