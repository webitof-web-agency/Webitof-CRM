import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, ShieldCheck, Users, CheckSquare, Square } from 'lucide-react';
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
import { ConfirmDialog } from '../components/overlays/ConfirmDialog';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { groupPermissionsByModule, mapRoleForForm } from '../lib/rbac';
import { sortRows } from '../lib/resource';

function RoleEditor({ role, permissions, onSubmit, onCancel, busy }) {
  const [form, setForm] = useState({
    code: role?.code || '',
    name: role?.name || '',
    description: role?.description || '',
    isSystem: role?.isSystem || false,
    isActive: role?.isActive !== false,
    permissionIds: role?.permissionIds || []
  });

  const grouped = useMemo(() => groupPermissionsByModule(permissions), [permissions]);

  function togglePermission(id) {
    setForm(prev => {
      const current = prev.permissionIds;
      if (current.includes(id)) {
        return { ...prev, permissionIds: current.filter(x => x !== id) };
      }
      return { ...prev, permissionIds: [...current, id] };
    });
  }

  function toggleModule(moduleItems, checked) {
    const ids = moduleItems.map(m => m.id);
    setForm(prev => {
      let current = [...prev.permissionIds];
      if (checked) {
        ids.forEach(id => {
          if (!current.includes(id)) current.push(id);
        });
      } else {
        current = current.filter(id => !ids.includes(id));
      }
      return { ...prev, permissionIds: current };
    });
  }

  return (
    <div className="flex h-[75vh] flex-col overflow-hidden bg-bg-main/50 rounded-2xl border border-white/5">
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Left Side: Role Form Card */}
        <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-white/10 p-5 overflow-y-auto bg-white/5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">Role Details</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-text-main">Role Name *</label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Sales Manager" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-text-main">Code *</label>
              <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="e.g. sales-manager" />
              <p className="mt-1 text-xs text-text-muted">Unique machine readable code.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-text-main">Description</label>
              <textarea 
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-text-main focus:border-accent focus:outline-none"
                rows={3} 
                value={form.description} 
                onChange={e => setForm({...form, description: e.target.value})} 
                placeholder="Role purpose..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})} className="rounded border-white/20 bg-white/5 text-accent focus:ring-accent focus:ring-offset-bg-main" />
              <label htmlFor="isActive" className="text-sm text-text-main">Active Role</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isSystem" checked={form.isSystem} onChange={e => setForm({...form, isSystem: e.target.checked})} className="rounded border-white/20 bg-white/5 text-accent focus:ring-accent focus:ring-offset-bg-main" />
              <label htmlFor="isSystem" className="text-sm text-text-main">System Role</label>
            </div>
          </div>
        </div>

        {/* Right Side: Permissions Checklist */}
        <div className="w-full md:w-2/3 p-5 overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Permissions Checklist</h3>
            <span className="text-sm font-medium text-accent">{form.permissionIds.length} Selected</span>
          </div>
          
          <div className="space-y-6">
            {grouped.map(group => {
              const allChecked = group.items.every(p => form.permissionIds.includes(p.id));
              const someChecked = group.items.some(p => form.permissionIds.includes(p.id));
              
              return (
                <div key={group.module} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20">
                  <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => toggleModule(group.items, !allChecked)}
                        className="text-accent hover:text-accent/80 focus:outline-none"
                      >
                        {allChecked ? <CheckSquare size={18} /> : (someChecked ? <CheckSquare size={18} className="opacity-50" /> : <Square size={18} />)}
                      </button>
                      <span className="text-base font-semibold capitalize text-text-main">{group.module.replace('-', ' ')} Module</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {group.items.map(perm => {
                      const checked = form.permissionIds.includes(perm.id);
                      return (
                        <label key={perm.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-white/5">
                          <div className="mt-0.5">
                            <input 
                              type="checkbox" 
                              checked={checked} 
                              onChange={() => togglePermission(perm.id)} 
                              className="rounded border-white/20 bg-white/5 text-accent focus:ring-accent focus:ring-offset-bg-main"
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-text-main capitalize">{perm.action}</span>
                            {perm.description && <span className="text-xs text-text-muted">{perm.description}</span>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 bg-bg-main p-4 flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={busy}>{role ? 'Update Role' : 'Create Role'}</Button>
      </div>
    </div>
  );
}

export function RolesPage() {
  const { token, hasPermission } = useAuth();
  const [rows, setRows] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('updatedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 250);
  const canCreate = hasPermission('roles.manage');
  const canEdit = hasPermission('roles.manage');
  const canDelete = hasPermission('roles.manage');

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const [rolesResponse, permissionsResponse] = await Promise.all([
          api.resources.list('/roles', token, debouncedSearch),
          api.resources.list('/permissions', token)
        ]);
        if (!mounted) return;
        setRows(rolesResponse.data || []);
        setPermissions(permissionsResponse.data || []);
      } catch (error) {
        if (!mounted) return;
        toast.error(error.message || 'Unable to load roles');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [debouncedSearch, reloadTick, token]);

  const formRows = useMemo(() => rows.map(mapRoleForForm), [rows]);
  const sortedRows = useMemo(() => sortRows(formRows, sortKey, sortDirection), [formRows, sortDirection, sortKey]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((row) => row.isActive).length;
    const system = rows.filter((row) => row.isSystem).length;
    const permissionLinks = rows.reduce((sum, row) => sum + (row.permissions?.length || 0), 0);
    return { total, active, system, permissionLinks };
  }, [rows]);

  function openCreate() {
    setActiveRecord(null);
    setEditorOpen(true);
  }

  function openEdit(record) {
    setActiveRecord(mapRoleForForm(record));
    setEditorOpen(true);
  }

  async function saveRecord(payload) {
    if (!payload.name || !payload.code) {
      return toast.error('Name and Code are required');
    }
    setBusy(true);
    try {
      const response = activeRecord
        ? await api.resources.update('/roles', activeRecord.id, payload, token)
        : await api.resources.create('/roles', payload, token);
      toast.success(activeRecord ? 'Role updated' : 'Role created');
      setRows((current) => {
        const next = activeRecord ? current.map((item) => (item.id === response.data.id ? response.data : item)) : [response.data, ...current];
        return next;
      });
      setEditorOpen(false);
      setActiveRecord(null);
    } catch (error) {
      toast.error(error.message || 'Unable to save role');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.resources.remove('/roles', deleteTarget.id, token);
      toast.success('Role deleted');
      setRows((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error.message || 'Unable to delete role');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Manage Roles & Permissions"
        description="Map permissions to roles and keep access control aligned with your backend RBAC rules."
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'secondary', onClick: () => setReloadTick((value) => value + 1) },
          ...(canCreate ? [{ label: 'Add Role', icon: Plus, onClick: openCreate }] : [])
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Roles" value={loading ? '...' : String(stats.total)} helper="All role groups" icon={ShieldCheck} />
        <StatCard title="Active" value={loading ? '...' : String(stats.active)} helper="Enabled roles" icon={ShieldCheck} tone="positive" />
        <StatCard title="System" value={loading ? '...' : String(stats.system)} helper="Built-in roles" icon={ShieldCheck} />
        <StatCard title="Assignments" value={loading ? '...' : String(stats.permissionLinks)} helper="Total permission links" icon={Users} />
      </div>

      <Card className="space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Search roles</label>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by code, name, or description"
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--text-muted)]">
            {rows.length} matching roles
          </div>
        </div>

        <DataTable
          loading={loading}
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Name' },
            { key: 'description', label: 'Description', ellipsis: true },
            { key: 'permissions', label: 'Permissions', render: (row) => String(row.permissions?.length || 0) },
            { key: 'isSystem', label: 'System', type: 'badge' },
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
          onCreate={canCreate ? openCreate : undefined}
          createLabel="Add Role"
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
        title="" // Custom title inside editor
        subtitle=""
        onClose={() => {
          setEditorOpen(false);
          setActiveRecord(null);
        }}
        width="min(1200px, 96vw)"
      >
        <div className="p-1">
           <RoleEditor 
             role={activeRecord} 
             permissions={permissions} 
             onSubmit={saveRecord} 
             onCancel={() => { setEditorOpen(false); setActiveRecord(null); }} 
             busy={busy} 
           />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete role"
        description={`This will permanently remove ${deleteTarget?.name || deleteTarget?.code || 'the selected role'}.`}
        confirmLabel={busy ? 'Deleting...' : 'Delete'}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
}
