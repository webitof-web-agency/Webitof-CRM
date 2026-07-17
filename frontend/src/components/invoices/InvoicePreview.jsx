import React from 'react';
import { normalizeInvoiceNumber } from '../../lib/invoiceNumber';
import watermarkImage from '../../../assets/images/invoicewatermark.png';

function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
  } catch {
    return String(value);
  }
}

function pickFirst(...values) {
  return values.find((value) => value != null && String(value).trim() !== '') || '';
}

function extractInitials(text = '') {
  return String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase() || 'INV';
}

function normalizeBank(bankAccount = {}, bankSettings = {}, company = {}) {
  return {
    bankName: pickFirst(bankAccount.bankName, bankAccount.bank_name, bankSettings.bankName, bankSettings.bank_name, company.bankName),
    accountHolderName: pickFirst(bankAccount.accountHolderName, bankAccount.account_holder_name, bankSettings.accountHolder, bankSettings.accountHolderName, company.name, company.legalName),
    accountNumber: pickFirst(bankAccount.accountNumber, bankAccount.account_number, bankSettings.accountNumber),
    ifsc: pickFirst(bankAccount.ifsc, bankSettings.ifsc),
    branch: pickFirst(bankAccount.branch, bankSettings.branch),
    accountType: pickFirst(bankAccount.accountType, bankAccount.account_type, bankSettings.accountType),
    upiId: pickFirst(bankAccount.upiId, bankAccount.upi_id, bankSettings.upiId),
    isPrimary: Boolean(bankAccount.isPrimary || bankAccount.is_primary || bankSettings.isPrimary),
  };
}

function buildUpiUri(bank, amount, invoiceNumber, companyName) {
  if (!bank?.upiId) return '';
  const params = new URLSearchParams();
  params.set('pa', bank.upiId);
  params.set('pn', bank.accountHolderName || companyName || 'Payee');
  params.set('cu', 'INR');
  if (Number(amount) > 0) params.set('am', Number(amount).toFixed(2));
  if (invoiceNumber) params.set('tn', `Invoice ${invoiceNumber}`);
  return `upi://pay?${params.toString()}`;
}

function splitTerms(text = '') {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function InvoicePreview({
  draft = {},
  client = {},
  company = {},
  logos = {},
  template = {},
  totals: propTotals,
  bankAccount = null,
  bankSettings = {},
  invoiceSettings = {},
  pageNumber = null,
  totalPages = null
}) {
  const totals = propTotals || {
    taxableAmount: draft.taxableAmount,
    discountAmount: draft.discountAmount || 0,
    cgst: draft.cgst,
    sgst: draft.sgst,
    igst: draft.igst,
    taxType: draft.taxType,
    taxRate: draft.taxRate,
    totalAmount: draft.totalAmount
  };

  const primaryColor = invoiceSettings?.invoiceTheme?.primaryColor || template?.primaryColor || '#4361EE';
  const logoUrl = template?.showLogo === false ? '' : (logos?.primary || logos?.sidebar || company?.logoUrl || '');
  const watermarkText = template?.watermarkText || extractInitials(company?.legalName || company?.name || 'Invoice');
  const customWatermarkUrl = invoiceSettings?.invoiceTheme?.watermarkUrl || null;
  const visibleItems = (draft.items || []).filter((item) => !item.hidden && (item.description || item.serviceName || item.serviceId || Number(item.rate) > 0));
  const hasHSNColumn = visibleItems.some((item) => item.hsnCode);
  const resolvedBank = normalizeBank(draft.bankAccount || bankAccount || {}, bankSettings || {}, company || {});
  const bankDetailsText = String(draft.bankDetails || '').trim();
  const invoiceTotal = Number(totals.totalAmount || draft.totalAmount || 0);
  const invoiceNumber = normalizeInvoiceNumber(draft.invoiceNumber);
  const upiUri = buildUpiUri(resolvedBank, invoiceTotal, invoiceNumber, company?.name || company?.legalName);
  const qrImageUrl = upiUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUri)}`
    : '';
  const termsText = String(draft.notes || invoiceSettings?.terms || '').trim();
  const termsLines = splitTerms(termsText);
  const companyDisplayName = company?.legalName || company?.name || 'Your Company';

  const layoutOrder = draft.layoutOrder || template?.layoutOrder || ['header', 'billTo', 'table', 'totals', 'notes', 'bank'];
  const hiddenBlocks = draft.hiddenBlocks || template?.hiddenBlocks || [];

  const ColGroup = () => (
    <colgroup>
      <col className={hasHSNColumn ? 'w-[35%]' : 'w-[45%]'} />
      {hasHSNColumn && <col className="w-[10%]" />}
      <col className="w-[15%]" />
      <col className="w-[20%]" />
      <col className="w-[20%]" />
    </colgroup>
  );

  const blocks = {
    header: (
      <div key="header" className="flex justify-between items-start mb-12">
        <div className="flex flex-col">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-16 object-contain mb-2" />
          ) : (
            <div className="text-3xl font-black tracking-widest uppercase" style={{ color: primaryColor }}>
              {companyDisplayName}
            </div>
          )}
        </div>
        <div className="text-right flex flex-col items-end">
          <div 
            className="px-4 py-1.5 text-white font-bold text-[15px] tracking-wider uppercase mb-3"
            style={{ backgroundColor: primaryColor }}
          >
            INVOICE #{invoiceNumber || '-'}
          </div>
          <div className="text-[13px] text-slate-800 space-y-1">
            <div>Bill date: {fmtDate(draft.invoiceDate)}</div>
            <div>Due date: {fmtDate(draft.dueDate) || 'On receipt'}</div>
          </div>
        </div>
      </div>
    ),
    billTo: (
      <div key="billTo" className="flex justify-between items-start mb-10 text-[13px] leading-relaxed">
        <div className="w-1/2 pr-6">
          <div className="font-bold text-[14px] uppercase mb-2 text-slate-900">{companyDisplayName}</div>
          <div className="text-slate-800 whitespace-pre-line">{company?.address || '-'}</div>
          <div className="mt-1">
            {company?.phone && <div>Phone: {company.phone}</div>}
            {company?.email && <div>Email: {company.email}</div>}
            {company?.website && <div>Website: {company.website.replace(/^https?:\/\//, '')}</div>}
          </div>
        </div>
        <div className="w-1/2 pl-6">
          <div className="font-bold text-[14px] mb-2 text-slate-900">Bill To</div>
          <div className="font-bold text-[14px] uppercase mb-1 text-slate-900">
            {client?.companyName || client?.name || draft.clientName || '-'}
          </div>
          <div className="text-slate-800 whitespace-pre-line">
            {client?.billingAddress || [client?.city, client?.state, client?.pincode].filter(Boolean).join(', ') || '-'}
          </div>
          {client?.gstin && <div className="mt-1">GST Number: {client.gstin}</div>}
        </div>
      </div>
    ),
    table: (
      <div key="table" className="mb-0">
        <table className="w-full border-collapse text-[13px] table-fixed">
          <ColGroup />
          <thead>
            <tr style={{ backgroundColor: primaryColor }} className="text-white">
              <th className="py-2.5 px-4 text-left font-bold border-r border-white/20">Item</th>
              {hasHSNColumn && <th className="py-2.5 px-4 text-left font-bold border-r border-white/20">HSN</th>}
              <th className="py-2.5 px-4 text-center font-bold border-r border-white/20">Quantity</th>
              <th className="py-2.5 px-4 text-right font-bold border-r border-white/20">Rate</th>
              <th className="py-2.5 px-4 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 ? (
              <tr>
                <td colSpan={hasHSNColumn ? 5 : 4} className="py-8 text-center text-slate-500 bg-[#f4f6f8] font-medium border-0">
                  No items added yet
                </td>
              </tr>
            ) : visibleItems.map((item, index) => {
              const quantity = Number(item.quantity) || 0;
              const rate = Number(item.rate) || 0;
              const amount = quantity * rate;
              const discount = (amount * (Number(item.discount) || 0)) / 100;
              return (
                <tr key={item._id || index} className="border-b-4 border-white bg-[#f8fafc]">
                  <td className="py-3 px-4 text-slate-800 border-r border-white truncate">
                    {item.description || item.serviceName || '-'}
                  </td>
                  {hasHSNColumn && (
                    <td className="py-3 px-4 text-slate-800 border-r border-white truncate">
                      {item.hsnCode || '-'}
                    </td>
                  )}
                  <td className="py-3 px-4 text-center text-slate-800 border-r border-white truncate">
                    {item.quantity} {item.unit !== 'Nos' ? item.unit : ''}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-800 border-r border-white truncate">
                    ₹{fmt(rate)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-800 truncate">
                    ₹{fmt(amount - discount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ),
    totals: (
      <div key="totals" className="mb-8 mt-2">
        <table className="w-full border-collapse text-[13px] table-fixed">
          <ColGroup />
          <tbody>
            <tr>
              <td colSpan={hasHSNColumn ? 3 : 2} className="border-0 bg-transparent"></td>
              <td className="py-2 px-4 text-center text-slate-800 border-0">Sub Total</td>
              <td className="py-2 px-4 text-right text-slate-800 font-medium border-0 bg-[#f4f6f8]">₹{fmt(totals.taxableAmount)}</td>
            </tr>
            {Number(totals.discountAmount) > 0 && (
              <tr>
                <td colSpan={hasHSNColumn ? 3 : 2} className="border-0 bg-transparent"></td>
                <td className="py-2 px-4 text-center text-slate-800 border-0">Discount</td>
                <td className="py-2 px-4 text-right text-slate-800 font-medium border-0 bg-[#f4f6f8]">-₹{fmt(totals.discountAmount)}</td>
              </tr>
            )}
            {totals.taxType === 'cgst_sgst' && (
              <>
                <tr>
                  <td colSpan={hasHSNColumn ? 3 : 2} className="border-0 bg-transparent"></td>
                  <td className="py-2 px-4 text-center text-slate-800 border-0">CGST ({Number(totals.taxRate || 0) / 2}%)</td>
                  <td className="py-2 px-4 text-right text-slate-800 font-medium border-0 bg-[#f4f6f8]">₹{fmt(totals.cgst)}</td>
                </tr>
                <tr>
                  <td colSpan={hasHSNColumn ? 3 : 2} className="border-0 bg-transparent"></td>
                  <td className="py-2 px-4 text-center text-slate-800 border-0">SGST ({Number(totals.taxRate || 0) / 2}%)</td>
                  <td className="py-2 px-4 text-right text-slate-800 font-medium border-0 bg-[#f4f6f8]">₹{fmt(totals.sgst)}</td>
                </tr>
              </>
            )}
            {totals.taxType === 'igst' && (
              <tr>
                <td colSpan={hasHSNColumn ? 3 : 2} className="border-0 bg-transparent"></td>
                <td className="py-2 px-4 text-center text-slate-800 border-0">IGST ({Number(totals.taxRate || 0)}%)</td>
                <td className="py-2 px-4 text-right text-slate-800 font-medium border-0 bg-[#f4f6f8]">₹{fmt(totals.igst)}</td>
              </tr>
            )}
            {Number(draft.advanceAmount) > 0 && (
              <tr>
                <td colSpan={hasHSNColumn ? 3 : 2} className="border-0 bg-transparent"></td>
                <td className="py-2 px-4 text-center text-slate-800 border-0">Advance paid</td>
                <td className="py-2 px-4 text-right text-slate-800 font-medium border-0 bg-[#f4f6f8]">-₹{fmt(draft.advanceAmount)}</td>
              </tr>
            )}
            <tr><td colSpan={hasHSNColumn ? 5 : 4} className="h-2 border-0 bg-transparent"></td></tr>
            <tr>
              <td colSpan={hasHSNColumn ? 3 : 2} className="border-0 bg-transparent"></td>
              <td className="py-2.5 px-4 text-center border-0 text-[13px] text-slate-800">Balance Due</td>
              <td className="py-2.5 px-4 text-right font-bold border-0 text-[13px] text-white" style={{ backgroundColor: primaryColor }}>₹{fmt(totals.totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    ),
    notes: termsText ? (
      <div key="notes" className="mb-6">
        <div className="text-[13px] font-bold text-blue-600 mb-3" style={{ color: primaryColor }}>Terms and Conditions</div>
        <ul className="list-disc list-outside pl-4 space-y-1 text-[12px] text-slate-700">
          {termsLines.map((line, idx) => (
            <li key={idx} className="pl-1 leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      </div>
    ) : null,
    bank: (resolvedBank.bankName || resolvedBank.accountNumber || resolvedBank.upiId || bankDetailsText) ? (
      <div key="bank" className="bg-[#f4f6f8] p-5 flex justify-between items-center mb-6">
        <div className="text-[12px] text-slate-700 space-y-1">
          <div className="text-[13px] font-bold text-blue-600 mb-3" style={{ color: primaryColor }}>Bank Details</div>
          {resolvedBank.accountHolderName && (
            <div className="flex items-start gap-4">
              <span className="font-bold text-slate-800 w-40 shrink-0">Company</span>
              <span className="text-slate-700 break-all">{resolvedBank.accountHolderName}</span>
            </div>
          )}
          {resolvedBank.accountHolderName && (
            <div className="flex items-start gap-4 mt-1.5">
              <span className="font-bold text-slate-800 w-40 shrink-0">Account Holder Name</span>
              <span className="text-slate-700 break-all">{resolvedBank.accountHolderName}</span>
            </div>
          )}
          {resolvedBank.accountNumber && (
            <div className="flex items-start gap-4 mt-1.5">
              <span className="font-bold text-slate-800 w-40 shrink-0">Account Number</span>
              <span className="text-slate-700 break-all">{resolvedBank.accountNumber}</span>
            </div>
          )}
          {resolvedBank.ifsc && (
            <div className="flex items-start gap-4 mt-1.5">
              <span className="font-bold text-slate-800 w-40 shrink-0">IFSC</span>
              <span className="text-slate-700 break-all">{resolvedBank.ifsc}</span>
            </div>
          )}
          {resolvedBank.bankName && (
            <div className="flex items-start gap-4 mt-1.5">
              <span className="font-bold text-slate-800 w-40 shrink-0">Bank</span>
              <span className="text-slate-700 break-all">{resolvedBank.bankName}</span>
            </div>
          )}
          {resolvedBank.upiId && (
            <div className="flex items-start gap-4 mt-1.5">
              <span className="font-bold text-slate-800 w-40 shrink-0">UPI ID</span>
              <span className="text-slate-700 break-all">{resolvedBank.upiId}</span>
            </div>
          )}
          {bankDetailsText && (
            <div className="mt-2 whitespace-pre-wrap">{bankDetailsText}</div>
          )}
        </div>
        
        {qrImageUrl && (
          <div className="flex flex-col items-center ml-6">
            <div className="bg-white p-1.5 border-[1.5px] rounded-lg mb-1.5" style={{ borderColor: primaryColor }}>
              <img src={qrImageUrl} alt="Scan to Pay" crossOrigin="anonymous" className="w-[100px] h-[100px] object-contain rounded-sm" />
            </div>
            <span className="text-[10px] font-bold tracking-widest text-slate-800">SCAN TO PAY</span>
          </div>
        )}
      </div>
    ) : null
  };

  return (
    <div
      id="invoice-document"
      className="relative w-[210mm] max-w-full min-h-[297mm] print:w-auto print:min-h-0 overflow-hidden bg-white text-slate-900 mx-auto font-sans"
      style={{ 
        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
        padding: '12mm 15mm'
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div className="absolute top-[25%] left-1/2 -translate-x-1/2 flex items-center justify-center opacity-[0.10] w-[90%]">
          {customWatermarkUrl ? (
            <img
              src={customWatermarkUrl}
              alt="Watermark"
              crossOrigin="anonymous"
              className="w-full h-auto object-contain select-none"
            />
          ) : (
            <img 
              src={watermarkImage} 
              alt="Watermark" 
              crossOrigin="anonymous"
              className="w-full h-auto object-contain select-none"
            />
          )}
        </div>
      </div>

      <div className="relative z-10 w-full h-full flex flex-col">
        
        {layoutOrder.filter(id => !hiddenBlocks.includes(id)).map(id => blocks[id])}

        <div className="flex-1"></div>
        <div className="text-center text-[12px] text-slate-700 mt-8 pt-4 border-t border-slate-200">
          For any inquiries, reach out via email at <span className="font-bold">{company?.email || 'contact@company.com'}</span> or call <span className="font-bold">{company?.phone || ''}</span>
        </div>
      </div>
    </div>
  );
}
