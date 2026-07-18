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
  Download,
  Activity,
  FileText,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  XCircle,
  CheckSquare,
  PieChart,
  Clock,
  CheckCheck,
  Receipt,
  ChevronsDown,
  Building2,
  Briefcase
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
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 10);
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const dateStr = `${day}-${month}-${year}`;
    
    const valStr = String(value);
    const hasTime = valStr.includes('T') && !valStr.endsWith('T00:00:00.000Z') && !valStr.endsWith('T00:00:00Z');
    
    if (hasTime) {
      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      return `${dateStr} ${timeStr}`;
    }
    return dateStr;
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

  const [overviewFrom, setOverviewFrom] = useState('');
  const [overviewTo, setOverviewTo] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const [summaryRes, ledgerRes, reconRes, banksRes, clientsRes, projectsRes] = await Promise.all([
        api.finance.summary(token, { from: overviewFrom, to: overviewTo }),
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
  }, [token, refreshTick, overviewFrom, overviewTo]);

  const overviewCards = useMemo(() => ([
    { title: 'RECEIVED', value: summary?.totalReceived || 0, helper: 'Actual collections', icon: Wallet, color: 'text-green-500', bg: 'bg-green-50/80' },
    { title: 'OUTSTANDING', value: summary?.totalOutstanding || 0, helper: 'Open receivables', icon: Banknote, color: 'text-blue-500', bg: 'bg-blue-50/80' },
    { title: 'OVERDUE', value: summary?.totalOverdueOutstanding || 0, helper: 'Past due invoices', icon: CircleDollarSign, color: 'text-rose-500', bg: 'bg-rose-50/80' },
    { title: 'PAYABLES', value: summary?.totalPayables || 0, helper: 'Outsourcing + commissions + expenses + payroll', icon: ArrowDownRight, color: 'text-orange-500', bg: 'bg-orange-50/80' },
    { title: 'PAYROLL', value: summary?.totalPayrollExpense || 0, helper: 'Active user salaries', icon: ShieldCheck, color: 'text-purple-500', bg: 'bg-purple-50/80' },
    { title: 'CASH IN BANK', value: summary?.cashInBank || 0, helper: 'Opening balance + credits - debits', icon: ArrowUpRight, color: 'text-emerald-500', bg: 'bg-emerald-50/80' },
    { title: 'NET CASH FLOW', value: summary?.netCashFlow || 0, helper: 'Receipts minus payables', icon: Scale, color: 'text-cyan-500', bg: 'bg-cyan-50/80' },
    { title: 'UNRECONCILED', value: summary?.unreconciledBankTransactions || 0, helper: 'Bank lines waiting for match', icon: SplitSquareHorizontal, color: 'text-pink-500', bg: 'bg-pink-50/80' },
    { title: 'PAYMENTS', value: summary?.paymentCount || 0, helper: 'Recorded receipts', icon: ShieldCheck, color: 'text-indigo-500', bg: 'bg-indigo-50/80', isCount: true }
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
    { label: 'Invoices', value: summary?.totalInvoices || 0, icon: FileText, rightIcon: Receipt, color: 'blue' },
    { label: 'Paid Invoices', value: summary?.paidInvoiceCount || 0, icon: CheckSquare, rightIcon: ChevronsDown, color: 'emerald' },
    { label: 'Partials', value: summary?.partialPaymentCount || 0, icon: Clock, rightIcon: PieChart, color: 'orange' },
    { label: 'Overdue', value: summary?.overdueInvoiceCount || 0, icon: AlertCircle, rightIcon: AlertCircle, color: 'red' },
    { label: 'Matched', value: reconciliation?.summary?.matched || 0, icon: CheckCircle2, rightIcon: CheckCircle2, color: 'emerald' },
    { label: 'Unmatched', value: reconciliation?.summary?.unmatched || 0, icon: XCircle, rightIcon: XCircle, color: 'blue' }
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Finance Ledger</h1>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 px-2 mb-6">
        <div className="flex items-center gap-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 px-1 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-[var(--primary)] text-[var(--primary)]'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {Icon && <Icon size={16} className={activeTab === tab.key ? 'text-[var(--primary)]' : 'text-slate-400'} />}
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 pb-2 sm:pb-0 gap-3">
          {activeTab === 'overview' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={overviewFrom}
                onChange={(e) => setOverviewFrom(e.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
              />
              <span className="text-slate-400 text-sm">to</span>
              <input
                type="date"
                value={overviewTo}
                onChange={(e) => setOverviewTo(e.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
              />
            </div>
          )}
          {activeTab === 'ledger' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shadow-sm"
              onClick={() => downloadCsv(`finance-ledger-${new Date().toISOString().slice(0, 10)}.csv`, ledgerExportColumns, filteredLedgerRows)}
              disabled={!filteredLedgerRows.length}
            >
              <Download size={16} className="mr-2" />
              Export CSV
            </Button>
          )}
          {activeTab === 'reconciliation' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shadow-sm"
              onClick={() => downloadCsv(`finance-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`, reconciliationExportColumns, filteredReconciliationRows)}
              disabled={!filteredReconciliationRows.length}
            >
              <Download size={16} className="mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {overviewCards.map((card, i) => (
              <Card key={i} className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
                <div className={`shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full ${card.bg} ${card.color}`}>
                  <card.icon size={24} strokeWidth={2} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">{card.title}</p>
                  <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">
                    {loading ? '...' : (card.isCount ? Number(card.value || 0).toLocaleString('en-IN') : formatAmount(card.value))}
                  </h3>
                  {card.helper && <p className="text-[9px] text-slate-400 mt-1 truncate">{card.helper}</p>}
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5 shadow-sm border border-slate-100 flex flex-col rounded-[16px] bg-white">
              <div className="flex items-center gap-3.5 mb-5">
                <div className="w-10 h-10 rounded-[10px] flex items-center justify-center relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
                  <ReceiptText size={20} strokeWidth={2} style={{ color: 'var(--primary)' }} className="relative z-10" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Receivables snapshot</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">What is billed, collected, and still due.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Total Invoiced', summary?.totalInvoiceAmount || 0, FileText],
                  ['Total Received', summary?.totalReceived || 0, Wallet],
                  ['Total Outstanding', summary?.totalOutstanding || 0, CircleDollarSign],
                  ['Overdue Outstanding', summary?.totalOverdueOutstanding || 0, AlertCircle]
                ].map(([label, value, Icon]) => (
                  <div key={label} className="rounded-[12px] border border-slate-100 p-4 bg-white hover:border-slate-200 transition-colors">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="text-slate-400">
                        <Icon size={16} strokeWidth={2.5} />
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">{label}</div>
                    </div>
                    <div className={`text-lg font-bold ${label === 'Overdue Outstanding' ? 'text-red-500' : 'text-slate-800'}`}>
                      {loading ? '...' : formatAmount(value)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 md:p-6 shadow-sm border border-slate-100 flex flex-col rounded-[20px] bg-white">
              <div className="flex items-center gap-3.5 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
                  <SplitSquareHorizontal size={20} strokeWidth={2} style={{ color: 'var(--primary)' }} className="relative z-10" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Bank reconciliation snapshot</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Quick read on what is matched to bank entries.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Matched', reconciliation?.summary?.matched || 0, CheckCircle2],
                  ['Suggested', reconciliation?.summary?.suggested || 0, HelpCircle],
                  ['Unmatched', reconciliation?.summary?.unmatched || 0, XCircle],
                  ['Matched Amount', reconciliation?.summary?.matchedAmount || 0, Banknote]
                ].map(([label, value, Icon]) => (
                  <div key={label} className="rounded-[12px] border border-slate-100 p-4 bg-white hover:border-slate-200 transition-colors">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="text-slate-400">
                        <Icon size={16} strokeWidth={2.5} />
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">{label}</div>
                    </div>
                    <div className="text-lg font-bold text-slate-800">
                      {typeof value === 'number' && label.includes('Amount') ? formatAmount(value) : value.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-5 md:p-6 shadow-sm border border-slate-100 flex flex-col rounded-[20px] bg-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
                  <Activity size={20} strokeWidth={2} style={{ color: 'var(--primary)' }} className="relative z-10" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-0.5">Health check</p>
                  <h3 className="text-sm font-bold text-slate-800">Finance flow indicators</h3>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 bg-slate-50">{summary?.paymentCount || 0} payments</span>
                <span className="rounded-full border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 bg-slate-50">{summary?.bankCredits || 0} bank credits</span>
                <span className="rounded-full border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 bg-slate-50">{summary?.bankDebits || 0} bank debits</span>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {summaryCards.map((item) => {
                const Icon = item.icon;
                const RightIcon = item.rightIcon;
                return (
                  <div key={item.label} className="rounded-[16px] border border-slate-100 p-4 bg-white flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-${item.color}-50 text-${item.color}-500`}>
                        <Icon size={20} strokeWidth={2.5} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-0.5">{item.label}</div>
                        <div className="text-lg font-bold text-slate-800">{loading ? '...' : Number(item.value || 0).toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-${item.color}-50 text-${item.color}-500 shrink-0`}>
                      <RightIcon size={16} strokeWidth={2.5} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === 'ledger' ? (
        <div className="space-y-6">
          <DataTable
            toolbarLeft={
              <div className="relative flex-1 w-full max-w-sm">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input className="pl-9 w-full" value={ledgerSearch} onChange={(e) => setLedgerSearch(e.target.value)} placeholder="Search notes, client, invoice..." />
              </div>
            }
            toolbarRight={
              <div className="flex items-center gap-3">
                <div className="w-32 md:w-36">
                  <Select options={moduleOptions} value={ledgerModule} onChange={setLedgerModule} placeholder="All modules" searchable={false} />
                </div>
                <div className="w-32 md:w-36">
                  <Select options={directionOptions} value={ledgerDirection} onChange={setLedgerDirection} placeholder="All directions" searchable={false} />
                </div>
                <Input type="date" value={ledgerFrom} onChange={(e) => setLedgerFrom(e.target.value)} title="From" className="w-auto h-10" />
                <Input type="date" value={ledgerTo} onChange={(e) => setLedgerTo(e.target.value)} title="To" className="w-auto h-10" />
              </div>
            }
            loading={loading}
            columns={[
              { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
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
            selectable={true}
            emptyTitle="No ledger entries"
            emptyDescription="Try changing the filters or search query."
            rowActions={(row) => (
              <div className="flex items-center justify-end gap-1">
                {row.invoiceId ? (
                  <Button type="button" variant="ghost" size="icon" title="Open Invoice" onClick={() => navigate(`/app/invoices/${row.invoiceId}`)}>
                    <FileText size={16} className="text-slate-400 hover:text-blue-500 transition-colors" />
                  </Button>
                ) : null}
                {row.clientId ? (
                  <Button type="button" variant="ghost" size="icon" title="Open Client" onClick={() => navigate(`/app/clients/${row.clientId}`)}>
                    <Building2 size={16} className="text-slate-400 hover:text-emerald-500 transition-colors" />
                  </Button>
                ) : null}
                {row.projectId ? (
                  <Button type="button" variant="ghost" size="icon" title="Open Project" onClick={() => navigate(`/app/projects/${row.projectId}`)}>
                    <Briefcase size={16} className="text-slate-400 hover:text-purple-500 transition-colors" />
                  </Button>
                ) : null}
              </div>
            )}
          />
        </div>
      ) : null}

      {activeTab === 'reconciliation' ? (
        <div className="space-y-6">
          <DataTable
            toolbarLeft={
              <div className="relative flex-1 w-full max-w-sm">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input className="pl-9 w-full" value={reconSearch} onChange={(e) => setReconSearch(e.target.value)} placeholder="Search client, invoice, note..." />
              </div>
            }
            toolbarRight={
              <div className="flex items-center gap-3">
                <div className="w-40 md:w-48">
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
                <div className="w-32 md:w-36">
                  <Select options={matchOptions} value={reconMatchStatus} onChange={setReconMatchStatus} placeholder="All statuses" searchable={false} />
                </div>
                <Input type="date" value={reconFrom} onChange={(e) => setReconFrom(e.target.value)} title="From" className="w-auto h-10" />
                <Input type="date" value={reconTo} onChange={(e) => setReconTo(e.target.value)} title="To" className="w-auto h-10" />
              </div>
            }
            loading={loading}
            columns={[
              { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
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
            selectable={true}
            emptyTitle="No reconciliation items"
            emptyDescription="Try a different match filter or date range."
            rowActions={(row) => (
              <div className="flex items-center justify-end gap-1">
                {row.invoiceId ? (
                  <Button type="button" variant="ghost" size="icon" title="Open Invoice" onClick={() => navigate(`/app/invoices/${row.invoiceId}`)}>
                    <FileText size={16} className="text-slate-400 hover:text-blue-500 transition-colors" />
                  </Button>
                ) : null}
                {row.clientId ? (
                  <Button type="button" variant="ghost" size="icon" title="Open Client" onClick={() => navigate(`/app/clients/${row.clientId}`)}>
                    <Building2 size={16} className="text-slate-400 hover:text-emerald-500 transition-colors" />
                  </Button>
                ) : null}
                {row.projectId ? (
                  <Button type="button" variant="ghost" size="icon" title="Open Project" onClick={() => navigate(`/app/projects/${row.projectId}`)}>
                    <Briefcase size={16} className="text-slate-400 hover:text-purple-500 transition-colors" />
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
