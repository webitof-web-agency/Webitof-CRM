const express = require('express');
const maintenance = require('../services/maintenance.service');
const { requireAuth, requirePermission } = require('../middlewares/auth');

const router = express.Router();

// Public: the maintenance screen polls this, logged in or not. No user details.
router.get('/status', (req, res) => {
  res.json({ success: true, data: maintenance.publicState() });
});

// Leave maintenance after an interrupted or failed restore has been checked.
router.post('/clear', requireAuth, requirePermission('backups.restore'), (req, res, next) => {
  try {
    maintenance.clear(req.user);
    console.log(`Maintenance cleared by ${req.user.id}`);
    res.json({ success: true, data: maintenance.publicState() });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
