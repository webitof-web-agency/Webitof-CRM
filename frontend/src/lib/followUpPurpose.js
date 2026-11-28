// Follow-up "purpose" labels: older records keep the label they were saved with, so renamed labels are
// mapped here for display instead of rewriting the stored rows.
const RENAMED_PURPOSES = {
  'First contact SLA': 'First call'
};

// Internal labels that read oddly in a message to the client ("following up regarding First call").
const INTERNAL_PURPOSES = new Set(['first call', 'first contact sla', 'lead follow-up']);

export function displayPurpose(purpose) {
  const value = String(purpose || '').trim();
  return RENAMED_PURPOSES[value] || value;
}

// Purpose text that is fit to put in a WhatsApp message; '' when it is only an internal label.
export function clientFacingPurpose(...candidates) {
  for (const candidate of candidates) {
    const value = displayPurpose(candidate);
    if (value && !INTERNAL_PURPOSES.has(value.toLowerCase())) return value;
  }
  return '';
}
