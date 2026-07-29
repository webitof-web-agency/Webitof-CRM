export function normalizeRoleIds(roles = []) {
  return roles.map((role) => role.id).filter(Boolean);
}

export function normalizePermissionIds(permissions = []) {
  return permissions.map((permission) => permission.id).filter(Boolean);
}

export function mapUserForForm(user = {}) {
  return {
    ...user,
    roleIds: normalizeRoleIds(user.roles || []),
    allowedLeadPipelineIds: Array.isArray(user.allowedLeadPipelineIds)
      ? user.allowedLeadPipelineIds
      : Array.isArray(user.payload?.allowedLeadPipelineIds)
        ? user.payload.allowedLeadPipelineIds
        : []
  };
}

export function mapRoleForForm(role = {}) {
  return {
    ...role,
    permissionIds: normalizePermissionIds(role.permissions || [])
  };
}

export function groupPermissionsByModule(permissions = []) {
  const grouped = permissions.reduce((acc, permission) => {
    const key = permission.module || 'general';
    if (!acc[key]) acc[key] = [];
    acc[key].push(permission);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([module, items]) => ({
      module,
      items: items.sort((a, b) => String(a.action || '').localeCompare(String(b.action || ''), undefined, { numeric: true, sensitivity: 'base' }))
    }))
    .sort((a, b) => String(a.module).localeCompare(String(b.module), undefined, { numeric: true, sensitivity: 'base' }));
}

export function formatPermissionLabel(permission = {}) {
  return [permission.module, permission.action].filter(Boolean).join('.');
}
