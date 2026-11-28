// Names for a follow-up's lead, read from the live lead (item.leadContext), not from the label the follow-up
// saved when it was created — that label goes stale when the lead is renamed or an auto name is filled in.

const LEAD_CONTEXT_TYPES = new Set(['lead', 'opportunity', 'deal', 'quotation', 'proposal']);
const AUTO_LEAD_NAME = /^lead-\d+$/i;
const PLACEHOLDER_NAMES = new Set(['-', 'na', 'n/a', 'n a', 'n.a', 'n.a.', 'none', 'unknown', 'test']);

export function hasLeadContext(item) {
  return Boolean(item?.leadContext) && LEAD_CONTEXT_TYPES.has(String(item.relatedEntityType || '').toLowerCase());
}

// A name a person typed in: not blank, not a placeholder like "na", not an auto name like "Lead-000015".
export function isRealName(value) {
  const name = String(value || '').trim();
  return Boolean(name) && !PLACEHOLDER_NAMES.has(name.toLowerCase()) && !AUTO_LEAD_NAME.test(name);
}

const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// "LD-000013" -> "Lead-000013", the same auto name the lead form uses when the name is unknown.
function leadNumberName(leadNumber) {
  const digits = String(leadNumber || '').trim().split('-').pop();
  return digits ? `Lead-${digits}` : '';
}

/**
 * chip    – the lead's own name for the card chip (business name for an organisation, else the person's name);
 *           when the lead has none, its lead number, so the contact person can be shown on its own
 * contact – the primary contact person, when it is a real name and not already the chip text
 * company – a person-type lead's company, when it adds something
 */
export function leadNames(item = {}) {
  const fallback = String(item.relatedEntityLabel || item.relatedEntityId || '');
  if (!hasLeadContext(item)) return { chip: fallback, contact: '', company: '' };

  const ctx = item.leadContext || {};
  const isOrganisation = String(ctx.type || '').toLowerCase() === 'organization';
  const contactPerson = isRealName(ctx.contactPerson) ? String(ctx.contactPerson).trim() : '';
  const ownName = [isOrganisation ? item.companyName : ctx.name, ctx.name, item.companyName].find(isRealName);
  const chip = String(ownName || leadNumberName(ctx.leadNumber) || contactPerson || fallback).trim();
  const company = !isOrganisation && isRealName(item.companyName) && !same(item.companyName, chip) && !same(item.companyName, contactPerson)
    ? String(item.companyName).trim()
    : '';
  return { chip, contact: contactPerson && !same(contactPerson, chip) ? contactPerson : '', company };
}

// Who to greet in a WhatsApp message: the contact person first, then the lead's name.
export function greetingName(item = {}) {
  const { chip, contact } = leadNames(item);
  const name = contact || chip;
  return isRealName(name) ? name : 'there';
}
