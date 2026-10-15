import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Input, Textarea } from '../ui/Input';
import { SearchableSelect } from './SearchableSelect';
import { PhoneInput } from './PhoneInput';
import { AttachmentPicker } from '../ui/AttachmentPicker';
import { buildInitialDraft, getFieldOptions, isFieldVisible, isLookupField, serializeDraft } from '../../lib/resource';
import { cn } from '../../lib/cn';
import { INDIA_STATE_OPTIONS, getCitiesByState, getStateCode } from '../../data/indiaLocations';
import { DEFAULT_TECHNOLOGY_ICON, TECHNOLOGY_ICONS } from '../../config/technologyIcons';

function FieldLabel({ field, compact = false, inline = false }) {
  const descriptionAsTooltip = field.description && field.descriptionDisplay === 'tooltip';

  return (
    <div className={cn(inline ? 'pt-1' : compact ? 'mb-1' : 'mb-2')}>
      <div className="flex items-center gap-1.5">
        <label className={cn('font-medium text-[var(--text)]', compact ? 'text-xs' : 'text-sm', inline && 'block')}>
          {field.label}
          {field.required ? <span className="ml-1 text-rose-500">*</span> : null}
        </label>
        {descriptionAsTooltip ? (
          <span className="group relative inline-flex">
            <button
              type="button"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:text-[var(--primary)] focus:text-[var(--primary)] focus:outline-none"
              aria-label={`About ${field.label}`}
            >
              <Info size={14} />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium leading-4 text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-100 dark:text-slate-900"
            >
              {field.description}
            </span>
          </span>
        ) : null}
      </div>
      {field.description && !descriptionAsTooltip ? (
        <p className={cn('text-[var(--text-muted)]', compact ? 'mt-0.5 text-[11px] leading-tight' : 'mt-1 text-xs leading-5')}>
          {field.description}
        </p>
      ) : null}
    </div>
  );
}

function FieldShell({ className = '', children }) {
  return <div className={className}>{children}</div>;
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
  labelPlacement = 'top',
  compact = false,
  gridClassName = '',
  fieldClassNames = {},
  defaultFieldClassName = ''
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
    const isFullWidth = fullWidthFields.includes(field.name) || field.type === 'textarea' || field.type === 'json' || field.type === 'multiselect' || field.type === 'checkbox_group' || field.type === 'payment_plan';
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
            rows={compact ? Math.min(field.rows || 3, 3) : (field.rows || 4)}
            value={value}
            onChange={(event) => updateField(field.name, event.target.value)}
            placeholder={field.placeholder || field.label}
            className={cn(compact && '!min-h-[4rem] !py-2 !px-3 !text-xs leading-relaxed', field.inputClassName)}
          />
        );
      }

      if (field.type === 'checkbox') {
        return isSplit ? (
          <label className={cn('inline-flex items-center gap-2 border border-[var(--input-border)] bg-[var(--surface)] text-xs font-medium text-[var(--text-main)] cursor-pointer', compact ? '!h-8 rounded-lg px-2.5 shadow-2xs' : 'rounded-2xl px-4 py-3')}>
            <Checkbox
              checked={Boolean(value)}
              onChange={(event) => updateField(field.name, event.target.checked)}
              disabled={busy}
            />
            <span className="sr-only">{field.label}</span>
          </label>
        ) : (
          <label className={cn('border border-[var(--input-border)] bg-[var(--surface)] text-xs font-medium text-[var(--text-main)] cursor-pointer transition hover:bg-[var(--surface-2)]/50', compact ? 'flex !h-8 w-full items-center gap-2 rounded-lg px-2.5 shadow-2xs' : 'inline-flex rounded-2xl px-4 py-3 gap-3')}>
            <Checkbox
              checked={Boolean(value)}
              onChange={(event) => updateField(field.name, event.target.checked)}
              disabled={busy}
              className="shrink-0"
            />
            <span className="truncate">{field.label}</span>
          </label>
        );
      }

      if (field.type === 'payment_plan') {
        const plan = value && typeof value === 'object' ? value : { type: '', milestones: [] };
        const milestones = Array.isArray(plan.milestones) ? plan.milestones : [];
        const totalPercentage = milestones.reduce((sum, item) => sum + Number(item?.percentage || 0), 0);
        const formattedTotal = Number(totalPercentage.toFixed(2));
        const servicePrice = Number(draft.defaultPrice || 0);
        const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

        function selectPaymentPlan(option) {
          const nextMilestones = option.value === 'manual'
            ? [
                { percentage: 50, milestone: 'First payment milestone' },
                { percentage: 50, milestone: 'Final payment milestone' }
              ]
            : (option.milestones || []).map((item) => ({ ...item }));
          updateField(field.name, { type: option.value, milestones: nextMilestones });
        }

        function updateInstallmentCount(countValue) {
          const count = Math.max(1, Math.min(6, Number(countValue || 1)));
          const basePercentage = Math.floor(100 / count);
          const remainder = 100 - (basePercentage * count);
          const nextMilestones = Array.from({ length: count }, (_, index) => ({
            percentage: basePercentage + (index < remainder ? 1 : 0),
            milestone: milestones[index]?.milestone || `Payment milestone ${index + 1}`
          }));
          updateField(field.name, { type: 'manual', milestones: nextMilestones });
        }

        function updateMilestone(index, key, nextValue) {
          const nextMilestones = milestones.map((item, itemIndex) => itemIndex === index
            ? { ...item, [key]: key === 'percentage' ? nextValue : nextValue }
            : item);
          updateField(field.name, { ...plan, milestones: nextMilestones });
        }

        return (
          <div className={cn(
            'border border-[var(--border)] bg-[var(--surface-2)]/40',
            compact ? 'space-y-2 rounded-xl p-2.5' : 'space-y-3 rounded-2xl p-3.5'
          )}>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {(field.options || []).map((option) => {
                const selected = String(plan.type || '') === String(option.value);
                return (
                  <label
                    key={String(option.value)}
                    className={cn(
                      'flex cursor-pointer items-start transition',
                      compact ? 'gap-2 rounded-lg p-2' : 'gap-2.5 rounded-xl p-2.5',
                      selected
                        ? 'border border-[var(--primary)] bg-[var(--primary-subtle)] ring-1 ring-[var(--primary)]/20'
                        : 'border border-[var(--border-muted)] bg-[var(--surface)] hover:border-[var(--primary)]/50'
                    )}
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={option.value}
                      checked={selected}
                      disabled={busy}
                      onChange={() => selectPaymentPlan(option)}
                      className={cn(
                        'shrink-0',
                        compact ? 'mt-0.5 h-3.5 w-3.5' : 'mt-0.5 h-4 w-4'
                      )}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold leading-tight text-[var(--text-main)] truncate" title={option.label}>
                        {option.label}
                      </span>
                      {option.description ? (
                        <span
                          className={cn(
                            'block text-[var(--text-muted)]',
                            compact ? 'mt-0.5 text-[10px] leading-snug line-clamp-2' : 'mt-1 text-[10px] leading-4'
                          )}
                          title={option.description}
                        >
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>

            {plan.type === 'manual' ? (
              <div className={cn(
                'border border-[var(--border)] bg-[var(--surface)]',
                compact ? 'space-y-2 rounded-lg p-2.5' : 'space-y-2.5 rounded-xl p-3'
              )}>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-main)]">
                    Number of installments
                    <select
                      value={milestones.length || 1}
                      onChange={(event) => updateInstallmentCount(event.target.value)}
                      disabled={busy}
                      className={cn(
                        'rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] text-xs font-medium outline-none focus:border-[var(--primary)]',
                        compact ? 'h-7 px-2 py-0.5' : 'px-2.5 py-1.5'
                      )}
                    >
                      {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}
                    </select>
                  </label>
                  <span className={cn(
                    'font-bold',
                    compact ? 'rounded-md px-2 py-0.5 text-[10.5px]' : 'rounded-full px-2.5 py-1 text-[11px]',
                    Math.abs(formattedTotal - 100) <= 0.01
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  )}>
                    Total: {formattedTotal}%
                  </span>
                </div>

                <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
                  {milestones.map((item, index) => {
                    const approxAmount = servicePrice > 0 ? currencyFormatter.format((servicePrice * Number(item.percentage || 0)) / 100) : '';
                    return (
                      <div
                        key={`payment-installment-${index}`}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border border-[var(--border-muted)] bg-[var(--surface-2)]/30',
                          compact ? 'px-2.5 py-1.5' : 'p-2'
                        )}
                      >
                        <span className={cn(
                          'flex shrink-0 items-center justify-center rounded-full bg-[var(--primary-subtle)] font-bold text-[var(--primary)]',
                          compact ? 'h-5.5 w-5.5 text-[10px]' : 'h-6 w-6 text-[11px]'
                        )}>
                          {index + 1}
                        </span>
                        <div
                          className="relative w-24 sm:w-28 shrink-0"
                          title={approxAmount ? `Approx. ${approxAmount}` : undefined}
                        >
                          <Input
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.01"
                            value={item.percentage}
                            disabled={busy}
                            onChange={(event) => updateMilestone(index, 'percentage', event.target.value)}
                            className={cn(
                              '!rounded-md pr-5 !text-xs font-medium',
                              compact ? '!h-8 !py-1 !pl-2.5' : '!h-9 !py-1.5 !pl-2.5'
                            )}
                            placeholder="%"
                          />
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[var(--text-muted)]">
                            %
                          </span>
                        </div>
                        <Input
                          type="text"
                          value={item.milestone}
                          disabled={busy}
                          onChange={(event) => updateMilestone(index, 'milestone', event.target.value)}
                          placeholder="When will this payment be collected?"
                          className={cn(
                            '!rounded-md px-2.5 !text-xs flex-1 min-w-0',
                            compact ? '!h-8 !py-1' : '!h-9 !py-1.5'
                          )}
                        />
                        {approxAmount ? (
                          <span className="hidden sm:inline-block shrink-0 text-right text-xs font-medium text-[var(--text-muted)] tabular-nums px-1.5 whitespace-nowrap min-w-[85px]">
                            Approx. {approxAmount}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {plan.type !== 'manual' && milestones.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-semibold text-[var(--text-muted)]">Schedule:</span>
                {milestones.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border-muted)] bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--text-main)]"
                  >
                    <strong className="text-[var(--primary)]">{item.percentage}%</strong>
                    <span>{item.milestone}</span>
                    {servicePrice > 0 ? (
                      <span className="text-[var(--text-muted)] text-[10px]">
                        ({currencyFormatter.format((servicePrice * Number(item.percentage || 0)) / 100)})
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      }

      if (field.type === 'checkbox_group') {
        const selectedValues = Array.isArray(value) ? value.map(String) : [];
        const groupedOptions = new Map();
        (field.options || []).forEach((option) => {
          const groups = option.groups?.length ? option.groups : [option.group || 'Other'];
          groups.forEach((group) => {
            if (!groupedOptions.has(group)) groupedOptions.set(group, []);
            groupedOptions.get(group).push(option);
          });
        });
        function renderTechnologyOptions(group, options) {
          return (
            <div className={cn('grid gap-2 sm:grid-cols-2 lg:grid-cols-3', compact && 'xl:grid-cols-6')}>
              {options.map((option) => {
                const optionValue = String(option.value);
                const checked = selectedValues.includes(optionValue);
                const technologyIcon = TECHNOLOGY_ICONS[option.label] || DEFAULT_TECHNOLOGY_ICON;
                const TechnologyIcon = technologyIcon.Icon;
                return (
                  <label key={`${group}-${optionValue}`} className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-xl border transition',
                    compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
                    checked
                      ? 'border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--text-main)]'
                      : 'border-[var(--border-muted)] bg-[var(--surface)] text-[var(--text-main)] hover:border-[var(--primary)]/50'
                  )}>
                    <Checkbox
                      checked={checked}
                      disabled={busy || option.disabled}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? Array.from(new Set([...selectedValues, optionValue]))
                          : selectedValues.filter((item) => item !== optionValue);
                        updateField(field.name, next);
                      }}
                    />
                    {field.showOptionIcons ? (
                      <TechnologyIcon
                        size={17}
                        strokeWidth={2.2}
                        className="shrink-0"
                        style={{ color: technologyIcon.color }}
                      />
                    ) : null}
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">{option.label}</span>
                      {field.showOptionDescriptions !== false && option.description ? <span className="mt-0.5 block text-[10px] leading-4 text-[var(--text-muted)]">{option.description}</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          );
        }

        return (
          <div className={cn('rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40', compact ? 'space-y-2 p-3' : 'space-y-3 p-4')}>
            {Array.from(groupedOptions.entries()).map(([group, options]) => {
              const selectedCount = options.reduce(
                (count, option) => count + (selectedValues.includes(String(option.value)) ? 1 : 0),
                0
              );

              if (field.collapsibleGroups) {
                return (
                  <details key={group} className="group overflow-hidden rounded-xl border border-[var(--border-muted)] bg-[var(--surface)]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-bold text-[var(--text-main)] transition hover:bg-[var(--hover-bg)] [&::-webkit-details-marker]:hidden">
                      <span>{group}</span>
                      <span className="flex items-center gap-2">
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          selectedCount
                            ? 'bg-[var(--primary-subtle)] text-[var(--primary)]'
                            : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                        )}>
                          {selectedCount}/{options.length} selected
                        </span>
                        <ChevronDown size={15} className="text-[var(--text-muted)] transition-transform group-open:rotate-180" />
                      </span>
                    </summary>
                    <div className="border-t border-[var(--border-muted)] p-2.5">
                      {renderTechnologyOptions(group, options)}
                    </div>
                  </details>
                );
              }

              return (
                <div key={group}>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{group}</div>
                  {renderTechnologyOptions(group, options)}
                </div>
              );
            })}
          </div>
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
            triggerClassName={compact ? '!min-h-8 !py-1 !px-2.5 !text-xs' : ''}
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
            triggerClassName={compact ? '!h-8 !py-1 !px-2.5 !text-xs' : ''}
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
          className={cn(compact && '!h-8 !py-1 !px-2.5 !text-xs', field.inputClassName)}
        />
      );
    }

    if (isSplit) {
      return (
        <div key={field.name} className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
          <FieldLabel field={field} inline />
          <div>{renderControl()}</div>
        </div>
      );
    }

    return (
      <FieldShell
        key={field.name}
        className={fieldClassNames[field.name] || (isFullWidth ? (compact ? 'md:col-span-2 xl:col-span-4' : 'md:col-span-2') : defaultFieldClassName)}
      >
        <FieldLabel field={field} compact={compact} />
        {renderControl()}
      </FieldShell>
    );
  }

  return (
    <form className={compact ? 'space-y-3' : 'space-y-6'} onSubmit={handleSubmit}>
      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {error}
        </div>
      ) : null}

      <div className={cn(
        labelPlacement === 'left'
          ? 'space-y-5'
          : (gridClassName || (compact ? 'grid gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-4' : 'grid gap-5 md:grid-cols-2'))
      )}>
        {visibleFields.map(renderField)}
      </div>

      <div className={cn(
        'sticky flex flex-wrap items-center justify-end gap-2.5 rounded-b-2xl border-t border-[var(--border)] bg-[var(--surface)] z-10 shadow-xs',
        compact ? '-bottom-4 -mx-4 -mb-4 mt-3 px-4 py-2.5' : '-bottom-6 -mx-6 -mb-6 mt-6 px-6 py-4'
      )}>
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
