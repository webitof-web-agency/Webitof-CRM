const { round2, toNumber } = require('./format');

const OUTSIDE_INDIA = 'Outside India';
const DEFAULT_STATE = 'Chhattisgarh';

function normalizeKey(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isIndiaCountry(country = 'India') {
  const value = normalizeKey(country);
  return value === 'india' || value === 'in';
}

function getStateCode(state = '', gstin = '') {
  const gstinCode = String(gstin || '').trim().slice(0, 2);
  if (/^\d{2}$/.test(gstinCode)) return gstinCode;
  const map = {
    'chhattisgarh': '22',
    'maharashtra': '27',
    'karnataka': '29',
    'delhi': '07',
    'rajasthan': '08',
    'uttar pradesh': '09',
    'madhya pradesh': '23',
    'gujarat': '24',
    'west bengal': '19',
    'tamil nadu': '33'
  };
  return map[normalizeKey(state)] || '';
}

function isUtgstState(state = '') {
  return ['andaman and nicobar islands', 'chandigarh', 'dadra and nagar haveli and daman and diu', 'lakshadweep', 'delhi', 'puducherry', 'jammu and kashmir', 'ladakh'].includes(normalizeKey(state));
}

function getPlaceOfSupplyForClient(client = {}, settings = {}) {
  if (!isIndiaCountry(client?.country || 'India') || client?.gstRegistrationType === 'Overseas') {
    return OUTSIDE_INDIA;
  }
  return client?.placeOfSupply || client?.state || settings?.company?.state || DEFAULT_STATE;
}

function getDefaultInvoiceTypeForClient(client = {}, settings = {}) {
  const useLut = Boolean(settings?.gst?.lutEnabled);
  if (!isIndiaCountry(client?.country || 'India') || client?.gstRegistrationType === 'Overseas') {
    return useLut ? 'Export without payment of IGST under LUT' : 'Export with payment of IGST';
  }
  if (client?.gstRegistrationType === 'SEZ') {
    return useLut ? 'SEZ without payment of IGST under LUT' : 'SEZ with payment of IGST';
  }
  return 'Regular';
}

function resolveGstType({ companyState = DEFAULT_STATE, companyCountry = 'India', clientState = DEFAULT_STATE, clientCountry = 'India', placeOfSupply = '', invoiceType = 'Regular', gstRegistered = true, lutEnabled = true } = {}) {
  const type = normalizeKey(invoiceType);
  const destination = normalizeKey(placeOfSupply || clientState || DEFAULT_STATE);
  const supplierState = normalizeKey(companyState || DEFAULT_STATE);
  const recipientCountry = normalizeKey(clientCountry || 'India');
  const supplierCountry = normalizeKey(companyCountry || 'India');
  const exportOrSez = !isIndiaCountry(recipientCountry) || type.includes('export') || type.includes('sez');

  if (!gstRegistered) {
    return { gstType: 'NONE', supplyType: 'Non-GST', reason: 'Company is not GST registered.' };
  }

  if (!isIndiaCountry(supplierCountry)) {
    return { gstType: 'NONE', supplyType: 'Non-GST', reason: 'Supplier country is outside India.' };
  }

  if (exportOrSez) {
    if (type.includes('without payment') || type.includes('lut') || lutEnabled) {
      return { gstType: 'NONE', supplyType: type.includes('sez') ? 'SEZ without payment under LUT' : 'Export without payment under LUT', reason: 'Zero-rated supply without payment of IGST.' };
    }
    return { gstType: 'IGST', supplyType: type.includes('sez') ? 'SEZ with payment of IGST' : 'Export with payment of IGST', reason: 'Zero-rated supply with payment of IGST.' };
  }

  if (supplierState === destination) {
    return {
      gstType: isUtgstState(destination) ? 'CGST_UTGST' : 'CGST_SGST',
      supplyType: isUtgstState(destination) ? 'Intra-state UT supply' : 'Intra-state supply',
      reason: 'Supplier state and place of supply are same.'
    };
  }

  return { gstType: 'IGST', supplyType: 'Inter-state supply', reason: 'Supplier state and place of supply are different.' };
}

function calculateGstBreakdown({
  taxableAmount,
  gstRate = 18,
  companyState = DEFAULT_STATE,
  companyCountry = 'India',
  companyGstin = '',
  clientState = DEFAULT_STATE,
  clientCountry = 'India',
  clientGstin = '',
  placeOfSupply = '',
  invoiceType = 'Regular',
  gstRegistered = true,
  lutEnabled = true
}) {
  const context = resolveGstType({
    companyState,
    companyCountry,
    clientState,
    clientCountry,
    placeOfSupply,
    invoiceType,
    gstRegistered,
    lutEnabled
  });
  const amount = round2(taxableAmount);
  const rate = toNumber(gstRate);
  if (context.gstType === 'NONE' || rate <= 0) {
    return {
      ...context,
      companyStateCode: getStateCode(companyState, companyGstin),
      placeOfSupplyStateCode: getStateCode(placeOfSupply || clientState, clientGstin),
      taxableAmount: amount,
      gstRate: rate,
      cgst: 0,
      sgst: 0,
      utgst: 0,
      igst: 0,
      gstAmount: 0,
      totalAmount: amount
    };
  }

  const gstAmount = round2(amount * rate / 100);
  const half = round2(gstAmount / 2);
  return {
    ...context,
    companyStateCode: getStateCode(companyState, companyGstin),
    placeOfSupplyStateCode: getStateCode(placeOfSupply || clientState, clientGstin),
    taxableAmount: amount,
    gstRate: rate,
    cgst: context.gstType === 'CGST_SGST' ? half : 0,
    sgst: context.gstType === 'CGST_SGST' ? round2(gstAmount - half) : 0,
    utgst: context.gstType === 'CGST_UTGST' ? round2(gstAmount - half) : 0,
    igst: context.gstType === 'IGST' ? gstAmount : 0,
    gstAmount,
    totalAmount: round2(amount + gstAmount)
  };
}

function calculateExclusiveTax(taxableAmount, gstRate = 18) {
  const taxable = round2(taxableAmount);
  const gstAmount = round2(taxable * toNumber(gstRate) / 100);
  return { taxableAmount: taxable, gstAmount, totalAmount: round2(taxable + gstAmount) };
}

function calculateInclusiveTax(totalAmount, gstRate = 18) {
  const total = round2(totalAmount);
  const rate = toNumber(gstRate);
  if (rate <= 0) return { taxableAmount: total, gstAmount: 0, totalAmount: total };
  const taxableAmount = round2(total / (1 + rate / 100));
  return { taxableAmount, gstAmount: round2(total - taxableAmount), totalAmount: total };
}

function splitCgstSgst(gstAmount) {
  const half = round2(toNumber(gstAmount) / 2);
  return { cgst: half, sgst: round2(toNumber(gstAmount) - half) };
}

function calculateInvoiceTotals(invoice = {}, invoiceItems = [], settings = {}, client = {}) {
  const companyState = settings?.company?.state || DEFAULT_STATE;
  const companyCountry = settings?.company?.country || 'India';
  const companyGstin = settings?.company?.gstin || '';
  const gstRegistered = settings?.gst?.gstRegistered !== false;
  const lutEnabled = settings?.gst?.lutEnabled !== false;
  const autoDetectTax = settings?.gst?.autoDetectTax !== false;
  const amountType = invoice?.amountType || 'GST Extra';
  const gstEnabled = amountType !== 'No Tax';
  const placeOfSupply = invoice?.placeOfSupply || client?.placeOfSupply || client?.state || companyState;
  const invoiceType = autoDetectTax && invoice?.invoiceType === 'Regular'
    ? getDefaultInvoiceTypeForClient(client, settings)
    : invoice?.invoiceType || 'Regular';

  const rows = invoiceItems.filter((item) => !item?.hidden).map((item) => {
    const quantity = toNumber(item.quantity ?? item.qty ?? 1);
    const lineAmount = round2(quantity * toNumber(item.rate));
    const lineDiscount = round2(lineAmount * toNumber(item.discount) / 100);
    const grossLineAmount = round2(Math.max(0, lineAmount - lineDiscount));
    const rate = gstEnabled ? toNumber(item.gstRate ?? item.taxRate, settings?.gst?.defaultRate ?? 18) : 0;
    const preview = calculateGstBreakdown({
      taxableAmount: 0,
      gstRate: rate,
      companyState,
      companyCountry,
      companyGstin,
      clientState: client?.state,
      clientCountry: client?.country,
      clientGstin: client?.gstin,
      placeOfSupply,
      invoiceType,
      gstRegistered,
      lutEnabled
    });
    const effectiveRate = gstEnabled && preview.gstType !== 'NONE' ? rate : 0;
    const base = amountType === 'GST Inclusive'
      ? calculateInclusiveTax(grossLineAmount, effectiveRate)
      : calculateExclusiveTax(grossLineAmount, effectiveRate);
    const gst = calculateGstBreakdown({
      taxableAmount: base.taxableAmount,
      gstRate: effectiveRate,
      companyState,
      companyCountry,
      companyGstin,
      clientState: client?.state,
      clientCountry: client?.country,
      clientGstin: client?.gstin,
      placeOfSupply,
      invoiceType,
      gstRegistered,
      lutEnabled
    });
    return {
      ...item,
      qty: quantity,
      quantity,
      discountAmount: lineDiscount,
      taxableAmount: gst.taxableAmount,
      cgst: gst.cgst,
      sgst: gst.sgst,
      utgst: gst.utgst,
      igst: gst.igst,
      gstAmount: gst.gstAmount,
      total: amountType === 'GST Inclusive' ? grossLineAmount : gst.totalAmount
    };
  });

  const subtotal = round2(rows.reduce((sum, item) => sum + toNumber(item.taxableAmount), 0));
  const discountValue = toNumber(invoice.discountValue);
  const discountAmount = discountValue > 0
    ? round2(String(invoice.discountType || 'percent').toLowerCase() === 'flat'
      ? discountValue
      : subtotal * discountValue / 100)
    : 0;
  const discountRatio = subtotal > 0 ? Math.min(discountAmount, subtotal) / subtotal : 0;

  const discountedRows = discountAmount > 0
    ? rows.map((item) => {
        const nextTaxableAmount = round2(Math.max(0, toNumber(item.taxableAmount) - (toNumber(item.taxableAmount) * discountRatio)));
        const gst = calculateGstBreakdown({
          taxableAmount: nextTaxableAmount,
          gstRate: item.gstRate || 0,
          companyState,
          companyCountry,
          companyGstin,
          clientState: client?.state,
          clientCountry: client?.country,
          clientGstin: client?.gstin,
          placeOfSupply,
          invoiceType,
          gstRegistered,
          lutEnabled
        });
        return {
          ...item,
          taxableAmount: gst.taxableAmount,
          cgst: gst.cgst,
          sgst: gst.sgst,
          utgst: gst.utgst,
          igst: gst.igst,
          gstAmount: gst.gstAmount,
          total: amountType === 'GST Inclusive' ? round2(nextTaxableAmount + gst.gstAmount) : gst.totalAmount
        };
      })
    : rows;

  const discountedTotals = discountedRows.reduce((acc, item) => {
    acc.taxableAmount += toNumber(item.taxableAmount);
    acc.cgst += toNumber(item.cgst);
    acc.sgst += toNumber(item.sgst);
    acc.utgst += toNumber(item.utgst);
    acc.igst += toNumber(item.igst);
    acc.gstAmount += toNumber(item.gstAmount);
    acc.totalAmount += toNumber(item.total);
    return acc;
  }, { taxableAmount: 0, cgst: 0, sgst: 0, utgst: 0, igst: 0, gstAmount: 0, totalAmount: 0 });

  const advanceAmount = Math.max(0, toNumber(invoice.advanceAmount));
  discountedTotals.totalAmount = Math.max(0, discountedTotals.totalAmount - advanceAmount);
  const gstType = !gstEnabled ? 'NONE' : discountedRows[0] ? calculateGstBreakdown({
    taxableAmount: discountedRows[0].taxableAmount,
    gstRate: discountedRows[0].gstRate || 0,
    companyState,
    companyCountry,
    companyGstin,
    clientState: client?.state,
    clientCountry: client?.country,
    clientGstin: client?.gstin,
    placeOfSupply,
    invoiceType,
    gstRegistered,
    lutEnabled
  }).gstType : 'NONE';
  const taxType = gstType === 'CGST_SGST' || gstType === 'CGST_UTGST'
    ? 'cgst_sgst'
    : gstType === 'IGST'
      ? 'igst'
      : 'none';

  return {
    gstType,
    taxType,
    taxRate: discountedRows[0]?.gstRate || invoice.taxRate || settings?.gst?.defaultRate || 0,
    placeOfSupply,
    discountAmount: round2(Math.min(discountAmount, subtotal)),
    advanceAmount: round2(advanceAmount),
    items: discountedRows,
    ...Object.fromEntries(Object.entries(discountedTotals).map(([key, value]) => [key, round2(value)]))
  };
}

function calculateExpenseImpact(expense = {}) {
  const amountBeforeGst = toNumber(expense.amountBeforeGst);
  const gstAmount = toNumber(expense.gstAmount);
  const totalAmount = round2(toNumber(expense.totalAmount) || amountBeforeGst + gstAmount);
  const isPayrollExpense = String(expense.expenseType || expense.expense_type || '').trim() === 'Employee Salary';
  return {
    expenseAmount: round2(isPayrollExpense ? totalAmount : expense.itcEligible ? amountBeforeGst : totalAmount),
    inputGst: round2(isPayrollExpense ? 0 : expense.itcEligible ? gstAmount : 0),
    totalCashOut: totalAmount
  };
}

function calculateOutsourcingExpense(expense = {}, vendor = {}, settings = {}) {
  const baseAmount = round2(expense.baseAmount ?? expense.amountBeforeGst);
  const vendorRegistered = Boolean(vendor?.gstRegistered || vendor?.gstin || expense.vendorGstRegistered);
  const gstApplicable = Boolean(expense.gstApplicable) && vendorRegistered;
  const gstRate = gstApplicable ? toNumber(expense.gstRate, settings?.gst?.defaultRate ?? 18) : 0;
  const gstAmount = round2(baseAmount * gstRate / 100);
  const itcEligible = gstApplicable && expense.itcEligible !== false;
  return {
    baseAmount,
    gstApplicable,
    gstRate,
    gstAmount,
    totalAmount: round2(baseAmount + gstAmount),
    itcEligible,
    inputGst: itcEligible ? gstAmount : 0,
    expenseImpact: itcEligible ? baseAmount : round2(baseAmount + gstAmount)
  };
}

function calculateLeadCommission(commission = {}, partner = {}, settings = {}) {
  const commissionBaseAmount = round2(commission.commissionBaseAmount);
  const commissionType = commission.commissionType || 'Percentage';
  const commissionPercentage = toNumber(commission.commissionPercentage);
  const fixedAmount = toNumber(commission.fixedAmount || commission.commissionAmount);
  const commissionAmount = commissionType === 'Fixed'
    ? round2(fixedAmount)
    : round2(commissionBaseAmount * commissionPercentage / 100);
  const gstRegistered = Boolean(partner?.gstRegistered || partner?.gstin || commission.gstRegistered);
  const gstRate = gstRegistered ? toNumber(commission.gstRate, settings?.gst?.defaultRate ?? 18) : 0;
  const gstAmount = round2(commissionAmount * gstRate / 100);
  const grossPayable = round2(commissionAmount + gstAmount);
  const defaultTdsRate = settings?.tds?.commissionRate ?? 2;
  const threshold = toNumber(settings?.tds?.commissionThreshold, 0);
  const tdsApplicable = Boolean(commission.tdsApplicable ?? partner?.tdsApplicable) && commissionAmount >= threshold;
  const tdsRate = tdsApplicable ? toNumber(commission.tdsRate, defaultTdsRate) : 0;
  const tdsAmount = round2(commissionAmount * tdsRate / 100);
  const netPayable = round2(grossPayable - tdsAmount);
  return {
    commissionBaseAmount,
    commissionType,
    commissionPercentage,
    commissionAmount,
    gstRegistered,
    gstRate,
    gstAmount,
    grossPayable,
    tdsApplicable,
    tdsSection: commission.tdsSection || partner?.defaultTdsSection || settings?.tds?.commissionSection || '194H',
    tdsRate,
    tdsAmount,
    netPayable,
    inputGst: gstRegistered && commission.itcEligible !== false ? gstAmount : 0,
    expenseImpact: commissionAmount
  };
}

module.exports = {
  calculateExpenseImpact,
  calculateExclusiveTax,
  calculateGstBreakdown,
  calculateInclusiveTax,
  calculateInvoiceTotals,
  calculateLeadCommission,
  calculateOutsourcingExpense,
  getDefaultInvoiceTypeForClient,
  getPlaceOfSupplyForClient,
  getStateCode,
  isIndiaCountry,
  resolveGstType,
  splitCgstSgst
};
