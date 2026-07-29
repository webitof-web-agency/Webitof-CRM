import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  IndianRupee,
  Paperclip,
  Tag,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../components/ui/Loader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatDateOnlyDisplay } from '../../lib/dateOnly';
import { cn } from '../../lib/cn';

function formatMoney(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
}

export function ExpenseDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, hasPermission } = useAuth();
  const [expense, setExpense] = useState(null);
  const [category, setCategory] = useState(null);
  const [bankAccount, setBankAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  const canRead = hasPermission('expenses.read');

  useEffect(() => {
    if (!canRead) {
      navigate('/app/dashboard', { replace: true });
      return;
    }

    let active = true;
    async function load() {
      try {
        const response = await api.resources.get('/expenses', id, token);
        if (!active) return;
        const data = response.data;
        if (!data) throw new Error('Expense not found');
        setExpense(data);

        // Fetch category name
        if (data.categoryId) {
          try {
            const categoriesRes = await api.resources.list('/masters/expense_category', token);
            const categoryData = categoriesRes.data?.find(c => c.id === data.categoryId);
            if (categoryData && active) {
              setCategory(categoryData);
            }
          } catch (e) {
            console.error('Failed to load category', e);
          }
        }

        if (data.bankAccountId) {
          try {
            const bankAccountsRes = await api.resources.list('/banking/accounts', token);
            const bankAccountData = bankAccountsRes.data?.find((account) => String(account.id) === String(data.bankAccountId));
            if (bankAccountData && active) {
              setBankAccount(bankAccountData);
            }
          } catch (e) {
            console.error('Failed to load bank account', e);
          }
        }
      } catch (error) {
        if (!active) return;
        toast.error(error.message || 'Unable to load expense');
        navigate('/app/expenses');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id, token, canRead, navigate]);

  if (loading) return <PageLoader />;
  if (!expense) return null;

  const totalAmount = Number(expense.totalAmount || 0);
  const gstAmount = Number(expense.gstAmount || 0);
  const baseAmount = Number(expense.amountBeforeGst || 0);
  const tdsAmount = Number(expense.tdsAmount || 0);
  const balanceDue = Number(expense.balanceDue || 0);

  const basePercent = totalAmount > 0 ? (baseAmount / totalAmount) * 100 : 0;
  const gstPercent = totalAmount > 0 ? (gstAmount / totalAmount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/expenses')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft size={16} />
              Back to Expenses
            </button>
            <span className="text-slate-300">/</span>
            <h1 className="text-base font-semibold tracking-tight text-[var(--text-main)]">
              Expense {expense.invoiceNumber ? `#${expense.invoiceNumber}` : ''}
            </h1>
          </div>
          <div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                {expense.paymentStatus || expense.status || 'Pending'}
              </span>
              <span className="text-sm text-[var(--text-muted)]">
                {expense.payeeName || expense.vendor || 'Unknown Payee'} &bull; {formatDateOnlyDisplay(expense.expenseDate)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
          <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-emerald-50/80 text-emerald-500">
            <IndianRupee size={24} strokeWidth={2} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Total Amount</p>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">{formatMoney(totalAmount)}</h3>
            <p className="mt-1 text-xs text-slate-400 truncate">Total expenditure</p>
          </div>
        </Card>
        
        <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
          <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-blue-50/80 text-blue-500">
            <Wallet size={24} strokeWidth={2} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Base Amount</p>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">{formatMoney(baseAmount)}</h3>
            <p className="mt-1 text-xs text-slate-400 truncate">Amount before tax</p>
          </div>
        </Card>
        
        <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
          <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-amber-50/80 text-amber-500">
            <FileText size={24} strokeWidth={2} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">GST Amount</p>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">{formatMoney(gstAmount)}</h3>
            <p className="mt-1 text-xs text-slate-400 truncate">Tax applied</p>
          </div>
        </Card>

        <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
          <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-purple-50/80 text-purple-500">
            <Tag size={24} strokeWidth={2} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Category</p>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate" title={category?.name || '-'}>{category?.name || '-'}</h3>
            <p className="mt-1 text-xs text-slate-400 truncate">Expense category</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Analytics Visual */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--text-main)] mb-6">Tax Breakdown</h3>
            <div className="mb-4 flex items-center justify-between text-sm text-[var(--text-muted)]">
              <span>Base Amount ({basePercent.toFixed(1)}%)</span>
              <span>GST ({gstPercent.toFixed(1)}%)</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 flex">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${basePercent}%` }}
              />
              <div
                className="h-full bg-amber-400 transition-all duration-500"
                style={{ width: `${gstPercent}%` }}
              />
            </div>
            
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)] mb-1">ITC Eligible</p>
                <p className={cn("text-lg font-semibold", expense.itcEligible ? "text-emerald-600" : "text-[var(--text-main)]")}>
                  {expense.itcEligible ? 'Yes' : 'No'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)] mb-1">RCM Applicable</p>
                <p className={cn("text-lg font-semibold", expense.rcmApplicable ? "text-amber-600" : "text-[var(--text-main)]")}>
                  {expense.rcmApplicable ? 'Yes' : 'No'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)] mb-1">Balance Due</p>
                <p className="text-lg font-semibold text-[var(--text-main)]">{formatMoney(balanceDue)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--text-main)] mb-4">Workflow</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Status</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{expense.status || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Approval Status</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{expense.approvalStatus || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Payment Status</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{expense.paymentStatus || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Due Date</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{expense.dueDate ? formatDateOnlyDisplay(expense.dueDate) : '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Period</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">
                  {expense.periodStart || expense.periodEnd
                    ? `${expense.periodStart ? formatDateOnlyDisplay(expense.periodStart) : '-'} to ${expense.periodEnd ? formatDateOnlyDisplay(expense.periodEnd) : '-'}`
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">TDS Amount</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{formatMoney(tdsAmount)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Cost Center</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{expense.costCenter || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Invoice Number</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{expense.invoiceNumber || '-'}</p>
              </div>
            </div>
          </Card>

          {/* Details Table */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--text-main)] mb-4">Payee Details</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Expense Type</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{expense.expenseType || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Payee Type</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{expense.payeeType || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Payee Name</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{expense.payeeName || expense.vendor || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Category</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{category?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Payment Mode</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{expense.paymentMode || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Bank Account</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">
                  {bankAccount
                    ? `${bankAccount.bankName || 'Bank'}${bankAccount.accountHolderName ? ` • ${bankAccount.accountHolderName}` : ''}${bankAccount.accountNumber ? ` • ${bankAccount.accountNumber}` : ''}`
                    : expense.bankAccountId || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Vendor GSTIN</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{expense.vendorGstin || '-'}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Attachments */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--text-main)] mb-4 flex items-center gap-2">
              <Paperclip size={18} className="text-[var(--text-muted)]" />
              Attachments
            </h3>
            
            {Array.isArray(expense.attachments) && expense.attachments.length > 0 ? (
              <div className="space-y-3">
                {expense.attachments.map((file, idx) => (
                  <a
                    key={file.id || idx}
                    href={file.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50 hover:border-slate-300"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text-main)]">{file.name || 'Attachment'}</p>
                        <p className="text-xs text-[var(--text-muted)]">{file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Unknown size'}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <Paperclip className="mx-auto h-6 w-6 text-slate-300" />
                <p className="mt-2 text-sm text-[var(--text-muted)]">No attachments found</p>
              </div>
            )}
          </Card>

          {/* Notes */}
          {expense.notes && (
            <Card className="p-6 bg-amber-50/50 border-amber-100">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">Notes</h3>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{expense.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
