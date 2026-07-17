import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AccessDeniedPage } from '../../pages/AccessDeniedPage';

export function PermissionRoute({ permission, children }) {
  const { token, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--text-muted)]">
        Loading session...
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <AccessDeniedPage requiredPermission={permission} />;
  }

  return children;
}
