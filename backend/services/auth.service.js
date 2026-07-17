const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomInt } = require('crypto');
const { createId, nowIso, toNumber } = require('../utils/format');
const { query, withTransaction } = require('../config/db');
const userModel = require('../models/user.model');
const roleModel = require('../models/role.model');
const permissionModel = require('../models/permission.model');
const { sendPasswordResetOtpEmail } = require('./mailer.service');
const { deleteFile } = require('./driveStorage.service');

const PASSWORD_RESET_OTP_MINUTES = Math.max(1, toNumber(process.env.PASSWORD_RESET_OTP_MINUTES, 10));
const PASSWORD_RESET_MAX_ATTEMPTS = Math.max(1, toNumber(process.env.PASSWORD_RESET_MAX_ATTEMPTS, 5));

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing in environment configuration.');
  }
  return process.env.JWT_SECRET;
}

function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '12h'
  });
}

async function hashPassword(password) {
  return bcrypt.hash(String(password), 10);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(String(password), String(hash || ''));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function generatePasswordResetOtp() {
  return String(randomInt(100000, 1000000));
}

function buildOtpExpiry() {
  return new Date(Date.now() + PASSWORD_RESET_OTP_MINUTES * 60 * 1000).toISOString();
}

function isExpired(value) {
  if (!value) return true;
  return new Date(value).getTime() <= Date.now();
}

async function findUserByLogin(identifier) {
  const value = String(identifier || '').trim().toLowerCase();
  const result = await query(
    `select * from users
     where lower(email) = $1 or lower(username) = $1
     limit 1`,
    [value]
  );
  return result.rows[0] ? userModel.hydrateRow(result.rows[0]) : null;
}

async function getUserRoles(userId) {
  const result = await query(
    `select r.*
     from roles r
     inner join user_roles ur on ur.role_id = r.id
     where ur.user_id = $1
     order by r.name asc`,
    [userId]
  );
  return result.rows.map((row) => roleModel.hydrateRow(row));
}

async function getRolePermissions(roleIds = []) {
  if (!roleIds.length) return [];
  const result = await query(
    `select distinct p.*
     from permissions p
     inner join role_permissions rp on rp.permission_id = p.id
     where rp.role_id = any($1::text[])
     order by p.module asc, p.action asc, p.name asc`,
    [roleIds]
  );
  return result.rows.map((row) => permissionModel.hydrateRow(row));
}

async function getUserAccessProfile(userId) {
  const user = await userModel.findById(userId);
  if (!user) return null;

  const roles = await getUserRoles(userId);
  const permissions = await getRolePermissions(roles.map((role) => role.id));
  const uniquePermissions = [...new Map(permissions.map((permission) => [permission.code, permission])).values()];
  const isSuperAdmin = roles.some((role) => role.code === 'admin');

  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    salary: user.salary,
    phone: user.phone,
    address: user.address,
    gender: user.gender,
    avatarUrl: user.avatarUrl,
    avatarFileId: user.avatarFileId,
    social: (user.payload && user.payload.social) ? user.payload.social : {},
    payload: user.payload || {},
    isActive: Boolean(user.isActive),
    lastLoginAt: user.lastLoginAt,
    roles: roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: Boolean(role.isSystem),
      isActive: Boolean(role.isActive)
    })),
    permissions: uniquePermissions.map((permission) => permission.code),
    permissionObjects: uniquePermissions.map((permission) => ({
      id: permission.id,
      code: permission.code,
      name: permission.name,
      module: permission.module,
      action: permission.action,
      description: permission.description
    })),
    isSuperAdmin
  };
}

async function getAuthProfileByLogin(identifier) {
  const user = await findUserByLogin(identifier);
  if (!user) return null;
  const access = await getUserAccessProfile(user.id);
  return access;
}

async function login({ identifier, password }) {
  const userRow = await findUserByLogin(identifier);
  if (!userRow) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }
  if (!userRow.isActive) {
    const error = new Error('User account is disabled');
    error.statusCode = 403;
    throw error;
  }
  const valid = await comparePassword(password, userRow.passwordHash);
  if (!valid) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  const tokenPayload = await getUserAccessProfile(userRow.id);
  await userModel.update(userRow.id, { lastLoginAt: nowIso() });
  const token = signToken({
    sub: userRow.id,
    uid: userRow.id,
    email: userRow.email,
    username: userRow.username
  });

  return {
    token,
    user: tokenPayload
  };
}

async function createPasswordResetRequest(identifier, meta = {}) {
  const user = await findUserByLogin(identifier);
  if (!user) {
    return { message: 'If the account exists, an OTP has been sent to the registered email address.' };
  }

  await query('delete from password_reset_tokens where user_id = $1 and used_at is null', [user.id]);

  const otp = generatePasswordResetOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = buildOtpExpiry();
  const tokenId = createId('reset');

  await query(
    `insert into password_reset_tokens
      (id, user_id, otp_hash, expires_at, requested_from_ip, requested_user_agent, payload)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      tokenId,
      user.id,
      otpHash,
      expiresAt,
      meta.ip || null,
      meta.userAgent || null,
      JSON.stringify({ identifier: normalizeEmail(identifier) || normalizeUsername(identifier) })
    ]
  );

  try {
    await sendPasswordResetOtpEmail({
      name: user.fullName,
      otp,
      minutes: PASSWORD_RESET_OTP_MINUTES,
      to: user.email
    });
  } catch (error) {
    await query('delete from password_reset_tokens where id = $1', [tokenId]);
    throw error;
  }

  return { message: 'If the account exists, an OTP has been sent to the registered email address.' };
}

async function resetPasswordWithOtp({ identifier, otp, password }, meta = {}) {
  const user = await findUserByLogin(identifier);
  if (!user) {
    const error = new Error('Invalid OTP or expired request');
    error.statusCode = 400;
    throw error;
  }

  const tokenResult = await query(
    `select *
     from password_reset_tokens
     where user_id = $1 and used_at is null
     order by created_at desc
     limit 1`,
    [user.id]
  );
  const token = tokenResult.rows[0];
  if (!token || isExpired(token.expires_at)) {
    if (token?.id) {
      await query('delete from password_reset_tokens where id = $1', [token.id]);
    }
    const error = new Error('Invalid OTP or expired request');
    error.statusCode = 400;
    throw error;
  }

  const normalizedOtp = String(otp || '').trim();
  const valid = await bcrypt.compare(normalizedOtp, token.otp_hash);
  if (!valid) {
    const attempts = Number(token.attempts || 0) + 1;
    await query(
      `update password_reset_tokens
       set attempts = $2,
           updated_at = now()
       where id = $1`,
      [token.id, attempts]
    );

    if (attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
      await query('delete from password_reset_tokens where id = $1', [token.id]);
    }

    const error = new Error('Invalid OTP or expired request');
    error.statusCode = 400;
    throw error;
  }

  if (!password || String(password).trim().length < 8) {
    const error = new Error('Password must be at least 8 characters long');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await hashPassword(password);
  await withTransaction(async (client) => {
    await userModel.update(user.id, { passwordHash }, client);
    await client.query(
      `update password_reset_tokens
       set used_at = now(),
           updated_at = now()
       where id = $1`,
      [token.id]
    );
    await client.query('delete from password_reset_tokens where user_id = $1 and id <> $2', [user.id, token.id]);
  });

  return {
    message: 'Password reset successfully',
    updatedAt: meta.requestedAt || nowIso()
  };
}

async function syncUserRoles(client, userId, roleIds = [], assignedBy = null) {
  await client.query('delete from user_roles where user_id = $1', [userId]);
  const uniqueRoleIds = [...new Set((roleIds || []).filter(Boolean))];
  for (const roleId of uniqueRoleIds) {
    await client.query(
      `insert into user_roles (user_id, role_id, assigned_by)
       values ($1, $2, $3)
       on conflict (user_id, role_id) do nothing`,
      [userId, roleId, assignedBy]
    );
  }
}

async function syncRolePermissions(client, roleId, permissionIds = [], grantedBy = null) {
  await client.query('delete from role_permissions where role_id = $1', [roleId]);
  const uniquePermissionIds = [...new Set((permissionIds || []).filter(Boolean))];
  for (const permissionId of uniquePermissionIds) {
    await client.query(
      `insert into role_permissions (role_id, permission_id, granted_by)
       values ($1, $2, $3)
       on conflict (role_id, permission_id) do nothing`,
      [roleId, permissionId, grantedBy]
    );
  }
}

async function createUser(data = {}, meta = {}) {
  return withTransaction(async (client) => {
    const passwordHash = await hashPassword(data.password || data.passwordHash || data.tempPassword || 'ChangeMe123!');
    const user = await userModel.create({
      fullName: data.fullName || data.full_name || data.name,
      username: normalizeUsername(data.username || data.email),
      email: normalizeEmail(data.email || data.username),
      salary: data.salary,
      phone: data.phone,
      address: data.address,
      gender: data.gender,
      passwordHash,
      isActive: data.isActive !== false,
      payload: data.payload || {}
    }, client);

    await syncUserRoles(client, user.id, data.roleIds || [], meta.assignedBy || null);
    return getUserAccessProfile(user.id);
  });
}

async function updateUser(userId, data = {}, meta = {}) {
  return withTransaction(async (client) => {
    // Fetch current user to merge payload
    const currentUser = await userModel.findById(userId, client);
    const currentPayload = (currentUser && currentUser.payload) ? currentUser.payload : {};

    // Merge social into payload
    const newPayload = Object.keys(data).includes('social')
      ? { ...currentPayload, social: data.social || {} }
      : currentPayload;

    const patch = {
      fullName: data.fullName || data.full_name || data.name,
      username: data.username ? normalizeUsername(data.username) : undefined,
      email: data.email ? normalizeEmail(data.email) : undefined,
      salary: data.salary,
      phone: data.phone,
      address: data.address,
      gender: data.gender,
      avatarUrl: data.avatarUrl,
      avatarFileId: data.avatarFileId,
      isActive: data.isActive,
      payload: Object.keys(newPayload).length ? newPayload : undefined
    };
    if (data.password || data.tempPassword) {
      patch.passwordHash = await hashPassword(data.password || data.tempPassword);
    }

    Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);
    await userModel.update(userId, patch, client);

    if (currentUser?.avatarFileId && data.avatarFileId && String(currentUser.avatarFileId) !== String(data.avatarFileId)) {
      await deleteFile(currentUser.avatarFileId);
    }

    if (Array.isArray(data.roleIds)) {
      await syncUserRoles(client, userId, data.roleIds, meta.assignedBy || null);
    }

    return getUserAccessProfile(userId);
  });
}

async function deleteUser(userId) {
  return userModel.remove(userId);
}

async function createRole(data = {}, meta = {}) {
  return withTransaction(async (client) => {
    const role = await roleModel.create({
      code: String(data.code || data.name || '').trim().toLowerCase().replace(/\s+/g, '-'),
      name: data.name,
      description: data.description || '',
      isSystem: Boolean(data.isSystem),
      isActive: data.isActive !== false,
      payload: data.payload || {}
    }, client);

    await syncRolePermissions(client, role.id, data.permissionIds || [], meta.grantedBy || null);
    return getRoleById(role.id, client);
  });
}

async function updateRole(roleId, data = {}, meta = {}) {
  return withTransaction(async (client) => {
    const patch = {
      code: data.code ? String(data.code).trim().toLowerCase().replace(/\s+/g, '-') : undefined,
      name: data.name,
      description: data.description,
      isSystem: data.isSystem,
      isActive: data.isActive,
      payload: data.payload
    };
    Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);
    await roleModel.update(roleId, patch, client);

    if (Array.isArray(data.permissionIds)) {
      await syncRolePermissions(client, roleId, data.permissionIds, meta.grantedBy || null);
    }

    return getRoleById(roleId, client);
  });
}

async function deleteRole(roleId) {
  return roleModel.remove(roleId);
}

async function getRoleById(roleId, dbClient = null) {
  const role = await roleModel.findById(roleId, dbClient);
  if (!role) return null;
  const exec = dbClient?.query || query;
  const result = await exec.call(dbClient || null,
    `select p.*
     from permissions p
     inner join role_permissions rp on rp.permission_id = p.id
     where rp.role_id = $1
     order by p.module asc, p.action asc, p.name asc`,
    [roleId]
  );
  const permissions = result.rows.map((row) => permissionModel.hydrateRow(row));
  return {
    ...role,
    permissionIds: permissions.map((permission) => permission.id),
    permissions
  };
}

async function listUsers(search = '') {
  const result = await query(
    `select u.*
     from users u
     where ($1 = '' or lower(u.full_name) like $2 or lower(u.username) like $2 or lower(u.email) like $2)
     order by u.updated_at desc`,
    [String(search || '').trim(), `%${String(search || '').trim().toLowerCase()}%`]
  );

  const users = result.rows.map((row) => userModel.hydrateRow(row));
  const enriched = [];
  for (const user of users) {
    enriched.push(await getUserAccessProfile(user.id));
  }
  return enriched;
}

async function listRoles(search = '') {
  const roles = await roleModel.list({ search });
  const enriched = [];
  for (const role of roles) {
    enriched.push(await getRoleById(role.id));
  }
  return enriched;
}

async function listPermissions() {
  return permissionModel.list();
}

async function findRoleByCode(code) {
  const result = await query('select * from roles where code = $1 limit 1', [String(code || '').trim().toLowerCase()]);
  return result.rows[0] ? roleModel.hydrateRow(result.rows[0]) : null;
}

async function findPermissionByCode(code) {
  const result = await query('select * from permissions where code = $1 limit 1', [String(code || '').trim().toLowerCase()]);
  return result.rows[0] ? permissionModel.hydrateRow(result.rows[0]) : null;
}

async function seedRolePermissions(roleId, permissionCodes = []) {
  const client = await withTransaction(async (tx) => {
    const normalizedCodes = permissionCodes
      .map((code) => String(code || '').trim().toLowerCase())
      .filter(Boolean);
    const result = await tx.query(
      `select id
       from permissions
       where code = any($1::text[])`,
      [normalizedCodes]
    );
    const permissionIds = result.rows.map((row) => row.id);
    await syncRolePermissions(tx, roleId, permissionIds, null);
    return true;
  });
  return client;
}

module.exports = {
  comparePassword,
  createPasswordResetRequest,
  createRole,
  createUser,
  deleteRole,
  deleteUser,
  findPermissionByCode,
  findRoleByCode,
  getAuthProfileByLogin,
  getRoleById,
  getUserAccessProfile,
  hashPassword,
  listPermissions,
  listRoles,
  listUsers,
  login,
  seedRolePermissions,
  signToken,
  syncRolePermissions,
  syncUserRoles,
  resetPasswordWithOtp,
  updateRole,
  updateUser
};
