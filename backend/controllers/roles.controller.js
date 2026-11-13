const roleModel = require('../models/role.model');
const { createRole, deleteRole, listRoles, updateRole } = require('../services/auth.service');

// The role with code "admin" is what makes a user Super Admin, so only a Super Admin may
// change it or give another role that code.
async function assertAdminRoleUntouched(actor, { roleId, code } = {}) {
  if (actor?.isSuperAdmin) return;
  const deny = () => {
    const error = new Error('Only a Super Admin can change the Super Admin role');
    error.statusCode = 403;
    throw error;
  };
  if (code && String(code).trim().toLowerCase().replace(/\s+/g, '-') === 'admin') deny();
  if (roleId) {
    const role = await roleModel.findById(roleId);
    if (String(role?.code || '').toLowerCase() === 'admin') deny();
  }
}

// Deleting the "admin" role, renaming its code or switching it off would take Super Admin away
// from everyone at once, so not even a Super Admin may do that.
async function assertAdminRoleKept(roleId, body = null) {
  const role = await roleModel.findById(roleId);
  if (String(role?.code || '').toLowerCase() !== 'admin') return;
  const refuse = (message) => {
    const error = new Error(message);
    error.statusCode = 409;
    throw error;
  };
  if (!body) refuse('The Super Admin role cannot be deleted');
  if (body.code && String(body.code).trim().toLowerCase() !== 'admin') refuse('The Super Admin role code cannot be changed');
  if (body.isActive === false || body.isActive === 'false') refuse('The Super Admin role cannot be switched off');
}

async function listController(req, res, next) {
  try {
    const rows = await listRoles(req.query.search || '');
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function getController(req, res, next) {
  try {
    const role = await roleModel.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    res.json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
}

async function createController(req, res, next) {
  try {
    await assertAdminRoleUntouched(req.user, { code: req.body?.code || req.body?.name });
    const result = await createRole(req.body || {}, { grantedBy: req.user?.id || null });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function updateController(req, res, next) {
  try {
    await assertAdminRoleUntouched(req.user, { roleId: req.params.id, code: req.body?.code });
    await assertAdminRoleKept(req.params.id, req.body || {});
    const result = await updateRole(req.params.id, req.body || {}, { grantedBy: req.user?.id || null });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function deleteController(req, res, next) {
  try {
    await assertAdminRoleUntouched(req.user, { roleId: req.params.id });
    await assertAdminRoleKept(req.params.id);
    const ok = await deleteRole(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Role not found' });
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
  updateController
};
