export function normalizeOption(option) {
  if (option && typeof option === 'object') {
    return {
      value: option.value ?? option.id ?? option.code ?? option.name ?? '',
      label: option.label ?? option.name ?? option.title ?? option.code ?? String(option.value ?? option.id ?? ''),
      description: option.description ?? '',
      color: option.color ?? option.badgeColor ?? '',
      disabled: Boolean(option.disabled ?? option.isDisabled ?? option.readOnly)
    };
  }

  return {
    value: option,
    label: String(option ?? ''),
    description: '',
    color: '',
    disabled: false
  };
}

const lookupSourceByFieldName = {
  customer: 'clients',
  clientId: 'clients',
  linkedClientId: 'clients',
  partnerId: 'vendors',
  vendorId: 'vendors',
  categoryId: 'expenseCategories',
  providerId: 'renewalProviders',
  amcType: 'amcTypes',
  projectId: 'projects',
  linkedProjectId: 'projects',
  invoiceId: 'invoices',
  linkedInvoiceId: 'invoices',
  expenseId: 'expenses',
  linkedExpenseId: 'expenses',
  bankAccountId: 'bankAccounts',
  roleIds: 'roles',
  permissionIds: 'permissions'
};

function formatLookupLabel(parts = []) {
  return parts.filter(Boolean).join(' - ');
}

function getLookupItems(field, lookups = {}) {
  const source = field?.type === 'customer' ? 'clients' : lookupSourceByFieldName[field?.name];
  if (!source) return [];
  return lookups[source] || [];
}

function lookupLabel(item = {}, field = {}) {
  const labelKey = field.lookupLabelKey;
  if (labelKey && item[labelKey] != null && item[labelKey] !== '') {
    return String(item[labelKey]);
  }

  return String(item.name || item.title || item.code || item.label || item.id || '');
}

function lookupDescription(item = {}, field = {}) {
  const descriptionKey = field.lookupDescriptionKey;
  if (descriptionKey && item[descriptionKey] != null && item[descriptionKey] !== '') {
    return String(item[descriptionKey]);
  }

  return String(item.description || item.status || item.type || item.module || item.action || '');
}

export function isLookupField(field) {
  if (!field) return false;
  return Boolean(field.type === 'customer' || field.lookupKey || lookupSourceByFieldName[field.name]);
}

export function getFieldOptions(field, lookups = {}) {
  if (!field) return [];

  if (field.lookupKey) {
    return (lookups[field.lookupKey] || []).map((item) =>
      normalizeOption({
        value: item.id ?? item.value ?? item.code ?? item.name,
        label: lookupLabel(item, field),
        description: lookupDescription(item, field)
      })
    );
  }

  if (field.type === 'customer' || lookupSourceByFieldName[field.name] === 'clients') {
    return getLookupItems(field, lookups).map((client) =>
      normalizeOption({
        value: client.id,
        label: client.companyName ? formatLookupLabel([client.companyName, client.name]) : client.name,
        description: formatLookupLabel([client.email, client.mobile])
      })
    );
  }

  if (field.name === 'roleIds') {
    return getLookupItems(field, lookups).map((role) =>
      normalizeOption({
        value: role.id,
        label: role.name,
        description: role.code
      })
    );
  }

  if (field.name === 'permissionIds') {
    return getLookupItems(field, lookups).map((permission) =>
      normalizeOption({
        value: permission.id,
        label: permission.name,
        description: `${permission.module}.${permission.action}`
      })
    );
  }

  if (field.name === 'bankAccountId') {
    return getLookupItems(field, lookups).map((account) =>
      normalizeOption({
        value: account.id,
        label: account.accountHolderName ? formatLookupLabel([account.bankName, account.accountHolderName]) : account.bankName,
        description: formatLookupLabel([account.accountNumber, account.ifsc])
      })
    );
  }

  if (field.name === 'linkedClientId') {
    return getLookupItems(field, lookups).map((client) =>
      normalizeOption({
        value: client.id,
        label: client.companyName ? formatLookupLabel([client.companyName, client.name]) : client.name,
        description: formatLookupLabel([client.email, client.mobile])
      })
    );
  }

  if (field.name === 'linkedProjectId') {
    return getLookupItems(field, lookups).map((project) =>
      normalizeOption({
        value: project.id,
        label: project.title,
        description: formatLookupLabel([project.status, project.projectType])
      })
    );
  }

  if (field.name === 'linkedInvoiceId') {
    return getLookupItems(field, lookups).map((invoice) =>
      normalizeOption({
        value: invoice.id,
        label: invoice.invoiceNumber || invoice.id,
        description: formatLookupLabel([invoice.status, invoice.totalAmount])
      })
    );
  }

  if (field.name === 'linkedExpenseId') {
    return getLookupItems(field, lookups).map((expense) =>
      normalizeOption({
        value: expense.id,
        label: expense.vendor || expense.id,
        description: formatLookupLabel([expense.expenseDate, expense.totalAmount])
      })
    );
  }

  return Array.isArray(field.options) ? field.options.map(normalizeOption) : [];
}

export function buildInitialDraft(fields = [], record = {}) {
  return fields.reduce((draft, field) => {
    const current = record[field.name];

    if (field.type === 'checkbox') {
      draft[field.name] = Boolean(current ?? field.defaultValue ?? false);
      return draft;
    }

    if (field.type === 'multiselect') {
      draft[field.name] = Array.isArray(current) ? current : Array.isArray(field.defaultValue) ? field.defaultValue : [];
      return draft;
    }

    if (field.type === 'json') {
      const value = current ?? field.defaultValue ?? {};
      draft[field.name] = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      return draft;
    }

    if (field.type === 'number' || field.type === 'money') {
      draft[field.name] = current ?? field.defaultValue ?? '';
      return draft;
    }

    if (field.type === 'date') {
      draft[field.name] = current ? String(current).slice(0, 10) : field.defaultValue || '';
      return draft;
    }

    draft[field.name] = current ?? field.defaultValue ?? '';
    return draft;
  }, {});
}

export function serializeDraft(fields = [], draft = {}) {
  const payload = {};

  for (const field of fields) {
    const value = draft[field.name];

    if (field.type === 'checkbox') {
      payload[field.name] = Boolean(value);
      continue;
    }

    if (field.type === 'multiselect') {
      payload[field.name] = Array.isArray(value) ? value.filter(Boolean) : [];
      continue;
    }

    if (field.type === 'json') {
      if (typeof value === 'string' && value.trim()) {
        payload[field.name] = JSON.parse(value);
      } else if (typeof value === 'object' && value !== null) {
        payload[field.name] = value;
      } else {
        payload[field.name] = {};
      }
      continue;
    }

    if (field.type === 'number' || field.type === 'money') {
      payload[field.name] = value === '' || value == null ? 0 : Number(value);
      continue;
    }

    payload[field.name] = value;
  }

  return payload;
}

function comparePrimitive(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  const leftNumber = Number(a);
  const rightNumber = Number(b);
  const numeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
  if (numeric) return leftNumber - rightNumber;

  const leftDate = new Date(a).getTime();
  const rightDate = new Date(b).getTime();
  const dateLike = Number.isFinite(leftDate) && Number.isFinite(rightDate) && String(a).includes('-') && String(b).includes('-');
  if (dateLike) return leftDate - rightDate;

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function sortRows(rows = [], sortKey = '', sortDirection = null) {
  if (!sortKey || !sortDirection) return [...rows];

  return [...rows].sort((left, right) => {
    const comparison = comparePrimitive(left?.[sortKey], right?.[sortKey]);
    return sortDirection === 'desc' ? -comparison : comparison;
  });
}

export function formatDisplayValue(value, type) {
  if (value == null || value === '') return '-';

  if (type === 'money') {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
      : String(value);
  }

  if (type === 'date') {
    return String(value).slice(0, 10);
  }

  if (type === 'badge') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}
