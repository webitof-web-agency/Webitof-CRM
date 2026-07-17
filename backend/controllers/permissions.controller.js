const permissionModel = require('../models/permission.model');

async function listController(req, res, next) {
  try {
    const rows = await permissionModel.list({ search: req.query.search || '' });
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listController
};
