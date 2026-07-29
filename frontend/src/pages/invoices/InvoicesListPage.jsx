import { useEffect, useState, useMemo } from 'react';
import { Plus, RefreshCw, Eye, Pencil, Trash2, Search, Edit3, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/Table';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { InvoiceExportModal } from '../../components/invoices/InvoiceExportModal';
import { formatFinancialYear } from '../../lib/financialYear';
import { normalizeInvoiceNumber } from '../../lib/invoiceNumber';

export function InvoicesListPage() {
  const { token, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState('updatedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedIds, setSelectedIds] = useState([]);
  
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);

  const canCreate = hasPermission('invoices.manage') || hasPermission('invoices.write');
  const canDelete = hasPermission('invoices.manage') || hasPermission('invoices.delete');
  const canExport = hasPermission('invoices.read');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [invRes, clientsRes, projectsRes] = await Promise.allSettled([
          api.resources.list('/invoices', token, debouncedSearch),
          api.resources.list('/clients', token),
          api.resources.list('/projects', token)
        ]);
        if (active) {
          setRows(invRes.status === 'fulfilled' ? invRes.value.data : []);
          setClients(clientsRes.status === 'fulfilled' ? clientsRes.value.data : []);
          setProjects(projectsRes.status === 'fulfilled' ? projectsRes.value.data : []);
        }
      } catch (error) {
        if (active) toast.error(error.message || 'Failed to load invoices');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [token, debouncedSearch, reloadTick]);

  const formatDateTime = (dateString) => {
    if (!dateString) return <span className="text-sm text-[var(--text-muted)]">-</span>;
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return <span className="text-sm text-[var(--text-muted)]">-</span>;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    let hr = d.getHours();
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    const ampm = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12 || 12;
    const hrStr = String(hr).padStart(2, '0');
    return (
      <span className="text-sm text-slate-600">
        {`${dd}-${mm}-${yyyy} ${hrStr}:${min}:${sec} ${ampm}`}
      </span>
    );
  };

  const columns = [
    { key: 'invoiceNumber', label: 'Invoice #', render: (row) => normalizeInvoiceNumber(row.invoiceNumber) || '-' },
    { key: 'financialYear', label: 'FY', render: (row) => formatFinancialYear(row.invoiceDate || row.createdAt) },
    { key: 'clientId', label: 'Client', render: (row) => clients.find(c => String(c.id) === String(row.clientId))?.name || '-' },
    { key: 'projectId', label: 'Project', render: (row) => projects.find(p => String(p.id) === String(row.projectId))?.title || '-' },
    { key: 'invoiceDate', label: 'Issue Date', render: (row) => formatDateTime(row.invoiceDate) },
    { key: 'dueDate', label: 'Due Date', render: (row) => formatDateTime(row.dueDate) },
    { key: 'totalAmount', label: 'Amount', align: 'right', type: 'money' },
    { key: 'status', label: 'Status', type: 'badge' }
  ];

  const sortedRows = useMemo(() => {
    let filtered = [...rows];

    if (statusFilter) {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    
    if (clientFilter) {
      filtered = filtered.filter(r => String(r.clientId) === String(clientFilter));
    }

    if (dateFilter) {
      filtered = filtered.filter(r => r.invoiceDate?.startsWith(dateFilter) || r.dueDate?.startsWith(dateFilter));
    }

    return filtered.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal ?? 0);
      const bNum = Number(bVal ?? 0);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [rows, sortKey, sortDirection, statusFilter, dateFilter, clientFilter]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.resources.remove('/invoices', deleteTarget.id, token);
      toast.success('Invoice deleted');
      setRows(curr => curr.filter(item => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error.message || 'Failed to delete invoice');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Invoices</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{rows.length} total invoices</p>
        </div>
        <div className="flex items-center gap-3">
          {canExport && (
            <Button type="button" variant="secondary" onClick={() => setExportOpen(true)} className="bg-white shadow-sm border border-slate-200 hover:bg-slate-50 text-slate-700">
              <Download size={16} className="mr-2" /> Export invoices
            </Button>
          )}
          {canCreate && (
            <Button type="button" onClick={() => navigate('/app/invoices/new')}>
              <Plus size={16} className="mr-2" /> Create Invoice
            </Button>
          )}
        </div>
      </div>

      <DataTable
        toolbarLeft={
          <div className="relative flex-1 w-full max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); setSelectedIds([]); }}
              placeholder="Search invoices..."
              className="pl-9 w-full"
            />
          </div>
        }
        toolbarRight={
          <div className="flex items-center gap-3">
            <div className="w-48">
              <SearchableSelect
                value={clientFilter}
                onChange={val => { setClientFilter(val); setPage(1); }}
                options={[
                  { label: 'All Clients', value: '' },
                  ...clients.map(c => ({ label: c.name, value: String(c.id) }))
                ]}
                placeholder="All Clients"
              />
            </div>
            <div className="w-40">
              <SearchableSelect
                value={statusFilter}
                onChange={val => { setStatusFilter(val); setPage(1); }}
                options={[
                  { label: 'All Statuses', value: '' },
                  ...Array.from(new Set(rows.map(r => r.status))).filter(Boolean).map(s => ({ label: s, value: s }))
                ]}
                placeholder="All Statuses"
              />
            </div>
            <Input
              type="date"
              value={dateFilter}
              onChange={e => { setDateFilter(e.target.value); setPage(1); }}
              className="w-auto py-2"
              title="Filter by Date"
            />
          </div>
        }
        loading={loading}
        columns={columns}
        rows={sortedRows}
        selectable={canDelete}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={(k, d) => { setSortKey(k); setSortDirection(d); }}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        rowActions={(row) => (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/app/invoices/${row.id}`)} title="View Document">
              <Eye size={16} />
            </Button>
            {canCreate && row.status === 'Draft' && (
              <Button variant="ghost" size="icon" onClick={() => navigate(`/app/invoices/${row.id}/edit`)} title="Edit Draft">
                <Edit3 size={16} />
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(row)} title="Delete" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        )}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Invoice"
        description={`Are you sure you want to delete Invoice ${normalizeInvoiceNumber(deleteTarget?.invoiceNumber)}? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        isLoading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <InvoiceExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        invoices={rows}
        onGenerate={(financialYear) => {
          if (!financialYear) return;
          const url = `${window.location.origin}${window.location.pathname}#/app/invoices/export?fy=${encodeURIComponent(financialYear)}&print=1`;
          window.open(url, '_blank', 'noopener,noreferrer');
          setExportOpen(false);
        }}
      />
    </div>
  );
}
