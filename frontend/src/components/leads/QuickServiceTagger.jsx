import React, { useState } from 'react';
import { Tag, Plus, X, Check, Sparkles } from 'lucide-react';
import { cn } from '../../lib/cn';
import { toast } from 'sonner';

const POPULAR_SERVICES = [
  'CRM Development',
  'Website Development',
  'Mobile App Development',
  'Custom Software Development',
  'Digital Marketing',
  'UI/UX Design',
  'Search Engine Optimisation',
  'IT Consulting',
  'Software AMC'
];

export function QuickServiceTagger({
  lead = {},
  onUpdateServices,
  canWrite = true
}) {
  const [busy, setBusy] = useState(false);

  // Normalize current services
  const currentServices = Array.isArray(lead.requiredServices)
    ? lead.requiredServices
    : typeof lead.requiredServices === 'string'
      ? lead.requiredServices.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  const handleAddService = async (serviceName) => {
    if (!canWrite || busy) return;
    if (currentServices.includes(serviceName)) return;

    const nextServices = [...currentServices, serviceName];
    setBusy(true);
    try {
      if (onUpdateServices) {
        await onUpdateServices(nextServices);
        toast.success(`Tagged: ${serviceName}`);
      }
    } catch (err) {
      toast.error('Failed to update service');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveService = async (serviceName) => {
    if (!canWrite || busy) return;
    const nextServices = currentServices.filter((s) => s !== serviceName);
    setBusy(true);
    try {
      if (onUpdateServices) {
        await onUpdateServices(nextServices);
        toast.success(`Removed: ${serviceName}`);
      }
    } catch (err) {
      toast.error('Failed to update service');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-transparent p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-[var(--text-main)]">
          <Tag size={13} className="text-cyan-600 dark:text-cyan-400" />
          <span>Fast-Action Requirement Tagger</span>
        </div>
        <span className="text-[10px] font-semibold text-[var(--text-muted)]">
          Click tag to instantly attach to lead
        </span>
      </div>

      {/* Currently tagged services */}
      {currentServices.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pb-1 border-b border-[var(--border-muted)]">
          <span className="text-[10px] font-semibold text-[var(--text-muted)] mr-1">Active Tags:</span>
          {currentServices.map((service) => (
            <span
              key={service}
              className="inline-flex items-center gap-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-xs font-semibold text-cyan-800 dark:text-cyan-200"
            >
              <Check size={11} className="text-cyan-600 dark:text-cyan-400" />
              <span>{service}</span>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => handleRemoveService(service)}
                  disabled={busy}
                  className="ml-0.5 text-cyan-600 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                  title={`Remove ${service}`}
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Suggested Quick Add Chips */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10px] font-semibold text-[var(--text-muted)] mr-1">Quick Add:</span>
        {POPULAR_SERVICES.filter((s) => !currentServices.includes(s)).map((service) => (
          <button
            key={service}
            type="button"
            disabled={busy || !canWrite}
            onClick={() => handleAddService(service)}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--surface)] hover:bg-cyan-500/10 border border-[var(--border-muted)] hover:border-cyan-500/30 px-2 py-0.5 text-xs font-medium text-[var(--text-muted)] hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors cursor-pointer select-none"
          >
            <Plus size={11} />
            <span>{service}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
export default QuickServiceTagger;
