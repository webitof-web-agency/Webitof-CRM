const userModel = require('../models/user.model');
const { query } = require('../config/db');
const { createUser, deleteUser, findRoleByCode, getUserAccessProfile, listUsers, updateUser } = require('../services/auth.service');

// users.manage alone must not create, promote, edit or remove a Super Admin: that would let
// any user manager take over the admin account (reset its password) or grant themselves admin.
async function assertCanManageAdmins(actor, { roleIds, targetUserId } = {}) {
  if (actor?.isSuperAdmin) return;
  const deny = () => {
    const error = new Error('Only a Super Admin can manage Super Admin accounts');
    error.statusCode = 403;
    throw error;
  };
  if (Array.isArray(roleIds) && roleIds.length) {
    const adminRole = await findRoleByCode('admin');
    if (adminRole && roleIds.map(String).includes(String(adminRole.id))) deny();
  }
  if (targetUserId) {
    const target = await getUserAccessProfile(targetUserId);
    if (target?.isSuperAdmin) deny();
  }
}

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
    await assertCanManageAdmins(req.user, { roleIds: req.body?.roleIds });
    const result = await createUser(req.body || {}, { assignedBy: req.user?.id || null });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// The system must always keep one active Super Admin, or nobody can manage users and roles again.
// A user also cannot switch off their own login (the next request would lock them out mid-session).
async function assertKeepsASuperAdmin(actor, targetUserId, body = {}) {
  const deactivating = body.isActive === false || body.isActive === 'false';
  if (deactivating && String(targetUserId) === String(actor?.id)) {
    const error = new Error('You cannot deactivate your own account');
    error.statusCode = 400;
    throw error;
  }
  const target = await getUserAccessProfile(targetUserId);
  if (!target?.isSuperAdmin || !target.isActive) return;
  let losesAdmin = deactivating;
  if (!losesAdmin && Array.isArray(body.roleIds)) {
    const adminRole = await findRoleByCode('admin');
    losesAdmin = Boolean(adminRole) && !body.roleIds.map(String).includes(String(adminRole.id));
  }
  if (!losesAdmin) return;
  const result = await query(
    `select count(distinct u.id)::int as others
       from users u join user_roles ur on ur.user_id = u.id join roles r on r.id = ur.role_id
      where r.code = 'admin' and u.is_active = true and u.id <> $1`,
    [String(target.id)]
  );
  if (!result.rows[0]?.others) {
    const error = new Error('This is the only active Super Admin. Make another user Super Admin first.');
    error.statusCode = 409;
    throw error;
  }
}

async function updateController(req, res, next) {
  try {
    await assertCanManageAdmins(req.user, { roleIds: req.body?.roleIds, targetUserId: req.params.id });
    await assertKeepsASuperAdmin(req.user, req.params.id, req.body || {});
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
    if (String(req.params.id) === String(req.user?.id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }
    await assertCanManageAdmins(req.user, { targetUserId: req.params.id });
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
