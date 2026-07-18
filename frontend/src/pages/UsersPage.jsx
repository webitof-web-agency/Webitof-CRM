import { useEffect, useMemo, useState } from 'react';
import { Plus, Users, Search, Edit2, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { ResourceForm } from '../components/forms/ResourceForm';
import { ConfirmDialog } from '../components/overlays/ConfirmDialog';
import { UserAvatar } from '../components/ui/UserAvatar';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
        const filteredUsers = (usersResponse.data || []).filter(u => u.email !== 'admin@webitof.com');
        setRows(filteredUsers);
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)]">Manage Users</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Create users, assign RBAC roles, and reset access without leaving the CRM.</p>
        </div>
        <div className="flex items-center gap-3">
          {canCreate ? (
            <Button onClick={openCreate} className="gap-2">
              <Plus size={16} />
              Add User
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Users', value: stats.total, helper: 'All accounts', bg: 'bg-blue-50/80 text-blue-500' },
          { label: 'Active', value: stats.active, helper: 'Enabled logins', bg: 'bg-emerald-50/80 text-emerald-500' },
          { label: 'Admins', value: stats.admins, helper: 'Admin role mapped', bg: 'bg-purple-50/80 text-purple-500' },
          { label: 'Inactive', value: stats.inactive, helper: 'Disabled accounts', bg: 'bg-rose-50/80 text-rose-500' }
        ].map((item) => (
          <Card key={item.label} className="px-4 py-5 flex items-center gap-3 shadow-sm border border-slate-100 rounded-[16px]">
            <div className={`shrink-0 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full ${item.bg}`}>
              <Users size={20} strokeWidth={2} />
            </div>
            <div className="overflow-hidden min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1 truncate">{item.label}</p>
              <h3 className="text-base md:text-lg font-bold text-slate-800 leading-tight truncate">{loading ? '...' : String(item.value)}</h3>
              <p className="mt-1 text-[10px] text-slate-400 truncate">{item.helper}</p>
            </div>
          </Card>
        ))}
      </div>

      <DataTable
        loading={loading}
        columns={[
          { key: 'fullName', label: 'Name', render: (row) => (
            <div className="flex items-center gap-3">
              <UserAvatar name={row.fullName} url={row.avatarUrl} className="h-7 w-7" fallbackSize={14} />
              <div className="text-sm font-medium text-[var(--text-main)] truncate">
                {row.fullName}
              </div>
            </div>
          )},
          { key: 'phone', label: 'Phone', render: (row) => row.phone || '-' },
          { key: 'username', label: 'Username' },
          { key: 'email', label: 'Email' },
          { key: 'salary', label: 'Salary', type: 'money', align: 'right' },
          { key: 'roles', label: 'Roles', render: (row) => formatRoleNames(row.roles) },
          { key: 'lastLoginAt', label: 'Last Login', render: (row) => {
            if (!row.lastLoginAt) return '-';
            const dateObj = new Date(row.lastLoginAt);
            if (Number.isNaN(dateObj.getTime())) return '-';
            const pad = (n) => String(n).padStart(2, '0');
            const day = pad(dateObj.getDate());
            const month = pad(dateObj.getMonth() + 1);
            const year = dateObj.getFullYear();
            let hours = dateObj.getHours();
            const minutes = pad(dateObj.getMinutes());
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            return `${day}-${month}-${year} ${pad(hours)}:${minutes} ${ampm}`;
          }},
          { key: 'isActive', label: 'Status', type: 'badge' }
        ]}
        rows={sortedRows}
        selectable={true}
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
        toolbarLeft={
          <div className="relative flex-1 w-full max-w-xs">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <Search size={16} />
            </div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="pl-9 w-full"
            />
          </div>
        }
        rowActions={
          (row) => (
            <div className="flex items-center justify-end gap-1">
              <button type="button" onClick={() => navigate(`/app/users/${row.id}`)} className="p-2 text-slate-400 hover:text-[var(--primary)] hover:bg-slate-50 rounded-lg transition-colors" title="View Details">
                <Eye size={16} />
              </button>
              {canEdit ? (
                <button type="button" onClick={() => openEdit(row)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                  <Edit2 size={16} />
                </button>
              ) : null}
              {canDelete ? (
                <button type="button" onClick={() => setDeleteTarget(row)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                  <Trash2 size={16} />
                </button>
              ) : null}
            </div>
          )
        }
      />

      <Modal
        open={editorOpen}
        title={`${activeRecord ? 'Edit' : 'Add'} User`}
        subtitle=""
        onClose={() => {
          setEditorOpen(false);
          setActiveRecord(null);
        }}
        width="min(1120px, 96vw)"
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
