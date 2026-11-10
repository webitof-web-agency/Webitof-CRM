import { useMemo, useState } from 'react';
import { Input } from '../ui/Input';
import { PasswordInput } from '../ui/PasswordInput';
import { Checkbox } from '../ui/Checkbox';
import { PhoneInput } from '../forms/PhoneInput';
import { SearchableSelect } from '../forms/SearchableSelect';
import { clean, valid } from '../../lib/fieldRules';
import { cn } from '../../lib/cn';

const GENDERS = ['Male', 'Female', 'Other'];
const MAX = { name: 80, username: 60, email: 254, password: 72 };

// Typing filters, so a field never holds characters it does not accept.
const sanitize = {
  fullName: (v) => clean.name(v).slice(0, MAX.name),
  username: (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9._@-]/g, '').slice(0, MAX.username),
  email: (v) => clean.email(v).slice(0, MAX.email),
  password: (v) => String(v ?? '').slice(0, MAX.password)
};

// "+91" alone (the dial code PhoneInput keeps for an empty field) counts as no phone.
// A bare 10-digit number is an Indian mobile: without +91 the phone widget would read its
// first digits as a country code (8839… shown as +88).
function normalizePhone(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const digits = text.replace(/\D/g, '');
  if (!text.startsWith('+') && digits.length === 10) return `+91${digits}`;
  if (!text.startsWith('+') && digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  return digits ? `+${digits}` : '';
}
function phoneForSave(value) {
  const phone = normalizePhone(value);
  return /^\+\d{1,4}$/.test(phone) ? '' : phone;
}
function phoneError(value) {
  const phone = phoneForSave(value);
  if (!phone) return '';
  if (phone.startsWith('+91') && !/^\+91[6-9]\d{9}$/.test(phone)) return 'Enter a valid 10-digit Indian mobile number';
  if (!/^\+\d{8,15}$/.test(phone)) return 'Enter a valid phone number';
  return '';
}

function initialDraft(record) {
  const r = record || {};
  return {
    fullName: r.fullName || '',
    email: r.email || '',
    username: r.username || '',
    phone: normalizePhone(r.phone),
    gender: GENDERS.includes(r.gender) ? r.gender : '',
    password: '',
    isActive: r.isActive !== false,
    roleIds: Array.isArray(r.roleIds) ? r.roleIds : []
  };
}

function validate(draft, creating) {
  const e = {};
  const name = draft.fullName.trim();
  if (!name) e.fullName = 'Full name is required';
  else if (name.length < 2 || !valid.name(name)) e.fullName = 'Use letters, spaces and . \' - only';
  if (!draft.email) e.email = 'Email is required';
  else if (!valid.email(draft.email)) e.email = 'Enter a valid email address';
  if (!draft.username) e.username = 'Username is required';
  else if (draft.username.length < 3) e.username = 'At least 3 characters';
  const phone = phoneError(draft.phone);
  if (phone) e.phone = phone;
  if (creating && !draft.password) e.password = 'Set a password for the new user';
  else if (draft.password && draft.password.length < 8) e.password = 'At least 8 characters';
  else if (draft.password && !draft.password.trim()) e.password = 'Password cannot be only spaces';
  if (!draft.roleIds.length) e.roleIds = 'Pick at least one role';
  return e;
}

function Row({ label, required, error, hint, className, children, htmlFor }) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-[var(--text-main)]">
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

// Compact add / edit form for ERP logins. Salary, address and lead-pipeline limits are not
// edited here; they are not sent, so the server keeps their saved values.
export function UserForm({ id = 'user-form', record = null, roles = [], busy = false, onSubmit }) {
  const creating = !record?.id;
  const [draft, setDraft] = useState(() => initialDraft(record));
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  // On a new user the username follows the email until it is edited by hand.
  const [usernameTouched, setUsernameTouched] = useState(!creating);

  const roleOptions = useMemo(
    () => (roles || []).filter((role) => role && role.isActive !== false).map((role) => ({ value: role.id, label: role.name, description: role.code })),
    [roles]
  );

  function set(key, raw) {
    const value = sanitize[key] ? sanitize[key](raw) : raw;
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === 'email' && !usernameTouched) next.username = sanitize.username(value);
      if (submitted) setErrors(validate(next, creating));
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    const found = validate(draft, creating);
    setErrors(found);
    if (Object.keys(found).length) return;
    const payload = {
      fullName: draft.fullName.trim().replace(/\s+/g, ' '),
      email: draft.email,
      username: draft.username,
      phone: phoneForSave(draft.phone),
      gender: draft.gender || null,
      isActive: draft.isActive,
      roleIds: draft.roleIds
    };
    if (draft.password) payload.password = draft.password;
    await onSubmit?.(payload);
  }

  const field = (key) => ({ id: `user-${key}`, disabled: busy, error: Boolean(errors[key]), className: '!py-2 !text-sm' });

  return (
    <form id={id} noValidate onSubmit={handleSubmit} className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      <Row label="Full name" required error={errors.fullName} htmlFor="user-fullName">
        <Input {...field('fullName')} value={draft.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="e.g. Mallika Paik" autoComplete="off" />
      </Row>
      <Row label="Email" required error={errors.email} htmlFor="user-email">
        <Input {...field('email')} type="email" inputMode="email" value={draft.email} onChange={(e) => set('email', e.target.value)} placeholder="name@company.com" autoComplete="off" />
      </Row>
      <Row label="Username" required error={errors.username} hint={creating && !usernameTouched ? 'Same as the email unless you change it' : 'Used to sign in, along with the email'} htmlFor="user-username">
        <Input
          {...field('username')}
          value={draft.username}
          onChange={(e) => {
            setUsernameTouched(true);
            set('username', e.target.value);
          }}
          autoComplete="off"
        />
      </Row>
      <Row label="Phone" error={errors.phone}>
        <PhoneInput name="phone" value={draft.phone} onChange={(e) => set('phone', e.target.value)} placeholder="98765 43210" compact />
      </Row>
      <Row
        label={creating ? 'Password' : 'New password'}
        required={creating}
        error={errors.password}
        hint={creating ? 'At least 8 characters' : 'Leave blank to keep the current password'}
        htmlFor="user-password"
      >
        <PasswordInput {...field('password')} value={draft.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" maxLength={MAX.password} />
      </Row>
      <Row label="Gender">
        <div className="flex h-[38px] items-center gap-1 rounded-[var(--radius-input,0.625rem)] border border-[var(--input-border)] bg-[var(--surface)] p-1" role="radiogroup" aria-label="Gender">
          {GENDERS.map((gender) => (
            <button
              key={gender}
              type="button"
              role="radio"
              aria-checked={draft.gender === gender}
              disabled={busy}
              onClick={() => set('gender', draft.gender === gender ? '' : gender)}
              className={cn(
                'h-full flex-1 rounded-md text-xs font-semibold transition',
                draft.gender === gender
                  ? 'bg-[var(--primary)] text-white shadow-2xs'
                  : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]'
              )}
            >
              {gender}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Roles" required error={errors.roleIds} className="sm:col-span-2">
        <SearchableSelect
          multiple
          value={draft.roleIds}
          onChange={(next) => set('roleIds', Array.isArray(next) ? next : [])}
          options={roleOptions}
          placeholder="Select roles"
          disabled={busy}
          listClassName="max-h-52"
        />
      </Row>
      <label className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
        <Checkbox checked={draft.isActive} onChange={(e) => set('isActive', e.target.checked)} disabled={busy} />
        <span className="text-xs font-semibold text-[var(--text-main)]">Active</span>
        <span className="text-[11px] text-[var(--text-muted)]">An inactive user cannot sign in.</span>
      </label>
    </form>
  );
}
