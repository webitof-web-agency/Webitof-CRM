/**
 * Smart Tax Engine
 * Automatically determines tax treatment based on:
 *  - Company's registered state (from settings.company.stateCode)
 *  - Client's state / tax treatment / country
 *  - Global GST settings (LUT, autoDetectTax, etc.)
 */

export const TAX_TREATMENTS = [
  { value: 'Regular', label: 'Regular (GST Registered)' },
  { value: 'Composition', label: 'Composition Scheme' },
  { value: 'Unregistered', label: 'Unregistered / Consumer' },
  { value: 'SEZ', label: 'SEZ Unit / Developer' },
  { value: 'Overseas', label: 'Overseas / Export' },
];

export const TDS_SECTIONS = [
  { value: 'Not Applicable', label: 'Not Applicable' },
  { value: '194C', label: '194C — Contractor (1% / 2%)' },
  { value: '194H', label: '194H — Commission / Brokerage (2%)' },
  { value: '194I', label: '194I — Rent (10%)' },
  { value: '194J', label: '194J — Professional / Technical (10%)' },
  { value: '194B', label: '194B — Winnings (30%)' },
];

export const TDS_RATES = {
  '194C': 2,
  '194H': 2,
  '194I': 10,
  '194J': 10,
  '194B': 30,
};

/**
 * Determines which tax type to apply based on company and client location/treatment.
 * Returns: 'none' | 'cgst_sgst' | 'igst' | 'igst_zero'
 */
export function determineTaxType({ gstSettings = {}, companyStateCode, client = {} }) {
  if (!gstSettings.gstRegistered) return 'none';

  const treatment = client.taxTreatment || 'Regular';

  // Overseas / Export clients: zero-rated with LUT
  if (treatment === 'Overseas' || client.country?.toLowerCase() !== 'india' && client.country) {
    return gstSettings.lutEnabled ? 'igst_zero' : 'igst';
  }

  // SEZ: zero rated
  if (treatment === 'SEZ') return 'igst_zero';

  // Unregistered: B2C — apply CGST/SGST intra-state, IGST inter-state
  // For Composition / Regular: check state codes
  if (!gstSettings.autoDetectTax) {
    // No smart detection — just apply the default rate as IGST
    return 'igst';
  }

  const clientStateCode = client.stateCode;
  if (!clientStateCode || !companyStateCode) {
    // Can't determine — default to IGST (safer)
    return 'igst';
  }

  if (String(clientStateCode).trim() === String(companyStateCode).trim()) {
    return 'cgst_sgst';
  }
  return 'igst';
}

/**
 * Calculates all tax components for a given taxable amount.
 * @param {number} taxableAmount - Pre-tax subtotal
 * @param {number} taxRate - Total GST rate (e.g. 18 for 18%)
 * @param {'none'|'cgst_sgst'|'igst'|'igst_zero'} taxType
 * @returns {{ cgst, sgst, igst, totalTax, totalAmount }}
 */
export function calculateTax(taxableAmount, taxRate = 18, taxType = 'igst') {
  const amount = Number(taxableAmount) || 0;
  const rate = Number(taxRate) || 0;

  if (taxType === 'none' || taxType === 'igst_zero') {
    return { cgst: 0, sgst: 0, igst: 0, totalTax: 0, totalAmount: amount };
  }

  const totalTax = Math.round((amount * rate) / 100 * 100) / 100;

  if (taxType === 'cgst_sgst') {
    const half = Math.round(totalTax / 2 * 100) / 100;
    return { cgst: half, sgst: half, igst: 0, totalTax, totalAmount: amount + totalTax };
  }

  // IGST
  return { cgst: 0, sgst: 0, igst: totalTax, totalTax, totalAmount: amount + totalTax };
}

/**
 * Validates a GSTIN format (Indian standard: 15 chars, first 2 digits are state code).
 * Returns null if valid, or an error string.
 */
export function validateGSTIN(gstin = '') {
  if (!gstin) return null; // Optional field
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(gstin.toUpperCase())) {
    return 'GSTIN must be 15 characters (e.g., 22AAAAA0000A1Z5)';
  }
  return null;
}

/**
 * Extracts state code from GSTIN (first 2 digits).
 */
export function getStateCodeFromGSTIN(gstin = '') {
  return gstin?.length >= 2 ? gstin.substring(0, 2) : null;
}

/**
 * Gets human-readable tax label for invoice display.
 */
export function getTaxLabel(taxType) {
  switch (taxType) {
    case 'cgst_sgst': return 'CGST + SGST (Local)';
    case 'igst': return 'IGST (Inter-State)';
    case 'igst_zero': return 'Export (Zero-Rated)';
    case 'none': return 'No Tax';
    default: return 'Tax';
  }
}
