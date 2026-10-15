import { useEffect, useMemo, useState } from 'react';
import { Eye, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DataTable } from '../../components/ui/Table';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { eventRouteSegment, leadRoute } from '../../utils/entityRoutes';

function structuredField(text, label) {
  const needle = String(label || '').trim().toLowerCase();
  const line = String(text || '')
    .split(/\r?\n/)
    .find((item) => item.trim().toLowerCase().startsWith(`${needle}:`));
  return line ? line.slice(line.indexOf(':') + 1).trim() : '';
}

function numberValue(...values) {
  for (const value of values) {
    if (value == null || value === '') continue;
    const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function quotationStatus(event) {
  const value = structuredField(event.description, 'Status')
    || event.status
    || event.payload?.status
    || 'Draft';
  return String(value).trim() || 'Draft';
}

function statusTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('approve') || normalized.includes('accept')) return 'success';
  if (normalized.includes('reject') || normalized.includes('declin')) return 'danger';
  if (normalized.includes('sent') || normalized.includes('view')) return 'info';
  if (normalized.includes('review') || normalized.includes('revis')) return 'warning';
  return 'neutral';
}

function formatDate(value) {
  if (!value) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split('-');
    return `${day}-${month}-${year}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN');
}

function formatAmount(value, currency = 'INR') {
  const amount = Number(value || 0);
  try {
    return amount.toLocaleString('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2
    });
  } catch {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
}

function quotationServices(event) {
  const value = event.serviceNames || event.payload?.serviceNames || structuredField(event.description, 'Service');
  return (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

export function QuotationsListPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [eventsResult, leadsResult] = await Promise.all([
          api.resources.list('/lead-events', token, '', { eventType: 'quotation' }),
          api.resources.list('/leads', token)
        ]);
        if (!active) return;
        setEvents((eventsResult.data || []).filter((item) => String(item.eventType || '').toLowerCase() === 'quotation'));
        setLeads(leadsResult.data || []);
      } catch (error) {
        if (active) toast.error(error.message || 'Failed to load quotations');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [token]);

  const leadLookup = useMemo(
    () => new Map(leads.map((lead) => [String(lead.id), lead])),
    [leads]
  );

  const rows = useMemo(() => events.map((event) => {
    const leadId = event.leadId || event.scopeId;
    const lead = leadLookup.get(String(leadId || '')) || {};
    const services = quotationServices(event);
    return {
      ...event,
      lead,
      leadId,
      leadName: lead.companyName || lead.contactPerson || lead.name || event.clientName || '-',
      leadNumber: lead.leadNumber || '',
      services,
      servicesText: services.join(', '),
      proposalDate: event.startDate || event.createdAt,
      validUntil: event.endDate || '',
      totalAmount: numberValue(
        event.totalAmount,
        event.payload?.totalAmount,
        structuredField(event.description, 'Total Amount'),
        event.amount,
        event.payload?.amount,
        structuredField(event.description, 'Amount')
      ),
      status: quotationStatus(event),
      currency: lead.currency || event.currency || event.payload?.currency || 'INR'
    };
  }), [events, leadLookup]);

  const statusOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.status).filter(Boolean))).sort(),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (dateFilter && !String(row.proposalDate || '').startsWith(dateFilter) && !String(row.validUntil || '').startsWith(dateFilter)) return false;
      if (!query) return true;
      return [row.title, row.leadName, row.leadNumber, row.servicesText, row.status, row.id]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });

    return filtered.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      if (sortKey === 'totalAmount') {
        return sortDirection === 'asc' ? Number(left || 0) - Number(right || 0) : Number(right || 0) - Number(left || 0);
      }
      const comparison = String(left || '').localeCompare(String(right || ''), undefined, { numeric: true });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [rows, debouncedSearch, statusFilter, dateFilter, sortKey, sortDirection]);

  function openQuotation(row) {
    if (!row.leadId) {
      toast.error('This quotation is not linked to a lead');
      return;
    }
    navigate(leadRoute(row.lead.id ? row.lead : row.leadId, `quotations/${eventRouteSegment(row)}`));
  }

  const columns = [
    {
      key: 'title',
      label: 'Quotation',
      render: (row) => (
        <div className="min-w-[190px] max-w-[360px]">
          <div className="truncate font-semibold text-[var(--text-main)]" title={row.title || 'Quotation'}>{row.title || 'Quotation'}</div>
          <div className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]" title={row.servicesText || ''}>{row.servicesText || 'No service specified'}</div>
        </div>
      )
    },
    {
      key: 'leadName',
      label: 'Lead / Company',
      render: (row) => (
        <div className="min-w-[160px]">
          <div>{row.leadName}</div>
          {row.leadNumber ? <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{row.leadNumber}</div> : null}
        </div>
      )
    },
    { key: 'proposalDate', label: 'Quotation Date', render: (row) => formatDate(row.proposalDate) },
    { key: 'validUntil', label: 'Valid Until', render: (row) => formatDate(row.validUntil) },
    { key: 'totalAmount', label: 'Amount', align: 'right', render: (row) => <span className="font-semibold">{formatAmount(row.totalAmount, row.currency)}</span> },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)} dot>{row.status}</Badge> }
  ];

  return (
    <div>
      <DataTable
        toolbarLeft={(
          <div className="relative w-64 max-w-full">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search quotations..."
              className="w-full py-1.5 pl-9 text-xs"
            />
          </div>
        )}
        toolbarRight={(
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-36">
              <SearchableSelect
                value={statusFilter}
                onChange={(value) => { setStatusFilter(value); setPage(1); }}
                options={[
                  { label: 'All Statuses', value: '' },
                  ...statusOptions.map((status) => ({ label: status, value: status }))
                ]}
                placeholder="All Statuses"
                triggerClassName="py-1.5"
              />
            </div>
            <Input
              type="date"
              value={dateFilter}
              onChange={(event) => { setDateFilter(event.target.value); setPage(1); }}
              className="w-[155px] py-1.5 text-xs"
              title="Filter by quotation or validity date"
            />
          </div>
        )}
        loading={loading}
        compact
        columns={columns}
        rows={filteredRows}
        selectable={false}
        emptyTitle="No quotations found"
        emptyDescription="Saved lead quotations will appear here."
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={(key, direction) => {
          setSortKey(key);
          setSortDirection(direction || 'asc');
        }}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        onRowClick={openQuotation}
        rowActions={(row) => (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openQuotation(row)} title="View Quotation">
            <Eye size={15} />
          </Button>
        )}
      />
    </div>
  );
}
