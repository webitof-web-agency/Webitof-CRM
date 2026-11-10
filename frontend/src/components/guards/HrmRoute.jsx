import { Link } from 'react-router-dom';
import { UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canOpenHrm } from '../../lib/hrmAccess';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { PermissionRoute } from './PermissionRoute';

// HRM permissions alone are not enough for own-records access: the login also needs an
// employee profile, otherwise every HRM page would be empty.
export function HrmRoute({ children }) {
  const { user } = useAuth();
  return (
    <PermissionRoute permissions={['hrm.view_own', 'hrm.view_team', 'hrm.view_projects', 'hrm.view_all']}>
      {canOpenHrm(user) ? children : <NoEmployeeProfile />}
    </PermissionRoute>
  );
}

function NoEmployeeProfile() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--text-muted)]">
          <UserX size={26} />
        </div>
        <h1 className="mt-5 text-lg font-bold text-[var(--text-main)]">No employee profile yet</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          HRM opens once HR creates your employee profile and links it to this login.
        </p>
        <div className="mt-6 flex justify-center">
          <Button as={Link} to="/app">Go to home</Button>
        </div>
      </Card>
    </div>
  );
}
