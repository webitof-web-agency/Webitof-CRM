import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { ResourceForm } from '../components/forms/ResourceForm';
import { ConfirmDialog } from '../components/overlays/ConfirmDialog';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { mapUserForForm } from '../lib/rbac';
import { sortRows } from '../lib/resource';

const userFields = [
  { name: 'fullName', label: 'Full Name', type: 'text', required: true },
  { name: 'username', label: 'Username', type: 'text', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone', type: 'phone', placeholder: '+91 98765 43210' },
  { name: 'address', label: 'Address', type: 'textarea', rows: 3, placeholder: 'Address' },
  { name: 'gender', label: 'Gender', type: 'radio', options: ['Male', 'Female', 'Other'], defaultValue: 'Other' },
  { name: 'salary', label: 'Salary', type: 'money', description: 'Monthly salary used for office expense tracking.' },
  { name: 'password', label: 'Password', type: 'password', description: 'Leave blank while editing if you do not want to change it.' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  { name: 'roleIds', label: 'Roles', type: 'multiselect' }
];

function formatRoleNames(roles = []) {
  return roles.map((role) => role.name).filter(Boolean).join(', ') || '-';
}

export function UsersPage() {
  const { token, hasPermission } = useAuth();
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('updatedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 250);
  const canCreate = hasPermission('users.manage');
  const canEdit = hasPermission('users.manage');
  const canDelete = hasPermission('users.manage');

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const [usersResponse, rolesResponse] = await Promise.all([
          api.resources.list('/users', token, debouncedSearch),
          api.resources.list('/roles', token)
        ]);
        if (!mounted) return;
        setRows(usersResponse.data || []);
        setRoles(rolesResponse.data || []);
      } catch (error) {
        if (!mounted) return;
        toast.error(error.message || 'Unable to load users');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [debouncedSearch, reloadTick, token]);

  const formRows = useMemo(() => rows.map(mapUserForForm), [rows]);
  const sortedRows = useMemo(() => sortRows(formRows, sortKey, sortDirection), [formRows, sortDirection, sortKey]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((row) => row.isActive).length;
    const admins = rows.filter((row) => row.roles?.some((role) => role.code === 'admin')).length;
    const inactive = total - active;
    return { total, active, admins, inactive };
  }, [rows]);

  function openCreate() {
    setActiveRecord(null);
    setEditorOpen(true);
  }

  function openEdit(record) {
    setActiveRecord(mapUserForForm(record));
    setEditorOpen(true);
  }

  async function saveRecord(payload) {
    setBusy(true);
    try {
      const response = activeRecord
        ? await api.resources.update('/users', activeRecord.id, payload, token)
        : await api.resources.create('/users', payload, token);
      toast.success(activeRecord ? 'User updated' : 'User created');
      setRows((current) => {
        const next = activeRecord ? current.map((item) => (item.id === response.data.id ? response.data : item)) : [response.data, ...current];
        return next;
      });
      setEditorOpen(false);
      setActiveRecord(null);
      setReloadTick((value) => value + 1);
    } catch (error) {
      toast.error(error.message || 'Unable to save user');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.resources.remove('/users', deleteTarget.id, token);
      toast.success('User deleted');
      setRows((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error.message || 'Unable to delete user');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Manage Users"
        description="Create users, assign RBAC roles, and reset access without leaving the CRM."
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'secondary', onClick: () => setReloadTick((value) => value + 1) },
          ...(canCreate ? [{ label: 'Add User', icon: Plus, onClick: openCreate }] : [])
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Users" value={loading ? '...' : String(stats.total)} helper="All accounts" icon={Users} />
        <StatCard title="Active" value={loading ? '...' : String(stats.active)} helper="Enabled logins" icon={Users} tone="positive" />
        <StatCard title="Admins" value={loading ? '...' : String(stats.admins)} helper="Admin role mapped" icon={Users} />
        <StatCard title="Inactive" value={loading ? '...' : String(stats.inactive)} helper="Disabled accounts" icon={Users} tone="negative" />
      </div>

      <Card className="space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Search users</label>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, username, or email" />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--text-muted)]">
            {rows.length} matching users
          </div>
        </div>

        <DataTable
          loading={loading}
          columns={[
            { key: 'fullName', label: 'Name' },
            { key: 'username', label: 'Username' },
            { key: 'email', label: 'Email' },
            { key: 'salary', label: 'Salary', type: 'money', align: 'right' },
            { key: 'roles', label: 'Roles', render: (row) => formatRoleNames(row.roles) },
            { key: 'lastLoginAt', label: 'Last Login', type: 'date' },
            { key: 'isActive', label: 'Status', type: 'badge' }
          ]}
          rows={sortedRows}
          selectable={canDelete}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={(key, direction) => {
            setSortKey(key);
            setSortDirection(direction);
          }}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          onCreate={canCreate ? openCreate : undefined}
          createLabel="Add User"
          rowActions={
            canEdit || canDelete
              ? (row) => (
                  <div className="flex items-center justify-end gap-2">
                    {canEdit ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteTarget(row)}>
                        Delete
                      </Button>
                    ) : null}
                  </div>
                )
              : undefined
          }
        />
      </Card>

      <Modal
        open={editorOpen}
        title={`${activeRecord ? 'Edit' : 'Add'} User`}
        subtitle=""
        onClose={() => {
          setEditorOpen(false);
          setActiveRecord(null);
        }}
        width="min(1120px, 96vw)"
        hideHeader
      >
        <ResourceForm
          key={`user:${activeRecord?.id || 'new'}`}
          fields={userFields}
          record={activeRecord}
          lookups={{ roles }}
          onSubmit={saveRecord}
          onCancel={() => {
            setEditorOpen(false);
            setActiveRecord(null);
          }}
          submitLabel={activeRecord ? 'Update User' : 'Create User'}
          busy={busy}
          labelPlacement="left"
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete user"
        description={`This will permanently remove ${deleteTarget?.fullName || deleteTarget?.username || 'the selected user'}.`}
        confirmLabel={busy ? 'Deleting...' : 'Delete'}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
}
