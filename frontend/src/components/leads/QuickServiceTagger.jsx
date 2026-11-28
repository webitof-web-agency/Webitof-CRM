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

  // One wrapping row: tagged services, then quick-add chips for the rest.
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-transparent px-3 py-2"
      title="Click a tag to attach it to the lead instantly"
    >
      <span className="mr-0.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-main)]">
        <Tag size={12} className="text-cyan-600 dark:text-cyan-400" />
        Services
      </span>

      {/* Currently tagged services */}
      {currentServices.length > 0 && (
        <>
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
          <span className="mx-1 h-4 w-px bg-[var(--border)]" aria-hidden="true" />
        </>
      )}

      {/* Suggested Quick Add Chips */}
      <span className="text-[10px] font-semibold text-[var(--text-muted)]">Add:</span>
      {POPULAR_SERVICES.filter((s) => !currentServices.includes(s)).map((service) => (
        <button
          key={service}
          type="button"
          disabled={busy || !canWrite}
          onClick={() => handleAddService(service)}
          className="inline-flex items-center gap-0.5 rounded-md bg-[var(--surface)] hover:bg-cyan-500/10 border border-[var(--border-muted)] hover:border-cyan-500/30 px-1.5 py-px text-[11px] font-medium text-[var(--text-muted)] hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors cursor-pointer select-none"
        >
          <Plus size={10} />
          <span>{service}</span>
        </button>
      ))}
    </div>
  );
}
export default QuickServiceTagger;
