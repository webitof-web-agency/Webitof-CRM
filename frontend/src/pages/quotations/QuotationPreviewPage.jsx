import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Printer, RefreshCw, Copy, Check, X, Shield, Clock, ArrowLeft, ExternalLink } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import quotationBackgroundImage from '../../../assets/images/invoice_watermark.png';
import frontCoverImg from '../../../assets/images/quotation-cover-front.png';
import backCoverImg from '../../../assets/images/quotation-cover-back.png';
import { calculateQuotationTotals as calculateCommercialTotals } from '../../utils/taxCalculationEngine';
import { calculateMilestoneAmounts, parseMilestonesFromText } from '../../utils/paymentMilestoneEngine';

const BUILT_IN_QUOTATION_BACKGROUND = 'builtin:invoice_watermark.png';

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
function toRoman(num) {
  return ROMAN_NUMERALS[num - 1] || String(num);
}

export function QuotationPreviewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const key = searchParams.get('key') || searchParams.get('id') || searchParams.get('leadId') || '';
  const shouldPrint = searchParams.get('print') === '1' || searchParams.get('print') === 'true';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // 1. Try reading key-specific data from localStorage
      let raw = key ? localStorage.getItem(`crm_quotation_preview_${key}`) : null;

      // 2. Try latest data in localStorage if key not found
      if (!raw) {
        raw = localStorage.getItem('crm_quotation_preview_latest');
      }

      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.formData || parsed.lead)) {
          setData(parsed);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      // 3. Fallback: try loading lead from API if key looks like an ID/number
      if (token && key && (key.startsWith('L-') || key.length >= 8)) {
        try {
          const [leadRes, settingsRes, quotationMasterRes] = await Promise.all([
            api.resources.get('/leads', `${key}/summary`, token).catch(() => null),
            api.settings.get(token).catch(() => null),
            api.resources.list('/masters/quotation_master', token).catch(() => null)
          ]);

          const lead = leadRes?.data?.lead;
          if (lead) {
            const events = leadRes.data.events || [];
            const quotationEvent = events.find((e) => e.eventType === 'quotation') || null;
            const settings = settingsRes?.data || null;

            const fallbackData = {
              formData: quotationEvent?.payload || {
                title: quotationEvent?.title || lead.requirements || 'Digital Solutions Proposal',
                amount: quotationEvent?.amount || lead.estimatedBudget || lead.value || 0,
                timeline: '4 - 6 Weeks',
                status: 'Draft'
              },
              lead,
              settings,
              quotationMaster: quotationMasterRes?.data?.[0] || null,
              proposalTitle: quotationEvent?.title || lead.companyName || 'Quotation Proposal',
              serviceSummary: (lead.requiredServices || []).join(', ') || 'Software Engineering',
              currency: 'INR',
              quotationTotals: {
                subtotal: quotationEvent?.amount || 0,
                discountAmount: 0,
                taxableAmount: quotationEvent?.amount || 0,
                gstAmount: Math.round((quotationEvent?.amount || 0) * 0.18),
                totalAmount: Math.round((quotationEvent?.amount || 0) * 1.18)
              },
              refNumber: lead.leadNumber ? `WBT-${lead.leadNumber}` : `WBT-PROP-${new Date().getFullYear()}-001`,
              savedAt: new Date().toISOString()
            };

            setData(fallbackData);
            setLoading(false);
            setRefreshing(false);
            return;
          }
        } catch (apiErr) {
          console.warn('API fallback load failed:', apiErr);
        }
      }

      setError('Quotation preview data expired or not found. Please open the quotation in the CRM and click "Preview".');
    } catch (err) {
      setError(err.message || 'Failed to parse quotation preview data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [key, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle auto-print if print query param is present
  useEffect(() => {
    if (data && shouldPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [data, shouldPrint]);

  // Set document title
  useEffect(() => {
    if (data) {
      const title = data.proposalTitle || 'Quotation Proposal';
      const company = data.settings?.company?.name || data.settings?.company?.legalName || 'Webitof Technologies';
      document.title = `${title} - Enterprise Proposal - ${company}`;
    }
  }, [data]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mb-4" />
        <h2 className="text-lg font-bold tracking-tight text-slate-100">Loading Enterprise Proposal</h2>
        <p className="text-sm text-slate-400 mt-1">Preparing high-fidelity executive document...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-200 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 bg-red-950/60 border border-red-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-400 text-2xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Proposal Preview Expired</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            {error || 'The preview data could not be found in browser storage.'}
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => loadData(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold rounded-xl text-sm transition-all cursor-pointer shadow-lg shadow-[var(--primary)]/20"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Retry Loading
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-sm transition-all cursor-pointer"
            >
              <ArrowLeft size={16} /> Return to CRM
            </button>
          </div>
        </div>
      </div>
    );
  }

  const {
    formData = {},
    lead = {},
    settings = {},
    proposalTitle = 'Statement of Work & Commercial Proposal',
    serviceSummary = '',
    quotationTotals = {},
    refNumber = 'WBT-PROP-2026-001'
  } = data;

  const company = settings?.company || {};
  const companyName = company.name || company.legalName || 'Webitof Technologies';
  const companyLegalName = company.legalName || company.name || 'Webitof Technologies Private Limited';
  const companyEmail = company.email || 'contact@webitof.com';
  const companyPhone = company.phone || '+91 98765 43210';
  const companyWebsite = company.website || 'https://webitof.com';
  const companyAddress = company.address || 'Raipur, Chhattisgarh, India';
  const companyLogo = settings?.logos?.quotation || settings?.logos?.primary || settings?.logos?.sidebar || company.logoUrl || '/assets/images/main-logo.png';
  const companyInitials = companyName.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'WT';
  const companyGstin = company.gstin || company.taxId || '22AAAAA0000A1Z5';
  const quotationMaster = data.quotationMaster?.payload || data.quotationMaster || {};
  const topClients = Array.isArray(quotationMaster.topClients) ? quotationMaster.topClients.filter((client) => client?.name || client?.logoUrl) : [];
  const credibilityMetrics = [
    { value: quotationMaster.experienceYears, label: 'Years of Experience' },
    { value: quotationMaster.clientsServed, label: 'Clients Served' },
    { value: quotationMaster.projectsDelivered, label: 'Projects Delivered' },
    { value: quotationMaster.countriesServed, label: 'Countries Served' }
  ].filter((metric) => String(metric.value || '').trim());
  const hasCompanyProfile = Boolean(
    quotationMaster.aboutCompany || quotationMaster.expertise || quotationMaster.developmentCapabilities
    || quotationMaster.businessContactDetails || credibilityMetrics.length || topClients.length || quotationMaster.clientsPageUrl
  );
  const clientsQrUrl = quotationMaster.clientsPageUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=5&data=${encodeURIComponent(quotationMaster.clientsPageUrl)}`
    : '';
  const quotationBackgroundUrl = quotationMaster.backgroundImageUrl === BUILT_IN_QUOTATION_BACKGROUND
    ? quotationBackgroundImage
    : quotationMaster.backgroundImageUrl;

  const clientName = lead?.companyName || lead?.name || 'Valued Client';
  const contactPerson = lead?.contactPerson || lead?.name || clientName;
  const clientEmail = lead?.email || '';
  const clientPhone = lead?.phone || '';
  const clientLocation = [lead?.city, lead?.state, lead?.country].filter(Boolean).join(', ') || 'India';

  const issueDate = formData.proposalDate || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const validDate = formData.validUntil || '30 Calendar Days from Issuance';
  const preparedByName = formData.preparedBy || user?.fullName || user?.name || company.contactPerson || 'Account Director';
  const preparedByRole = formData.preparedByRole || user?.role || 'Solutions Architect & Engagement Lead';
  const preparedByEmail = formData.preparedByEmail || user?.email || companyEmail;
  const preparedByPhone = formData.preparedByPhone || user?.phone || companyPhone;
  const confidentialityClassification = 'RESTRICTED & CONFIDENTIAL // ENTERPRISE COMMERCIAL PROPOSAL';

  const clientState = lead?.state || lead?.city || '';
  const clientGstin = lead?.gstin || lead?.taxId || '';
  const supplierState = company?.state || 'Chhattisgarh';

  const commercialTotals = calculateCommercialTotals({
    amount: formData.amount || quotationTotals.subtotal || 0,
    discountEnabled: formData.discountEnabled,
    discountType: formData.discountType,
    discountValue: formData.discountValue,
    gstApplicable: formData.gstApplicable,
    gstRate: formData.gstRate,
    supplierState,
    clientState,
    clientGstin
  });

  const subtotal = commercialTotals.subtotal;
  const discountAmount = commercialTotals.discountAmount;
  const taxableAmount = commercialTotals.taxableAmount;
  const gstAmount = commercialTotals.gstAmount;
  const totalAmount = commercialTotals.totalAmount;
  const gstRate = commercialTotals.gstRate;
  const taxType = commercialTotals.taxType;
  const isInterState = commercialTotals.isInterState;
  const igstAmount = commercialTotals.igstAmount;
  const cgstAmount = commercialTotals.cgstAmount;
  const sgstAmount = commercialTotals.sgstAmount;

  // Centralized payment milestone engine
  const activeMilestones = useMemo(() => {
    if (Array.isArray(formData.milestones) && formData.milestones.length > 0) {
      return calculateMilestoneAmounts(formData.milestones, totalAmount);
    }
    const textToParse = formData.paymentInfo || formData.milestoneTemplate || '';
    if (textToParse.trim()) {
      return parseMilestonesFromText(textToParse, totalAmount);
    }
    return calculateMilestoneAmounts([
      { id: 'ms-1', name: 'Mobilization Advance & Architecture Blueprint Approval', percentage: 40, dueEvent: 'Upon formal contract signing' },
      { id: 'ms-2', name: 'Core Engineering & Alpha Module Demonstration', percentage: 30, dueEvent: 'Upon Alpha demonstration sign-off' },
      { id: 'ms-3', name: 'Omnichannel Integrations & Beta UAT Sign-off', percentage: 20, dueEvent: 'Upon Beta testing & integration' },
      { id: 'ms-4', name: 'Production Cloud Cutover, Codebase Handover & Sign-off', percentage: 10, dueEvent: 'Prior to final go-live & handover' }
    ], totalAmount);
  }, [formData.milestones, formData.paymentInfo, formData.milestoneTemplate, totalAmount]);

  // Enabled legal agreements
  const enabledAgreements = (formData.legalAgreements || []).filter((a) => a.enabled && String(a.content || '').trim());

  // Technology items
  const techItems = formData.technologyStack?.trim()
    ? formData.technologyStack.split(/[,\n;•·|]+/).map((t) => t.trim()).filter(Boolean)
    : [];

  // Warranty items
  const warrantyLines = formData.afterCompletion?.trim()
    ? formData.afterCompletion.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];

  // AMC items
  const amcIncList = formData.amcPlan ? (formData.amcPlan.includedItems || '').split('\n').map((l) => l.trim()).filter(Boolean) : [];
  const amcExcList = formData.amcPlan ? (formData.amcPlan.excludedItems || '').split('\n').map((l) => l.trim()).filter(Boolean) : [];

  // Service-wise grouped capabilities
  const groupedPreviewFeatures = useMemo(() => {
    const rawList = formData.features || [];
    if (!rawList.length) return [];
    const groups = new Map();

    rawList.forEach((feat) => {
      const text = typeof feat === 'string' ? feat : (feat.text || '');
      if (!text.trim()) return;
      const serviceName = (typeof feat === 'object' && feat.serviceName) ? feat.serviceName : '';
      const finalService = serviceName || (formData.serviceNames?.[0] || 'Core Capabilities & Deliverables');

      if (!groups.has(finalService)) {
        groups.set(finalService, []);
      }
      groups.get(finalService).push(text);
    });

    return Array.from(groups.entries()).filter(([_, feats]) => feats.length > 0);
  }, [formData.features, formData.serviceNames]);

  return (
    <div className="quotation-preview-container min-h-screen bg-[#f1f5f9] text-[#0f172a] font-['Plus_Jakarta_Sans',sans-serif]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; }
        
        .topbar {
          position: sticky;
          top: 0;
          z-index: 999;
          background: #090e17;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          color: #ffffff;
          padding: 12px 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .badge-tier1 {
          background: linear-gradient(135deg, #1d4ed8, #0284c7);
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 4px;
        }
        .btn-topbar {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          border: none;
          transition: all 0.15s ease;
        }
        .btn-print {
          background: #2563eb;
          color: #ffffff;
        }
        .btn-print:hover { background: #1d4ed8; }
        .btn-subtle {
          background: rgba(255,255,255,0.1);
          color: #e2e8f0;
        }
        .btn-subtle:hover { background: rgba(255,255,255,0.2); }

        .proposal-wrapper {
          max-width: 920px;
          margin: 28px auto 60px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .quotation-page {
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 10px 40px -10px rgba(0,0,0,0.12), 0 0 1px 1px rgba(0,0,0,0.05);
          overflow: hidden;
          border: 1px solid #e2e8f0;
          position: relative;
          isolation: isolate;
        }
        .quotation-cover-page {
          aspect-ratio: 210 / 297;
          width: 100%;
          max-width: 920px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        .quotation-cover-page img.cover-img {
          width: 100%;
          height: 100%;
          object-fit: fill;
          display: block;
        }
        .overview-page-body {
          padding: 32px 38px 36px;
        }
        .overview-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px 18px;
          position: relative;
        }
        .overview-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 4px;
          background: #2563eb;
          border-radius: 8px 0 0 8px;
        }
        .overview-card.secondary-border::before {
          background: #0f172a;
        }
        .overview-card.client-card::before {
          background: #0284c7;
        }
        .overview-card.vendor-card::before {
          background: #4361ee;
        }
        .kpi-mini-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 12px;
          text-align: left;
        }
        .kpi-mini-label {
          font-size: 9px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        }
        .kpi-mini-val {
          font-size: 13.5px;
          font-weight: 800;
          color: #0f172a;
        }
        .kpi-mini-sub {
          font-size: 9.5px;
          color: #64748b;
          margin-top: 1px;
        }
        .confidentiality-box {
          background: #fffbeb;
          border: 1px solid #fef3c7;
          border-left: 4px solid #f59e0b;
          border-radius: 6px;
          padding: 12px 16px;
        }
        .quotation-body-page.has-custom-background::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-image: var(--quotation-background);
          background-position: center;
          background-size: 100% auto;
          background-repeat: repeat-y;
          opacity: var(--quotation-background-opacity, 0.08);
        }
        .quotation-body-page > * {
          position: relative;
          z-index: 1;
        }
        .proposal-body {
          padding: 36px 44px 48px;
        }

        .security-ribbon {
          background: #090e17;
          color: #94a3b8;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          padding: 8px 44px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #2563eb;
        }
        .security-ribbon span.active-tag {
          color: #38bdf8;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .security-ribbon span.active-tag::before {
          content: '';
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #38bdf8;
        }

        .masthead {
          display: grid;
          grid-template-columns: 1fr 310px;
          gap: 24px;
          align-items: start;
          padding-bottom: 24px;
          border-bottom: 1.5px solid #e2e8f0;
          margin-bottom: 22px;
        }
        .brand-monogram {
          width: 52px;
          height: 52px;
          border-radius: 10px;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          letter-spacing: -0.5px;
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.15);
          flex-shrink: 0;
        }
        .brand-logo-img {
          max-height: 52px;
          max-width: 170px;
          object-fit: contain;
        }

        .dossier-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 22px;
        }
        .dossier-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px 20px;
          position: relative;
        }
        .dossier-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 4px;
          background: #2563eb;
          border-radius: 8px 0 0 8px;
        }
        .dossier-card.secondary-border::before {
          background: #0f172a;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 26px;
        }
        .kpi-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px 16px;
          text-align: left;
        }
        .kpi-card.highlight {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border-color: #0f172a;
          color: #ffffff;
        }

        .phase-framework {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 18px 20px;
          margin-bottom: 28px;
        }

        .company-profile-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(250px, 0.6fr);
          gap: 18px;
        }
        .credibility-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-top: 14px;
        }
        .credibility-card {
          border: 1px solid #dbeafe;
          border-radius: 7px;
          background: #eff6ff;
          padding: 10px;
        }
        .client-logo-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .client-logo-tile {
          min-height: 54px;
          border: 1px solid #e2e8f0;
          border-radius: 7px;
          background: rgba(255,255,255,0.92);
          padding: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .client-logo-tile img {
          max-width: 100%;
          max-height: 34px;
          object-fit: contain;
        }
        .phase-steps-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .section-block {
          margin-bottom: 28px;
        }
        .sec-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding-bottom: 8px;
          border-bottom: 2px solid #0f172a;
          margin-bottom: 14px;
        }
        .sec-title {
          font-size: 13.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #0f172a;
        }
        .sec-tag {
          font-size: 10px;
          font-weight: 700;
          color: #2563eb;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .matrix-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          overflow: hidden;
        }
        .matrix-table th {
          background: #f1f5f9;
          color: #334155;
          font-size: 10.5px;
          font-weight: 800;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          padding: 10px 14px;
          border-bottom: 1.5px solid #cbd5e1;
          text-align: left;
        }
        .matrix-table td {
          padding: 12px 14px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 12.5px;
          color: #334155;
          vertical-align: top;
        }

        .commercial-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 18px;
        }

        .sla-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          overflow: hidden;
        }
        .sla-table th {
          background: #f8fafc;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: #475569;
          padding: 9px 12px;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
        }
        .sla-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 11.5px;
          color: #334155;
        }

        .sign-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .proposal-wrapper {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            gap: 0 !important;
          }
          .quotation-page {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
          }
          .quotation-cover-page {
            width: 210mm !important;
            height: 297mm !important;
            max-width: 210mm !important;
            max-height: 297mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .quotation-cover-page.front-cover {
            page-break-after: always !important;
            break-after: page !important;
          }
          .quotation-cover-page.back-cover {
            page-break-before: always !important;
            break-before: page !important;
          }
          .quotation-cover-page img.cover-img {
            width: 210mm !important;
            height: 297mm !important;
            object-fit: fill !important;
          }
          .quotation-overview-page {
            width: 210mm !important;
            min-height: 297mm !important;
            box-sizing: border-box !important;
            padding: 12mm 14mm !important;
            page-break-before: always !important;
            break-before: page !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .overview-page-body {
            padding: 0 !important;
          }
          .quotation-body-page {
            width: 210mm !important;
            box-sizing: border-box !important;
            padding: 12mm 14mm !important;
            page-break-before: always !important;
            break-before: page !important;
          }
          .proposal-body {
            padding: 0 !important;
          }
          .security-ribbon {
            padding: 6px 0 !important;
            background: transparent !important;
            color: #475569 !important;
            border-bottom: 1.5px solid #0f172a !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Top action bar */}
      <div className="no-print topbar">
        <div className="flex items-center gap-3 min-w-0">
          <span className="badge-tier1">TIER-1 ENTERPRISE SOW</span>
          <span className="text-sm font-semibold text-slate-200 truncate">
            {proposalTitle} ({refNumber})
          </span>
          <span className="hidden md:inline-flex items-center text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700 font-mono">
            Key: {key || 'latest'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button type="button" onClick={() => window.print()} className="btn-topbar btn-print">
            <Printer size={14} /> Print / Save PDF
          </button>
          <button type="button" onClick={handleCopyLink} className="btn-topbar btn-subtle">
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? 'Link Copied!' : 'Copy Link'}
          </button>
          <button type="button" onClick={() => loadData(true)} className="btn-topbar btn-subtle" title="Refresh proposal data">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" onClick={() => window.close()} className="btn-topbar btn-subtle">
            <X size={14} /> Close
          </button>
        </div>
      </div>

      <div className="proposal-wrapper">
        {/* ========================================================================= */}
        {/* PAGE 1: FRONT COVER PAGE (Webitof-cover.pdf)                              */}
        {/* ========================================================================= */}
        <div className="quotation-page quotation-cover-page front-cover">
          <img
            src={frontCoverImg}
            alt="Webitof Proposal Front Cover"
            className="cover-img"
          />
        </div>

        {/* ========================================================================= */}
        {/* PAGE 2: QUOTATION OVERVIEW PAGE                                           */}
        {/* 1. Company logo                                                           */}
        {/* 2. Company legal name                                                     */}
        {/* 3. Quotation title                                                        */}
        {/* 4. Quotation number                                                       */}
        {/* 5. Prepared for                                                           */}
        {/* 6. Prepared by                                                            */}
        {/* 7. Issue date                                                             */}
        {/* 8. Validity                                                               */}
        {/* 9. Confidentiality classification                                         */}
        {/* ========================================================================= */}
        <div className="quotation-page quotation-overview-page">
          <div className="security-ribbon">
            <span>{confidentialityClassification}</span>
            <span className="active-tag">{refNumber} // REV 1.0</span>
          </div>

          <div className="overview-page-body">
            {/* Top Bar: Quotation Overview Header */}
            <div className="flex justify-between items-center pb-4 mb-6 border-b-2 border-slate-900">
              <div>
                <span className="text-[10px] font-extrabold tracking-widest uppercase text-blue-600 block mb-1">
                  EXECUTIVE DOCUMENTATION · SECTION 01
                </span>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight m-0">
                  Quotation Overview
                </h1>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 block mb-0.5">
                  QUOTATION NUMBER
                </span>
                <span className="font-mono text-base font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-md inline-block">
                  {refNumber}
                </span>
              </div>
            </div>

            {/* Row 1: Company Logo + Legal Name & Quotation Specification */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              {/* Company Logo + Legal Name Card */}
              <div className="overview-card vendor-card">
                <div className="text-[10px] font-extrabold tracking-wider uppercase text-blue-700 mb-2.5">
                  ISSUING ENTERPRISE
                </div>
                <div className="flex items-start gap-4 mb-3">
                  {companyLogo ? (
                    <img
                      src={companyLogo}
                      alt={companyLegalName}
                      className="h-12 max-w-[150px] object-contain flex-shrink-0"
                    />
                  ) : (
                    <div className="brand-monogram">{companyInitials}</div>
                  )}
                  <div className="min-w-0">
                    <div className="text-base font-extrabold text-slate-900 leading-snug">
                      {companyLegalName}
                    </div>
                    <div className="text-[11px] font-semibold text-blue-600 mt-0.5">
                      {companyName !== companyLegalName ? companyName : 'Digital Solutions & Enterprise Consulting'}
                    </div>
                  </div>
                </div>
                <div className="text-[11.5px] text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400">GSTIN:</span>{' '}
                    <strong className="text-slate-800 font-mono">{companyGstin}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Address:</span>{' '}
                    <span className="text-slate-700">{companyAddress}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4">
                    <span>
                      <span className="text-slate-400">Email:</span>{' '}
                      <strong className="text-slate-700">{companyEmail}</strong>
                    </span>
                    <span>
                      <span className="text-slate-400">Tel:</span>{' '}
                      <strong className="text-slate-700">{companyPhone}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Quotation Title & Schedule Specs */}
              <div className="overview-card secondary-border">
                <div className="text-[10px] font-extrabold tracking-wider uppercase text-slate-500 mb-2.5">
                  QUOTATION SPECIFICATION
                </div>
                <div className="mb-3">
                  <div className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                    QUOTATION TITLE
                  </div>
                  <div className="text-base font-extrabold text-slate-900 mt-0.5 leading-snug">
                    {proposalTitle}
                  </div>
                  {serviceSummary && (
                    <div className="text-xs text-blue-700 font-medium mt-1">
                      Scope: {serviceSummary}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-100">
                  <div className="bg-slate-50 rounded-md p-2.5 border border-slate-200">
                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                      ISSUE DATE
                    </div>
                    <div className="text-xs font-extrabold text-slate-900 mt-0.5">
                      {issueDate}
                    </div>
                  </div>
                  <div className="bg-amber-50/60 rounded-md p-2.5 border border-amber-200/80">
                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-amber-700">
                      VALIDITY
                    </div>
                    <div className="text-xs font-extrabold text-amber-950 mt-0.5">
                      {validDate}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Prepared For & Prepared By */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              {/* Prepared For (Client) */}
              <div className="overview-card client-card">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-[10px] font-extrabold tracking-wider uppercase text-sky-700">
                    PREPARED FOR (CLIENT)
                  </div>
                  <span className="text-[9px] font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded">
                    Client Organization
                  </span>
                </div>
                <div className="text-base font-extrabold text-slate-900 mb-1">
                  {clientName}
                </div>
                <div className="text-[11.5px] text-slate-600 space-y-1">
                  <div>
                    <span className="text-slate-400">Attention:</span>{' '}
                    <strong className="text-slate-800">{contactPerson}</strong>
                  </div>
                  {clientEmail && (
                    <div>
                      <span className="text-slate-400">Email:</span>{' '}
                      <span className="text-slate-700 font-mono">{clientEmail}</span>
                    </div>
                  )}
                  {clientPhone && (
                    <div>
                      <span className="text-slate-400">Phone:</span>{' '}
                      <span className="text-slate-700 font-mono">{clientPhone}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">Location:</span>{' '}
                    <span className="text-slate-700">{clientLocation}</span>
                  </div>
                </div>
              </div>

              {/* Prepared By (Solutions Lead) */}
              <div className="overview-card vendor-card">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-[10px] font-extrabold tracking-wider uppercase text-blue-700">
                    PREPARED BY (ENGAGEMENT LEAD)
                  </div>
                  <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    Practice Delivery
                  </span>
                </div>
                <div className="text-base font-extrabold text-slate-900 mb-0.5">
                  {preparedByName}
                </div>
                <div className="text-[11px] font-semibold text-blue-600 mb-1.5">
                  {preparedByRole}
                </div>
                <div className="text-[11.5px] text-slate-600 space-y-1">
                  <div>
                    <span className="text-slate-400">Email:</span>{' '}
                    <span className="text-slate-700 font-mono">{preparedByEmail}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Phone:</span>{' '}
                    <span className="text-slate-700 font-mono">{preparedByPhone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Issuing Entity:</span>{' '}
                    <strong className="text-slate-800">{companyLegalName}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Investment Snapshot KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="kpi-mini-card">
                <div className="kpi-mini-label">TOTAL INVESTMENT</div>
                <div className="kpi-mini-val text-blue-700">{fmt(totalAmount)}</div>
                <div className="kpi-mini-sub">Inclusive of taxes</div>
              </div>
              <div className="kpi-mini-card">
                <div className="kpi-mini-label">BASE QUOTATION</div>
                <div className="kpi-mini-val">{fmt(subtotal)}</div>
                <div className="kpi-mini-sub">{discountAmount > 0 ? `After ${fmt(discountAmount)} disc.` : 'Net taxable base'}</div>
              </div>
              <div className="kpi-mini-card">
                <div className="kpi-mini-label">DELIVERY TIMELINE</div>
                <div className="kpi-mini-val">{formData.timeline || '4 - 6 Weeks'}</div>
                <div className="kpi-mini-sub">Standard milestone cadence</div>
              </div>
              <div className="kpi-mini-card">
                <div className="kpi-mini-label">QUOTE VALIDITY</div>
                <div className="kpi-mini-val text-amber-700">{validDate}</div>
                <div className="kpi-mini-sub">Guaranteed pricing period</div>
              </div>
            </div>

            {/* Row 4: Confidentiality Classification Box */}
            <div className="confidentiality-box">
              <div className="flex items-start gap-3">
                <Shield size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10.5px] font-extrabold tracking-wider uppercase text-amber-900 mb-1">
                    CONFIDENTIALITY CLASSIFICATION: {confidentialityClassification}
                  </div>
                  <p className="text-[11px] text-amber-900/90 m-0 leading-relaxed">
                    This document and its contents are strictly proprietary to <strong className="font-semibold text-slate-900">{companyLegalName}</strong> and prepared exclusively for the confidential evaluation of <strong className="font-semibold text-slate-900">{clientName}</strong>. Unauthorized copying, distribution, or disclosure of the technical architecture, methodology, or commercial pricing without prior written consent is strictly prohibited under applicable Indian and International copyright &amp; trade secret laws.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PAGES 3+: DETAILED SOW, DELIVERABLES, COMMERCIALS & ANNEXURES             */}
        {/* ========================================================================= */}
        <div
          className={`quotation-page quotation-body-page ${quotationBackgroundUrl ? 'has-custom-background' : ''}`}
          style={quotationBackgroundUrl ? {
            '--quotation-background': `url("${String(quotationBackgroundUrl).replace(/"/g, '%22')}")`,
            '--quotation-background-opacity': Math.min(0.3, Math.max(0, Number(quotationMaster.backgroundOpacity ?? 8) / 100))
          } : undefined}
        >
          {/* Security Classification Ribbon */}
          <div className="security-ribbon">
            <span>RESTRICTED &amp; CONFIDENTIAL // ENTERPRISE STATEMENT OF WORK</span>
            <span className="active-tag">{refNumber} // REV 1.0</span>
          </div>

          <div className="proposal-body">
          {/* Executive Masthead */}
          <div className="masthead">
            <div className="flex gap-4 items-start">
              {companyLogo ? (
                <img src={companyLogo} alt="Logo" className="brand-logo-img" />
              ) : (
                <div className="brand-monogram">{companyInitials}</div>
              )}
              <div>
                <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight m-0 mb-0.5">{companyName}</h1>
                <div className="text-[11px] font-semibold text-blue-600 tracking-wider uppercase mb-1.5">
                  Strategic Digital Engineering &amp; Technology Consulting
                </div>
                <div className="text-[11.5px] text-slate-500 leading-relaxed">
                  {companyAddress}<br />
                  <span>Email: <strong className="text-slate-700">{companyEmail}</strong></span> · <span>Tel: <strong className="text-slate-700">{companyPhone}</strong></span><br />
                  {companyWebsite && <><span>Web: <strong className="text-slate-700">{companyWebsite}</strong></span> · </>}
                  <span>GSTIN: <strong className="text-slate-700">{companyGstin}</strong></span>
                </div>
              </div>
            </div>

            <div className="bg-[#f8fafc] border border-slate-300 rounded-lg p-3.5">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800">ENGAGEMENT CHARTER</span>
                <span className="text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {formData.status || 'Proposal'}
                </span>
              </div>
              <div className="flex justify-between text-[11.5px] mb-1.5">
                <span className="text-slate-500">Reference ID:</span>
                <span className="font-bold font-mono text-[#0f172a] text-[11px]">{refNumber}</span>
              </div>
              <div className="flex justify-between text-[11.5px] mb-1.5">
                <span className="text-slate-500">Date of Issuance:</span>
                <span className="font-bold font-mono text-[#0f172a] text-[11px]">{issueDate}</span>
              </div>
              <div className="flex justify-between text-[11.5px] mb-1.5">
                <span className="text-slate-500">Proposal Validity:</span>
                <span className="font-bold font-mono text-[#0f172a] text-[11px]">{validDate}</span>
              </div>
              <div className="flex justify-between text-[11.5px]">
                <span className="text-slate-500">Delivery Scope:</span>
                <span className="font-bold font-mono text-[#0f172a] text-[11px]">{formData.timeline || 'Sprint-Based'}</span>
              </div>
            </div>
          </div>

          {/* Bilateral Stakeholder Dossier */}
          <div className="dossier-grid avoid-break">
            <div className="dossier-card">
              <div className="text-[9.5px] font-extrabold tracking-wider uppercase text-blue-600 mb-1.5">PREPARED FOR (CLIENT SPONSOR)</div>
              <div className="text-base font-bold text-[#0f172a] mb-1">{clientName}</div>
              {contactPerson && contactPerson !== clientName && (
                <div className="text-[11.5px] text-slate-600 leading-normal"><strong>Attn:</strong> {contactPerson}</div>
              )}
              {clientEmail && (
                <div className="text-[11.5px] text-slate-600 leading-normal"><strong>Email:</strong> {clientEmail}</div>
              )}
              {clientPhone && (
                <div className="text-[11.5px] text-slate-600 leading-normal"><strong>Phone:</strong> {clientPhone}</div>
              )}
              <div className="text-[11.5px] text-slate-600 leading-normal"><strong>Location:</strong> {clientLocation}</div>
            </div>

            <div className="dossier-card secondary-border">
              <div className="text-[9.5px] font-extrabold tracking-wider uppercase text-slate-600 mb-1.5">ENGAGEMENT PROGRAM OVERVIEW</div>
              <div className="text-base font-bold text-[#0f172a] mb-1">{proposalTitle}</div>
              {serviceSummary && (
                <div className="text-[11.5px] text-slate-600 leading-normal"><strong>Core Services:</strong> {serviceSummary}</div>
              )}
              <div className="text-[11.5px] text-slate-600 leading-normal"><strong>Engagement Model:</strong> Fixed-Scope Milestone SOW</div>
              <div className="text-[11.5px] text-slate-600 leading-normal"><strong>Deployment Target:</strong> Production Cloud Infrastructure</div>
            </div>
          </div>

          {hasCompanyProfile && (
            <div className="section-block avoid-break">
              <div className="sec-header">
                <div className="sec-title">About the Company</div>
                <span className="sec-tag">Delivery Partner Profile</span>
              </div>
              <div className="company-profile-grid">
                <div>
                  {quotationMaster.aboutCompany && <p className="m-0 whitespace-pre-line text-[11.5px] leading-relaxed text-slate-700">{quotationMaster.aboutCompany}</p>}
                  {(quotationMaster.expertise || quotationMaster.developmentCapabilities) && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {quotationMaster.expertise && <div className="rounded-lg border border-slate-200 bg-white/90 p-3"><div className="mb-1 text-[9.5px] font-extrabold uppercase tracking-wider text-blue-600">Expertise</div><div className="whitespace-pre-line text-[10.5px] leading-relaxed text-slate-600">{quotationMaster.expertise}</div></div>}
                      {quotationMaster.developmentCapabilities && <div className="rounded-lg border border-slate-200 bg-white/90 p-3"><div className="mb-1 text-[9.5px] font-extrabold uppercase tracking-wider text-blue-600">Development Capabilities</div><div className="whitespace-pre-line text-[10.5px] leading-relaxed text-slate-600">{quotationMaster.developmentCapabilities}</div></div>}
                    </div>
                  )}
                  {credibilityMetrics.length > 0 && (
                    <div className="credibility-grid">
                      {credibilityMetrics.map((metric) => <div key={metric.label} className="credibility-card"><div className="text-[16px] font-extrabold font-mono text-blue-700">{metric.value}</div><div className="mt-0.5 text-[8.5px] font-bold uppercase leading-tight tracking-wide text-slate-500">{metric.label}</div></div>)}
                    </div>
                  )}
                  {quotationMaster.businessContactDetails && <div className="mt-3 border-t border-slate-200 pt-2 text-[10.5px] leading-relaxed text-slate-600"><strong className="text-slate-800">Business Contact:</strong> <span className="whitespace-pre-line">{quotationMaster.businessContactDetails}</span></div>}
                </div>
                <div>
                  {topClients.length > 0 && <><div className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wider text-slate-600">Selected Clients</div><div className="client-logo-grid">{topClients.slice(0, 12).map((client, index) => <div key={client.id || `${client.name}-${index}`} className="client-logo-tile" title={client.name}>{client.logoUrl ? <img src={client.logoUrl} alt={client.name || 'Client'} /> : <span className="text-[9px] font-bold text-slate-600">{client.name}</span>}</div>)}</div></>}
                  {clientsQrUrl && <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-white/95 p-2.5"><img src={clientsQrUrl} alt="View all clients QR code" className="h-[66px] w-[66px] shrink-0" /><div><div className="text-[9.5px] font-bold text-slate-800">{quotationMaster.qrCaption || 'Scan to view all clients'}</div><div className="mt-1 break-all text-[8px] leading-tight text-slate-400">{quotationMaster.clientsPageUrl}</div></div></div>}
                </div>
              </div>
            </div>
          )}

          {/* 4-KPI Executive Value Dashboard */}
          <div className="kpi-grid avoid-break">
            <div className="kpi-card highlight">
              <div className="text-[9.5px] font-extrabold tracking-wider uppercase text-slate-400 mb-1">TOTAL COMMERCIAL VALUE</div>
              <div className="text-[17px] font-extrabold font-mono text-cyan-400">{fmt(totalAmount)}</div>
              <div className="text-[10px] text-slate-300 mt-0.5">{formData.gstApplicable ? 'Inclusive of GST' : 'Net Taxable Investment'}</div>
            </div>
            <div className="kpi-card">
              <div className="text-[9.5px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">DELIVERY WINDOW</div>
              <div className="text-[16px] font-extrabold font-mono text-[#0f172a]">{formData.timeline || 'Sprint-Based'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">4-Phase Release Cycle</div>
            </div>
            <div className="kpi-card">
              <div className="text-[9.5px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">HYPERCARE WARRANTY</div>
              <div className="text-[16px] font-extrabold font-mono text-[#0f172a]">45 Days</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Zero-Cost Defect Coverage</div>
            </div>
            <div className="kpi-card">
              <div className="text-[9.5px] font-extrabold tracking-wider uppercase text-slate-500 mb-1">UPTIME / AVAILABILITY</div>
              <div className="text-[16px] font-extrabold font-mono text-[#0f172a]">99.9%</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Tier-1 Incident SLA</div>
            </div>
          </div>

          {/* 4-Phase Delivery Framework */}
          <div className="phase-framework avoid-break">
            <div className="flex justify-between items-center mb-3.5">
              <span className="text-[10.5px] font-extrabold tracking-wider uppercase text-[#0f172a]">SOLUTION DELIVERY LIFECYCLE &amp; METHODOLOGY</span>
              <span className="text-[11px] text-slate-500">Phase-Gate Enterprise Execution</span>
            </div>
            <div className="phase-steps-grid">
              <div className="bg-[#f8fafc] border border-slate-200 rounded p-3">
                <div className="text-[9.5px] font-extrabold text-blue-600 tracking-wider mb-1">PHASE 01</div>
                <div className="text-xs font-bold text-[#0f172a] mb-1">Architecture &amp; Blueprint</div>
                <div className="text-[10.5px] text-slate-500 leading-snug">Discovery, UX/UI wireframes, data models &amp; architectural sign-off.</div>
              </div>
              <div className="bg-[#f8fafc] border border-slate-200 rounded p-3">
                <div className="text-[9.5px] font-extrabold text-blue-600 tracking-wider mb-1">PHASE 02</div>
                <div className="text-xs font-bold text-[#0f172a] mb-1">Core Engineering</div>
                <div className="text-[10.5px] text-slate-500 leading-snug">Modular front-end build, backend microservices &amp; database logic.</div>
              </div>
              <div className="bg-[#f8fafc] border border-slate-200 rounded p-3">
                <div className="text-[9.5px] font-extrabold text-blue-600 tracking-wider mb-1">PHASE 03</div>
                <div className="text-xs font-bold text-[#0f172a] mb-1">API &amp; Integrations</div>
                <div className="text-[10.5px] text-slate-500 leading-snug">Third-party webhooks, payment gateways, security &amp; load testing.</div>
              </div>
              <div className="bg-[#f8fafc] border border-slate-200 rounded p-3">
                <div className="text-[9.5px] font-extrabold text-blue-600 tracking-wider mb-1">PHASE 04</div>
                <div className="text-xs font-bold text-[#0f172a] mb-1">UAT &amp; Cloud Cutover</div>
                <div className="text-[10.5px] text-slate-500 leading-snug">Acceptance testing sign-off, production deployment &amp; warranty.</div>
              </div>
            </div>
          </div>

          {/* 01. Scope of Deliverables Matrix */}
          {formData.items?.length > 0 && (
            <div className="section-block avoid-break">
              <div className="sec-header">
                <div className="sec-title">01. Scope of Deliverables &amp; Commercial Value Matrix</div>
                <span className="sec-tag">{formData.items.length} Deliverable Module{formData.items.length > 1 ? 's' : ''}</span>
              </div>
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: 'center' }}>#</th>
                    <th>Deliverable / Module Specification</th>
                    <th style={{ width: 60, textAlign: 'center' }}>Units</th>
                    <th style={{ width: 130, textAlign: 'right' }}>Unit Rate (INR)</th>
                    <th style={{ width: 140, textAlign: 'right' }}>Net Value (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((it, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? 'bg-[#f8fafc]' : ''}>
                      <td className="text-center font-mono font-semibold text-slate-500">{String(idx + 1).padStart(2, '0')}</td>
                      <td>
                        <div className="font-bold text-[#0f172a] text-xs mb-0.5">{it.name || 'Deliverable Module'}</div>
                        {it.description && <div className="text-[11.5px] text-slate-500 leading-snug">{it.description}</div>}
                      </td>
                      <td className="text-center font-mono font-semibold">{it.qty || 1}</td>
                      <td className="text-right font-mono font-semibold text-slate-600">{fmt(it.rate || 0)}</td>
                      <td className="text-right font-mono font-bold text-[#0f172a]">{fmt(it.amount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 02. Commercial Summary & Milestones */}
          <div className="section-block avoid-break">
            <div className="sec-header">
              <div className="sec-title">02. Commercial Summary &amp; Milestone Governance</div>
              <span className="sec-tag">Financial Charter</span>
            </div>
            <div className="commercial-grid">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-[10.5px] font-extrabold tracking-wider uppercase text-[#0f172a] pb-2 border-b border-slate-200 mb-3">
                  STAGE-GATE DISBURSEMENT SCHEDULE
                </div>
                <div className="space-y-2.5">
                  {activeMilestones.length > 0 ? (
                    activeMilestones.map((ms, idx) => (
                      <div key={idx} className="flex items-start gap-3 pb-2.5 border-b border-dashed border-slate-200 last:border-none last:pb-0">
                        <span className="bg-[#0f172a] text-white text-[10px] font-bold px-2 py-0.5 rounded font-mono shrink-0">
                          MS-{String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-slate-800 leading-snug">{ms.name}</div>
                          {ms.dueEvent && ms.dueEvent !== ms.name && (
                            <div className="text-[10px] text-slate-500 mt-0.5 italic">Trigger: {ms.dueEvent}</div>
                          )}
                          <div className="text-[11px] font-bold text-blue-600 font-mono mt-0.5">
                            Milestone Disbursement: {fmt(ms.amount)} ({ms.percentage}%)
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 italic">No disbursement milestones defined.</div>
                  )}
                </div>
              </div>

              <div className="bg-[#f8fafc] border border-slate-300 rounded-lg p-4">
                <div className="text-[10.5px] font-extrabold tracking-wider uppercase text-[#0f172a] pb-2 border-b border-slate-200 mb-2.5">
                  COMMERCIAL CONSOLIDATION
                </div>
                <div className="flex justify-between text-xs py-1.5 text-slate-600">
                  <span>Base Professional &amp; Engineering Fee:</span>
                  <strong className="font-mono text-[#0f172a]">{fmt(subtotal)}</strong>
                </div>
                {formData.discountEnabled && discountAmount > 0 && (
                  <div className="flex justify-between text-xs py-1.5 text-red-600">
                    <span>Strategic Commercial Discount:</span>
                    <strong className="font-mono text-red-600">- {fmt(discountAmount)}</strong>
                  </div>
                )}
                <div className="flex justify-between text-xs py-1.5 text-slate-700 border-t border-slate-200">
                  <span>Net Taxable Commercial Value:</span>
                  <strong className="font-mono text-[#0f172a]">{fmt(taxableAmount)}</strong>
                </div>
                {formData.gstApplicable && (
                  isInterState ? (
                    <div className="flex justify-between text-xs py-1 text-slate-600">
                      <span>Integrated GST (IGST {gstRate}%):</span>
                      <strong className="font-mono text-[#0f172a]">+ {fmt(igstAmount)}</strong>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-xs py-1 text-slate-600">
                        <span>Central GST (CGST {(gstRate / 2).toFixed(1)}%):</span>
                        <strong className="font-mono text-[#0f172a]">+ {fmt(cgstAmount)}</strong>
                      </div>
                      <div className="flex justify-between text-xs py-1 text-slate-600">
                        <span>State GST (SGST {(gstRate / 2).toFixed(1)}%):</span>
                        <strong className="font-mono text-[#0f172a]">+ {fmt(sgstAmount)}</strong>
                      </div>
                    </>
                  )
                )}
                <div className="mt-2.5 pt-3 border-t-2 border-[#0f172a] flex justify-between items-baseline">
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-wide text-[#0f172a]">TOTAL INVESTMENT</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {formData.gstApplicable
                        ? (isInterState ? `Inclusive of IGST @ ${gstRate}% (Inter-State)` : `Inclusive of CGST+SGST @ ${gstRate}% (Intra-State)`)
                        : 'Exclusive of taxes / Zero-Rated'}
                    </div>
                  </div>
                  <div className="text-xl font-extrabold font-mono text-blue-700">{fmt(totalAmount)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Capabilities */}
          {groupedPreviewFeatures.length > 0 && (
            <div className="section-block avoid-break">
              <div className="sec-header">
                <div className="sec-title">Key Capabilities &amp; Functional Scope</div>
                <span className="sec-tag">{formData.features.length} Core Modules Included</span>
              </div>
              <div className="space-y-3">
                {groupedPreviewFeatures.map(([svcName, feats], gIdx) => (
                  <div key={gIdx} className="bg-[#f8fafc] border border-slate-200 rounded-lg p-3">
                    {groupedPreviewFeatures.length > 1 && (
                      <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 pb-1.5 mb-2 border-b border-slate-200/80 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                        <span>{svcName}</span>
                        <span className="text-[10px] font-medium text-slate-400 lowercase">({feats.length} {feats.length === 1 ? 'feature' : 'features'})</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {feats.map((featureText, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-700 leading-snug">
                          <span className="text-emerald-600 font-bold text-xs shrink-0">✓</span>
                          <span>{featureText}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technology Stack */}
          {techItems.length > 0 && (
            <div className="section-block avoid-break">
              <div className="sec-header">
                <div className="sec-title">03. Enterprise Technology Stack &amp; Architecture</div>
                <span className="sec-tag">Architecture Tier</span>
              </div>
              <div className="flex flex-wrap gap-2 bg-[#f8fafc] border border-slate-200 rounded-lg p-3.5">
                {techItems.map((tech, idx) => (
                  <div key={idx} className="inline-flex items-center gap-1.5 bg-white border border-slate-300 text-slate-800 px-3 py-1 text-xs font-semibold rounded-full shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    <span>{tech}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Scope */}
          {formData.scopeOfWork?.trim() && (
            <div className="section-block avoid-break">
              <div className="sec-header">
                <div className="sec-title">Detailed Technical Scope &amp; Implementation Approach</div>
              </div>
              {/<[a-z][\s\S]*>/i.test(formData.scopeOfWork) ? (
                <div
                  className="bg-[#f8fafc] border border-slate-200 border-l-4 border-l-blue-600 rounded p-4 text-xs leading-relaxed text-slate-700 [&_a]:text-blue-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2.5 last:[&_p]:mb-0 [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mt-2 [&_h3]:mb-1"
                  dangerouslySetInnerHTML={{ __html: formData.scopeOfWork }}
                />
              ) : (
                <div className="bg-[#f8fafc] border border-slate-200 border-l-4 border-l-blue-600 rounded p-4 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                  {formData.scopeOfWork}
                </div>
              )}
            </div>
          )}

          {/* Custom Content */}
          {formData.customContent && (
            <div className="section-block avoid-break">
              <div className="sec-header">
                <div className="sec-title">Additional Project Specifications</div>
              </div>
              <div
                className="bg-[#f8fafc] border border-slate-200 border-l-4 border-l-blue-600 rounded p-4 text-xs leading-relaxed text-slate-700"
                dangerouslySetInnerHTML={{ __html: formData.customContent }}
              />
            </div>
          )}

          {/* SLA Table */}
          <div className="section-block avoid-break">
            <div className="sec-header">
              <div className="sec-title">Enterprise Service Level Agreement (SLA) &amp; Incident Triage</div>
              <span className="sec-tag">Tier-1 Support Matrix</span>
            </div>
            <table className="sla-table">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Severity Level</th>
                  <th>Incident Definition &amp; Business Impact</th>
                  <th style={{ width: 120 }}>Initial Response</th>
                  <th style={{ width: 130 }}>Target Resolution</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-bold text-xs text-red-600">Severity 1 (Critical)</td>
                  <td>Production outage, core application inaccessible, or payment process failure with no workaround.</td>
                  <td>&lt; 1 Hour</td>
                  <td>4 - 8 Hours</td>
                </tr>
                <tr>
                  <td className="font-bold text-xs text-amber-600">Severity 2 (High)</td>
                  <td>Major system feature impaired, performance degraded, but partial operational workaround exists.</td>
                  <td>&lt; 4 Hours</td>
                  <td>24 Hours</td>
                </tr>
                <tr>
                  <td className="font-bold text-xs text-blue-600">Severity 3 (Standard)</td>
                  <td>Minor non-critical bug, cosmetic/UI imperfection, standard operational query or change request.</td>
                  <td>&lt; 8 Hours</td>
                  <td>48 - 72 Hours</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Post-Deployment Warranty */}
          {warrantyLines.length > 0 && (
            <div className="section-block avoid-break">
              <div className="sec-header">
                <div className="sec-title">Post-Deployment Warranty &amp; Hypercare Governance</div>
                <span className="sec-tag">Assurance Charter</span>
              </div>
              <div className="grid grid-cols-2 gap-3 bg-[#f8fafc] border border-slate-200 rounded-lg p-4">
                {warrantyLines.map((line, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 leading-snug">
                    <span className="text-sm">🛡️</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AMC Plan */}
          {formData.amcPlan && (
            <div className="section-block avoid-break">
              <div className="sec-header">
                <div className="sec-title">Annual Maintenance &amp; Dedicated Support Package (AMC)</div>
                <span className="sec-tag">Enterprise Support</span>
              </div>
              <div className="bg-[#f8fafc] border border-slate-200 rounded-lg p-4">
                <div className="flex justify-between items-start border-b border-slate-200 pb-3 mb-3">
                  <div>
                    <div className="text-sm font-bold text-[#0f172a]">{formData.amcPlan.name}</div>
                    {formData.amcPlan.description && (
                      <div className="text-[11.5px] text-slate-500 mt-0.5">{formData.amcPlan.description}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-base font-extrabold font-mono text-blue-800">{fmt(formData.amcPlan.defaultCost || 0)}</div>
                    <div className="text-[10.5px] text-slate-500">/ {formData.amcPlan.defaultBillingCycle || 'Yearly'}</div>
                    {formData.amcPlan.responseSlaHours && (
                      <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded mt-1 inline-block">
                        ⚡ {formData.amcPlan.responseSlaHours}h Response SLA
                      </div>
                    )}
                  </div>
                </div>
                {(amcIncList.length > 0 || amcExcList.length > 0) && (
                  <div className="grid grid-cols-2 gap-4">
                    {amcIncList.length > 0 && (
                      <div>
                        <div className="text-[10px] font-extrabold text-emerald-700 tracking-wider mb-2">INCLUDED SUPPORT SERVICES:</div>
                        {amcIncList.map((item, idx) => (
                          <div key={idx} className="text-[11.5px] text-slate-700 mb-1 flex items-start gap-1.5">
                            <span className="text-emerald-600 font-bold">✓</span> {item}
                          </div>
                        ))}
                      </div>
                    )}
                    {amcExcList.length > 0 && (
                      <div>
                        <div className="text-[10px] font-extrabold text-slate-500 tracking-wider mb-2">OUT-OF-SCOPE EXCLUSIONS:</div>
                        {amcExcList.map((item, idx) => (
                          <div key={idx} className="text-[11.5px] text-slate-500 mb-1 flex items-start gap-1.5">
                            <span className="text-slate-400 font-bold">✕</span> {item}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Next Year Projections */}
          {formData.nextYearCostSummary?.trim() && (
            <div className="section-block avoid-break">
              <div className="sec-header">
                <div className="sec-title">Subsequent Year Operational &amp; Infrastructure Forecast</div>
              </div>
              <div className="bg-[#f8fafc] border border-slate-200 border-l-4 border-l-blue-600 rounded p-4 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                {formData.nextYearCostSummary}
              </div>
            </div>
          )}

          {/* Legal Governance Annexures */}
          {enabledAgreements.length > 0 ? (
            <div className="section-block avoid-break mt-9">
              <div className="sec-header">
                <div className="sec-title">Statutory Governance, Compliance &amp; Legal Annexures</div>
                <span className="sec-tag">{enabledAgreements.length} Binding Annexure{enabledAgreements.length > 1 ? 's' : ''}</span>
              </div>
              <p className="text-[11.5px] text-slate-500 mb-4">The following legal covenants, statutory clauses, and operating frameworks govern this Statement of Work:</p>
              <div className="space-y-3.5">
                {enabledAgreements.map((agreement, idx) => (
                  <div key={idx} className="bg-white border border-slate-300 rounded-lg p-4 avoid-break">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2.5">
                      <div className="text-xs font-extrabold text-[#0f172a] tracking-wide">
                        ANNEXURE {toRoman(idx + 1)}: {agreement.name.toUpperCase()}
                      </div>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        {agreement.category || 'Compliance'}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-slate-700 leading-relaxed whitespace-pre-line">
                      {agreement.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : formData.termsAndConditions?.trim() ? (
            <div className="section-block avoid-break mt-8">
              <div className="sec-header">
                <div className="sec-title">Terms &amp; Conditions of Engagement</div>
                <span className="sec-tag">Annexure I</span>
              </div>
              <div className="bg-white border border-slate-300 rounded-lg p-4">
                <div className="text-[11.5px] text-slate-700 leading-relaxed whitespace-pre-line">
                  {formData.termsAndConditions}
                </div>
              </div>
            </div>
          ) : null}

          {/* Bilateral Execution Block */}
          <div className="sign-section avoid-break mt-9 pt-6 border-t-2 border-[#0f172a] mb-5">
            <div className="flex justify-between items-baseline mb-1">
              <div className="text-xs font-extrabold uppercase tracking-wide text-[#0f172a]">Bilateral Execution &amp; Formal Authorization</div>
              <span className="sec-tag">Legally Binding SOW</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              This Statement of Work and Commercial Agreement represents the entire understanding between the parties. Execution by authorized officers constitutes acceptance of all terms, milestones, and governance annexures outlined herein.
            </p>
            <div className="sign-grid">
              <div className="bg-[#f8fafc] border border-slate-300 rounded-lg p-4">
                <div className="text-[9.5px] font-extrabold tracking-wider uppercase text-blue-600">EXECUTED FOR &amp; ON BEHALF OF:</div>
                <div className="text-xs font-bold text-[#0f172a] mt-0.5 mb-2.5">{companyName}</div>
                <div className="h-12" />
                <div className="h-px bg-slate-400 mb-2" />
                <div className="text-[11px] text-slate-600 mb-1">Authorized Signatory: _________________________</div>
                <div className="text-[11px] text-slate-600 mb-1">Designation: <strong className="text-[#0f172a]">Practice Director / Partner</strong></div>
                <div className="text-[11px] text-slate-600 mb-1">Official Seal / Stamp: _________________________</div>
                <div className="text-[11px] text-slate-600">Date of Execution: _________________________</div>
              </div>

              <div className="bg-[#f8fafc] border border-slate-300 rounded-lg p-4">
                <div className="text-[9.5px] font-extrabold tracking-wider uppercase text-[#0f172a]">ACCEPTED &amp; CONFIRMED FOR:</div>
                <div className="text-xs font-bold text-[#0f172a] mt-0.5 mb-2.5">{clientName}</div>
                <div className="h-12" />
                <div className="h-px bg-slate-400 mb-2" />
                <div className="text-[11px] text-slate-600 mb-1">Authorized Signatory: _________________________</div>
                <div className="text-[11px] text-slate-600 mb-1">Designation / Title: _________________________</div>
                <div className="text-[11px] text-slate-600 mb-1">Corporate Seal / Stamp: _________________________</div>
                <div className="text-[11px] text-slate-600">Date of Acceptance: _________________________</div>
              </div>
            </div>

            <div className="bg-[#f1f5f9] border border-dashed border-slate-300 rounded p-2.5 flex justify-between items-center text-[9.5px] text-slate-500 font-mono mt-5">
              <div>DOCUMENT DIGEST: SHA256-{refNumber}-WBT-ENG-{new Date().getFullYear()}</div>
              <div>GOVERNED BY INDIAN INFORMATION TECHNOLOGY ACT, 2000</div>
            </div>
          </div>

          {/* Proposal Footer */}
          <div className="mt-7 pt-3.5 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-400">
            <div>
              <strong className="text-slate-600">{companyName}</strong> · Enterprise SOW &amp; Proposal for {clientName}
            </div>
            <div>
              {companyWebsite && <span>{companyWebsite}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LAST PAGE: BACK COVER PAGE (Webitof-cover2.pdf)                           */}
      {/* ========================================================================= */}
      <div className="quotation-page quotation-cover-page back-cover">
        <img
          src={backCoverImg}
          alt="Webitof Proposal Back Cover"
          className="cover-img"
        />
      </div>
    </div>
  </div>
);
}
