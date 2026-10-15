/**
 * Webitof Enterprise Quotation - Frontend Tax & GST Calculation Engine
 * Comprehensive place-of-supply resolution, inter-state IGST vs intra-state CGST+SGST,
 * and deterministic commercial totals calculations.
 */

export const DEFAULT_SUPPLIER_STATE = 'Chhattisgarh';
export const DEFAULT_SUPPLIER_COUNTRY = 'India';

export const STATE_CODE_MAP = {
  'jammu and kashmir': '01',
  'himachal pradesh': '02',
  'punjab': '03',
  'chandigarh': '04',
  'uttarakhand': '05',
  'haryana': '06',
  'delhi': '07',
  'rajasthan': '08',
  'uttar pradesh': '09',
  'bihar': '10',
  'sikkim': '11',
  'arunachal pradesh': '12',
  'nagaland': '13',
  'manipur': '14',
  'mizoram': '15',
  'tripura': '16',
  'meghalaya': '17',
  'assam': '18',
  'west bengal': '19',
  'jharkhand': '20',
  'odisha': '21',
  'chhattisgarh': '22',
  'madhya pradesh': '23',
  'gujarat': '24',
  'dadra and nagar haveli and daman and diu': '26',
  'maharashtra': '27',
  'andhra pradesh': '28',
  'karnataka': '29',
  'goa': '30',
  'lakshadweep': '31',
  'kerala': '32',
  'tamil nadu': '33',
  'puducherry': '34',
  'andaman and nicobar islands': '35',
  'telangana': '36',
  'andhra pradesh (new)': '37',
  'ladakh': '38'
};

export const UTGST_STATES = new Set([
  'andaman and nicobar islands',
  'chandigarh',
  'dadra and nagar haveli and daman and diu',
  'lakshadweep',
  'delhi',
  'puducherry',
  'jammu and kashmir',
  'ladakh'
]);

export function normalizeState(state = '') {
  return String(state || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getStateFromGstin(gstin = '') {
  const code = String(gstin || '').trim().slice(0, 2);
  if (/^\d{2}$/.test(code)) {
    for (const [stateName, stateCode] of Object.entries(STATE_CODE_MAP)) {
      if (stateCode === code) return stateName;
    }
  }
  return '';
}

export function resolveTaxTreatment({
  supplierState = DEFAULT_SUPPLIER_STATE,
  supplierCountry = DEFAULT_SUPPLIER_COUNTRY,
  clientState = '',
  clientCountry = 'India',
  clientGstin = '',
  placeOfSupply = '',
  gstApplicable = true,
  gstRate = 18
} = {}) {
  if (!gstApplicable || Number(gstRate) <= 0) {
    return {
      taxType: 'NO_TAX',
      isInterState: false,
      gstRate: 0,
      label: 'Tax Exempt / Not Applicable',
      summary: 'No GST Applicable'
    };
  }

  const normSupplierCountry = normalizeState(supplierCountry);
  const normClientCountry = normalizeState(clientCountry);

  // Overseas export check
  if (normClientCountry && normClientCountry !== 'india' && normClientCountry !== 'in') {
    return {
      taxType: 'EXPORT_ZERO_RATED',
      isInterState: true,
      gstRate: 0,
      label: 'Zero-Rated Export (Under LUT)',
      summary: 'Export Supply (Zero-Rated under LUT)'
    };
  }

  // Determine Destination / Place of Supply
  let destination = normalizeState(placeOfSupply);
  if (!destination) {
    const gstinState = getStateFromGstin(clientGstin);
    if (gstinState) {
      destination = gstinState;
    } else {
      destination = normalizeState(clientState);
    }
  }

  const origin = normalizeState(supplierState) || normalizeState(DEFAULT_SUPPLIER_STATE);

  // Inter-State vs Intra-State comparison
  if (destination && origin && destination !== origin) {
    const numericRate = Number(gstRate) || 18;
    return {
      taxType: 'IGST',
      isInterState: true,
      gstRate: numericRate,
      igstRate: numericRate,
      cgstRate: 0,
      sgstRate: 0,
      label: `IGST (${numericRate}%)`,
      summary: `Inter-State Supply (${destination.toUpperCase()} ≠ ${origin.toUpperCase()})`
    };
  }

  // Intra-State Supply -> CGST + SGST (or UTGST)
  const numericRate = Number(gstRate) || 18;
  const halfRate = Math.round((numericRate / 2) * 10) / 10;
  const isUt = UTGST_STATES.has(destination || origin);

  return {
    taxType: isUt ? 'CGST_UTGST' : 'CGST_SGST',
    isInterState: false,
    gstRate: numericRate,
    igstRate: 0,
    cgstRate: halfRate,
    sgstRate: halfRate,
    label: isUt ? `CGST (${halfRate}%) + UTGST (${halfRate}%)` : `CGST (${halfRate}%) + SGST (${halfRate}%)`,
    summary: `Intra-State Supply (${(destination || origin).toUpperCase()})`
  };
}

export function calculateQuotationTotals({
  amount = 0,
  discountEnabled = false,
  discountType = 'percent',
  discountValue = 0,
  gstApplicable = false,
  gstRate = 18,
  supplierState = DEFAULT_SUPPLIER_STATE,
  clientState = '',
  placeOfSupply = '',
  clientGstin = ''
} = {}) {
  const round2 = (val) => Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;

  const subtotal = Math.max(0, Number(amount) || 0);

  let rawDiscount = 0;
  if (discountEnabled) {
    const dVal = Math.max(0, Number(discountValue) || 0);
    if (discountType === 'flat') {
      rawDiscount = Math.min(subtotal, dVal);
    } else {
      rawDiscount = Math.min(subtotal, (subtotal * Math.min(dVal, 100)) / 100);
    }
  }
  const discountAmount = round2(rawDiscount);
  const taxableAmount = round2(Math.max(0, subtotal - discountAmount));

  const treatment = resolveTaxTreatment({
    supplierState,
    clientState,
    placeOfSupply,
    clientGstin,
    gstApplicable,
    gstRate
  });

  let igstAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let gstAmount = 0;

  if (treatment.taxType === 'IGST') {
    igstAmount = Math.round((taxableAmount * treatment.gstRate) / 100);
    gstAmount = igstAmount;
  } else if (treatment.taxType === 'CGST_SGST' || treatment.taxType === 'CGST_UTGST') {
    cgstAmount = Math.round((taxableAmount * treatment.cgstRate) / 100);
    sgstAmount = Math.round((taxableAmount * treatment.sgstRate) / 100);
    gstAmount = cgstAmount + sgstAmount;
  }

  const totalAmount = round2(taxableAmount + gstAmount);

  return {
    subtotal: round2(subtotal),
    discountAmount,
    taxableAmount,
    gstApplicable: treatment.taxType !== 'NO_TAX',
    gstRate: treatment.gstRate,
    taxType: treatment.taxType,
    isInterState: treatment.isInterState,
    taxLabel: treatment.label,
    taxSummary: treatment.summary,
    igstAmount,
    cgstAmount,
    sgstAmount,
    gstAmount,
    totalAmount
  };
}
