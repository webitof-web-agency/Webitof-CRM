// Records worked by a Super Admin stay with Super Admins: a lead or client assigned to an admin,
// a follow-up assigned to an admin, or a call an admin made is hidden from everyone else (CTO and
// Sales Manager included) unless that person is on the record themselves.
// user.adminUserIds comes from the access profile and is empty for Super Admins.

function hiddenAdminIds(user) {
  if (!user || user.isSuperAdmin) return [];
  return Array.isArray(user.adminUserIds) ? user.adminUserIds.map(String) : [];
}

function isAdminOwned(user, ownerIds = []) {
  const admins = hiddenAdminIds(user);
  if (!admins.length) return false;
  return ownerIds.some((id) => id && admins.includes(String(id).trim()));
}

module.exports = { hiddenAdminIds, isAdminOwned };
