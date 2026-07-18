import { useEffect, useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Eye } from 'lucide-react';
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
  const [sortKey, setSortKey] = useState('updated_at');
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
        const dateStr = `${dd}-${mm}-${yyyy}`;
        
        const valStr = String(row.paymentDate);
        const hasTime = valStr.includes('T') && !valStr.endsWith('T00:00:00.000Z') && !valStr.endsWith('T00:00:00Z');
        
        if (hasTime) {
          const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
          return <span className="text-sm text-slate-600">{`${dateStr} ${timeStr}`}</span>;
        }
        return <span className="text-sm text-slate-600">{dateStr}</span>;
      }
    },
    { key: 'clientId', label: 'Client', render: (row) => clients.find(c => String(c.id) === String(row.clientId))?.name || '-' },
    {
      key: 'invoiceId',
      label: 'Invoice',
      render: (row) => {
        const invoice = invoices.find(i => String(i.id) === String(row.invoiceId));
        return invoice?.invoiceNumber || '-';
      }
    },
    {
      key: 'invoiceStatus',
      label: 'Invoice Status',
      sortable: false,
      render: (row) => {
        const invoice = invoices.find(i => String(i.id) === String(row.invoiceId));
        if (!invoice) return <span className="text-slate-400">-</span>;
        const status = invoice.status || 'Sent';
        const color = TONE_COLORS[getInvoiceStatusTone(status)] || TONE_COLORS.neutral;
        return (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border uppercase tracking-[0.16em]"
            style={{ backgroundColor: `${color}1A`, color: color, borderColor: `${color}33` }}
          >
            {status}
          </span>
        );
      }
    },

    { key: 'amountReceived', label: 'Received', align: 'right', type: 'money' },
    {
      key: 'balanceDue',
      label: 'Balance Due',
      align: 'right',
      sortable: false,
      render: (row) => {
        const invoice = invoices.find(i => String(i.id) === String(row.invoiceId));
        if (!invoice) return <span className="text-slate-400">-</span>;
        return <span className="font-medium text-[var(--text-main)]">{Number(invoice.balanceDue || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })}</span>;
      }
    },
    { key: 'paymentMode', label: 'Mode' },
    {
      key: 'paymentStatus',
      label: 'Payment Status',
      render: (row) => {
        const status = row.paymentStatus || 'Received';
        const color = TONE_COLORS[getPaymentStatusTone(status)] || TONE_COLORS.neutral;
        return (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border uppercase tracking-[0.16em]"
            style={{ backgroundColor: `${color}1A`, color: color, borderColor: `${color}33` }}
          >
            {status}
          </span>
        );
      }
    }
  ];

  const sortedRows = useMemo(() => {
    let filtered = [...rows];

    if (paymentStatusFilter) {
      filtered = filtered.filter(r => String(r.paymentStatus || 'Received') === String(paymentStatusFilter));
    }

    if (modeFilter) {
      filtered = filtered.filter(r => r.paymentMode === modeFilter);
    }

    if (dateFilter) {
      filtered = filtered.filter(r => r.paymentDate?.startsWith(dateFilter));
    }

    return filtered.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
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
          {canCreate && (
            <Button type="button" onClick={() => { setEditData(null); setFormOpen(true); }}>
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
