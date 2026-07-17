import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { ResourceForm } from '../components/forms/ResourceForm';
import { ConfirmDialog } from '../components/overlays/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { sortRows } from '../lib/resource';

function getWritePermission(permission = '') {
  if (!permission) return '';
  if (permission.includes('manage')) return permission;
  if (permission.endsWith('.read')) return permission.replace('.read', '.write');
  return permission;
}

function getDeletePermission(permission = '') {
  if (!permission) return '';
  if (permission.includes('manage')) return permission;
  if (permission.endsWith('.read')) return permission.replace('.read', '.delete');
  return permission;
}

function needsLookup(fields = [], predicate) {
  return fields.some((field) => predicate(field));
}

function pickLookups(fields = []) {
  return {
    clients: needsLookup(fields, (field) => field.type === 'customer' || ['clientId', 'linkedClientId'].includes(field.name)),
    vendors: needsLookup(fields, (field) => ['partnerId', 'vendorId'].includes(field.name) || field.lookupKey === 'vendors'),
    expenseCategories: needsLookup(fields, (field) => field.name === 'categoryId' || field.lookupKey === 'expenseCategories'),
    renewalProviders: needsLookup(fields, (field) => field.name === 'providerId' || field.lookupKey === 'renewalProviders'),
    amcTypes: needsLookup(fields, (field) => field.name === 'amcType' || field.lookupKey === 'amcTypes'),
    projects: needsLookup(fields, (field) => ['projectId', 'linkedProjectId'].includes(field.name)),
    invoices: needsLookup(fields, (field) => ['invoiceId', 'linkedInvoiceId'].includes(field.name)),
    expenses: needsLookup(fields, (field) => ['expenseId', 'linkedExpenseId'].includes(field.name)),
    bankAccounts: needsLookup(fields, (field) => field.name === 'bankAccountId'),
    roles: needsLookup(fields, (field) => field.name === 'roleIds'),
    permissions: needsLookup(fields, (field) => field.name === 'permissionIds')
  };
}

export function ResourcePage({ schema }) {
  const { token, hasPermission } = useAuth();
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ clients: [], roles: [], permissions: [], bankAccounts: [], projects: [], invoices: [], expenses: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sortKey, setSortKey] = useState(schema.columns?.[0]?.key || 'updatedAt');
  const [sortDirection, setSortDirection] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const createPermission = getWritePermission(schema.permission);
  const deletePermission = getDeletePermission(schema.permission);
  const canCreate = !schema.readOnly && (!createPermission || hasPermission(createPermission));
  const canEdit = !schema.readOnly && canCreate;
  const canDelete = !schema.readOnly && (!deletePermission || hasPermission(deletePermission));

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const lookupNeeds = pickLookups(schema.fields || []);
        const rowsResponse = await api.resources.list(schema.apiPath, token, debouncedSearch);
        const customLookupEntries = Object.entries(schema.lookupPaths || {});
        const customLookupResults = await Promise.allSettled(
          customLookupEntries.map(([, path]) => api.resources.list(path, token))
        );
        const lookupResults = await Promise.allSettled([
          lookupNeeds.clients ? api.resources.list('/clients', token) : Promise.resolve({ data: [] }),
          lookupNeeds.vendors ? api.resources.list('/masters/vendor', token) : Promise.resolve({ data: [] }),
          lookupNeeds.expenseCategories ? api.resources.list('/masters/expense_category', token) : Promise.resolve({ data: [] }),
          lookupNeeds.renewalProviders ? api.resources.list('/masters/renewal_provider', token) : Promise.resolve({ data: [] }),
          lookupNeeds.amcTypes ? api.resources.list('/masters/amc_type', token) : Promise.resolve({ data: [] }),
          lookupNeeds.roles ? api.resources.list('/roles', token) : Promise.resolve({ data: [] }),
          lookupNeeds.permissions ? api.resources.list('/permissions', token) : Promise.resolve({ data: [] }),
          lookupNeeds.projects ? api.resources.list('/projects', token) : Promise.resolve({ data: [] }),
          lookupNeeds.invoices ? api.resources.list('/invoices', token) : Promise.resolve({ data: [] }),
          lookupNeeds.expenses ? api.resources.list('/expenses', token) : Promise.resolve({ data: [] }),
          lookupNeeds.bankAccounts ? api.resources.list('/banking/accounts', token) : Promise.resolve({ data: [] })
        ]);
        const [clientsResult, vendorsResult, expenseCategoriesResult, renewalProvidersResult, amcTypesResult, rolesResult, permissionsResult, projectsResult, invoicesResult, expensesResult, bankAccountsResult] = lookupResults.map((result) =>
          result.status === 'fulfilled' ? result.value : { data: [] }
        );
        const customLookupObject = customLookupEntries.reduce((acc, [key], index) => {
          acc[key] = customLookupResults[index]?.status === 'fulfilled' ? customLookupResults[index].value.data || [] : [];
          return acc;
        }, {});

        if (!active) return;
        setRows(rowsResponse.data || []);
        setLookups((current) => ({
          ...current,
          clients: clientsResult.data || [],
          vendors: vendorsResult.data || [],
          expenseCategories: expenseCategoriesResult.data || [],
          renewalProviders: renewalProvidersResult.data || [],
          amcTypes: amcTypesResult.data || [],
          roles: rolesResult.data || [],
          permissions: permissionsResult.data || [],
          projects: projectsResult.data || [],
          invoices: invoicesResult.data || [],
          expenses: expensesResult.data || [],
          bankAccounts: bankAccountsResult.data || [],
          ...customLookupObject
        }));
      } catch (error) {
        if (!active) return;
        toast.error(error.message || `Unable to load ${schema.label.toLowerCase()}`);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [debouncedSearch, reloadTick, schema.apiPath, schema.fields, schema.label, token]);

  const sortedRows = useMemo(() => sortRows(rows, sortKey, sortDirection), [rows, sortKey, sortDirection]);

  function openCreate() {
    setActiveRecord(null);
    setEditorOpen(true);
  }

  function openEdit(record) {
    setActiveRecord(record);
    setEditorOpen(true);
  }

  async function saveRecord(payload) {
    setBusy(true);
    try {
      const response = activeRecord
        ? await api.resources.update(schema.apiPath, activeRecord.id, payload, token)
        : await api.resources.create(schema.apiPath, payload, token);
      toast.success(activeRecord ? `${schema.singular || schema.label} updated` : `${schema.singular || schema.label} created`);
      setEditorOpen(false);
      setActiveRecord(null);
      setRows((current) => {
        if (!activeRecord) return [response.data, ...current];
        return current.map((item) => (item.id === response.data.id ? response.data : item));
      });
    } catch (error) {
      toast.error(error.message || 'Unable to save record');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.resources.remove(schema.apiPath, deleteTarget.id, token);
      toast.success(`${schema.singular || schema.label} deleted`);
      setRows((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error.message || 'Unable to delete record');
    } finally {
      setDeleting(false);
    }
  }

  const recordCount = rows.length;
  const pageMeta = `${recordCount} records`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={schema.label}
        title={schema.label}
        description={schema.searchPlaceholder || `Manage ${schema.label.toLowerCase()} records, sorted and paginated with RBAC protection.`}
        meta={pageMeta}
        actions={[
          ...(canCreate ? [{ label: `Add ${schema.singular || schema.label}`, icon: Plus, onClick: openCreate }] : []),
          { label: 'Refresh', icon: RefreshCw, variant: 'secondary', onClick: () => setReloadTick((current) => current + 1) }
        ]}
      />

      <Card className="space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
              Search
            </label>
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                setSelectedIds([]);
              }}
              placeholder={schema.searchPlaceholder || `Search ${schema.label.toLowerCase()}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:min-w-[260px]">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Rows</div>
              <div className="mt-1 text-lg font-semibold text-[var(--text)]">{recordCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Selected</div>
              <div className="mt-1 text-lg font-semibold text-[var(--text)]">{selectedIds.length}</div>
            </div>
          </div>
        </div>

        <DataTable
          loading={loading}
          columns={schema.columns || []}
          rows={sortedRows}
          rowKey="id"
          selectable={Boolean(canDelete)}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
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
          createLabel={`Add ${schema.singular || schema.label}`}
          rowActions={
            canEdit || canDelete
              ? (row) => (
                  <div className="flex items-center justify-end gap-2">
                    {canEdit ? (
                      <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(row)} title="Edit">
                        <Pencil size={16} />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(row)} title="Delete">
                        <Trash2 size={16} />
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
        title={`${activeRecord ? 'Edit' : 'Add'} ${schema.singular || schema.label}`}
        subtitle={schema.searchPlaceholder || `Fill in the ${schema.label.toLowerCase()} details`}
        onClose={() => {
          setEditorOpen(false);
          setActiveRecord(null);
        }}
        width="min(980px, 96vw)"
      >
        <ResourceForm
          key={`${schema.key}:${activeRecord?.id || 'new'}`}
          fields={schema.fields || []}
          record={activeRecord}
          lookups={lookups}
          onSubmit={saveRecord}
          onCancel={() => {
            setEditorOpen(false);
            setActiveRecord(null);
          }}
          submitLabel={activeRecord ? 'Update' : 'Create'}
          busy={busy}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${schema.singular || schema.label}`}
        description={`This action will remove ${deleteTarget?.name || deleteTarget?.title || deleteTarget?.code || 'the selected record'}.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={deleting}
      />
    </div>
  );
}
