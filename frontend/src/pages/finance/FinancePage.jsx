import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  CircleDollarSign,
  Filter,
  RefreshCw,
  Scale,
  Search,
  SplitSquareHorizontal,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  ReceiptText,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { DataTable } from '../../components/ui/Table';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
}

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(value).slice(0, 10);
  }
}

function badgeClass(value = '') {
  const text = String(value || '').toLowerCase();
  if (text === 'matched' || text === 'paid' || text === 'posted' || text === 'in') return 'bg-emerald-100 text-emerald-700';
  if (text === 'suggested' || text === 'partially paid') return 'bg-amber-100 text-amber-700';
  if (text === 'unmatched' || text === 'overdue') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-700';
}

function Badge({ children, tone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(tone)}`}>
      {children}
    </span>
  );
}

function csvValue(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, columns, rows) {
  const header = columns.map((column) => csvValue(column.label)).join(',');
  const lines = rows.map((row) => columns.map((column) => csvValue(column.getValue(row))).join(','));
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

const tabs = [
  { key: 'overview', label: 'Overview', icon: Scale },
  { key: 'ledger', label: 'Ledger', icon: ReceiptText },
  { key: 'reconciliation', label: 'Reconciliation', icon: SplitSquareHorizontal }
];

const moduleOptions = [
  { value: '', label: 'All modules' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'payments', label: 'Payments' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'outsourcing', label: 'Outsourcing' },
  { value: 'lead-commissions', label: 'Lead Commissions' },
  { value: 'banking', label: 'Banking' }
];

const directionOptions = [
  { value: '', label: 'All directions' },
  { value: 'in', label: 'Inflow' },
  { value: 'out', label: 'Outflow' }
];

const matchOptions = [
  { value: '', label: 'All statuses' },
  { value: 'matched', label: 'Matched' },
  { value: 'suggested', label: 'Suggested' },
  { value: 'unmatched', label: 'Unmatched' }
];

export function FinancePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [ledger, setLedger] = useState({ entries: [], totals: {} });
  const [reconciliation, setReconciliation] = useState({ entries: [], summary: {} });
  const [bankAccounts, setBankAccounts] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);

  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerModule, setLedgerModule] = useState('');
  const [ledgerDirection, setLedgerDirection] = useState('');
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');
  const debouncedLedgerSearch = useDebouncedValue(ledgerSearch, 250);

  const [reconSearch, setReconSearch] = useState('');
  const [reconBankAccountId, setReconBankAccountId] = useState('');
  const [reconMatchStatus, setReconMatchStatus] = useState('');
  const [reconFrom, setReconFrom] = useState('');
  const [reconTo, setReconTo] = useState('');
  const debouncedReconSearch = useDebouncedValue(reconSearch, 250);

  async function loadData() {
    setLoading(true);
    try {
      const [summaryRes, ledgerRes, reconRes, banksRes, clientsRes, projectsRes] = await Promise.all([
        api.finance.summary(token),
        api.finance.ledger(token, { search: debouncedLedgerSearch, module: ledgerModule, direction: ledgerDirection, from: ledgerFrom, to: ledgerTo }),
        api.finance.reconciliation(token, { search: debouncedReconSearch, bankAccountId: reconBankAccountId, matchStatus: reconMatchStatus, from: reconFrom, to: reconTo }),
        api.resources.list('/banking/accounts', token),
        api.resources.list('/clients', token),
        api.resources.list('/projects', token)
      ]);

      setSummary(summaryRes.data || {});
      setLedger(ledgerRes.data || { entries: [], totals: {} });
      setReconciliation(reconRes.data || { entries: [], summary: {} });
      setBankAccounts(banksRes.data || []);
      setClients(clientsRes.data || []);
      setProjects(projectsRes.data || []);
    } catch (error) {
      toast.error(error.message || 'Unable to load finance data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshTick]);

  const overviewCards = useMemo(() => ([
    { title: 'Received', value: summary?.totalReceived || 0, helper: 'Actual collections', icon: Wallet, tone: 'positive' },
    { title: 'Outstanding', value: summary?.totalOutstanding || 0, helper: 'Open receivables', icon: Banknote },
    { title: 'Overdue', value: summary?.totalOverdueOutstanding || 0, helper: 'Past due invoices', icon: CircleDollarSign, tone: 'negative' },
    { title: 'Payables', value: summary?.totalPayables || 0, helper: 'Outsourcing + commissions + expenses + payroll', icon: ArrowDownRight },
    { title: 'Payroll', value: summary?.totalPayrollExpense || 0, helper: 'Active user salaries', icon: ShieldCheck },
    { title: 'Cash in Bank', value: summary?.cashInBank || 0, helper: 'Opening balance + credits - debits', icon: ArrowUpRight },
    { title: 'Net Cash Flow', value: summary?.netCashFlow || 0, helper: 'Receipts minus payables', icon: Scale },
    { title: 'Unreconciled', value: summary?.unreconciledBankTransactions || 0, helper: 'Bank lines waiting for match', icon: SplitSquareHorizontal, tone: 'negative' },
    { title: 'Payments', value: summary?.paymentCount || 0, helper: 'Recorded receipts', icon: ShieldCheck }
  ]), [summary]);

  const filteredLedgerRows = useMemo(() => {
    return (ledger.entries || []).filter((row) => {
      if (ledgerModule && String(row.module || '') !== ledgerModule) return false;
      if (ledgerDirection && String(row.direction || '') !== ledgerDirection) return false;
      if (ledgerFrom && String(row.date || '') < ledgerFrom) return false;
      if (ledgerTo && String(row.date || '') > ledgerTo) return false;
      const search = debouncedLedgerSearch.trim().toLowerCase();
      if (!search) return true;
      const haystack = [
        row.title,
        row.notes,
        row.clientName,
        row.projectName,
        row.invoiceNumber,
        row.vendorName,
        row.partnerName,
        row.reference,
        row.status
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }, [debouncedLedgerSearch, ledger.entries, ledgerDirection, ledgerFrom, ledgerModule, ledgerTo]);

  const filteredReconciliationRows = useMemo(() => {
    return (reconciliation.entries || []).filter((row) => {
      if (reconBankAccountId && String(row.bankAccountId || '') !== reconBankAccountId) return false;
      if (reconMatchStatus && String(row.matchStatus || '') !== reconMatchStatus) return false;
      if (reconFrom && String(row.date || '') < reconFrom) return false;
      if (reconTo && String(row.date || '') > reconTo) return false;
      const search = debouncedReconSearch.trim().toLowerCase();
      if (!search) return true;
      const haystack = [
        row.clientName,
        row.projectName,
        row.invoiceNumber,
        row.expenseVendor,
        row.notes,
        row.transactionType,
        row.matchStatus
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }, [debouncedReconSearch, reconBankAccountId, reconFrom, reconMatchStatus, reconTo, reconciliation.entries]);

  const summaryCards = [
    { label: 'Invoices', value: summary?.totalInvoices || 0 },
    { label: 'Paid Invoices', value: summary?.paidInvoiceCount || 0 },
    { label: 'Partials', value: summary?.partialPaymentCount || 0 },
    { label: 'Overdue', value: summary?.overdueInvoiceCount || 0 },
    { label: 'Matched', value: reconciliation?.summary?.matched || 0 },
    { label: 'Unmatched', value: reconciliation?.summary?.unmatched || 0 }
  ];

  const ledgerExportColumns = [
    { label: 'Date', getValue: (row) => formatDate(row.date) },
    { label: 'Module', getValue: (row) => row.module || '-' },
    { label: 'Entry', getValue: (row) => row.title || '-' },
    { label: 'Client', getValue: (row) => row.clientName || '-' },
    { label: 'Project', getValue: (row) => row.projectName || '-' },
    { label: 'Ref', getValue: (row) => row.reference || '-' },
    { label: 'Direction', getValue: (row) => (row.direction === 'in' ? 'Inflow' : row.direction === 'out' ? 'Outflow' : '-') },
    { label: 'Status', getValue: (row) => row.status || '-' },
    { label: 'Amount', getValue: (row) => formatAmount(row.amount || 0) }
  ];

  const reconciliationExportColumns = [
    { label: 'Date', getValue: (row) => formatDate(row.date) },
    { label: 'Bank Account', getValue: (row) => bankAccounts.find((account) => String(account.id) === String(row.bankAccountId))?.accountHolderName || row.bankAccountId || '-' },
    { label: 'Type', getValue: (row) => row.transactionType || '-' },
    { label: 'Match', getValue: (row) => row.matchStatus || '-' },
    { label: 'Client', getValue: (row) => row.clientName || '-' },
    { label: 'Project', getValue: (row) => row.projectName || '-' },
    { label: 'Invoice', getValue: (row) => row.invoiceNumber || '-' },
    { label: 'Expense', getValue: (row) => row.expenseVendor || '-' },
    { label: 'Amount', getValue: (row) => formatAmount(row.amount || 0) }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Finance Ledger"
        description="Track incoming cash, outgoing payables, and bank reconciliation from one place."
        meta={loading ? 'Loading finance data...' : `${ledger.entries?.length || 0} ledger entries`}
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'secondary', onClick: () => setRefreshTick((value) => value + 1) }
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            type="button"
            variant={activeTab === tab.key ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon size={16} />
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {overviewCards.map((card) => (
              <StatCard
                key={card.title}
                title={card.title}
                value={loading ? '...' : formatAmount(card.value)}
                helper={card.helper}
                icon={card.icon}
                tone={card.tone}
              />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] p-3 text-[var(--accent)]">
                  <ReceiptText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text)]">Receivables snapshot</h3>
                  <p className="text-sm text-[var(--text-muted)]">What is billed, collected, and still due.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Total Invoiced', summary?.totalInvoiceAmount || 0],
                  ['Total Received', summary?.totalReceived || 0],
                  ['Total Outstanding', summary?.totalOutstanding || 0],
                  ['Overdue Outstanding', summary?.totalOverdueOutstanding || 0]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">{label}</div>
                    <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{loading ? '...' : formatAmount(value)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] p-3 text-[var(--accent)]">
                  <SplitSquareHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text)]">Bank reconciliation snapshot</h3>
                  <p className="text-sm text-[var(--text-muted)]">Quick read on what is matched to bank entries.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Matched', reconciliation?.summary?.matched || 0],
                  ['Suggested', reconciliation?.summary?.suggested || 0],
                  ['Unmatched', reconciliation?.summary?.unmatched || 0],
                  ['Matched Amount', reconciliation?.summary?.matchedAmount || 0]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">{label}</div>
                    <div className="mt-2 text-2xl font-semibold text-[var(--text)]">
                      {typeof value === 'number' && label.includes('Amount') ? formatAmount(value) : value.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Health check</p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">Finance flow indicators</h3>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-[var(--text-muted)]">
                <span className="rounded-full border border-border bg-surface px-3 py-1">{summary?.paymentCount || 0} payments</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1">{summary?.bankCredits || 0} bank credits</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1">{summary?.bankDebits || 0} bank debits</span>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {summaryCards.map((item) => (
                <div key={item.label} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">{item.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{loading ? '...' : Number(item.value || 0).toLocaleString('en-IN')}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === 'ledger' ? (
        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] p-3 text-[var(--accent)]">
                  <Filter size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text)]">Ledger filters</h3>
                  <p className="text-sm text-[var(--text-muted)]">Search, narrow by module, and inspect the money trail.</p>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => downloadCsv(`finance-ledger-${new Date().toISOString().slice(0, 10)}.csv`, ledgerExportColumns, filteredLedgerRows)}
                disabled={!filteredLedgerRows.length}
              >
                <Download size={16} />
                Export CSV
              </Button>
            </div>
            <div className="grid gap-4 xl:grid-cols-6">
              <div className="xl:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Search</label>
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <Input className="pl-10" value={ledgerSearch} onChange={(e) => setLedgerSearch(e.target.value)} placeholder="Search notes, client, invoice..." />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Module</label>
                <Select options={moduleOptions} value={ledgerModule} onChange={setLedgerModule} placeholder="All modules" searchable={false} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Direction</label>
                <Select options={directionOptions} value={ledgerDirection} onChange={setLedgerDirection} placeholder="All directions" searchable={false} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">From</label>
                <Input type="date" value={ledgerFrom} onChange={(e) => setLedgerFrom(e.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">To</label>
                <Input type="date" value={ledgerTo} onChange={(e) => setLedgerTo(e.target.value)} />
              </div>
            </div>
          </Card>

          <DataTable
            loading={loading}
            columns={[
              { key: 'date', label: 'Date', type: 'date' },
              { key: 'module', label: 'Module' },
              { key: 'title', label: 'Entry' },
              { key: 'clientName', label: 'Client' },
              { key: 'projectName', label: 'Project' },
              { key: 'reference', label: 'Ref' },
              { key: 'direction', label: 'Direction', render: (row) => <Badge tone={row.direction}>{row.direction === 'in' ? 'In' : 'Out'}</Badge> },
              { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status}>{row.status || '-'}</Badge> },
              { key: 'amount', label: 'Amount', type: 'money', align: 'right' }
            ]}
            rows={filteredLedgerRows}
            selectable={false}
            emptyTitle="No ledger entries"
            emptyDescription="Try changing the filters or search query."
            rowActions={(row) => (
              <div className="flex items-center justify-end gap-2">
                {row.invoiceId ? (
                  <Button type="button" variant="ghost" size="icon" title="Open Invoice" onClick={() => navigate(`/app/invoices/${row.invoiceId}`)}>
                    <ArrowRight size={16} />
                  </Button>
                ) : null}
                {row.clientId ? (
                  <Button type="button" variant="ghost" size="icon" title="Open Client" onClick={() => navigate(`/app/clients/${row.clientId}`)}>
                    <ArrowRight size={16} />
                  </Button>
                ) : null}
                {row.projectId ? (
                  <Button type="button" variant="ghost" size="icon" title="Open Project" onClick={() => navigate(`/app/projects/${row.projectId}`)}>
                    <ArrowRight size={16} />
                  </Button>
                ) : null}
              </div>
            )}
          />
        </div>
      ) : null}

      {activeTab === 'reconciliation' ? (
        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] p-3 text-[var(--accent)]">
                  <SplitSquareHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text)]">Reconciliation filters</h3>
                  <p className="text-sm text-[var(--text-muted)]">Match and trace bank entries against invoices and expenses.</p>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => downloadCsv(`finance-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`, reconciliationExportColumns, filteredReconciliationRows)}
                disabled={!filteredReconciliationRows.length}
              >
                <Download size={16} />
                Export CSV
              </Button>
            </div>
            <div className="grid gap-4 xl:grid-cols-6">
              <div className="xl:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Search</label>
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <Input className="pl-10" value={reconSearch} onChange={(e) => setReconSearch(e.target.value)} placeholder="Search client, invoice, note..." />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Bank account</label>
                <Select
                  options={[{ value: '', label: 'All accounts' }, ...bankAccounts.map((account) => ({
                    value: account.id,
                    label: account.accountHolderName ? `${account.bankName} - ${account.accountHolderName}` : account.bankName
                  }))]}
                  value={reconBankAccountId}
                  onChange={setReconBankAccountId}
                  placeholder="All accounts"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Match status</label>
                <Select options={matchOptions} value={reconMatchStatus} onChange={setReconMatchStatus} placeholder="All statuses" searchable={false} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">From</label>
                <Input type="date" value={reconFrom} onChange={(e) => setReconFrom(e.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">To</label>
                <Input type="date" value={reconTo} onChange={(e) => setReconTo(e.target.value)} />
              </div>
            </div>
          </Card>

          <DataTable
            loading={loading}
            columns={[
              { key: 'date', label: 'Date', type: 'date' },
              { key: 'bankAccountId', label: 'Bank Account', render: (row) => bankAccounts.find((account) => String(account.id) === String(row.bankAccountId))?.accountHolderName || row.bankAccountId || '-' },
              { key: 'transactionType', label: 'Type' },
              { key: 'matchStatus', label: 'Match', render: (row) => <Badge tone={row.matchStatus}>{row.matchStatus}</Badge> },
              { key: 'clientName', label: 'Client' },
              { key: 'projectName', label: 'Project' },
              { key: 'invoiceNumber', label: 'Invoice' },
              { key: 'expenseVendor', label: 'Expense' },
              { key: 'amount', label: 'Amount', type: 'money', align: 'right' }
            ]}
            rows={filteredReconciliationRows}
            selectable={false}
            emptyTitle="No reconciliation items"
            emptyDescription="Try a different match filter or date range."
            rowActions={(row) => (
              <div className="flex items-center justify-end gap-2">
                {row.invoiceId ? (
                  <Button type="button" variant="ghost" size="icon" title="Open Invoice" onClick={() => navigate(`/app/invoices/${row.invoiceId}`)}>
                    <ArrowRight size={16} />
                  </Button>
                ) : null}
                {row.clientId ? (
                  <Button type="button" variant="ghost" size="icon" title="Open Client" onClick={() => navigate(`/app/clients/${row.clientId}`)}>
                    <ArrowRight size={16} />
                  </Button>
                ) : null}
                {row.projectId ? (
                  <Button type="button" variant="ghost" size="icon" title="Open Project" onClick={() => navigate(`/app/projects/${row.projectId}`)}>
                    <ArrowRight size={16} />
                  </Button>
                ) : null}
              </div>
            )}
          />
        </div>
      ) : null}
    </div>
  );
}
