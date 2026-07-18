import { useEffect, useMemo, useState } from 'react';
import { BarChart3, FileText, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';
import { cn } from '../lib/cn';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/Table';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
}

const sections = [
  { key: 'summary', label: 'Summary' },
  { key: 'profit', label: 'Profit & Loss' },
  { key: 'gst', label: 'GST' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'audit', label: 'CA Audit' },
  { key: 'renewals', label: 'Renewals' }
];

export function ReportsPage() {
  const { token } = useAuth();
  const [activeSection, setActiveSection] = useState('summary');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [profitLoss, setProfitLoss] = useState(null);
  const [gst, setGst] = useState(null);
  const [payroll, setPayroll] = useState(null);
  const [audit, setAudit] = useState(null);
  const [renewals, setRenewals] = useState(null);
  const [payables, setPayables] = useState([]);
  const [renewalsPage, setRenewalsPage] = useState(1);
  const [renewalsPageSize, setRenewalsPageSize] = useState(8);
  const [payablesPage, setPayablesPage] = useState(1);
  const [payablesPageSize, setPayablesPageSize] = useState(6);
  const [payrollSearch, setPayrollSearch] = useState('');
  const [renewalsSearch, setRenewalsSearch] = useState('');
  const [payablesSearch, setPayablesSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [summaryResponse, profitResponse, gstResponse, payrollResponse, auditResponse, renewalsResponse, payablesResponse] = await Promise.all([
          api.reports.dashboard(token),
          api.reports.profitLoss(token),
          api.reports.gst(token),
          api.reports.payroll(token),
          api.reports.caAudit(token),
          api.reports.renewalDashboard(token),
          api.reports.pendingPayables(token)
        ]);
        if (!mounted) return;
        setDashboard(summaryResponse.data || {});
        setProfitLoss(profitResponse.data || {});
        setGst(gstResponse.data || {});
        setPayroll(payrollResponse?.data || {});
        setAudit(auditResponse.data || {});
        setRenewals(renewalsResponse.data || {});
        setPayables(payablesResponse.data || []);
      } catch (error) {
        if (!mounted) return;
        toast.error(error.message || 'Unable to load reports');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  const renewalRows = useMemo(() => {
    const all = renewals?.rows || [];
    let mapped = [...all].map((item) => ({
      ...item,
      amount: item.renewalPrice || item.amcAmount || item.amount || 0,
      title: item.renewalType || item.amcType || item.category || item.title || 'Renewal',
      detail: item.providerName || item.provider || item.clientName || item.notes || '-'
    }));
    if (renewalsSearch) {
      const q = renewalsSearch.toLowerCase();
      mapped = mapped.filter(r => r.title.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q) || r.recordType?.toLowerCase().includes(q));
    }
    return mapped;
  }, [renewals, renewalsSearch]);

  const payrollRows = useMemo(() => {
    const rows = payroll?.rows || [];
    let mapped = [...rows].map((item) => ({
      ...item,
      employeeName: item.fullName || item.employeeName || item.username || item.email || '-'
    }));
    if (payrollSearch) {
      const q = payrollSearch.toLowerCase();
      mapped = mapped.filter(r => r.employeeName.toLowerCase().includes(q) || r.username?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q));
    }
    return mapped;
  }, [payroll, payrollSearch]);

  const payablesRows = useMemo(() => {
    let mapped = payables.map((item) => ({ ...item, vendorName: item.vendorName || item.partnerName || item.employeeName || item.vendorName || '-' }));
    if (payablesSearch) {
      const q = payablesSearch.toLowerCase();
      mapped = mapped.filter(r => r.vendorName.toLowerCase().includes(q) || r.type?.toLowerCase().includes(q) || r.paymentStatus?.toLowerCase().includes(q));
    }
    return mapped;
  }, [payables, payablesSearch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)]">Reports Center</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Financial summaries, audit snapshots, and renewal intelligence in one place.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => window.location.reload()} className="bg-white shadow-sm border-slate-200 hover:bg-slate-50 gap-2">
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-slate-200 px-2 overflow-x-auto">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => setActiveSection(section.key)}
            className={cn(
              'inline-flex items-center gap-2 px-1 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
              activeSection === section.key
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
            )}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === 'summary' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[
            { title: 'Taxable Revenue', value: dashboard?.totalTaxableAmount || 0, helper: 'From invoices', icon: FileText, bg: 'bg-blue-50/80 text-blue-500' },
            { title: 'Received', value: dashboard?.totalReceived || 0, helper: 'Payments received', icon: BarChart3, bg: 'bg-emerald-50/80 text-emerald-500' },
            { title: 'Outstanding', value: dashboard?.totalOutstanding || dashboard?.totalDue || 0, helper: 'Open receivables', icon: BarChart3, bg: 'bg-rose-50/80 text-rose-500' },
            { title: 'Payables', value: dashboard?.totalPayables || 0, helper: 'Vendor, commission, and payroll dues', icon: BarChart3, bg: 'bg-amber-50/80 text-amber-500' },
            { title: 'Payroll', value: dashboard?.payrollExpense || 0, helper: 'Active user salaries', icon: BarChart3, bg: 'bg-purple-50/80 text-purple-500' },
            { title: 'Cash in Bank', value: dashboard?.cashInBank || 0, helper: 'Opening + credits - debits', icon: BarChart3, bg: 'bg-indigo-50/80 text-indigo-500' },
            { title: 'Net GST', value: gst?.netGstPayable || dashboard?.netGstPayable || 0, helper: 'Input minus output', icon: BarChart3, bg: 'bg-cyan-50/80 text-cyan-500' },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <Card key={i} className="px-4 py-5 flex items-center gap-3 shadow-sm border border-slate-100 rounded-[16px]">
                <div className={`shrink-0 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full ${item.bg}`}>
                  <Icon size={20} strokeWidth={2} />
                </div>
                <div className="overflow-hidden min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1 truncate">{item.title}</p>
                  <h3 className="text-base md:text-lg font-bold text-slate-800 leading-tight truncate">{loading ? '...' : formatAmount(item.value)}</h3>
                  <p className="mt-1 text-[10px] text-slate-400 truncate">{item.helper}</p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {activeSection === 'profit' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[
            { label: 'Revenue', value: profitLoss?.revenue, helper: 'Total income generated', bg: 'bg-emerald-50/80 text-emerald-500' },
            { label: 'Expense', value: profitLoss?.expense, helper: 'Total costs incurred', bg: 'bg-rose-50/80 text-rose-500' },
            { label: 'Payroll', value: profitLoss?.payrollExpense, helper: 'Employee salary costs', bg: 'bg-amber-50/80 text-amber-500' },
            { label: 'Office Expense', value: profitLoss?.officeExpense, helper: 'Operational costs', bg: 'bg-purple-50/80 text-purple-500' },
            { label: 'Profit', value: profitLoss?.profit, helper: 'Net income', bg: 'bg-blue-50/80 text-blue-500' }
          ].map((item, i) => (
            <Card key={item.label} className="px-4 py-5 flex items-center gap-3 shadow-sm border border-slate-100 rounded-[16px]">
              <div className={`shrink-0 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full ${item.bg}`}>
                <BarChart3 size={20} strokeWidth={2} />
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1 truncate">{item.label}</p>
                <h3 className="text-base md:text-lg font-bold text-slate-800 leading-tight truncate">{loading ? '...' : formatAmount(item.value || 0)}</h3>
                <p className="mt-1 text-[10px] text-slate-400 truncate">{item.helper}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {activeSection === 'gst' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Output GST', value: gst?.outputGst, helper: 'Collected from sales', bg: 'bg-amber-50/80 text-amber-500' },
            { label: 'Input GST', value: gst?.inputGst, helper: 'Paid on purchases', bg: 'bg-indigo-50/80 text-indigo-500' },
            { label: 'Net Payable', value: gst?.netGstPayable, helper: 'Amount due to govt', bg: 'bg-rose-50/80 text-rose-500' },
            { label: 'IGST', value: gst?.igst, helper: 'Inter-state tax', bg: 'bg-cyan-50/80 text-cyan-500' }
          ].map((item) => (
            <Card key={item.label} className="px-4 py-5 flex items-center gap-3 shadow-sm border border-slate-100 rounded-[16px]">
              <div className={`shrink-0 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full ${item.bg}`}>
                <BarChart3 size={20} strokeWidth={2} />
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1 truncate">{item.label}</p>
                <h3 className="text-base md:text-lg font-bold text-slate-800 leading-tight truncate">{loading ? '...' : formatAmount(item.value || 0)}</h3>
                <p className="mt-1 text-[10px] text-slate-400 truncate">{item.helper}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {activeSection === 'payroll' ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Active Employees', value: payroll?.summary?.activeEmployees, isNum: true, helper: 'Total active staff', bg: 'bg-blue-50/80 text-blue-500' },
              { label: 'Monthly Payroll', value: payroll?.summary?.totalMonthlyPayroll, helper: 'Active user salary cost', bg: 'bg-purple-50/80 text-purple-500' },
              { label: 'Annual Payroll', value: payroll?.summary?.annualPayroll, helper: 'Projected yearly cost', bg: 'bg-emerald-50/80 text-emerald-500' },
              { label: 'Average Salary', value: payroll?.summary?.averageSalary, helper: 'Average monthly salary', bg: 'bg-amber-50/80 text-amber-500' }
            ].map((item) => (
              <Card key={item.label} className="px-4 py-5 flex items-center gap-3 shadow-sm border border-slate-100 rounded-[16px]">
                <div className={`shrink-0 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full ${item.bg}`}>
                  <BarChart3 size={20} strokeWidth={2} />
                </div>
                <div className="overflow-hidden min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1 truncate">{item.label}</p>
                  <h3 className="text-base md:text-lg font-bold text-slate-800 leading-tight truncate">
                    {loading ? '...' : item.isNum ? Number(item.value || 0).toLocaleString('en-IN') : formatAmount(item.value || 0)}
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-400 truncate">{item.helper}</p>
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Payroll register</p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">User salary list</h3>
              </div>
            </div>
            <DataTable
              loading={loading}
              columns={[
                { key: 'employeeName', label: 'Employee' },
                { key: 'username', label: 'Username' },
                { key: 'email', label: 'Email' },
                { key: 'salary', label: 'Monthly Salary', type: 'money', align: 'right' },
                { key: 'annualSalary', label: 'Annual Salary', type: 'money', align: 'right' },
                { key: 'status', label: 'Status', type: 'badge' }
              ]}
              rows={payrollRows}
              selectable={true}
              toolbarLeft={
                <div className="relative flex-1 w-full max-w-xs">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                    <Search size={16} />
                  </div>
                  <Input
                    value={payrollSearch}
                    onChange={(e) => setPayrollSearch(e.target.value)}
                    placeholder="Search payroll..."
                    className="pl-9 w-full"
                  />
                </div>
              }
              onCreate={undefined}
            />
          </Card>
        </div>
      ) : null}

      {activeSection === 'audit' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Invoices', value: audit?.invoiceCount, helper: 'Total generated', bg: 'bg-blue-50/80 text-blue-500' },
            { label: 'Clients', value: audit?.clientCount, helper: 'Active clients', bg: 'bg-emerald-50/80 text-emerald-500' },
            { label: 'Projects', value: audit?.projectCount, helper: 'Ongoing projects', bg: 'bg-purple-50/80 text-purple-500' },
            { label: 'Pending TDS', value: audit?.pendingTdsCount, helper: 'TDS to be filed', bg: 'bg-rose-50/80 text-rose-500' },
            { label: 'Pending ITC', value: audit?.pendingItcCount, helper: 'ITC to be claimed', bg: 'bg-amber-50/80 text-amber-500' },
            { label: 'Renewals Due', value: audit?.renewalDueSoonCount, helper: 'Upcoming renewals', bg: 'bg-indigo-50/80 text-indigo-500' }
          ].map((item) => (
            <Card key={item.label} className="px-4 py-5 flex items-center gap-3 shadow-sm border border-slate-100 rounded-[16px]">
              <div className={`shrink-0 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full ${item.bg}`}>
                <FileText size={20} strokeWidth={2} />
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1 truncate">{item.label}</p>
                <h3 className="text-base md:text-lg font-bold text-slate-800 leading-tight truncate">{loading ? '...' : Number(item.value || 0).toLocaleString('en-IN')}</h3>
                <p className="mt-1 text-[10px] text-slate-400 truncate">{item.helper}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {activeSection === 'renewals' ? (
        <Card>
          <DataTable
            loading={loading}
            columns={[
              { key: 'renewalDate', label: 'Date', type: 'date' },
              { key: 'recordType', label: 'Type' },
              { key: 'title', label: 'Title' },
              { key: 'detail', label: 'Detail', ellipsis: true },
              { key: 'amount', label: 'Amount', type: 'money', align: 'right' }
            ]}
            rows={renewalRows}
            selectable={true}
            toolbarLeft={
              <div className="relative flex-1 w-full max-w-xs">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <Search size={16} />
                </div>
                <Input
                  value={renewalsSearch}
                  onChange={(e) => {
                    setRenewalsSearch(e.target.value);
                    setRenewalsPage(1);
                  }}
                  placeholder="Search renewals..."
                  className="pl-9 w-full"
                />
              </div>
            }
            onCreate={undefined}
            page={renewalsPage}
            pageSize={renewalsPageSize}
            onPageChange={setRenewalsPage}
            onPageSizeChange={(size) => {
              setRenewalsPageSize(size);
              setRenewalsPage(1);
            }}
          />
        </Card>
      ) : null}

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Payables</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">Pending vendor, commission, and payroll payables</h3>
          </div>
        </div>
        <DataTable
          loading={loading}
          columns={[
            { key: 'type', label: 'Type', type: 'badge' },
            { key: 'vendorName', label: 'Name', render: (row) => row.vendorName || row.partnerName || row.employeeName || row.detail || '-' },
            { key: 'paymentStatus', label: 'Status', type: 'badge' },
            { key: 'amount', label: 'Amount', type: 'money', align: 'right' }
          ]}
          rows={payablesRows}
          selectable={true}
          toolbarLeft={
            <div className="relative flex-1 w-full max-w-xs">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                <Search size={16} />
              </div>
              <Input
                value={payablesSearch}
                onChange={(e) => {
                  setPayablesSearch(e.target.value);
                  setPayablesPage(1);
                }}
                placeholder="Search payables..."
                className="pl-9 w-full"
              />
            </div>
          }
          onCreate={undefined}
          page={payablesPage}
          pageSize={payablesPageSize}
          onPageChange={setPayablesPage}
          onPageSizeChange={(size) => {
            setPayablesPageSize(size);
            setPayablesPage(1);
          }}
        />
      </Card>
    </div>
  );
}
