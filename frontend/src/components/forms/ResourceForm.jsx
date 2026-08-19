import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Input, Textarea } from '../ui/Input';
import { SearchableSelect } from './SearchableSelect';
import { PhoneInput } from './PhoneInput';
import { AttachmentPicker } from '../ui/AttachmentPicker';
import { buildInitialDraft, getFieldOptions, isFieldVisible, isLookupField, serializeDraft } from '../../lib/resource';
import { cn } from '../../lib/cn';
import { INDIA_STATE_OPTIONS, getCitiesByState, getStateCode } from '../../data/indiaLocations';

function FieldLabel({ field, compact = false }) {
  return (
    <div className={cn(compact ? 'pt-1' : 'mb-2')}>
      <label className={cn('text-sm font-medium text-[var(--text)]', compact && 'block')}>
        {field.label}
        {field.required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      {field.description ? <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{field.description}</p> : null}
    </div>
  );
}

function FieldShell({ fullWidth = false, children }) {
  return <div className={cn(fullWidth ? 'md:col-span-2' : '')}>{children}</div>;
}

export function ResourceForm({
  fields = [],
  record = null,
  lookups = {},
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  busy = false,
  fullWidthFields = [],
  labelPlacement = 'top'
}) {
  const [draft, setDraft] = useState(() => buildInitialDraft(fields, record || {}));
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(buildInitialDraft(fields, record || {}));
    setError('');
  }, [fields, record]);

  const enrichedFields = useMemo(
    () =>
      fields.map((field) => ({
        ...field,
        options: getFieldOptions(field, lookups)
      })),
    [fields, lookups]
  );

  const visibleFields = useMemo(
    () => enrichedFields.filter((field) => isFieldVisible(field, draft)),
    [draft, enrichedFields]
  );

  function updateField(name, nextValue) {
    setDraft((current) => {
      const next = { ...current, [name]: nextValue };
      // When state is selected, auto-fill stateCode and clear city
      if (name === 'state') {
        const code = getStateCode(nextValue);
        if (code) next.stateCode = code;
        // Reset city fields
        if ('city' in current) next.city = '';
        if ('placeOfSupply' in current) next.placeOfSupply = '';
      }

      if (name === 'expenseType') {
        if (String(nextValue) === 'Employee Salary') {
          next.payeeType = 'Employee';
          next.vendorId = '';
          next.vendor = '';
          next.vendorGstin = '';
          next.amountBeforeGst = '';
          next.gstRate = 0;
          next.gstAmount = 0;
          next.totalAmount = '';
          next.paidAmount = '';
          next.balanceDue = '';
          next.periodStart = '';
          next.periodEnd = '';
        } else if (String(nextValue) === 'Reimbursement') {
          next.payeeType = 'Employee';
          next.vendorId = '';
          next.vendor = '';
          next.vendorGstin = '';
          next.gstRate = 0;
          next.gstAmount = 0;
        } else {
          if (String(current.expenseType) === 'Employee Salary' || String(current.payeeType) === 'Employee') {
            next.payeeType = 'Vendor';
            next.employeeId = '';
          } else if (!next.payeeType) {
            next.payeeType = 'Vendor';
          }
        }
      }

      if (name === 'payeeType') {
        if (String(nextValue) === 'Vendor') {
          next.employeeId = '';
          next.clientId = next.clientId || '';
        }
        if (String(nextValue) === 'Employee') {
          next.vendorId = '';
          next.vendor = '';
          next.vendorGstin = '';
        }
        if (String(nextValue) === 'Client') {
          next.vendorId = '';
          next.employeeId = '';
          next.vendorGstin = '';
        }
        if (String(nextValue) === 'Internal' || String(nextValue) === 'Other') {
          next.vendorId = '';
          next.employeeId = '';
          next.clientId = '';
          next.vendorGstin = '';
        }
      }

      if (name === 'vendorId') {
        next.payeeId = nextValue;
        next.payeeType = next.payeeType || 'Vendor';
      }

      if (name === 'employeeId') {
        next.payeeId = nextValue;
        next.payeeType = next.payeeType || 'Employee';
      }

      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setError('');
      const payload = serializeDraft(enrichedFields, draft);
      await onSubmit?.(payload);
    } catch (submissionError) {
      setError(submissionError.message || 'Failed to save');
    }
  }

  function renderField(field) {
    const value = draft[field.name];
    const commonProps = {
      disabled: busy,
      required: field.required
    };
    const isFullWidth = fullWidthFields.includes(field.name) || field.type === 'textarea' || field.type === 'json' || field.type === 'multiselect';
    const isSearchableLookup = field.type === 'select' || field.type === 'customer' || field.type === 'multiselect' || (field.type === 'text' && isLookupField(field));
    const isSplit = labelPlacement === 'left';

    function renderControl() {
      if (field.type === 'phone') {
        return (
          <PhoneInput
            name={field.name}
            value={value}
            onChange={(event) => updateField(field.name, event?.target?.value ?? '')}
            placeholder={field.placeholder || field.label}
            required={field.required}
            defaultCountry={field.defaultCountry || 'in'}
            defaultDialCode={field.defaultDialCode || '91'}
          />
        );
      }

      if (field.type === 'radio') {
        const radioOptions = Array.isArray(field.options) ? field.options : [];
        return (
          <div className="flex flex-wrap gap-4 rounded-[var(--radius-input,0.75rem)] border border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-3">
            {radioOptions.map((option) => {
              const optionValue = typeof option === 'string' ? option : option.value;
              const optionLabel = typeof option === 'string' ? option : option.label;
              return (
                <label key={String(optionValue)} className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-main)] cursor-pointer">
                  <input
                    type="radio"
                    name={field.name}
                    value={optionValue}
                    checked={String(value || '') === String(optionValue)}
                    onChange={(event) => updateField(field.name, event.target.value)}
                    disabled={busy}
                    className="h-4 w-4"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>{optionLabel}</span>
                </label>
              );
            })}
          </div>
        );
      }

      if (field.type === 'state_select') {
        return (
          <SearchableSelect
            value={value}
            onChange={(val) => updateField(field.name, val)}
            options={INDIA_STATE_OPTIONS}
            placeholder="Select State"
            disabled={busy}
          />
        );
      }

      if (field.type === 'city_select') {
        const currentState = draft['state'] || draft['placeOfSupplyState'] || '';
        const cities = getCitiesByState(currentState);
        const cityOptions = cities.map((c) => ({ value: c, label: c }));
        return (
          <SearchableSelect
            value={value}
            onChange={(val) => updateField(field.name, val)}
            options={cityOptions}
            placeholder={currentState ? `Select city in ${currentState}` : 'Select state first'}
            disabled={busy || !currentState}
          />
        );
      }

      if (field.type === 'textarea' || field.type === 'json') {
        return (
          <Textarea
            {...commonProps}
            rows={field.rows || 4}
            value={value}
            onChange={(event) => updateField(field.name, event.target.value)}
            placeholder={field.placeholder || field.label}
          />
        );
      }

      if (field.type === 'checkbox') {
        return isSplit ? (
          <label className="inline-flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs font-medium text-[var(--text-main)] cursor-pointer">
            <Checkbox
              checked={Boolean(value)}
              onChange={(event) => updateField(field.name, event.target.checked)}
              disabled={busy}
            />
            <span className="sr-only">{field.label}</span>
          </label>
        ) : (
          <label className="inline-flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs font-medium text-[var(--text-main)] cursor-pointer">
            <Checkbox
              checked={Boolean(value)}
              onChange={(event) => updateField(field.name, event.target.checked)}
              disabled={busy}
            />
            {field.label}
          </label>
        );
      }

      if (field.type === 'multiselect') {
        return (
          <SearchableSelect
            {...commonProps}
            multiple
            value={value}
            onChange={(nextValue) => updateField(field.name, nextValue)}
            options={field.options}
            placeholder={field.placeholder || `Select ${field.label}`}
          />
        );
      }

      if (isSearchableLookup) {
        return (
          <SearchableSelect
            {...commonProps}
            value={value}
            onChange={(nextValue) => updateField(field.name, nextValue)}
            options={field.options}
            placeholder={field.placeholder || `Select ${field.label}`}
          />
        );
      }

      if (field.type === 'attachment') {
        const fieldAttachments = Array.isArray(value) ? value : [];
        return (
          <AttachmentPicker
            attachments={fieldAttachments}
            uploadModule="expenses"
            uploadEntityId={draft.id || 'draft'}
            onAddFile={(file) => {
              if (!file) return;
              if (fieldAttachments.some(a => String(a.driveFileId || a.id) === String(file.driveFileId || file.id))) return;
              updateField(field.name, [file, ...fieldAttachments]);
            }}
            onRemoveFile={(driveFileId) => {
              updateField(field.name, fieldAttachments.filter((item) => String(item.driveFileId || item.id) !== String(driveFileId)));
            }}
          />
        );
      }

      return (
        <Input
          {...commonProps}
          type={field.type === 'number' || field.type === 'money' ? 'number' : field.type === 'date' ? 'date' : field.type === 'password' ? 'password' : field.type || 'text'}
          step={field.step}
          value={value}
          onChange={(event) => updateField(field.name, event.target.value)}
          placeholder={field.placeholder || field.label}
        />
      );
    }

    if (isSplit) {
      return (
        <div key={field.name} className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
          <FieldLabel field={field} compact />
          <div>{renderControl()}</div>
        </div>
      );
    }

    return (
      <FieldShell key={field.name} fullWidth={isFullWidth}>
        <FieldLabel field={field} />
        {renderControl()}
      </FieldShell>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {error}
        </div>
      ) : null}

      <div className={cn(labelPlacement === 'left' ? 'space-y-5' : 'grid gap-5 md:grid-cols-2')}>
        {visibleFields.map(renderField)}
      </div>

      <div className="sticky -bottom-6 -mx-6 -mb-6 mt-6 flex flex-wrap items-center justify-end gap-3 rounded-b-2xl border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4 z-10 shadow-xs">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button type="submit" size="sm" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
