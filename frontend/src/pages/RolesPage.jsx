import { useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck, Users, CheckSquare, Square, Search, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/overlays/ConfirmDialog';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { groupPermissionsByModule, mapRoleForForm } from '../lib/rbac';
import { sortRows } from '../lib/resource';

const NOTIFICATION_MODULES = [
  { key: '*', label: 'All Modules' },
  { key: 'follow-ups', label: 'Follow-ups' },
  { key: 'leads', label: 'Leads' },
  { key: 'clients', label: 'Clients' },
  { key: 'projects', label: 'Projects' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'outsourcing', label: 'Outsourcing' },
  { key: 'lead-commissions', label: 'Lead Commissions' },
  { key: 'amc', label: 'AMC' },
  { key: 'renewals', label: 'Renewals' },
  { key: 'banking', label: 'Banking' },
  { key: 'files', label: 'Files' },
  { key: 'reports', label: 'Reports' }
];

function RoleEditor({ role, permissions, onSubmit, onCancel, busy }) {
  const rolePayload = role?.payload || {};
  const notificationDefaults = rolePayload.notificationSettings || {};
  const [form, setForm] = useState({
    code: role?.code || '',
    name: role?.name || '',
    description: role?.description || '',
    isSystem: role?.isSystem || false,
    isActive: role?.isActive !== false,
    permissionIds: role?.permissionIds || [],
    payload: {
      ...rolePayload,
      notificationSettings: {
        enabled: notificationDefaults.enabled !== false,
        inApp: notificationDefaults.inApp !== false,
        email: Boolean(notificationDefaults.email),
        modules: Array.isArray(notificationDefaults.modules) && notificationDefaults.modules.length
          ? notificationDefaults.modules
          : ['*']
      }
    }
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

  function updateNotificationSettings(patch) {
    setForm((prev) => ({
      ...prev,
      payload: {
        ...(prev.payload || {}),
        notificationSettings: {
          ...(prev.payload?.notificationSettings || {}),
          ...patch
        }
      }
    }));
  }

  function toggleNotificationModule(moduleKey) {
    setForm((prev) => {
      const current = [...(prev.payload?.notificationSettings?.modules || [])];
      const hasAll = current.includes('*');
      let next = current;
      if (moduleKey === '*') {
        next = hasAll ? [] : ['*'];
      } else if (hasAll) {
        next = [moduleKey];
      } else if (current.includes(moduleKey)) {
        next = current.filter((item) => item !== moduleKey);
      } else {
        next = [...current, moduleKey];
      }

      return {
        ...prev,
        payload: {
          ...(prev.payload || {}),
          notificationSettings: {
            ...(prev.payload?.notificationSettings || {}),
            modules: next.length ? next : ['*']
          }
        }
      };
    });
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Side: Role Form Card */}
        <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-200 md:pr-8 pb-6 md:pb-0">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Role Details</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-[var(--text-main)]">Role Name <span className="text-rose-500">*</span></label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Sales Manager" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-main)]">Code <span className="text-rose-500">*</span></label>
              <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="e.g. sales-manager" />
              <p className="mt-1 text-xs text-text-muted">Unique machine readable code.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-text-main">Description</label>
              <textarea 
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-[var(--text-main)] focus:border-[var(--primary)] focus:outline-none"
                rows={3} 
                value={form.description} 
                onChange={e => setForm({...form, description: e.target.value})} 
                placeholder="Role purpose..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})} className="h-4 w-4 rounded border-slate-300 outline-none transition" style={{ accentColor: 'var(--primary)' }} />
              <label htmlFor="isActive" className="text-sm text-[var(--text-main)]">Active Role</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isSystem" checked={form.isSystem} onChange={e => setForm({...form, isSystem: e.target.checked})} className="h-4 w-4 rounded border-slate-300 outline-none transition" style={{ accentColor: 'var(--primary)' }} />
              <label htmlFor="isSystem" className="text-sm text-[var(--text-main)]">System Role</label>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-[var(--text-main)]">Notification Preferences</h4>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Control which modules generate in-app alerts and email copies for this role.</p>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.payload?.notificationSettings?.enabled !== false}
                    onChange={(e) => updateNotificationSettings({ enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 outline-none transition"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span className="text-sm text-[var(--text-main)]">Enable notifications</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.payload?.notificationSettings?.inApp !== false}
                    onChange={(e) => updateNotificationSettings({ inApp: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 outline-none transition"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span className="text-sm text-[var(--text-main)]">In-app alerts</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(form.payload?.notificationSettings?.email)}
                    onChange={(e) => updateNotificationSettings({ email: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 outline-none transition"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span className="text-sm text-[var(--text-main)]">Email alerts</span>
                </label>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Modules</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {NOTIFICATION_MODULES.map((item) => {
                      const selected = (form.payload?.notificationSettings?.modules || []).includes(item.key);
                      return (
                        <label key={item.key} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--text-main)] transition hover:border-slate-300">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleNotificationModule(item.key)}
                            disabled={form.payload?.notificationSettings?.enabled === false}
                            className="h-4 w-4 rounded border-slate-300 outline-none transition"
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <span>{item.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Permissions Checklist */}
        <div className="w-full md:w-2/3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Permissions Checklist</h3>
            <span className="text-sm font-medium text-[var(--primary)]">{form.permissionIds.length} Selected</span>
          </div>
          
          <div className="space-y-6">
            {grouped.map(group => {
              const allChecked = group.items.every(p => form.permissionIds.includes(p.id));
              const someChecked = group.items.some(p => form.permissionIds.includes(p.id));
              
              return (
                <div key={group.module} className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 shadow-sm">
                  <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => toggleModule(group.items, !allChecked)}
                        className="text-[var(--primary)] hover:opacity-80 focus:outline-none transition-opacity"
                      >
                        {allChecked ? <CheckSquare size={18} /> : (someChecked ? <CheckSquare size={18} className="opacity-50" /> : <Square size={18} />)}
                      </button>
                      <span className="text-base font-semibold capitalize text-[var(--text-main)]">{group.module.replace('-', ' ')} Module</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {group.items.map(perm => {
                      const checked = form.permissionIds.includes(perm.id);
                      return (
                        <label key={perm.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-slate-50 transition-colors">
                          <div className="mt-0.5">
                            <input 
                              type="checkbox" 
                              checked={checked} 
                              onChange={() => togglePermission(perm.id)} 
                              className="h-4 w-4 rounded border-slate-300 outline-none transition"
                              style={{ accentColor: 'var(--primary)' }}
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-[var(--text-main)] capitalize">{perm.action}</span>
                            {perm.description && <span className="text-xs text-[var(--text-muted)]">{perm.description}</span>}
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
      <div className="sticky -bottom-6 -mx-6 -mb-6 mt-8 flex flex-wrap items-center justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4 z-10">
        <Button variant="secondary" onClick={onCancel} disabled={busy} className="bg-white shadow-sm">Cancel</Button>
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)]">Manage Roles & Permissions</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Map permissions to roles and keep access control aligned with your backend RBAC rules.</p>
        </div>
        <div className="flex items-center gap-3">
          {canCreate ? (
            <Button onClick={openCreate} className="gap-2">
              <Plus size={16} />
              Add Role
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Roles', value: stats.total, helper: 'All role groups', bg: 'bg-blue-50/80 text-blue-500', icon: ShieldCheck },
          { label: 'Active', value: stats.active, helper: 'Enabled roles', bg: 'bg-emerald-50/80 text-emerald-500', icon: ShieldCheck },
          { label: 'System', value: stats.system, helper: 'Built-in roles', bg: 'bg-purple-50/80 text-purple-500', icon: ShieldCheck },
          { label: 'Assignments', value: stats.permissionLinks, helper: 'Total permission links', bg: 'bg-amber-50/80 text-amber-500', icon: Users }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="px-4 py-5 flex items-center gap-3 shadow-sm border border-slate-100 rounded-[16px]">
              <div className={`shrink-0 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full ${item.bg}`}>
                <Icon size={20} strokeWidth={2} />
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1 truncate">{item.label}</p>
                <h3 className="text-base md:text-lg font-bold text-slate-800 leading-tight truncate">{loading ? '...' : String(item.value)}</h3>
                <p className="mt-1 text-[10px] text-slate-400 truncate">{item.helper}</p>
              </div>
            </Card>
          );
        })}
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
        selectable={true}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={(key, direction) => {
          setSortKey(key);
          setSortDirection(direction);
        }}
        toolbarLeft={
          <div className="relative flex-1 w-full max-w-xs">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <Search size={16} />
            </div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roles..."
              className="pl-9 w-full"
            />
          </div>
        }
        rowActions={
          canEdit || canDelete
            ? (row) => (
                <div className="flex items-center justify-end gap-1">
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
            : undefined
        }
      />

      <Modal
        open={editorOpen}
        title={`${activeRecord ? 'Edit' : 'Add'} Role`}
        subtitle=""
        onClose={() => {
          setEditorOpen(false);
          setActiveRecord(null);
        }}
        width="min(1200px, 96vw)"
      >
        <RoleEditor 
          role={activeRecord} 
          permissions={permissions} 
          onSubmit={saveRecord} 
          onCancel={() => { setEditorOpen(false); setActiveRecord(null); }} 
          busy={busy} 
        />
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
