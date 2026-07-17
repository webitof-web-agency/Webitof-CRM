import { useEffect, useMemo, useState } from 'react';
import { Banknote, RefreshCw, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
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
      <PageHeader
        eyebrow="Finance"
        title="Banking"
        description="Accounts and transaction mapping with linked clients, projects, invoices, and expenses."
        actions={[
          { label: 'Reload', icon: RefreshCw, variant: 'secondary', onClick: load },
          ...(hasPermission('banking.write') ? [{ label: `Add ${schema.singular}`, icon: Plus, onClick: openCreate }] : [])
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {[
          ['accounts', `Accounts (${accounts.length})`],
          ['transactions', `Transactions (${transactions.length})`]
        ].map(([key, label]) => (
          <Button key={key} type="button" variant={activeTab === key ? 'primary' : 'secondary'} size="sm" onClick={() => setActiveTab(key)}>
            {label}
          </Button>
        ))}
      </div>

      <Card className="space-y-4 p-4 md:p-5">
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
          rows={sortRows(rows, 'updatedAt', 'desc')}
          selectable={false}
          onCreate={hasPermission('banking.write') ? openCreate : undefined}
          createLabel={`Add ${schema.singular}`}
          rowActions={
            hasPermission('banking.write')
              ? (row) => (
                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row)}>
                      Edit
                    </Button>
                  </div>
                )
              : undefined
          }
        />
      </Card>

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
