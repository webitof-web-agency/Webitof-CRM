const userModel = require('../models/user.model');
const { createUser, deleteUser, listUsers, updateUser } = require('../services/auth.service');

async function listController(req, res, next) {
  try {
    const rows = await listUsers(req.query.search || '');
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function lookupController(req, res, next) {
  try {
    const rows = await listUsers(req.query.search || '');
    const data = rows
      .filter((user) => user?.isActive !== false)
      .map((user) => ({
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        phone: user.phone,
        address: user.address,
        gender: user.gender,
        isActive: user.isActive,
        roles: user.roles || []
      }));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getController(req, res, next) {
  try {
    const { getUserAccessProfile } = require('../services/auth.service');
    const user = await getUserAccessProfile(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

async function createController(req, res, next) {
  try {
    const result = await createUser(req.body || {}, { assignedBy: req.user?.id || null });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function updateController(req, res, next) {
  try {
    const result = await updateUser(req.params.id, req.body || {}, { assignedBy: req.user?.id || null });
    if (!result) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function deleteController(req, res, next) {
  try {
    const ok = await deleteUser(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createController,
  deleteController,
  getController,
  listController,
  lookupController,
  updateController
};
