import { useEffect, useMemo, useState } from 'react';
import { Banknote, Plus, Edit2, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { ResourceForm } from '../components/forms/ResourceForm';
import { useAuth } from '../context/AuthContext';
import { sortRows } from '../lib/resource';

const accountSchema = {
  key: 'banking-accounts',
  label: 'Bank Accounts',
  singular: 'Bank Account',
  permission: 'banking.read',
  apiPath: '/banking/accounts',
  fields: [
    { name: 'bankName', label: 'Bank Name', type: 'text', required: true },
    { name: 'accountHolderName', label: 'Account Holder Name', type: 'text', required: true },
    { name: 'accountNumber', label: 'Account Number', type: 'text' },
    { name: 'ifsc', label: 'IFSC', type: 'text' },
    { name: 'branch', label: 'Branch', type: 'text' },
    { name: 'accountType', label: 'Account Type', type: 'select', options: ['Current', 'Savings', 'OD', 'Cash Credit'] },
    { name: 'upiId', label: 'UPI ID', type: 'text' },
    { name: 'openingBalance', label: 'Opening Balance', type: 'money' },
    { name: 'isPrimary', label: 'Primary Account', type: 'checkbox' }
  ],
  columns: [
    { key: 'bankName', label: 'Bank' },
    { key: 'accountHolderName', label: 'Holder' },
    { key: 'accountNumber', label: 'Account Number' },
    { key: 'accountType', label: 'Type' },
    { key: 'openingBalance', label: 'Opening Balance', type: 'money', align: 'right' },
    { key: 'isPrimary', label: 'Primary', type: 'badge' }
  ]
};

const transactionSchema = {
  key: 'banking-transactions',
  label: 'Bank Transactions',
  singular: 'Transaction',
  permission: 'banking.read',
  apiPath: '/banking/transactions',
  fields: [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'bankAccountId', label: 'Bank Account', type: 'select', required: true, lookupKey: 'bankAccounts', lookupLabelKey: 'accountHolderName', lookupDescriptionKey: 'accountNumber' },
    { name: 'transactionType', label: 'Transaction Type', type: 'select', options: ['Credit', 'Debit', 'Transfer', 'Adjustment'] },
    { name: 'amount', label: 'Amount', type: 'money', required: true },
    { name: 'linkedClientId', label: 'Linked Client', type: 'select', lookupKey: 'clients' },
    { name: 'linkedProjectId', label: 'Linked Project', type: 'select', lookupKey: 'projects' },
    { name: 'linkedInvoiceId', label: 'Linked Invoice', type: 'select', lookupKey: 'invoices' },
    { name: 'linkedExpenseId', label: 'Linked Expense', type: 'select', lookupKey: 'expenses' },
    { name: 'notes', label: 'Notes', type: 'textarea' }
  ],
  columns: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'bankAccountId', label: 'Bank Account' },
    { key: 'transactionType', label: 'Type' },
    { key: 'amount', label: 'Amount', type: 'money', align: 'right' },
    { key: 'notes', label: 'Notes', ellipsis: true }
  ]
};

function getLabelById(rows, id, key = 'name') {
  return rows.find((row) => row.id === id)?.[key] || id || '-';
}

export function BankingPage() {
  const { token, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [lookups, setLookups] = useState({ bankAccounts: [], clients: [], projects: [], invoices: [], expenses: [] });
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);
  const [busy, setBusy] = useState(false);

  const [filterType, setFilterType] = useState('');
  const [filterBank, setFilterBank] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterProject, setFilterProject] = useState('');

  useEffect(() => {
    setFilterType('');
    setFilterBank('');
    setFilterClient('');
    setFilterProject('');
  }, [activeTab]);

  const schema = activeTab === 'accounts' ? accountSchema : transactionSchema;

  async function load() {
    setLoading(true);
    try {
      const [accountsResponse, transactionsResponse, clientsResponse, projectsResponse, invoicesResponse, expensesResponse] = await Promise.all([
        api.resources.list('/banking/accounts', token),
        api.resources.list('/banking/transactions', token),
        api.resources.list('/clients', token),
        api.resources.list('/projects', token),
        api.resources.list('/invoices', token),
        api.resources.list('/expenses', token)
      ]);
      setAccounts(accountsResponse.data || []);
      setTransactions(transactionsResponse.data || []);
      setLookups({
        bankAccounts: accountsResponse.data || [],
        clients: clientsResponse.data || [],
        projects: projectsResponse.data || [],
        invoices: invoicesResponse.data || [],
        expenses: expensesResponse.data || []
      });
    } catch (error) {
      toast.error(error.message || 'Unable to load banking data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const rows = useMemo(() => (activeTab === 'accounts' ? accounts : transactions), [activeTab, accounts, transactions]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (activeTab === 'transactions') {
      if (filterType) result = result.filter(r => r.transactionType === filterType);
      if (filterBank) result = result.filter(r => String(r.bankAccountId) === String(filterBank));
      if (filterClient) result = result.filter(r => String(r.linkedClientId) === String(filterClient));
      if (filterProject) result = result.filter(r => String(r.linkedProjectId) === String(filterProject));
    } else {
      if (filterType) result = result.filter(r => r.accountType === filterType);
      if (filterBank !== '') result = result.filter(r => String(!!r.isPrimary) === filterBank);
    }
    return result;
  }, [rows, activeTab, filterType, filterBank, filterClient, filterProject]);

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
      toast.success(activeRecord ? 'Updated successfully' : 'Created successfully');
      setEditorOpen(false);
      setActiveRecord(null);
      if (activeTab === 'accounts') {
        setAccounts((current) => (activeRecord ? current.map((item) => (item.id === response.data.id ? response.data : item)) : [response.data, ...current]));
      } else {
        setTransactions((current) => (activeRecord ? current.map((item) => (item.id === response.data.id ? response.data : item)) : [response.data, ...current]));
      }
      await load();
    } catch (error) {
      toast.error(error.message || 'Unable to save record');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)]">Banking</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Accounts and transaction mapping with linked clients, projects, invoices, and expenses.</p>
        </div>
        <div className="flex items-center gap-3">
          {hasPermission('banking.write') ? (
            <Button onClick={openCreate} className="gap-2">
              <Plus size={16} />
              Add {schema.singular}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        {[
          ['accounts', `Accounts (${accounts.length})`],
          ['transactions', `Transactions (${transactions.length})`]
        ].map(([key, label]) => (
          <button 
            key={key} 
            type="button" 
            className={`px-5 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-[1px] ${
              activeTab === key 
                ? 'border-[var(--primary)] text-[var(--primary)]' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
        <DataTable
          loading={loading}
          columns={(activeTab === 'accounts' ? accountSchema.columns : transactionSchema.columns).map((column) => {
            if (activeTab === 'accounts' && column.key === 'isPrimary') {
              return { ...column, render: (row) => (row.isPrimary ? 'Primary' : 'Secondary') };
            }
            if (activeTab === 'transactions' && column.key === 'bankAccountId') {
              return { ...column, render: (row) => getLabelById(accounts, row.bankAccountId, 'accountHolderName') || row.bankAccountId };
            }
            return column;
          })}
          rows={sortRows(filteredRows, 'updatedAt', 'desc')}
          selectable={false}
          toolbarLeft={
            activeTab === 'transactions' ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-[var(--text-muted)] mr-1"><Filter size={16} /> <span className="text-sm font-medium">Filters:</span></div>
                <select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-[var(--text-main)] outline-none focus:border-[var(--primary)]" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">All Types</option>
                  <option value="Credit">Credit</option>
                  <option value="Debit">Debit</option>
                  <option value="Transfer">Transfer</option>
                  <option value="Adjustment">Adjustment</option>
                </select>
                <select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-[var(--text-main)] outline-none focus:border-[var(--primary)]" value={filterBank} onChange={e => setFilterBank(e.target.value)}>
                  <option value="">All Banks</option>
                  {lookups.bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>)}
                </select>
                <select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-[var(--text-main)] outline-none focus:border-[var(--primary)]" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
                  <option value="">All Clients</option>
                  {lookups.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-[var(--text-main)] outline-none focus:border-[var(--primary)]" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
                  <option value="">All Projects</option>
                  {lookups.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-[var(--text-muted)] mr-1"><Filter size={16} /> <span className="text-sm font-medium">Filters:</span></div>
                <select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-[var(--text-main)] outline-none focus:border-[var(--primary)]" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">All Account Types</option>
                  <option value="Current">Current</option>
                  <option value="Savings">Savings</option>
                  <option value="OD">OD</option>
                  <option value="Cash Credit">Cash Credit</option>
                </select>
                <select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-[var(--text-main)] outline-none focus:border-[var(--primary)]" value={filterBank} onChange={e => setFilterBank(e.target.value)}>
                  <option value="">Primary Status</option>
                  <option value="true">Primary Only</option>
                  <option value="false">Secondary Only</option>
                </select>
              </div>
            )
          }
          rowActions={
            hasPermission('banking.write')
              ? (row) => (
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" onClick={() => openEdit(row)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                      <Edit2 size={16} />
                    </button>
                  </div>
                )
              : undefined
          }
        />

      <Modal
        open={editorOpen}
        title={`${activeRecord ? 'Edit' : 'Add'} ${schema.singular}`}
        subtitle={schema.label}
        onClose={() => {
          setEditorOpen(false);
          setActiveRecord(null);
        }}
        width="min(960px, 96vw)"
      >
        <ResourceForm
          key={`${schema.key}:${activeRecord?.id || 'new'}`}
          fields={schema.fields}
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
    </div>
  );
}
