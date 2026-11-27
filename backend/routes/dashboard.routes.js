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
    res.json({ success: true, data: await businessDashboard(req.user) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
