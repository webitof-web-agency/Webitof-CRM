import { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { MessageSquare, Copy, Check, ExternalLink, Mail, Sparkles, PhoneCall } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_TEMPLATES = [
  {
    id: 'intro',
    name: '👋 Intro & Welcome',
    subject: 'Welcome to Webitof - {{service}} Consultation',
    template: `Hi {{name}}, Webitof welcomes you! 

Thank you for reaching out regarding {{service}}. We would love to understand your vision and goals so we can craft the perfect digital solution for {{company}}.

When would be a good time for a quick 10-minute discovery call today?

Warm regards,
{{agent_name}} | Webitof Digital Solutions`
  },
  {
    id: 'proposal_sent',
    name: '📄 Proposal Shared Follow-up',
    subject: 'Proposal for {{service}} - Webitof',
    template: `Hi {{name}}, 

Hope you are having a productive day! 

We have prepared and shared the project scope and commercial proposal for {{service}} (Estimated Investment: {{budget}}). 

Please take a look at your convenience. I would be happy to walk you through the details and answer any questions.

Looking forward to hearing your thoughts!

Best regards,
{{agent_name}} | Webitof`
  },
  {
    id: 'meeting_reminder',
    name: '⏰ Meeting / Call Reminder',
    subject: 'Quick Reminder: Discussion at {{time}} today',
    template: `Hi {{name}}, 

Gentle reminder regarding our scheduled discussion at {{time}} today regarding {{service}}. 

Looking forward to connecting with you. If you need to reschedule or have any questions beforehand, please feel free to let me know.

Thanks,
{{agent_name}} | Webitof`
  },
  {
    id: 'advance_payment',
    name: '💰 Advance Payment & Project Kickoff',
    subject: 'Project Kickoff & Milestone Advance - {{service}}',
    template: `Hi {{name}}, 

We are excited to kick off {{service}} for {{company}}! 

As agreed, to initiate the dedicated design & development phase, kindly arrange the 50% milestone advance ({{advance_amount}}). 

Bank / UPI details:
• Bank: HDFC Bank
• A/C Name: Webitof Technologies Pvt Ltd
• UPI / QR: webitof@hdfcbank

Please share the payment confirmation screenshot once done so our team can onboard your project immediately.

Warm regards,
{{agent_name}} | Webitof`
  },
  {
    id: 'reengagement',
    name: '🔥 Re-engagement / Revive Lead',
    subject: 'Checking in regarding {{service}} for {{company}}',
    template: `Hi {{name}}, 

Checking in to see if you are still looking to proceed with {{service}} for {{company}}? 

We have rolled out exciting new features and flexible milestone options this month that might perfectly align with your roadmap. 

Would love to reconnect whenever you are ready!

Best regards,
{{agent_name}} | Webitof`
  }
];

export function WhatsAppTemplateModal({ open, onClose, lead }) {
  const { user } = useAuth();
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATES[0].id);
  const [copied, setCopied] = useState(false);

  const cleanPhone = useMemo(() => {
    if (!lead?.phone && !lead?.mobile) return '';
    let digits = String(lead.phone || lead.mobile).replace(/[^0-9]/g, '');
    if (digits.length === 10) digits = `91${digits}`;
    return digits;
  }, [lead?.phone, lead?.mobile]);

  const mergeVariables = useMemo(() => {
    const contactName = lead?.contactPerson || lead?.name || 'there';
    const company = lead?.companyName || lead?.name || 'your business';
    const service = lead?.requiredService || (Array.isArray(lead?.requiredServices) && lead.requiredServices[0]) || lead?.serviceName || 'Website & Digital Growth';
    const budgetVal = Number(lead?.estimatedBudget || lead?.value || 0);
    const budget = budgetVal > 0 ? `₹${budgetVal.toLocaleString('en-IN')}` : 'competitive pricing';
    const advanceAmount = budgetVal > 0 ? `₹${Math.round(budgetVal * 0.5).toLocaleString('en-IN')}` : '50% Advance';
    const time = lead?.nextFollowUpTime || 'scheduled time';
    const agentName = user?.fullName || user?.username || 'Team Webitof';
    const leadCode = lead?.leadNumber || '';

    return {
      '{{name}}': contactName,
      '{{company}}': company,
      '{{service}}': service,
      '{{budget}}': budget,
      '{{advance_amount}}': advanceAmount,
      '{{time}}': time,
      '{{agent_name}}': agentName,
      '{{lead_code}}': leadCode
    };
  }, [lead, user]);

  const activeTemplate = useMemo(() => {
    return DEFAULT_TEMPLATES.find((t) => t.id === selectedTemplateId) || DEFAULT_TEMPLATES[0];
  }, [selectedTemplateId]);

  const interpolatedMessage = useMemo(() => {
    let msg = activeTemplate.template;
    Object.entries(mergeVariables).forEach(([key, val]) => {
      msg = msg.split(key).join(val);
    });
    return msg;
  }, [activeTemplate, mergeVariables]);

  const [customText, setCustomText] = useState('');

  // When active template or lead changes, reset customText
  const currentText = customText !== '' ? customText : interpolatedMessage;

  function handleSelectTemplate(id) {
    setSelectedTemplateId(id);
    setCustomText('');
  }

  function handleCopy() {
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    toast.success('Message copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSendWhatsApp() {
    if (!cleanPhone) {
      toast.error('No valid phone number for WhatsApp');
      return;
    }
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(currentText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.success('Opening WhatsApp...');
    onClose();
  }

  function handleSendEmail() {
    if (!lead?.email) {
      toast.error('No email address for this lead');
      return;
    }
    let subject = activeTemplate.subject;
    Object.entries(mergeVariables).forEach(([key, val]) => {
      subject = subject.split(key).join(val);
    });
    const url = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(currentText)}`;
    window.location.href = url;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Smart Outreach & WhatsApp Templates"
      subtitle={`Outreach message for ${lead?.contactPerson || lead?.name || 'Lead'} • Phone: ${lead?.phone || 'N/A'}`}
      width="min(720px, 96vw)"
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Sparkles size={13} className="text-amber-500" />
            <span>Dynamic tags auto-filled from lead data</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check size={14} className="mr-1.5 text-emerald-600" /> : <Copy size={14} className="mr-1.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            {lead?.email ? (
              <Button variant="outline" size="sm" onClick={handleSendEmail}>
                <Mail size={14} className="mr-1.5 text-blue-600" />
                Email
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={handleSendWhatsApp}
              disabled={!cleanPhone}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              <MessageSquare size={14} className="mr-1.5 fill-white" />
              Send WhatsApp
              <ExternalLink size={12} className="ml-1 opacity-70" />
            </Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        {/* Template selector pills */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Select Outreach Template:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl.id)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                  selectedTemplateId === tpl.id
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                }`}
              >
                {tpl.name}
              </button>
            ))}
          </div>
        </div>

        {/* Message Editor & Live Preview */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Personalized Message Preview (Editable):
            </span>
            <span className="text-[11px] text-slate-400">
              {currentText.length} characters
            </span>
          </div>
          <Textarea
            rows={10}
            value={currentText}
            onChange={(e) => setCustomText(e.target.value)}
            className="font-mono text-xs leading-relaxed bg-white dark:bg-slate-900"
          />
        </div>

        {/* Dynamic Variable Chips */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Applied Data Tags:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(mergeVariables).map(([tag, value]) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300"
              >
                <code className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">{tag}</code>
                <span>➔</span>
                <span className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[140px]">{value}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
