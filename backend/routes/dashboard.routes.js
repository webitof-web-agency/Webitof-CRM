const express = require('express');
const { myDashboard } = require('../services/dashboard.service');
const { businessDashboard } = require('../services/businessDashboard.service');

const router = express.Router();

// The signed-in user's own dashboard. Each section checks its own permission inside the service.
router.get('/me', async (req, res, next) => {
  try {
    res.json({ success: true, data: await myDashboard(req.user) });
  } catch (error) {
    next(error);
  }
});

// Business overview: every block the user's role may see (everything for admins).
router.get('/business', async (req, res, next) => {
  try {
    res.json({ success: true, data: await businessDashboard(req.user, { period: String(req.query.period || 'month') }) });
  } catch (error) {
    next(error);
  }
});

// Monthly sales targets shown on the dashboard. Everyone who sees the targets block may read them;
// only admins change them.
const insights = require('../services/dashboardInsights.service');
const { _private: { isAdmin } } = require('../services/businessDashboard.service');
function adminOnly(req, res, next) {
  if (isAdmin(req.user)) return next();
  return res.status(403).json({ success: false, message: 'Only admins can do this' });
}
router.get('/targets', async (req, res, next) => {
  try {
    res.json({ success: true, data: await insights.getTargets() });
  } catch (error) {
    next(error);
  }
});
router.put('/targets', adminOnly, async (req, res, next) => {
  try {
    res.json({ success: true, data: await insights.saveTargets(req.body || {}), message: 'Targets saved' });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ success: false, message: error.message });
    next(error);
  }
});

// Send the morning summary email to the signed-in admin now (to preview it).
router.post('/digest/send', adminOnly, async (req, res, next) => {
  try {
    const result = await require('../services/dailyDigest.service').sendDigest({ users: [req.user], force: true });
    res.json({ success: true, data: result, message: result.sent ? `Summary sent to ${req.user.email}` : 'Could not send the summary' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
