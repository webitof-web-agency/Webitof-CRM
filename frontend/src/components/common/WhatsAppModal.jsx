import { useState, useEffect } from 'react';
import { MessageSquare, Send, Copy, Check, Sparkles, X, Phone, User, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

function cleanPhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  let digits = String(rawPhone).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }
  // If 10 digits without country code, assume India (+91)
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  return digits;
}

export function WhatsAppModal({ open, onClose, recipient, onSent }) {
  const { token } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState('intro');
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [logging, setLogging] = useState(false);

  const name = recipient?.name || recipient?.contactPerson || 'Client';
  const company = recipient?.companyName || recipient?.company || 'your organization';
  const service = Array.isArray(recipient?.requiredServices)
    ? recipient.requiredServices.join(', ')
    : (recipient?.service || recipient?.services || 'your inquiry');
  const amount = recipient?.amount ? `₹${Number(recipient.amount).toLocaleString('en-IN')}` : '';

  const templates = [
    {
      id: 'intro',
      label: '👋 Introduction & Welcome',
      text: `Hello ${name},\n\nThank you for connecting with Webitof regarding ${service}. We are excited to collaborate with ${company} to deliver high-quality digital solutions.\n\nPlease let us know a suitable time for a quick 10-minute discovery call.\n\nBest regards,\nWebitof Team`
    },
    {
      id: 'followup',
      label: '⏰ Follow-up Nudge',
      text: `Hi ${name},\n\nHope you are having a productive week!\n\nJust following up on our previous discussion regarding ${service}. Do you have any questions or feedback for us?\n\nLooking forward to hearing from you.`
    },
    {
      id: 'proposal',
      label: '📑 Proposal & Quotation Shared',
      text: `Hello ${name},\n\nWe have shared the project scope and proposal for ${service}.\n\nPlease review it at your convenience and let us know if any adjustments are needed.\n\nBest regards,\nWebitof Team`
    },
    {
      id: 'payment',
      label: '💳 Payment / Invoice Reminder',
      text: `Dear ${name},\n\nThis is a gentle reminder regarding invoice for ${company}${amount ? ` of amount ${amount}` : ''}.\n\nKindly process the payment at your earliest convenience. Let us know once completed.\n\nThank you for your business!`
    },
    {
      id: 'custom',
      label: '✏️ Custom Message',
      text: `Hi ${name}, `
    }
  ];

  useEffect(() => {
    if (open) {
      const defaultTpl = templates.find((t) => t.id === selectedTemplate) || templates[0];
      setCustomMessage(defaultTpl.text);
      setCopied(false);
    }
  }, [open, selectedTemplate, recipient]);

  const handleSelectTemplate = (tplId) => {
    setSelectedTemplate(tplId);
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl) setCustomMessage(tpl.text);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customMessage);
      setCopied(true);
      toast.success('Message copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleSendWhatsApp = async () => {
    const rawPhone = recipient?.phone || recipient?.mobile;
    const phone = cleanPhoneNumber(rawPhone);
    if (!phone) {
      toast.error('Valid phone number not found for this contact');
      return;
    }

    const encodedText = encodeURIComponent(customMessage);
    const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');

    // Auto-log activity if leadId or followUpId exists
    if (recipient?.leadId && token) {
      setLogging(true);
      try {
        await api.resources.create(`/leads/${recipient.leadId}/calls`, {
          callType: 'Outgoing',
          callOutcome: 'WhatsApp Sent',
          callNotes: `WhatsApp outreach sent: "${customMessage.slice(0, 100)}..."`,
          callerNumber: rawPhone,
          callDuration: 0
        }, token);
        toast.success('WhatsApp outreach logged in Lead timeline');
      } catch (e) {
        // Silently log or ignore non-critical logging failure
      } finally {
        setLogging(false);
      }
    }

    onSent?.();
    onClose();
  };

  const rawPhone = recipient?.phone || recipient?.mobile;
  const formattedPhone = cleanPhoneNumber(rawPhone);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="1-Click WhatsApp Outreach"
      subtitle={`Send a personalized direct WhatsApp message to ${name}`}
      width="640px"
      footer={(
        <div className="flex items-center justify-between gap-3 w-full">
          <Button variant="secondary" size="sm" onClick={handleCopy} className="cursor-pointer">
            {copied ? <Check size={14} className="mr-1.5 text-emerald-600" /> : <Copy size={14} className="mr-1.5" />}
            {copied ? 'Copied' : 'Copy Text'}
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              onClick={handleSendWhatsApp}
              disabled={!formattedPhone || logging}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm cursor-pointer"
            >
              <Send size={14} className="mr-1.5" />
              Open in WhatsApp
            </Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        {/* Recipient Badge */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 font-bold">
              <Phone size={14} />
            </span>
            <div>
              <span className="font-semibold text-slate-800">{name}</span>
              {recipient?.companyName && <span className="text-slate-500 ml-1">({recipient.companyName})</span>}
            </div>
          </div>
          <span className="font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded-md border border-slate-200">
            {rawPhone || 'No Phone Number'}
          </span>
        </div>

        {/* Template Selector Pills */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Message Template</label>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((tpl) => {
              const active = selectedTemplate === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    active
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {tpl.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Message Editor */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700">Message Preview & Customization</label>
            <span className="text-[11px] text-slate-400 font-mono">{customMessage.length} characters</span>
          </div>
          <Textarea
            rows={7}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className="text-sm font-sans leading-relaxed"
            placeholder="Type your WhatsApp message..."
          />
        </div>

        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
          Clicking "Open in WhatsApp" will open WhatsApp Web / App with this pre-filled message and log the outreach.
        </p>
      </div>
    </Modal>
  );
}
