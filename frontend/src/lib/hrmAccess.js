// HRM is useful to two kinds of users: people who look after others (team, project or
// company-wide access) and employees looking at their own records. Own-record access means
// nothing until an employee profile is linked to the login, so it is hidden until then.
const WIDE_HRM_PERMISSIONS = ['hrm.view_team', 'hrm.view_projects', 'hrm.view_all'];

// hrmEmployeeId is undefined on a session cached before the field existed; treat that as
// unknown and keep the old behaviour until /auth/me refreshes it.
export function hasEmployeeProfile(user) {
  return user?.hrmEmployeeId !== null;
}

export function canOpenHrm(user) {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  if (WIDE_HRM_PERMISSIONS.some((code) => permissions.includes(code))) return true;
  return permissions.includes('hrm.view_own') && hasEmployeeProfile(user);
}
