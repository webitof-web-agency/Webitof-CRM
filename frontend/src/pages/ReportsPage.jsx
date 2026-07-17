import { useEffect, useMemo, useState } from 'react';
import { BarChart3, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/Table';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
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
    return [...all].map((item) => ({
      ...item,
      amount: item.renewalPrice || item.amcAmount || item.amount || 0,
      title: item.renewalType || item.amcType || item.category || item.title || 'Renewal',
      detail: item.providerName || item.provider || item.clientName || item.notes || '-'
    }));
  }, [renewals]);

  const payrollRows = useMemo(() => {
    const rows = payroll?.rows || [];
    return [...rows].map((item) => ({
      ...item,
      employeeName: item.fullName || item.employeeName || item.username || item.email || '-'
    }));
  }, [payroll]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Reports Center"
        description="Financial summaries, audit snapshots, and renewal intelligence in one place."
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'secondary', onClick: () => window.location.reload() }
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <Button
            key={section.key}
            type="button"
            variant={activeSection === section.key ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveSection(section.key)}
          >
            {section.label}
          </Button>
        ))}
      </div>

      {activeSection === 'summary' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <StatCard title="Taxable Revenue" value={loading ? '...' : formatAmount(dashboard?.totalTaxableAmount || 0)} helper="From invoices" icon={FileText} />
          <StatCard title="Received" value={loading ? '...' : formatAmount(dashboard?.totalReceived || 0)} helper="Payments received" icon={BarChart3} />
          <StatCard title="Outstanding" value={loading ? '...' : formatAmount(dashboard?.totalOutstanding || dashboard?.totalDue || 0)} helper="Open receivables" icon={BarChart3} />
          <StatCard title="Payables" value={loading ? '...' : formatAmount(dashboard?.totalPayables || 0)} helper="Vendor, commission, and payroll dues" icon={BarChart3} />
          <StatCard title="Payroll" value={loading ? '...' : formatAmount(dashboard?.payrollExpense || 0)} helper="Active user salaries" icon={BarChart3} />
          <StatCard title="Cash in Bank" value={loading ? '...' : formatAmount(dashboard?.cashInBank || 0)} helper="Opening + credits - debits" icon={BarChart3} />
          <StatCard title="Net GST" value={loading ? '...' : formatAmount(gst?.netGstPayable || dashboard?.netGstPayable || 0)} helper="Input minus output" icon={BarChart3} />
        </div>
      ) : null}

      {activeSection === 'profit' ? (
        <Card className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ['Revenue', profitLoss?.revenue],
            ['Expense', profitLoss?.expense],
            ['Payroll', profitLoss?.payrollExpense],
            ['Office Expense', profitLoss?.officeExpense],
            ['Profit', profitLoss?.profit]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{loading ? '...' : formatAmount(value || 0)}</div>
            </div>
          ))}
        </Card>
      ) : null}

      {activeSection === 'gst' ? (
        <Card className="grid gap-4 md:grid-cols-4">
          {[
            ['Output GST', gst?.outputGst],
            ['Input GST', gst?.inputGst],
            ['Net Payable', gst?.netGstPayable],
            ['IGST', gst?.igst]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{loading ? '...' : formatAmount(value || 0)}</div>
            </div>
          ))}
        </Card>
      ) : null}

      {activeSection === 'payroll' ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['Active Employees', payroll?.summary?.activeEmployees],
              ['Monthly Payroll', payroll?.summary?.totalMonthlyPayroll],
              ['Annual Payroll', payroll?.summary?.annualPayroll],
              ['Average Salary', payroll?.summary?.averageSalary]
            ].map(([label, value]) => (
              <StatCard
                key={label}
                title={label}
                value={loading ? '...' : label.includes('Employees') ? Number(value || 0).toLocaleString('en-IN') : formatAmount(value || 0)}
                helper={label === 'Monthly Payroll' ? 'Active user salary cost' : label === 'Average Salary' ? 'Average monthly salary' : 'Payroll metrics'}
                icon={BarChart3}
              />
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
              selectable={false}
              onCreate={undefined}
            />
          </Card>
        </div>
      ) : null}

      {activeSection === 'audit' ? (
        <Card className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            ['Invoices', audit?.invoiceCount],
            ['Clients', audit?.clientCount],
            ['Projects', audit?.projectCount],
            ['Pending TDS', audit?.pendingTdsCount],
            ['Pending ITC', audit?.pendingItcCount],
            ['Renewals Due', audit?.renewalDueSoonCount]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{loading ? '...' : Number(value || 0).toLocaleString('en-IN')}</div>
            </div>
          ))}
        </Card>
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
            selectable={false}
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
          rows={payables.map((item) => ({ ...item, vendorName: item.vendorName || item.partnerName || item.employeeName || item.vendorName || '-' }))}
          selectable={false}
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
