import { useEffect, useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Eye, Download } from 'lucide-react';
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
import { PaymentFormModal } from '../../components/forms/PaymentFormModal';
import { exportToCsv } from '../../lib/exportCsv';
import { getInvoiceStatusTone, getPaymentStatusTone, PAYMENT_STATUS_OPTIONS } from '../../lib/paymentStatus';

const TONE_COLORS = {
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#f43f5e',
  info: '#0ea5e9',
  neutral: '#64748b'
};

export function PaymentsListPage() {
  const { token, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState('updatedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedIds, setSelectedIds] = useState([]);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);

  const canCreate = hasPermission('payments.manage') || hasPermission('payments.write');
  const canDelete = hasPermission('payments.manage') || hasPermission('payments.delete');

  const paymentStatusOptions = [{ label: 'All Payment Statuses', value: '' }, ...PAYMENT_STATUS_OPTIONS.map((status) => ({ label: status, value: status }))];
  const modeOptions = [{ label: 'All Modes', value: '' }, ...Array.from(new Set(rows.map((r) => r.paymentMode))).filter(Boolean).map((status) => ({ label: status, value: status }))];

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [payRes, clientsRes, invRes] = await Promise.allSettled([
          api.resources.list('/payments', token, debouncedSearch),
          api.resources.list('/clients', token),
          api.resources.list('/invoices', token)
        ]);
        if (active) {
          setRows(payRes.status === 'fulfilled' ? payRes.value.data : []);
          setClients(clientsRes.status === 'fulfilled' ? clientsRes.value.data : []);
          setInvoices(invRes.status === 'fulfilled' ? invRes.value.data : []);
        }
      } catch (error) {
        if (active) toast.error(error.message || 'Failed to load payments');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [token, debouncedSearch, reloadTick]);

  const columns = [
    {
      key: 'paymentDate', label: 'Date', render: (row) => {
        if (!row.paymentDate) return <span className="text-sm text-[var(--text-muted)]">-</span>;
        const d = new Date(row.paymentDate);
        if (Number.isNaN(d.getTime())) return <span className="text-sm text-[var(--text-muted)]">-</span>;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return <span className="text-sm font-medium text-[var(--text-main)]">{`${dd}/${mm}/${yyyy}`}</span>;
      }
    },
    {
      key: 'clientId', label: 'Client', render: (row) => {
        const client = clients.find((c) => String(c.id) === String(row.clientId));
        return (
          <div>
            <span className="font-semibold text-[var(--text-main)] text-sm">{client?.companyName || client?.name || 'Unknown'}</span>
            {client?.companyName && client?.name && client.companyName !== client.name ? (
              <span className="block text-xs text-[var(--text-muted)]">{client.name}</span>
            ) : null}
          </div>
        );
      }
    },
    {
      key: 'invoiceId', label: 'Invoice', render: (row) => {
        const inv = invoices.find((i) => String(i.id) === String(row.invoiceId));
        if (!inv) return <span className="text-xs text-[var(--text-muted)] italic">Advance / Direct</span>;
        return (
          <div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/app/invoices/${inv.id}`); }}
              className="text-xs font-semibold text-[var(--primary)] hover:underline"
            >
              #{inv.invoiceNumber || inv.id}
            </button>
            <div className="text-[11px] text-[var(--text-muted)]">
              Total: ₹{Number(inv.totalAmount || 0).toLocaleString('en-IN')}
            </div>
          </div>
        );
      }
    },
    {
      key: 'amountReceived', label: 'Amount', align: 'right', render: (row) => (
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
          ₹{Number(row.amountReceived || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'paymentMode', label: 'Mode', render: (row) => (
        <span className="text-xs font-medium text-[var(--text-muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded-md border border-[var(--border)]">
          {row.paymentMode || 'Direct'}
        </span>
      )
    },
    {
      key: 'paymentStatus', label: 'Status', render: (row) => {
        const tone = getPaymentStatusTone(row.paymentStatus);
        const color = TONE_COLORS[tone] || TONE_COLORS.neutral;
        return (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border"
            style={{
              backgroundColor: `${color}15`,
              borderColor: `${color}40`,
              color
            }}
          >
            {row.paymentStatus || 'Received'}
          </span>
        );
      }
    }
  ];

  const handleExportCsv = () => {
    if (!sortedRows || !sortedRows.length) {
      toast.error('No payments available to export');
      return;
    }
    const cols = [
      { label: 'Date', key: 'paymentDate' },
      { label: 'Client', accessor: (row) => clients.find((c) => String(c.id) === String(row.clientId))?.name || '' },
      { label: 'Invoice #', accessor: (row) => invoices.find((i) => String(i.id) === String(row.invoiceId))?.invoiceNumber || '' },
      { label: 'Amount Received (INR)', key: 'amountReceived' },
      { label: 'TDS Deducted (INR)', key: 'tdsDeducted' },
      { label: 'Payment Mode', key: 'paymentMode' },
      { label: 'Status', key: 'paymentStatus' },
      { label: 'Transaction ID', key: 'transactionId' },
      { label: 'Notes', key: 'notes' }
    ];
    exportToCsv('payments_export', cols, sortedRows);
    toast.success(`Exported ${sortedRows.length} payment records to CSV`);
  };

  const sortedRows = useMemo(() => {
    let filtered = [...rows];
    if (paymentStatusFilter) {
      filtered = filtered.filter((r) => r.paymentStatus === paymentStatusFilter);
    }
    if (modeFilter) {
      filtered = filtered.filter((r) => r.paymentMode === modeFilter);
    }
    if (dateFilter) {
      filtered = filtered.filter((r) => (r.paymentDate || '').startsWith(dateFilter));
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
  }, [rows, sortKey, sortDirection, paymentStatusFilter, modeFilter, dateFilter]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.resources.remove('/payments', deleteTarget.id, token);
      toast.success('Payment deleted');
      setRows(curr => curr.filter(item => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error.message || 'Failed to delete payment');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Payments</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Record and track all client payments against invoices.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={handleExportCsv} className="bg-white shadow-sm border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer">
            <Download size={16} className="mr-2 text-emerald-600" /> Export CSV
          </Button>
          {canCreate && (
            <Button type="button" onClick={() => { setEditData(null); setFormOpen(true); }} className="cursor-pointer">
              <Plus size={16} className="mr-2" /> Record Payment
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
              placeholder="Search payments..."
              className="pl-9 w-full"
            />
          </div>
        }
        toolbarRight={
          <div className="flex items-center gap-3">
            <div className="w-48">
              <SearchableSelect
                value={paymentStatusFilter}
                onChange={val => { setPaymentStatusFilter(val); setPage(1); }}
                options={paymentStatusOptions}
                placeholder="All Payment Statuses"
                searchPlaceholder="Search payment status..."
              />
            </div>
            <div className="w-40">
              <SearchableSelect
                value={modeFilter}
                onChange={val => { setModeFilter(val); setPage(1); }}
                options={modeOptions}
                placeholder="All Modes"
                searchPlaceholder="Search mode..."
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/app/payments/${row.id}`);
              }}
              title="View Payment"
            >
              <Eye size={16} />
            </Button>
            {canCreate && (
              <Button variant="ghost" size="icon" onClick={() => { setEditData(row); setFormOpen(true); }} title="Edit">
                <Pencil size={16} />
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
        title="Delete Payment"
        description="Are you sure you want to delete this payment? This action cannot be undone."
        confirmText="Delete"
        type="danger"
        isLoading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <PaymentFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditData(null); }}
        initialData={editData}
        onSuccess={() => {
          setFormOpen(false);
          setEditData(null);
          setReloadTick(curr => curr + 1);
        }}
      />
    </div>
  );
}
