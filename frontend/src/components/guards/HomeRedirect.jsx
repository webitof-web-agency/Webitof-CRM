import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canOpenHrm, hasEmployeeProfile } from '../../lib/hrmAccess';

// Landing page per role: employees without CRM dashboard access start on their HRM workday.
export function homePath(user) {
  const has = (code) => Boolean(user?.isSuperAdmin || user?.permissions?.includes(code));
  if (has('dashboard.view')) return '/app/dashboard';
  if (has('hrm.self_service') && hasEmployeeProfile(user)) return '/app/hrm/my-day';
  if (canOpenHrm(user)) return '/app/hrm/overview';
  return '/app/dashboard';
}

export function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={homePath(user)} replace />;
}
