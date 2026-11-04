import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Landing page per role: employees without CRM dashboard access start on their HRM workday.
export function homePath(user) {
  const has = (code) => Boolean(user?.isSuperAdmin || user?.permissions?.includes(code));
  if (has('dashboard.view')) return '/app/dashboard';
  if (has('hrm.self_service')) return '/app/hrm/my-day';
  if (['hrm.view_own', 'hrm.view_team', 'hrm.view_projects', 'hrm.view_all'].some(has)) return '/app/hrm/overview';
  return '/app/dashboard';
}

export function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={homePath(user)} replace />;
}
