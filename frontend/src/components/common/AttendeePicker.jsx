import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, HelpCircle, Mail, Phone, Plus, UserRound, Users, X } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';

const TYPE_META = {
  user: { label: 'Employee', icon: UserRound, tone: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  lead: { label: 'Lead', icon: Building2, tone: 'text-violet-600 bg-violet-500/10 border-violet-500/20' },
  lead_contact: { label: 'Lead contact', icon: Users, tone: 'text-violet-600 bg-violet-500/10 border-violet-500/20' },
  client_contact: { label: 'Client contact', icon: Users, tone: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  client: { label: 'Client', icon: Building2, tone: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  email: { label: 'Guest', icon: Mail, tone: 'text-slate-600 bg-slate-500/10 border-slate-500/20' }
};

const RESPONSE = {
  accepted: { label: 'Yes', className: 'text-emerald-600', icon: Check },
  declined: { label: 'No', className: 'text-rose-600', icon: X },
  tentative: { label: 'Maybe', className: 'text-amber-600', icon: HelpCircle }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function keyOf(attendee) {
  if (attendee.type === 'user') return `user:${attendee.id}`;
  return attendee.email ? `email:${String(attendee.email).toLowerCase()}` : `phone:${attendee.phone}`;
}

function contactName(contact) {
  return [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || contact.name || contact.email || contact.phone || 'Contact';
}

// People on a meeting / reminder / follow-up: employees, the lead or client's contacts, or any
// email / phone typed in. They get the Google invite and the notifications (email, WhatsApp, app).
export function AttendeePicker({ value = [], onChange, leadId = '', clientId = '', lead = null, excludeUserId = '', label = 'Invite people' }) {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const attendees = Array.isArray(value) ? value : [];

  useEffect(() => {
    let active = true;
    api.resources.list('/users/lookup', token)
      .then((response) => active && setUsers(response.data || []))
      .catch(() => active && setUsers([]));
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    let active = true;
    const requests = [];
    if (leadId) requests.push(api.resources.list('/lead-contacts', token, '', { leadId }).then((r) => (r.data || []).map((c) => ({ ...c, _type: 'lead_contact' }))).catch(() => []));
    if (clientId) requests.push(api.resources.list('/client-contacts', token, '', { clientId }).then((r) => (r.data || []).map((c) => ({ ...c, _type: 'client_contact' }))).catch(() => []));
    Promise.all(requests).then((lists) => active && setContacts(lists.flat()));
    return () => { active = false; };
  }, [token, leadId, clientId]);

  useEffect(() => {
    function onDown(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const options = useMemo(() => {
    const list = [];
    if (lead && (lead.email || lead.phone)) {
      list.push({
        type: 'lead',
        id: lead.id || '',
        name: lead.contactPerson || lead.name || lead.companyName || 'Lead',
        email: lead.email || '',
        phone: lead.phone || lead.whatsappNumber || '',
        hint: lead.companyName || 'Lead primary contact'
      });
    }
    contacts.forEach((contact) => {
      if (!contact.email && !contact.phone) return;
      list.push({ type: contact._type, id: contact.id, name: contactName(contact), email: contact.email || '', phone: contact.phone || '', hint: contact.designation || TYPE_META[contact._type].label });
    });
    users.forEach((user) => {
      if (excludeUserId && String(user.id) === String(excludeUserId)) return;
      list.push({ type: 'user', id: user.id, name: user.fullName || user.email, email: user.email || '', phone: user.phone || '', hint: 'Employee' });
    });
    const taken = new Set(attendees.map(keyOf));
    const query = text.trim().toLowerCase();
    return list
      .filter((option) => !taken.has(keyOf(option)))
      .filter((option) => !query || [option.name, option.email, option.phone, option.hint].some((field) => String(field || '').toLowerCase().includes(query)))
      .slice(0, 12);
  }, [attendees, contacts, excludeUserId, lead, text, users]);

  const typed = text.trim();
  const typedEmail = EMAIL_RE.test(typed) ? typed.toLowerCase() : '';
  const typedPhone = !typedEmail && /^[+\d][\d\s-]{8,}$/.test(typed) ? typed.replace(/[^\d+]/g, '') : '';

  function add(option) {
    const next = [...attendees, {
      type: option.type, id: option.id || '', name: option.name || '', email: option.email || '', phone: option.phone || '', responseStatus: 'needsAction'
    }];
    onChange?.(next);
    setText('');
  }

  function remove(attendee) {
    onChange?.(attendees.filter((item) => keyOf(item) !== keyOf(attendee)));
  }

  return (
    <div ref={boxRef} className="space-y-1.5">
      <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      {attendees.length ? (
        <div className="flex flex-wrap gap-1.5">
          {attendees.map((attendee) => {
            const meta = TYPE_META[attendee.type] || TYPE_META.email;
            const Icon = meta.icon;
            const response = RESPONSE[attendee.responseStatus];
            const ResponseIcon = response?.icon;
            return (
              <span key={keyOf(attendee)} className={cn('inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', meta.tone)} title={[meta.label, attendee.email, attendee.phone].filter(Boolean).join(' · ')}>
                <Icon size={11} className="shrink-0" />
                <span className="truncate">{attendee.name || attendee.email || attendee.phone}</span>
                {response ? (
                  <span className={cn('inline-flex items-center gap-0.5', response.className)} title={`Replied: ${response.label}`}>
                    <ResponseIcon size={10} />{response.label}
                  </span>
                ) : null}
                <button type="button" onClick={() => remove(attendee)} className="ml-0.5 shrink-0 opacity-70 hover:opacity-100 cursor-pointer" aria-label={`Remove ${attendee.name || attendee.email}`}>
                  <X size={11} />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
      <div className="relative">
        <input
          value={text}
          onChange={(event) => { setText(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (typedEmail || typedPhone)) {
              event.preventDefault();
              add({ type: 'email', name: '', email: typedEmail, phone: typedPhone });
            }
          }}
          placeholder="Search employee, contact, or type an email / phone"
          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        {open && (options.length || typedEmail || typedPhone) ? (
          <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
            {typedEmail || typedPhone ? (
              <button type="button" onClick={() => add({ type: 'email', name: '', email: typedEmail, phone: typedPhone })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-blue-500/10 cursor-pointer">
                <Plus size={13} className="text-blue-600" />
                <span>Invite <strong>{typedEmail || typedPhone}</strong></span>
              </button>
            ) : null}
            {options.map((option) => {
              const meta = TYPE_META[option.type] || TYPE_META.email;
              const Icon = meta.icon;
              return (
                <button key={keyOf(option)} type="button" onClick={() => add(option)} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-blue-500/10 cursor-pointer">
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon size={13} className="shrink-0 text-slate-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{option.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">{[option.email, option.phone].filter(Boolean).join(' · ') || option.hint}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold uppercase text-slate-400">{option.hint}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <p className="flex items-center gap-1 text-[11px] text-slate-500">
        <Phone size={10} /> They get a Google Calendar invite, an email and a WhatsApp message with the details.
      </p>
    </div>
  );
}
