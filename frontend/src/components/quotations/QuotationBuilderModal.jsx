import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { leadRoute, clientRoute } from '../../utils/entityRoutes';
import {
  FileText,
  Layers,
  Cpu,
  Calculator,
  Scale,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  Plus,
  PlusCircle,
  Trash2,
  Eye,
  Printer,
  Share2,
  Clock,
  Calendar,
  DollarSign,
  Shield,
  HelpCircle,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Building,
  User,
  Search,
  ArrowRight,
  Monitor,
  Server,
  Globe2,
  ShieldCheck,
  CreditCard,
  Activity,
  Webhook,
  MessageSquareText,
  Database,
  Phone,
  Mail,
  MapPin,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { RichTextEditor } from '../forms/RichTextEditor';
import { WhatsAppModal } from '../common/WhatsAppModal';
import { IT_LEGAL_PRESETS } from '../../pages/LegalMasterPage';
import {
  TECHNOLOGY_ICONS,
  DEFAULT_TECHNOLOGY_ICON
} from '../../config/technologyIcons';
import { STATIC_TECHNOLOGIES } from '../../config/technologyStacks';
import { FaWhatsapp, FaAws } from 'react-icons/fa6';
import {
  QUOTATION_PACKAGE_PRESETS,
  buildWhatsAppProposalPitch
} from '../../config/quotationPresets';
import {
  MILESTONE_PRESETS,
  validateMilestones,
  calculateMilestoneAmounts,
  parseMilestonesFromText,
  serializeMilestonesToText
} from '../../utils/paymentMilestoneEngine';
import {
  calculateQuotationTotals,
  resolveTaxTreatment
} from '../../utils/taxCalculationEngine';

function cleanSingleLine(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function toAmountNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLeadAmount(value, currency = 'INR') {
  const amount = Number(value || 0);
  try {
    return amount.toLocaleString('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0
    });
  } catch {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  const formatted = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  if (diffDays === 0) return `${formatted} (Today)`;
  if (diffDays === 1) return `${formatted} (Yesterday)`;
  if (diffDays > 1 && diffDays < 30) return `${formatted} (${diffDays}d ago)`;
  return formatted;
}

function matchServiceInCatalog(name, catalog = []) {
  if (!name || !catalog.length) return null;
  const cleanName = String(name).trim().toLowerCase();
  
  // 1. Exact name match
  let found = catalog.find((s) => String(s.name || '').trim().toLowerCase() === cleanName);
  if (found) return found;

  // 2. Strip "other:" or punctuation
  const strippedName = cleanName.replace(/^other:\s*/i, '').replace(/[^a-z0-9]/g, '');
  if (strippedName) {
    found = catalog.find((s) => {
      const sName = String(s.name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return sName === strippedName;
    });
    if (found) return found;
  }

  // 3. Substring inclusion
  found = catalog.find((s) => {
    const sName = String(s.name || '').trim().toLowerCase();
    return Boolean(sName && cleanName && (sName.includes(cleanName) || cleanName.includes(sName)));
  });
  if (found) return found;

  // 4. Keyword fuzzy match
  const keywords = ['ecommerce', 'e-commerce', 'whatsapp', 'website', 'web', 'app', 'mobile', 'hosting', 'domain', 'amc', 'maintenance', 'seo'];
  for (const kw of keywords) {
    if (cleanName.includes(kw)) {
      found = catalog.find((s) => String(s.name || '').toLowerCase().includes(kw));
      if (found) return found;
    }
  }

  return null;
}

export const ARCHITECTURE_TIERS = [
  {
    id: 'frontend',
    title: 'Frontend & UI Frameworks',
    shortTitle: 'Frontend',
    icon: Monitor,
    dotColor: '#0ea5e9',
    badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
    keywords: ['react', 'next', 'vue', 'angular', 'tailwind', 'bootstrap', 'html', 'css', 'javascript', 'typescript', 'vite', 'ui', 'redux', 'svelte', 'jquery', 'figma']
  },
  {
    id: 'backend',
    title: 'Backend & Server Runtimes',
    shortTitle: 'Backend',
    icon: Cpu,
    dotColor: '#10b981',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    keywords: ['node', 'express', 'python', 'django', 'fastapi', 'php', 'laravel', 'nest', 'java', 'spring', 'dotnet', 'asp.net', 'rest api', 'graphql', 'socket.io', 'backend']
  },
  {
    id: 'database',
    title: 'Database & Storage Engines',
    shortTitle: 'Database',
    icon: Database,
    dotColor: '#8b5cf6',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    keywords: ['postgres', 'postgresql', 'mongo', 'mongodb', 'mysql', 'mariadb', 'redis', 'sqlite', 'supabase', 'firebase', 'prisma', 'sql server', 'elasticsearch', 'dynamodb', 'database']
  },
  {
    id: 'cloud',
    title: 'Cloud, Hosting & Infrastructure',
    shortTitle: 'Cloud & Infrastructure',
    icon: Server,
    dotColor: '#f59e0b',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    keywords: ['cloud', 'hosting', 'aws', 'azure', 'gcp', 'digitalocean', 'hostinger', 'cpanel', 'cloudflare', 'docker', 'kubernetes', 'ssl', 'tls', 'dns', 'domain', 'nginx', 'vercel', 'netlify', 'vps', 'server']
  },
  {
    id: 'api',
    title: 'APIs, Gateways & Integrations',
    shortTitle: 'APIs & Gateways',
    icon: Webhook,
    dotColor: '#06b6d4',
    badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    keywords: ['whatsapp', 'meta', 'payment', 'gateway', 'razorpay', 'stripe', 'paypal', 'cashfree', 'webhook', 'webhooks', 'sms', 'email api', 'google maps', 'api integration', 'rest webhooks', 'integration']
  },
  {
    id: 'devops',
    title: 'DevOps, Monitoring & Handover Support',
    shortTitle: 'DevOps & Support',
    icon: Activity,
    dotColor: '#ec4899',
    badgeBg: 'bg-pink-50 text-pink-700 border-pink-200',
    keywords: ['monitoring', 'backup', 'support', 'ticket', 'sentry', 'grafana', 'prometheus', 'git', 'github', 'ci/cd', 'postman', 'jira', 'slack', 'security', 'vapt', 'tools']
  },
  {
    id: 'others',
    title: 'Others & Custom Technologies',
    shortTitle: 'Others',
    icon: Layers,
    dotColor: '#6366f1',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    keywords: ['other', 'others', 'custom', 'misc', 'utility', 'general']
  }
];

export function resolveTechIcon(name) {
  if (!name) return DEFAULT_TECHNOLOGY_ICON;
  const clean = String(name).trim();

  // 1. Direct key match
  if (TECHNOLOGY_ICONS[clean]) return TECHNOLOGY_ICONS[clean];

  // 2. Case-insensitive key match
  const lower = clean.toLowerCase();
  for (const [key, val] of Object.entries(TECHNOLOGY_ICONS)) {
    if (key.toLowerCase() === lower) return val;
  }

  // 3. Keyword / partial matching
  if (lower.includes('react')) return TECHNOLOGY_ICONS['React.js'] || TECHNOLOGY_ICONS['React Native'];
  if (lower.includes('next')) return TECHNOLOGY_ICONS['Next.js'];
  if (lower.includes('vue')) return TECHNOLOGY_ICONS['Vue.js'];
  if (lower.includes('angular')) return TECHNOLOGY_ICONS['Angular'];
  if (lower.includes('node')) return TECHNOLOGY_ICONS['Node.js'];
  if (lower.includes('express')) return TECHNOLOGY_ICONS['Express.js'];
  if (lower.includes('python') || lower.includes('django') || lower.includes('fastapi')) return TECHNOLOGY_ICONS['Python'];
  if (lower.includes('php') || lower.includes('laravel')) return TECHNOLOGY_ICONS['PHP'];
  if (lower.includes('postgres')) return TECHNOLOGY_ICONS['PostgreSQL'];
  if (lower.includes('mongo')) return TECHNOLOGY_ICONS['MongoDB'];
  if (lower.includes('mysql') || lower.includes('mariadb')) return TECHNOLOGY_ICONS['MySQL'];
  if (lower.includes('redis')) return TECHNOLOGY_ICONS['Redis'];
  if (lower.includes('supabase')) return TECHNOLOGY_ICONS['Supabase'];
  if (lower.includes('firebase')) return TECHNOLOGY_ICONS['Firebase'];
  if (lower.includes('whatsapp') || lower.includes('meta')) return { Icon: FaWhatsapp, color: '#25D366' };
  if (lower.includes('payment') || lower.includes('razorpay') || lower.includes('stripe') || lower.includes('gateway')) return TECHNOLOGY_ICONS['Payment Gateway API'] || { Icon: CreditCard, color: '#6366f1' };
  if (lower.includes('cloud') || lower.includes('hosting') || lower.includes('vps') || lower.includes('server')) return { Icon: Server, color: '#0ea5e9' };
  if (lower.includes('aws')) return TECHNOLOGY_ICONS['AWS'] || { Icon: FaAws, color: '#ff9900' };
  if (lower.includes('docker') || lower.includes('kubernetes')) return TECHNOLOGY_ICONS['Docker'];
  if (lower.includes('webhook')) return { Icon: Webhook, color: '#14b8a6' };
  if (lower.includes('ssl') || lower.includes('tls') || lower.includes('security')) return { Icon: ShieldCheck, color: '#10b981' };
  if (lower.includes('dns') || lower.includes('domain')) return { Icon: Globe2, color: '#3b82f6' };
  if (lower.includes('monitor') || lower.includes('metric')) return { Icon: Activity, color: '#f59e0b' };
  if (lower.includes('backup')) return { Icon: Database, color: '#06b6d4' };
  if (lower.includes('support') || lower.includes('ticket')) return { Icon: MessageSquareText, color: '#8b5cf6' };
  if (lower.includes('tailwind')) return TECHNOLOGY_ICONS['Tailwind CSS'];
  if (lower.includes('html') || lower.includes('css')) return TECHNOLOGY_ICONS['HTML5'];
  if (lower.includes('git')) return TECHNOLOGY_ICONS['Git'];
  if (lower.includes('shopify')) return TECHNOLOGY_ICONS['Shopify'];
  if (lower.includes('wordpress') || lower.includes('woocommerce')) return TECHNOLOGY_ICONS['WordPress'];

  return DEFAULT_TECHNOLOGY_ICON;
}

export const getTechIcon = resolveTechIcon;

export function classifyTechTier(techName) {
  const lower = String(techName || '').toLowerCase();
  for (const tier of ARCHITECTURE_TIERS) {
    if (tier.id === 'others') continue;
    if (tier.keywords.some((kw) => lower.includes(kw))) {
      return tier.id;
    }
  }
  return 'others';
}

export function isTechRelevantToService(tech, serviceName, matchedSvc = null) {
  if (!tech || !serviceName) return false;
  const tLower = tech.toLowerCase().trim();
  const sLower = serviceName.toLowerCase().trim();

  // 1. If matchedSvc explicitly has this technology in its catalog technologyStack string
  if (matchedSvc) {
    const raw = String(matchedSvc.technologyStack || matchedSvc.payload?.technologyStack || '').toLowerCase();
    if (raw && (raw.includes(tLower) || tLower.split(/[\s/]+/).some((w) => w.length > 2 && raw.includes(w)))) {
      return true;
    }
  }

  const tier = classifyTechTier(tech);
  if (tier === 'others') return false; // Unmapped/custom tech never auto-maps to standard services

  // 2. Classify service domain
  const isWebDev = sLower.includes('website') || sLower.includes('web') || sLower.includes('development') ||
                   sLower.includes('ecommerce') || sLower.includes('e-commerce') || sLower.includes('portal') ||
                   sLower.includes('software') || sLower.includes('frontend') || sLower.includes('fullstack') ||
                   sLower.includes('custom crm') || sLower.includes('saas') || sLower.includes('cms') ||
                   sLower.includes('wordpress') || sLower.includes('shopify');

  const isEcommerce = sLower.includes('ecommerce') || sLower.includes('e-commerce') || sLower.includes('store') ||
                      sLower.includes('shop') || sLower.includes('woocommerce') || sLower.includes('shopify');

  const isDomainHosting = sLower.includes('domain') || sLower.includes('hosting') || sLower.includes('server') ||
                          sLower.includes('cloud') || sLower.includes('vps') || sLower.includes('infrastructure') ||
                          sLower.includes('devops');

  const isWhatsApp = sLower.includes('whatsapp') || sLower.includes('meta') || sLower.includes('messaging') ||
                     sLower.includes('bot') || sLower.includes('chat');

  const isMobile = sLower.includes('mobile') || sLower.includes('app') || sLower.includes('android') || sLower.includes('ios');

  const isApi = sLower.includes('api') || sLower.includes('integration') || sLower.includes('webhook');

  // Match domain specifically:
  if (isDomainHosting) {
    if (tier === 'cloud' || tier === 'devops') return true;
    if (tLower.includes('hosting') || tLower.includes('ssl') || tLower.includes('dns') || tLower.includes('domain') || tLower.includes('server') || tLower.includes('backup') || tLower.includes('monitoring')) return true;
    return false;
  }

  if (isWhatsApp) {
    if (tLower.includes('whatsapp') || tLower.includes('meta') || tLower.includes('webhook') || tLower.includes('messaging') || (tier === 'api' && !tLower.includes('payment'))) return true;
    return false;
  }

  if (isMobile) {
    if (tLower.includes('react native') || tLower.includes('flutter') || tLower.includes('android') || tLower.includes('ios') || tLower.includes('expo') || tLower.includes('mobile')) return true;
    if (tier === 'frontend' && (tLower.includes('react') || tLower.includes('javascript') || tLower.includes('typescript'))) return true;
    if (tier === 'backend' || tier === 'database') return true;
    return false;
  }

  if (isEcommerce) {
    if (tier === 'frontend' || tier === 'backend' || tier === 'database') return true;
    if (tLower.includes('payment') || tLower.includes('razorpay') || tLower.includes('stripe') || tLower.includes('gateway') || tLower.includes('cashfree') || tLower.includes('paypal') || tLower.includes('commerce') || tLower.includes('shopify')) return true;
    if (tLower.includes('hosting') || tLower.includes('ssl')) return true;
    return false;
  }

  if (isWebDev) {
    if (tier === 'frontend' || tier === 'backend' || tier === 'database') return true;
    if (tLower.includes('hosting') || tLower.includes('ssl') || tLower.includes('dns') || tLower.includes('git')) return true;
    if (tier === 'api' && !tLower.includes('whatsapp')) return true;
    return false;
  }

  if (isApi) {
    if (tier === 'api' || tier === 'backend') return true;
    return false;
  }

  return tier === 'frontend' || tier === 'backend';
}

export const POPULAR_TECH_SUGGESTIONS = [
  'React.js', 'Next.js', 'Tailwind CSS', 'Node.js', 'Express.js', 'PostgreSQL',
  'MongoDB', 'Redis', 'Meta WhatsApp Cloud API', 'Payment gateway API', 'Razorpay',
  'AWS', 'Docker', 'REST webhooks', 'Cloud hosting', 'SSL/TLS', 'DNS',
  'Monitoring and backup tools', 'Ticket-based support'
];

export const TECH_CATEGORY_FILTERS = [
  { id: 'all', label: 'All (150+)' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'backend', label: 'Backend' },
  { id: 'database', label: 'Database' },
  { id: 'cloud', label: 'Cloud & DevOps' },
  { id: 'api', label: 'APIs & Webhooks' },
  { id: 'mobile', label: 'Mobile App' },
  { id: 'security', label: 'Security' },
  { id: 'others', label: 'Others' }
];

function buildServiceTemplatePatch({
  serviceNames = [],
  serviceCatalog = [],
  amcPlans = [],
  lead = null,
  defaultAmount = '',
  defaultTermsAndConditions = '',
  currency = 'INR'
}) {
  const clientName = lead?.companyName || lead?.name || lead?.contactPerson || 'Client';
  const rawNames = (Array.isArray(serviceNames) && serviceNames.length)
    ? serviceNames
    : (Array.isArray(lead?.requiredServices) && lead.requiredServices.length
        ? lead.requiredServices
        : (lead?.service ? [lead.service] : []));

  const resolvedServices = [];
  const unmatchedNames = [];

  rawNames.forEach((rawName) => {
    const matched = matchServiceInCatalog(rawName, serviceCatalog);
    if (matched) {
      if (!resolvedServices.some((s) => String(s.id) === String(matched.id))) {
        resolvedServices.push(matched);
      }
    } else {
      const clean = String(rawName || '').replace(/^other:\s*/i, '').trim();
      if (clean && !unmatchedNames.includes(clean)) {
        unmatchedNames.push(clean);
      }
    }
  });

  const leadBudget = Number(lead?.estimatedBudget ?? lead?.value ?? defaultAmount ?? 0);

  // Generate line items
  const items = [];
  resolvedServices.forEach((service, index) => {
    const rate = Math.max(0, Number(service.defaultPrice ?? service.payload?.defaultPrice ?? 0));
    const desc = service.description || service.payload?.description || service.scopeOfWork || service.payload?.scopeOfWork || `Professional ${service.name} engineering & delivery`;
    const isAddon = (service.serviceKind || service.payload?.serviceKind) === 'addon';
    items.push({
      id: `svc-${service.id || index + 1}`,
      serviceId: service.id || '',
      name: service.name,
      description: desc,
      qty: 1,
      rate,
      amount: rate,
      isAddon
    });
  });

  unmatchedNames.forEach((name, index) => {
    const rate = (!items.length && leadBudget > 0) ? leadBudget : 0;
    items.push({
      id: `custom-svc-${index + 1}`,
      serviceId: '',
      name,
      description: `Custom engineering and execution for ${name} as required by ${clientName}.`,
      qty: 1,
      rate,
      amount: rate,
      isAddon: false
    });
  });

  // Calculate total amount
  const catalogTotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const finalAmount = catalogTotal > 0 ? catalogTotal : (leadBudget > 0 ? leadBudget : '');

  // Extract features service-wise
  const allFeatures = [];
  resolvedServices.forEach((svc) => {
    const featText = svc.featuresText || svc.payload?.featuresText;
    const featArr = svc.features || svc.payload?.features;
    if (featText) {
      const lines = String(featText).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      lines.forEach((line) => {
        allFeatures.push({ text: line, serviceName: svc.name });
      });
    } else if (Array.isArray(featArr)) {
      featArr.forEach((line) => {
        const clean = String(line).trim();
        if (clean) allFeatures.push({ text: clean, serviceName: svc.name });
      });
    }
  });

  if (!allFeatures.length && items.length) {
    items.forEach((item) => {
      allFeatures.push(
        { text: `${item.name} Core Architecture & UI/UX Layout`, serviceName: item.name },
        { text: `${item.name} Integration & Quality Assurance`, serviceName: item.name }
      );
    });
  }
  const uniqueFeatures = allFeatures;

  // Extract scope of work
  const scopeParts = resolvedServices
    .map((s) => {
      const sow = s.scopeOfWork || s.payload?.scopeOfWork;
      return sow ? `• ${s.name}: ${sow}` : '';
    })
    .filter(Boolean);
  const scopeOfWork = scopeParts.length
    ? scopeParts.join('\n\n')
    : (lead?.requirements || lead?.notes || `Complete end-to-end delivery of the agreed deliverables including requirement discovery, system architecture, UI/UX implementation, testing, and production rollout.`);

  // Extract tech stack
  const techLines = resolvedServices
    .map((s) => s.technologyStack || s.payload?.technologyStack)
    .filter(Boolean);
  const technologyStack = techLines.length
    ? Array.from(new Set(techLines.flatMap((t) => String(t).split(/,\s*|\r?\n/)).map((t) => t.trim()).filter(Boolean))).join(', ')
    : 'React, Node.js, PostgreSQL, Tailwind CSS, AWS Cloud';

  // Extract timeline
  const timelines = resolvedServices
    .map((s) => s.timeline || s.payload?.timeline)
    .filter(Boolean);
  const timeline = timelines.length ? Array.from(new Set(timelines)).join(' + ') : '4 - 6 Weeks';

  // Extract warranty / afterCompletion
  const afterCompletionParts = resolvedServices
    .map((s) => s.afterCompletion || s.payload?.afterCompletion)
    .filter(Boolean);
  const afterCompletion = afterCompletionParts.length
    ? Array.from(new Set(afterCompletionParts)).join('\n')
    : '1. 30 calendar days of complimentary bug-fix warranty.\n2. Complete source code and operational credential handover.\n3. Dedicated administrator & user onboarding training session.';

  // Match AMC Plan
  const directAmcId = resolvedServices.map((s) => s.amcPlanId || s.payload?.amcPlanId).find(Boolean);
  let recommendedAmc = null;
  if (directAmcId) {
    recommendedAmc = amcPlans.find((p) => String(p.id) === String(directAmcId)) || null;
  }
  if (!recommendedAmc && resolvedServices.length) {
    const selectedIds = new Set(resolvedServices.map((s) => String(s.id)));
    recommendedAmc = amcPlans.find((p) => (p.linkedServiceIds || p.payload?.linkedServiceIds || []).some((id) => selectedIds.has(String(id)))) || null;
  }

  // Next Year Cost
  const nextYearRows = resolvedServices
    .filter((s) => Number(s.nextYearCost ?? s.payload?.nextYearCost ?? 0) > 0)
    .map((s) => `${s.name}: ${formatLeadAmount(s.nextYearCost ?? s.payload?.nextYearCost, currency)} / year`);
  if (recommendedAmc) {
    const amcCost = Number(recommendedAmc.nextYearCost ?? recommendedAmc.defaultCost ?? recommendedAmc.payload?.nextYearCost ?? recommendedAmc.payload?.defaultCost ?? 0);
    const billingCycle = recommendedAmc.defaultBillingCycle || recommendedAmc.payload?.defaultBillingCycle || 'year';
    if (amcCost > 0) {
      nextYearRows.push(`${recommendedAmc.name}: ${formatLeadAmount(amcCost, currency)} / ${billingCycle}`);
    }
  }

  // Milestones
  const defaultMilestones = MILESTONE_PRESETS[1].milestones; // 40/30/20/10 sprint
  const calculatedMilestones = calculateMilestoneAmounts(defaultMilestones, Number(finalAmount || 0));

  // Proposal Title: End with "Proposal for <lead name / company name>"
  const allServiceNames = Array.from(new Set([...resolvedServices.map((s) => s.name), ...unmatchedNames]));
  const proposalSuffix = `Proposal for ${clientName}`;
  const title = allServiceNames.length
    ? `${allServiceNames.join(', ')} - ${proposalSuffix}`
    : proposalSuffix;

  // Terms
  const termsParts = resolvedServices
    .map((s) => s.termsAndConditions || s.payload?.termsAndConditions)
    .filter(Boolean);
  const termsAndConditions = termsParts.length
    ? termsParts.join('\n\n')
    : (defaultTermsAndConditions || '');

  return {
    title,
    serviceNames: allServiceNames,
    amount: finalAmount != null && finalAmount !== '' ? String(finalAmount) : '',
    items,
    features: uniqueFeatures,
    scopeOfWork,
    technologyStack,
    timeline,
    milestones: calculatedMilestones,
    paymentInfo: serializeMilestonesToText(calculatedMilestones),
    afterCompletion,
    amcPlan: recommendedAmc ? { ...recommendedAmc } : null,
    nextYearCostSummary: nextYearRows.join('\n'),
    termsAndConditions
  };
}

const STEPS = [
  { id: 1, key: 'info', title: 'Client & Info', icon: FileText, desc: 'Lead, title & charter' },
  { id: 2, key: 'scope', title: 'Scope & Services', icon: Layers, desc: 'Deliverables & features' },
  { id: 3, key: 'tech', title: 'Tech & Delivery', icon: Cpu, desc: 'Architecture & timeline' },
  { id: 4, key: 'commercial', title: 'Commercial & Terms', icon: Calculator, desc: 'Costing, tax & milestones' },
  { id: 5, key: 'legal', title: 'Legal Governance', icon: Scale, desc: 'Annexures & covenants' },
  { id: 6, key: 'review', title: 'Review & Publish', icon: CheckCircle2, desc: 'Summary & PDF export' }
];

function TechBadge({ tech, onRemove = null }) {
  const iconInfo = resolveTechIcon(tech);
  const IconComponent = iconInfo.Icon || DEFAULT_TECHNOLOGY_ICON.Icon;
  const iconColor = iconInfo.color || '#64748b';

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-800 shadow-2xs hover:border-slate-300 transition-all group">
      <IconComponent size={13} style={{ color: iconColor }} className="shrink-0" />
      <span className="truncate max-w-[220px]">{tech}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(tech);
          }}
          className="ml-0.5 text-slate-400 hover:text-red-500 rounded p-0.5 transition-colors cursor-pointer"
          title={`Remove ${tech}`}
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}

const LEGAL_CATEGORIES = [
  'All',
  'General',
  'Contracts',
  'Project Governance',
  'Commercial',
  'Confidentiality',
  'Intellectual Property',
  'Security & Privacy',
  'Operations',
  'Maintenance'
];

function buildInitialLegalAgreements(savedAgreements, masterLegalTerms = [], fallbackTerms = '') {
  const masterList = (Array.isArray(masterLegalTerms) && masterLegalTerms.length > 0)
    ? masterLegalTerms
    : IT_LEGAL_PRESETS.map((p) => ({
        id: p.type,
        name: p.label,
        documentType: p.type,
        category: p.category,
        includeInQuotation: Boolean(p.includeInQuotation),
        content: p.content
      }));

  if (Array.isArray(savedAgreements) && savedAgreements.length > 0) {
    const savedMap = new Map(
      savedAgreements.map((item) => [String(item.id || item.documentType || item.name).toLowerCase(), item])
    );
    return masterList.map((term) => {
      const key1 = String(term.id || '').toLowerCase();
      const key2 = String(term.documentType || '').toLowerCase();
      const key3 = String(term.name || '').toLowerCase();
      const saved = (key1 && savedMap.get(key1)) || (key2 && savedMap.get(key2)) || (key3 && savedMap.get(key3));

      if (saved) {
        return {
          id: term.id,
          name: saved.name || term.name,
          documentType: saved.documentType || term.documentType || 'terms_and_conditions',
          category: saved.category || term.category || 'General',
          enabled: saved.enabled !== undefined ? Boolean(saved.enabled) : Boolean(term.includeInQuotation),
          content: saved.content !== undefined ? saved.content : (term.content || '')
        };
      }

      return {
        id: term.id,
        name: term.name,
        documentType: term.documentType || 'terms_and_conditions',
        category: term.category || 'General',
        enabled: Boolean(term.includeInQuotation),
        content: term.content || ''
      };
    });
  }

  return masterList.map((term) => {
    const isTerms = term.documentType === 'terms_and_conditions' || String(term.name).toLowerCase().includes('terms');
    return {
      id: term.id,
      name: term.name,
      documentType: term.documentType || 'terms_and_conditions',
      category: term.category || 'General',
      enabled: Boolean(term.includeInQuotation),
      content: (isTerms && fallbackTerms?.trim()) ? fallbackTerms : (term.content || '')
    };
  });
}

export function QuotationBuilderModal({
  onClose,
  onSave,
  onAutoSave = null,
  leadId,
  lead = null,
  settings = null,
  quotationMaster = null,
  initialValue = null,
  busy = false,
  serviceOptions = [],
  serviceCatalog = [],
  amcPlans = [],
  legalTerms = [],
  defaultTermsAndConditions = '',
  currency = 'INR',
  defaultAmount = '',
  defaultGstApplicable = false,
  defaultGstRate = 18,
  isModal = false
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    serviceNames: [],
    proposalDate: '',
    validUntil: '',
    amount: '',
    items: [],
    features: [],
    scopeOfWork: '',
    technologyStack: '',
    timeline: '',
    customContent: '',
    paymentInfo: '',
    milestones: [],
    termsAndConditions: '',
    legalAgreements: [],
    afterCompletion: '',
    amcPlan: null,
    nextYearCostSummary: '',
    milestoneTemplate: '',
    discountEnabled: false,
    discountType: 'percent',
    discountValue: '',
    gstApplicable: false,
    gstRate: '18',
    status: 'Draft',
    quotationLink: '',
    comments: ''
  });

  const [featureDraft, setFeatureDraft] = useState('');
  const [selectedFeatureService, setSelectedFeatureService] = useState('');
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [expandedAgreements, setExpandedAgreements] = useState({});
  const [legalCategoryFilter, setLegalCategoryFilter] = useState('All');
  const [legalSearch, setLegalSearch] = useState('');
  const [customMilestone, setCustomMilestone] = useState({ name: '', percentage: '', dueEvent: '' });

  // Service Search & Selection State
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const serviceDropdownRef = useRef(null);

  // Technology Stack Interactive State
  const [techViewTab, setTechViewTab] = useState('tiers'); // 'tiers' | 'services' | 'text'
  const [newTechInput, setNewTechInput] = useState('');
  const [isTechModalOpen, setIsTechModalOpen] = useState(false);
  const [techCategoryFilter, setTechCategoryFilter] = useState('all');

  useEffect(() => {
    function handleClickOutside(event) {
      if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(event.target)) {
        setIsServiceDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isTechModalOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsTechModalOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTechModalOpen]);

  // Live Auto-Save State
  const hasInitializedRef = useRef(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [draftRestoredAt, setDraftRestoredAt] = useState(null);

  const autoSaveDraftKey = useMemo(() => {
    const rawLeadId = lead?.leadNumber || leadId || lead?.id || 'lead';
    const quoteId = initialValue?.id || 'new';
    return `crm_quotation_draft_${rawLeadId}_${quoteId}`;
  }, [lead?.leadNumber, lead?.id, leadId, initialValue?.id]);

  const clientRecord = lead?.convertedClient || lead?.convertedClientId || lead?.clientId || null;
  const isClient = Boolean(clientRecord);
  const targetRoute = useMemo(() => {
    if (isClient && clientRecord) return clientRoute(clientRecord);
    if (lead) return leadRoute(lead);
    return '';
  }, [isClient, clientRecord, lead]);
  const displayName = lead?.companyName || lead?.name || lead?.contactPerson || 'Lead';

  // Initialize or reload formData
  useEffect(() => {
    if (hasInitializedRef.current) return;

    // 1. Check if a live auto-saved draft exists in localStorage
    let savedDraft = null;
    try {
      const stored = localStorage.getItem(autoSaveDraftKey);
      if (stored) {
        savedDraft = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse quotation draft from localStorage:', e);
    }

    if (savedDraft?.formData && !initialValue?.id) {
      const restoredFormData = { ...savedDraft.formData };
      if (restoredFormData.title && /\s+proposal for\s+/i.test(restoredFormData.title) && !restoredFormData.title.includes(' - Proposal for ')) {
        restoredFormData.title = restoredFormData.title.replace(/\s+proposal for\s+/i, ' - Proposal for ');
      }
      setFormData(restoredFormData);
      if (savedDraft.currentStep) {
        setCurrentStep(savedDraft.currentStep);
      }
      setDraftRestoredAt(savedDraft.savedAt);
      setLastSavedAt(savedDraft.savedAt);
      setAutoSaveStatus('saved');
      hasInitializedRef.current = true;
      toast.info(
        `Restored auto-saved live draft (${new Date(savedDraft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        { id: 'quotation-draft-restored', duration: 3500 }
      );
      return;
    }

    if (initialValue?.id || initialValue?.title) {
      const details = initialValue.payload || initialValue;

      // Check if draft has newer modifications
      if (savedDraft?.formData && savedDraft?.savedAt && initialValue.updatedAt && new Date(savedDraft.savedAt) > new Date(initialValue.updatedAt)) {
        setFormData(savedDraft.formData);
        if (savedDraft.currentStep) setCurrentStep(savedDraft.currentStep);
        setDraftRestoredAt(savedDraft.savedAt);
        setLastSavedAt(savedDraft.savedAt);
        setAutoSaveStatus('saved');
        hasInitializedRef.current = true;
        toast.info('Restored more recent auto-saved draft changes');
        return;
      }

      const initialAgreements = buildInitialLegalAgreements(
        details.legalAgreements,
        legalTerms,
        defaultTermsAndConditions
      );

      const parsedMilestones = (Array.isArray(details.milestones) && details.milestones.length > 0)
        ? details.milestones
        : parseMilestonesFromText(details.paymentInfo || details.milestoneTemplate || '', Number(details.amount || 0));

      setFormData({
        title: details.title || '',
        serviceNames: details.serviceNames || [],
        proposalDate: details.proposalDate || details.startDate || new Date().toISOString().slice(0, 10),
        validUntil: details.validUntil || details.endDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        amount: details.amount != null ? String(details.amount) : '',
        items: details.items || [],
        features: (details.features || []).map((feat) => {
          if (typeof feat === 'object' && feat?.text) return feat;
          const str = String(feat || '').trim();
          let matchedSvc = '';
          if (serviceCatalog && serviceCatalog.length) {
            const match = serviceCatalog.find((svc) => {
              const txt = String(svc.featuresText || svc.payload?.featuresText || '');
              return txt.toLowerCase().includes(str.toLowerCase());
            });
            if (match) matchedSvc = match.name;
          }
          if (!matchedSvc && details.serviceNames && details.serviceNames.length === 1) {
            matchedSvc = details.serviceNames[0];
          }
          return {
            text: str,
            serviceName: matchedSvc || (details.serviceNames?.[0] || 'General Scope')
          };
        }),
        scopeOfWork: details.scopeOfWork || '',
        technologyStack: details.technologyStack || '',
        timeline: details.timeline || '',
        customContent: details.customContent || '',
        paymentInfo: details.paymentInfo || '',
        milestones: parsedMilestones,
        termsAndConditions: details.termsAndConditions || defaultTermsAndConditions || '',
        legalAgreements: initialAgreements,
        afterCompletion: details.afterCompletion || '',
        amcPlan: details.amcPlan || null,
        nextYearCostSummary: details.nextYearCostSummary || '',
        milestoneTemplate: details.milestoneTemplate || '',
        discountEnabled: Boolean(details.discountEnabled),
        discountType: details.discountType || 'percent',
        discountValue: details.discountValue ? String(details.discountValue) : '',
        gstApplicable: Boolean(details.gstApplicable ?? defaultGstApplicable),
        gstRate: String(details.gstRate ?? defaultGstRate),
        status: details.status || 'Draft',
        quotationLink: details.quotationLink || '',
        comments: details.comments || ''
      });
      hasInitializedRef.current = true;
      return;
    }

    // Default initialization based on Lead's services & Service Master
    const today = new Date();
    const rawServices = (serviceOptions && serviceOptions.length)
      ? serviceOptions
      : (Array.isArray(lead?.requiredServices) && lead.requiredServices.length
          ? lead.requiredServices
          : (lead?.service ? [lead.service] : []));

    const patch = buildServiceTemplatePatch({
      serviceNames: rawServices,
      serviceCatalog,
      amcPlans,
      lead,
      defaultAmount,
      defaultTermsAndConditions,
      currency
    });

    const initialAgreements = buildInitialLegalAgreements(
      null,
      legalTerms,
      defaultTermsAndConditions
    );

    setFormData((prev) => {
      // If user has already entered custom items or edited title, preserve them
      if (prev.items && prev.items.length > 0 && prev.title && prev.title !== patch.title) {
        return prev;
      }
      return {
        ...prev,
        ...patch,
        proposalDate: today.toISOString().slice(0, 10),
        validUntil: new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10),
        legalAgreements: prev.legalAgreements?.length
          ? buildInitialLegalAgreements(prev.legalAgreements, legalTerms, defaultTermsAndConditions)
          : initialAgreements,
        gstApplicable: Boolean(defaultGstApplicable || lead?.gstInvoiceRequired),
        gstRate: String(defaultGstRate || 18),
        status: 'Draft',
        comments: lead?.notes || lead?.requirements || ''
      };
    });
    hasInitializedRef.current = true;
  }, [
    initialValue,
    serviceOptions,
    serviceCatalog,
    amcPlans,
    legalTerms,
    defaultTermsAndConditions,
    defaultAmount,
    defaultGstApplicable,
    defaultGstRate,
    lead,
    currency,
    autoSaveDraftKey
  ]);

  // Client & Supplier Location Context
  const clientState = lead?.state || lead?.city || '';
  const clientGstin = lead?.gstin || lead?.taxId || '';
  const supplierState = settings?.company?.state || 'Chhattisgarh';

  // Commercial Calculations via Centralized Engine
  const commercialTotals = useMemo(() => {
    return calculateQuotationTotals({
      amount: formData.amount,
      discountEnabled: formData.discountEnabled,
      discountType: formData.discountType,
      discountValue: formData.discountValue,
      gstApplicable: formData.gstApplicable,
      gstRate: formData.gstRate,
      supplierState,
      clientState,
      clientGstin
    });
  }, [formData.amount, formData.discountEnabled, formData.discountType, formData.discountValue, formData.gstApplicable, formData.gstRate, supplierState, clientState, clientGstin]);

  // Milestone Validation & Calculation
  const milestoneValidation = useMemo(() => {
    return validateMilestones(formData.milestones);
  }, [formData.milestones]);

  const calculatedMilestones = useMemo(() => {
    return calculateMilestoneAmounts(formData.milestones, commercialTotals.totalAmount);
  }, [formData.milestones, commercialTotals.totalAmount]);

  // Lead Budget Fit Analysis
  const leadBudget = Number(lead?.estimatedBudget ?? lead?.value ?? 0);
  const budgetFit = useMemo(() => {
    if (!leadBudget || leadBudget <= 0) return null;
    const diff = leadBudget - commercialTotals.totalAmount;
    const pct = Math.round((Math.abs(diff) / leadBudget) * 100);
    return {
      leadBudget,
      diff,
      pct,
      isWithin: diff >= 0,
      label: diff >= 0 ? `Within Budget (by ${formatLeadAmount(diff, currency)})` : `Exceeds Budget (by ${formatLeadAmount(Math.abs(diff), currency)})`
    };
  }, [leadBudget, commercialTotals.totalAmount, currency]);

  // Master Service Rate Helper & Live Search
  const getServicePrice = useCallback((svcName) => {
    const matchedItem = (formData.items || []).find((it) => it.name === svcName || it.name?.toLowerCase() === svcName?.toLowerCase());
    if (matchedItem && (Number(matchedItem.amount) > 0 || Number(matchedItem.rate) > 0)) {
      return Number(matchedItem.amount || (matchedItem.qty * matchedItem.rate));
    }
    const matchedSvc = (serviceCatalog || []).find((s) => s.name === svcName || s.name?.toLowerCase() === svcName?.toLowerCase());
    if (matchedSvc) {
      return Number(matchedSvc.defaultPrice ?? matchedSvc.payload?.defaultPrice ?? 0);
    }
    return 0;
  }, [formData.items, serviceCatalog]);

  const selectedServicesTotalPrice = useMemo(() => {
    return (formData.serviceNames || []).reduce((acc, svcName) => acc + getServicePrice(svcName), 0);
  }, [formData.serviceNames, getServicePrice]);

  const filteredMasterServices = useMemo(() => {
    if (!serviceCatalog || !serviceCatalog.length) return [];
    const selectedSet = new Set((formData.serviceNames || []).map((s) => s.toLowerCase()));
    const q = serviceSearchQuery.trim().toLowerCase();

    return serviceCatalog.filter((svc) => {
      const name = String(svc.name || '').trim();
      if (!name || selectedSet.has(name.toLowerCase())) return false;
      if (!q) return true;
      const cat = String(svc.category || svc.payload?.category || '').toLowerCase();
      const desc = String(svc.description || svc.payload?.description || '').toLowerCase();
      return name.toLowerCase().includes(q) || cat.includes(q) || desc.includes(q);
    });
  }, [serviceCatalog, formData.serviceNames, serviceSearchQuery]);

  // Technology Stack Parsing & Grouping
  const parsedTechItems = useMemo(() => {
    if (!formData.technologyStack?.trim()) return [];
    return Array.from(
      new Set(
        formData.technologyStack
          .split(/[,\n;•·|]+/)
          .map((t) => t.trim())
          .filter(Boolean)
      )
    );
  }, [formData.technologyStack]);

  const techByTier = useMemo(() => {
    const map = {
      frontend: [],
      backend: [],
      database: [],
      cloud: [],
      api: [],
      devops: [],
      others: []
    };

    parsedTechItems.forEach((tech) => {
      const tierId = classifyTechTier(tech);
      if (map[tierId]) {
        map[tierId].push(tech);
      } else {
        map.others.push(tech);
      }
    });

    return map;
  }, [parsedTechItems]);

  const techByService = useMemo(() => {
    const services = formData.serviceNames || [];
    const list = [];
    const matchedTechSet = new Set();

    if (services.length > 0) {
      services.forEach((svcName) => {
        const matchedSvc = (serviceCatalog || []).find(
          (s) => s.name === svcName || s.name?.toLowerCase() === svcName?.toLowerCase()
        );
        const rawTech = matchedSvc?.technologyStack || matchedSvc?.payload?.technologyStack || '';
        const baseTechs = rawTech
          ? rawTech.split(/[,\n;•·|]+/).map((t) => t.trim()).filter(Boolean)
          : [];

        // Find which technologies in parsedTechItems are relevant to this service
        const relevantFromParsed = parsedTechItems.filter((t) =>
          isTechRelevantToService(t, svcName, matchedSvc)
        );

        // Combine: relevant items from parsedTechItems + any baseTechs that were in parsedTechItems
        let svcTechList = Array.from(new Set([
          ...relevantFromParsed,
          ...baseTechs.filter((bt) => parsedTechItems.some((pt) => pt.toLowerCase() === bt.toLowerCase()))
        ]));

        // If no items matched but parsedTechItems has items (and no other service took them)
        if (!svcTechList.length && parsedTechItems.length && !list.length) {
          svcTechList = parsedTechItems.filter((t) => classifyTechTier(t) !== 'others');
        }

        svcTechList.forEach((t) => matchedTechSet.add(t.toLowerCase()));

        list.push({
          serviceName: svcName,
          category: matchedSvc?.category || matchedSvc?.payload?.category || 'Core Service',
          technologies: svcTechList
        });
      });
    }

    // Custom or unmapped technologies grouped under "Others"
    // Standard CRM tier technologies (frontend, backend, database, cloud, api, devops) NEVER go to Others
    const othersTech = parsedTechItems.filter((tech) => {
      const tierId = classifyTechTier(tech);
      return tierId === 'others';
    });

    if (othersTech.length > 0) {
      list.push({
        serviceName: 'Others',
        category: 'Custom & Additional Tech',
        technologies: othersTech,
        isCustom: true
      });
    }

    return list;
  }, [formData.serviceNames, serviceCatalog, parsedTechItems]);

  const handleRemoveTech = useCallback((techToRemove) => {
    setFormData((prev) => {
      const currentList = (prev.technologyStack || '')
        .split(/[,\n;•·|]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const updated = currentList.filter(
        (t) => t.toLowerCase() !== techToRemove.toLowerCase()
      );
      return {
        ...prev,
        technologyStack: updated.join(', ')
      };
    });
  }, []);

  const handleAddTech = useCallback((techToAdd) => {
    if (!techToAdd?.trim()) return;
    const clean = techToAdd.trim();
    setFormData((prev) => {
      const currentList = (prev.technologyStack || '')
        .split(/[,\n;•·|]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (currentList.some((t) => t.toLowerCase() === clean.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        technologyStack: currentList.length ? `${currentList.join(', ')}, ${clean}` : clean
      };
    });
  }, []);

  // All CRM Technologies (from STATIC_TECHNOLOGIES master and serviceCatalog)
  const allCrmTechnologies = useMemo(() => {
    const list = [];
    const seen = new Set();

    (STATIC_TECHNOLOGIES || []).forEach((t) => {
      const name = String(t.name || '').trim();
      const lower = name.toLowerCase();
      if (!lower || seen.has(lower)) return;
      seen.add(lower);
      list.push({
        name,
        category: t.category || t.groups?.[0] || 'General',
        tier: classifyTechTier(name)
      });
    });

    (serviceCatalog || []).forEach((svc) => {
      const raw = svc.technologyStack || svc.payload?.technologyStack || '';
      if (!raw) return;
      raw.split(/[,\n;•·|]+/).forEach((item) => {
        const name = item.trim();
        const lower = name.toLowerCase();
        if (!name || seen.has(lower)) return;
        seen.add(lower);
        list.push({
          name,
          category: svc.category || svc.name || 'Service Tech',
          tier: classifyTechTier(name)
        });
      });
    });

    return list;
  }, [serviceCatalog]);

  const filteredCrmTechnologies = useMemo(() => {
    const query = newTechInput.trim().toLowerCase();
    return allCrmTechnologies.filter((t) => {
      if (techCategoryFilter !== 'all') {
        const matchesTier = t.tier === techCategoryFilter;
        const matchesCat = t.category.toLowerCase().includes(techCategoryFilter.toLowerCase());
        if (!matchesTier && !matchesCat) return false;
      }
      if (!query) return true;
      return t.name.toLowerCase().includes(query) || t.category.toLowerCase().includes(query);
    });
  }, [allCrmTechnologies, newTechInput, techCategoryFilter]);

  // Real-time Live Auto-Save to LocalStorage (debounced 600ms)
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    if (!formData.title && !formData.serviceNames?.length && !formData.items?.length) return;

    setAutoSaveStatus('saving');
    const timer = setTimeout(() => {
      try {
        const payload = {
          formData,
          currentStep,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(autoSaveDraftKey, JSON.stringify(payload));
        setAutoSaveStatus('saved');
        setLastSavedAt(new Date().toISOString());
      } catch (err) {
        console.warn('Live auto-save failed:', err);
        setAutoSaveStatus('error');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [formData, currentStep, autoSaveDraftKey]);

  // Background Server Auto-Sync (if onAutoSave provided, debounced 2500ms)
  useEffect(() => {
    if (!hasInitializedRef.current || !onAutoSave) return;
    if (!formData.title?.trim()) return;

    const serverTimer = setTimeout(() => {
      const quotationData = {
        items: formData.items || [],
        features: formData.features || [],
        scopeOfWork: formData.scopeOfWork || '',
        technologyStack: formData.technologyStack || '',
        timeline: formData.timeline || '',
        customContent: formData.customContent || '',
        paymentInfo: serializeMilestonesToText(formData.milestones),
        milestones: calculatedMilestones,
        termsAndConditions: formData.termsAndConditions || '',
        legalAgreements: formData.legalAgreements || [],
        afterCompletion: formData.afterCompletion || '',
        amcPlan: formData.amcPlan || null,
        nextYearCostSummary: formData.nextYearCostSummary || ''
      };

      onAutoSave({
        title: formData.title.trim(),
        startDate: formData.proposalDate || '',
        endDate: formData.validUntil || '',
        color: '#0891b2',
        labels: ['Quotation', formData.status || 'Draft'],
        serviceNames: formData.serviceNames || [],
        ...quotationData,
        milestoneTemplate: formData.milestoneTemplate || '',
        quotationLink: formData.quotationLink ? formData.quotationLink.trim() : '',
        comments: formData.comments ? formData.comments.trim() : '',
        amount: commercialTotals.subtotal,
        discountType: formData.discountType,
        discountValue: formData.discountValue || 0,
        gstApplicable: Boolean(formData.gstApplicable),
        gstRate: commercialTotals.gstRate,
        subtotal: commercialTotals.subtotal,
        discountAmount: commercialTotals.discountAmount,
        taxableAmount: commercialTotals.taxableAmount,
        taxType: commercialTotals.taxType,
        gstAmount: commercialTotals.gstAmount,
        totalAmount: commercialTotals.totalAmount,
        status: 'Draft'
      });
    }, 2500);

    return () => clearTimeout(serverTimer);
  }, [formData, commercialTotals, calculatedMilestones, onAutoSave]);

  function handleDiscardDraft() {
    if (!window.confirm('Discard auto-saved draft and reload template defaults from the Lead?')) return;
    try {
      localStorage.removeItem(autoSaveDraftKey);
    } catch (e) {}
    setDraftRestoredAt(null);
    setAutoSaveStatus('idle');
    setLastSavedAt(null);
    handleAutoFillFromLead();
  }

  function setField(key, value) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  // 1-Click Auto-Fill from Lead Requirements & Service Master
  function handleAutoFillFromLead() {
    if (!lead) return;
    const today = new Date();
    const rawServices = (serviceOptions && serviceOptions.length)
      ? serviceOptions
      : (Array.isArray(lead.requiredServices) && lead.requiredServices.length
          ? lead.requiredServices
          : (lead.service ? [lead.service] : []));

    const patch = buildServiceTemplatePatch({
      serviceNames: rawServices,
      serviceCatalog,
      amcPlans,
      lead,
      defaultAmount,
      defaultTermsAndConditions,
      currency
    });

    setFormData((prev) => ({
      ...prev,
      ...patch,
      proposalDate: today.toISOString().slice(0, 10),
      validUntil: new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10),
      gstApplicable: Boolean(lead.gstInvoiceRequired ?? prev.gstApplicable),
      comments: prev.comments || lead.notes || lead.requirements || ''
    }));
    toast.success('Quotation pre-filled from Lead data & Service Master!');
  }

  function handleAddService(serviceName) {
    if (!serviceName) return;
    const currentNames = formData.serviceNames || [];
    if (currentNames.includes(serviceName)) return;
    const nextNames = [...currentNames, serviceName];
    const patch = buildServiceTemplatePatch({
      serviceNames: nextNames,
      serviceCatalog,
      amcPlans,
      lead,
      defaultAmount,
      defaultTermsAndConditions,
      currency
    });
    setFormData((prev) => ({
      ...prev,
      ...patch
    }));
    toast.success(`Added ${serviceName} & updated deliverables!`);
  }

  function handleRemoveService(serviceName) {
    const nextNames = (formData.serviceNames || []).filter((s) => s !== serviceName);
    const patch = buildServiceTemplatePatch({
      serviceNames: nextNames,
      serviceCatalog,
      amcPlans,
      lead,
      defaultAmount,
      defaultTermsAndConditions,
      currency
    });
    setFormData((prev) => ({
      ...prev,
      ...patch
    }));
    toast.info(`Removed ${serviceName}`);
  }

  // 1-Click Package Preset Loader (Replaces schedule cleanly!)
  function handleApplyPackagePreset(preset) {
    const today = new Date();
    const clientName = lead?.companyName || lead?.name || 'Client';
    const items = (preset.items || []).map((it, idx) => ({ ...it, id: `pkg-item-${idx + 1}` }));
    const parsedSchedule = parseMilestonesFromText(preset.milestoneTemplate, preset.amount);

    setFormData((prev) => ({
      ...prev,
      title: `${preset.title} - Proposal for ${clientName}`,
      serviceNames: Array.from(new Set([...prev.serviceNames, ...preset.serviceNames])),
      amount: String(preset.amount),
      items,
      proposalDate: today.toISOString().slice(0, 10),
      validUntil: new Date(today.getTime() + (preset.validityDays || 30) * 86400000).toISOString().slice(0, 10),
      gstApplicable: preset.gstApplicable,
      gstRate: String(preset.gstRate || 18),
      milestoneTemplate: preset.milestoneTemplate,
      milestones: parsedSchedule.length ? parsedSchedule : prev.milestones,
      paymentInfo: preset.milestoneTemplate,
      termsAndConditions: preset.terms || prev.termsAndConditions
    }));
    toast.success(`Loaded "${preset.name}" preset (${formatLeadAmount(preset.amount, currency)})`);
  }

  // Deliverables Line Items
  function addDeliverableItem() {
    setFormData((prev) => {
      const nextItems = [
        ...(prev.items || []),
        { id: `item-${Date.now()}`, name: '', description: '', qty: 1, rate: 0, amount: 0 }
      ];
      return { ...prev, items: nextItems };
    });
  }

  function updateDeliverableItem(index, key, value) {
    setFormData((prev) => {
      const nextItems = [...(prev.items || [])];
      const item = { ...nextItems[index], [key]: value };
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      item.amount = qty * rate;
      nextItems[index] = item;
      const totalFromItems = nextItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      return {
        ...prev,
        items: nextItems,
        amount: totalFromItems > 0 ? String(totalFromItems) : prev.amount
      };
    });
  }

  function removeDeliverableItem(index) {
    setFormData((prev) => {
      const nextItems = (prev.items || []).filter((_, i) => i !== index);
      const totalFromItems = nextItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      return {
        ...prev,
        items: nextItems,
        amount: totalFromItems > 0 ? String(totalFromItems) : prev.amount
      };
    });
  }

  const availableFeatureServices = useMemo(() => {
    const list = Array.from(new Set(formData.serviceNames || [])).filter(Boolean);
    if (!list.length) return ['General Scope'];
    return list;
  }, [formData.serviceNames]);

  const groupedFeatures = useMemo(() => {
    const rawList = formData.features || [];
    const groups = new Map();

    // 1. Initialize groups for all selected services first
    (formData.serviceNames || []).forEach((sName) => {
      if (sName && !groups.has(sName)) {
        groups.set(sName, []);
      }
    });

    // 2. Put features into their corresponding service group
    rawList.forEach((feat, index) => {
      const defaultSvc = formData.serviceNames?.[0] || 'General Scope';
      const text = typeof feat === 'string' ? feat : (feat.text || '');
      let sName = (typeof feat === 'object' && feat.serviceName) ? feat.serviceName : '';
      if (!sName && serviceCatalog && serviceCatalog.length) {
        const match = serviceCatalog.find((svc) => {
          const txt = String(svc.featuresText || svc.payload?.featuresText || '');
          return txt.toLowerCase().includes(text.toLowerCase());
        });
        if (match) sName = match.name;
      }
      const finalService = sName || defaultSvc;
      if (!groups.has(finalService)) {
        groups.set(finalService, []);
      }
      groups.get(finalService).push({
        text,
        serviceName: finalService,
        globalIndex: index
      });
    });

    return Array.from(groups.entries()).filter(([_, feats]) => feats.length > 0);
  }, [formData.features, formData.serviceNames, serviceCatalog]);

  // Feature Tags
  function addFeature() {
    const val = cleanSingleLine(featureDraft);
    if (!val) return;
    const targetService = selectedFeatureService || availableFeatureServices[0] || 'General Scope';
    const newFeature = { text: val, serviceName: targetService };
    setFormData((prev) => {
      const currentList = prev.features || [];
      if (currentList.some((f) => (typeof f === 'string' ? f === val : (f.text === val && f.serviceName === targetService)))) {
        return prev;
      }
      return {
        ...prev,
        features: [...currentList, newFeature]
      };
    });
    setFeatureDraft('');
  }

  function removeFeature(index) {
    setFormData((prev) => ({
      ...prev,
      features: (prev.features || []).filter((_, i) => i !== index)
    }));
  }

  // Milestone Presets (Cleanly REPLACES active schedule)
  function applyMilestonePreset(preset) {
    setFormData((prev) => ({
      ...prev,
      milestones: [...preset.milestones],
      milestoneTemplate: preset.name,
      paymentInfo: serializeMilestonesToText(preset.milestones)
    }));
    toast.success(`Applied ${preset.name}`);
  }

  function addCustomMilestone() {
    const pct = Number(customMilestone.percentage);
    if (!customMilestone.name.trim() || isNaN(pct) || pct <= 0) {
      toast.error('Enter a valid milestone name and positive percentage');
      return;
    }
    const newMs = {
      id: `ms-${Date.now()}`,
      name: customMilestone.name.trim(),
      percentage: pct,
      dueEvent: customMilestone.dueEvent.trim() || customMilestone.name.trim()
    };
    const nextList = [...(formData.milestones || []), newMs];
    setFormData((prev) => ({
      ...prev,
      milestones: nextList,
      paymentInfo: serializeMilestonesToText(nextList)
    }));
    setCustomMilestone({ name: '', percentage: '', dueEvent: '' });
  }

  function removeMilestone(index) {
    const nextList = (formData.milestones || []).filter((_, i) => i !== index);
    setFormData((prev) => ({
      ...prev,
      milestones: nextList,
      paymentInfo: serializeMilestonesToText(nextList)
    }));
  }

  // Legal Agreements
  function toggleAgreement(index) {
    setFormData((prev) => {
      const list = [...(prev.legalAgreements || [])];
      if (list[index]) {
        list[index] = { ...list[index], enabled: !list[index].enabled };
      }
      return { ...prev, legalAgreements: list };
    });
  }

  function updateAgreementContent(index, newContent) {
    setFormData((prev) => {
      const list = [...(prev.legalAgreements || [])];
      if (list[index]) {
        list[index] = { ...list[index], content: newContent };
      }
      return { ...prev, legalAgreements: list };
    });
  }

  function toggleAllAgreements(enableAll) {
    setFormData((prev) => ({
      ...prev,
      legalAgreements: (prev.legalAgreements || []).map((a) => ({ ...a, enabled: enableAll }))
    }));
    toast.success(enableAll ? 'Included all legal agreements in proposal' : 'Excluded all legal agreements from proposal');
  }

  function resetAllAgreementsFromMaster() {
    const fresh = buildInitialLegalAgreements(null, legalTerms, defaultTermsAndConditions);
    setFormData((prev) => ({
      ...prev,
      legalAgreements: fresh
    }));
    toast.success('Reset all legal agreements to master defaults');
  }

  function resetAgreementToDefault(index) {
    setFormData((prev) => {
      const list = [...(prev.legalAgreements || [])];
      const item = list[index];
      if (!item) return prev;

      const masterList = (Array.isArray(legalTerms) && legalTerms.length > 0)
        ? legalTerms
        : IT_LEGAL_PRESETS.map((p) => ({
            id: p.type,
            name: p.label,
            documentType: p.type,
            category: p.category,
            includeInQuotation: Boolean(p.includeInQuotation),
            content: p.content
          }));

      const master = masterList.find((t) =>
        String(t.id).toLowerCase() === String(item.id).toLowerCase() ||
        String(t.documentType).toLowerCase() === String(item.documentType).toLowerCase() ||
        String(t.name).toLowerCase() === String(item.name).toLowerCase()
      );

      if (master) {
        list[index] = { ...list[index], content: master.content || '' };
        toast.success(`Reset "${item.name}" to template default`);
      } else {
        toast.info(`No default template found for "${item.name}"`);
      }
      return { ...prev, legalAgreements: list };
    });
  }

  // Open Preview / Print
  function openPreview({ print = false } = {}) {
    const previewKey = lead?.leadNumber || lead?.id || `draft_${Date.now()}`;
    const refNumber = lead?.leadNumber ? `WBT-${lead.leadNumber}` : `WBT-PROP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const previewPayload = {
      formData: {
        ...formData,
        milestones: calculatedMilestones
      },
      lead,
      settings,
      quotationMaster,
      proposalTitle: formData.title.trim() || 'Statement of Work & Commercial Proposal',
      serviceSummary: (formData.serviceNames || []).join(', '),
      currency,
      quotationTotals: commercialTotals,
      refNumber,
      savedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(`crm_quotation_preview_${previewKey}`, JSON.stringify(previewPayload));
      localStorage.setItem('crm_quotation_preview_latest', JSON.stringify(previewPayload));
    } catch (err) {
      console.warn('Failed to store preview in localStorage:', err);
    }

    const previewUrl = `#/quotations/preview?key=${encodeURIComponent(previewKey)}${print ? '&print=1' : ''}`;
    const outputTab = window.open(previewUrl, '_blank');
    if (!outputTab) {
      toast.error('Unable to open preview tab. Please allow popups for this site.');
    }
  }

  // Submit & Save
  async function handleSubmit(e) {
    if (e) e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Please enter a proposal title in Step 1');
      setCurrentStep(1);
      return;
    }

    if (!milestoneValidation.isValid) {
      toast.error(milestoneValidation.error);
      setCurrentStep(4);
      return;
    }

    const title = formData.title.trim();
    const serviceSummary = (formData.serviceNames || []).join(', ');
    const defaultTermsMatch = (formData.legalAgreements || []).find(
      (a) => a.enabled && (a.documentType === 'terms_and_conditions' || String(a.name || '').toLowerCase().includes('terms'))
    );

    const quotationData = {
      items: formData.items || [],
      features: formData.features || [],
      scopeOfWork: formData.scopeOfWork || '',
      technologyStack: formData.technologyStack || '',
      timeline: formData.timeline || '',
      customContent: formData.customContent || '',
      paymentInfo: serializeMilestonesToText(formData.milestones),
      milestones: calculatedMilestones,
      termsAndConditions: defaultTermsMatch?.content || formData.termsAndConditions || '',
      legalAgreements: formData.legalAgreements || [],
      afterCompletion: formData.afterCompletion || '',
      amcPlan: formData.amcPlan || null,
      nextYearCostSummary: formData.nextYearCostSummary || ''
    };

    const description = [
      serviceSummary ? `Service: ${cleanSingleLine(serviceSummary)}` : '',
      `Amount: ${commercialTotals.subtotal}`,
      formData.items?.length ? `Items JSON: ${JSON.stringify(formData.items)}` : '',
      formData.milestoneTemplate ? `Milestone Template: ${cleanSingleLine(formData.milestoneTemplate)}` : '',
      `Quotation Data JSON: ${JSON.stringify(quotationData)}`,
      formData.legalAgreements?.length ? `Legal Agreements JSON: ${JSON.stringify(formData.legalAgreements)}` : '',
      `Discount Type: ${formData.discountType || 'percent'}`,
      `Discount Value: ${formData.discountValue || 0}`,
      `GST Applicable: ${formData.gstApplicable ? 'Yes' : 'No'}`,
      `GST Rate: ${formData.gstApplicable ? commercialTotals.gstRate : 0}`,
      `Tax Type: ${commercialTotals.taxType}`,
      `Total Amount: ${commercialTotals.totalAmount}`,
      `Status: ${formData.status || 'Draft'}`,
      formData.quotationLink.trim() ? `Quotation Link: ${cleanSingleLine(formData.quotationLink)}` : '',
      formData.comments.trim() ? `Comments: ${cleanSingleLine(formData.comments)}` : ''
    ].filter(Boolean).join('\n');

    await onSave({
      leadId,
      eventType: 'quotation',
      title,
      description,
      startDate: formData.proposalDate || '',
      endDate: formData.validUntil || '',
      color: '#0891b2',
      labels: ['Quotation', formData.status || 'Draft'],
      serviceNames: formData.serviceNames || [],
      ...quotationData,
      milestoneTemplate: formData.milestoneTemplate || '',
      quotationLink: formData.quotationLink.trim(),
      comments: formData.comments.trim(),
      amount: commercialTotals.subtotal,
      discountType: formData.discountType,
      discountValue: formData.discountValue || 0,
      gstApplicable: Boolean(formData.gstApplicable),
      gstRate: commercialTotals.gstRate,
      subtotal: commercialTotals.subtotal,
      discountAmount: commercialTotals.discountAmount,
      taxableAmount: commercialTotals.taxableAmount,
      taxType: commercialTotals.taxType,
      gstAmount: commercialTotals.gstAmount,
      totalAmount: commercialTotals.totalAmount
    });
    try {
      localStorage.removeItem(autoSaveDraftKey);
    } catch (e) {}
  }

  const generatedWhatsAppPitch = useMemo(() => {
    return buildWhatsAppProposalPitch({
      leadName: lead?.contactPerson || lead?.name,
      companyName: lead?.companyName,
      proposalTitle: formData.title,
      serviceSummary: (formData.serviceNames || []).join(', '),
      totalAmount: commercialTotals.totalAmount,
      currency,
      validityDate: formData.validUntil
    });
  }, [lead, formData.title, formData.serviceNames, commercialTotals.totalAmount, currency, formData.validUntil]);

  const filteredAgreements = useMemo(() => {
    const list = formData.legalAgreements || [];
    return list
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => {
        if (legalCategoryFilter !== 'All' && item.category !== legalCategoryFilter) {
          return false;
        }
        if (legalSearch.trim()) {
          const q = legalSearch.toLowerCase().trim();
          const matchName = String(item.name || '').toLowerCase().includes(q);
          const matchCat = String(item.category || '').toLowerCase().includes(q);
          const matchContent = String(item.content || '').toLowerCase().includes(q);
          if (!matchName && !matchCat && !matchContent) return false;
        }
        return true;
      });
  }, [formData.legalAgreements, legalCategoryFilter, legalSearch]);

  const legalCategories = useMemo(() => {
    const dynamicCats = (formData.legalAgreements || []).map((a) => a.category).filter(Boolean);
    const set = new Set([...LEGAL_CATEGORIES, ...dynamicCats]);
    return Array.from(set);
  }, [formData.legalAgreements]);

  const builderContent = (
    <div className={`flex flex-col w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-900 font-sans ${isModal ? 'max-w-6xl max-h-[94vh]' : ''}`}>
      {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center text-white shadow-md shadow-[var(--primary)]/20">
              <FileText size={20} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                {targetRoute && displayName ? (
                  <div className="relative group/lead-tooltip">
                    <Link
                      to={targetRoute}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-800 hover:text-[var(--primary)] hover:border-[var(--primary)]/50 hover:bg-slate-50 transition-all shadow-xs group cursor-pointer"
                    >
                      {isClient ? (
                        <Building size={14} className="text-emerald-600 shrink-0" />
                      ) : (
                        <User size={14} className="text-[var(--primary)] shrink-0" />
                      )}
                      <span className="font-bold text-slate-900 group-hover:text-[var(--primary)]">{displayName}</span>
                      {lead?.leadNumber && (
                        <span className="text-xs text-slate-400 group-hover:text-slate-500 font-mono">
                          ({lead.leadNumber})
                        </span>
                      )}
                      <ExternalLink size={12} className="text-slate-400 group-hover:text-[var(--primary)] shrink-0" />
                    </Link>

                    {/* Rich Hover Details Tooltip */}
                    <div className="absolute left-0 top-full mt-2 z-50 w-80 sm:w-96 p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xl opacity-0 invisible group-hover/lead-tooltip:opacity-100 group-hover/lead-tooltip:visible transition-all duration-200 pointer-events-none group-hover/lead-tooltip:pointer-events-auto divide-y divide-slate-100 text-left">
                      {/* Little Pointer Arrow */}
                      <div className="absolute -top-1.5 left-6 w-3 h-3 bg-white border-t border-l border-slate-200 rotate-45" />

                      {/* Header */}
                      <div className="pb-3 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isClient ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                            {isClient ? <Building size={18} /> : <User size={18} />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {lead?.companyName || lead?.name || displayName}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {lead?.leadNumber && (
                                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {lead.leadNumber}
                                </span>
                              )}
                              {lead?.status && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  {lead.status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="py-2.5 space-y-2 text-xs">
                        {/* Contact Person */}
                        {(lead?.contactPerson || lead?.name) && (
                          <div className="flex items-center justify-between text-slate-700">
                            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                              <User size={12} className="text-blue-500" /> Contact Person:
                            </span>
                            <span className="font-semibold text-slate-800 truncate max-w-[190px]">
                              {lead.contactPerson || lead.name}
                            </span>
                          </div>
                        )}

                        {/* Mobile / Phone */}
                        {(lead?.phone || lead?.mobile) && (
                          <div className="flex items-center justify-between text-slate-700">
                            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                              <Phone size={12} className="text-emerald-500" /> Mobile:
                            </span>
                            <span className="font-semibold font-mono text-slate-800">
                              {lead.phone || lead.mobile}
                            </span>
                          </div>
                        )}

                        {/* Email */}
                        {lead?.email && (
                          <div className="flex items-center justify-between text-slate-700">
                            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                              <Mail size={12} className="text-indigo-500" /> Email:
                            </span>
                            <span className="font-medium text-slate-800 truncate max-w-[190px]">
                              {lead.email}
                            </span>
                          </div>
                        )}

                        {/* Estimated Budget */}
                        {(lead?.estimatedBudget || lead?.budget) && (
                          <div className="flex items-center justify-between text-slate-700">
                            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                              <DollarSign size={12} className="text-amber-500" /> Estimated Budget:
                            </span>
                            <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded text-[11px]">
                              {formatLeadAmount(lead.estimatedBudget || lead.budget, currency)}
                            </span>
                          </div>
                        )}

                        {/* Created Date */}
                        {lead?.createdAt && (
                          <div className="flex items-center justify-between text-slate-700">
                            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                              <Calendar size={12} className="text-purple-500" /> Created Date:
                            </span>
                            <span className="font-medium text-slate-700 text-[11px]">
                              {formatRelativeDate(lead.createdAt)}
                            </span>
                          </div>
                        )}

                        {/* Requirement / Services */}
                        {(lead?.serviceName || lead?.requirements) && (
                          <div className="flex items-center justify-between text-slate-700">
                            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                              <Layers size={12} className="text-blue-500" /> Requirement:
                            </span>
                            <span className="font-medium text-slate-800 truncate max-w-[190px]">
                              {lead.serviceName || lead.requirements}
                            </span>
                          </div>
                        )}

                        {/* Source */}
                        {lead?.source && (
                          <div className="flex items-center justify-between text-slate-700">
                            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                              <Globe2 size={12} className="text-sky-500" /> Source:
                            </span>
                            <span className="font-medium text-slate-700 text-[11px]">
                              {lead.source}
                            </span>
                          </div>
                        )}

                        {/* Location */}
                        {(lead?.city || lead?.state) && (
                          <div className="flex items-center justify-between text-slate-700">
                            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                              <MapPin size={12} className="text-rose-500" /> Location:
                            </span>
                            <span className="font-medium text-slate-700 text-[11px]">
                              {[lead.city, lead.state].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}

                        {/* Assigned To */}
                        {(lead?.assignedTo?.name || lead?.assignedToName) && (
                          <div className="flex items-center justify-between text-slate-700">
                            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                              <Briefcase size={12} className="text-slate-500" /> Assigned Rep:
                            </span>
                            <span className="font-medium text-slate-700 text-[11px]">
                              {lead.assignedTo?.name || lead.assignedToName}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Footer Link Hint */}
                      <div className="pt-2 text-[10.5px] text-slate-400 flex items-center justify-between">
                        <span>Click pill to open full lead profile</span>
                        <ExternalLink size={10} className="text-slate-400" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight shrink-0">
                    {initialValue?.id ? 'Edit Quotation' : 'Quotation'}
                  </h2>
                )}

                {/* Minimal 1-Click Auto-Fill Button */}
                {lead && (
                  <button
                    type="button"
                    onClick={handleAutoFillFromLead}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/90 transition-colors shadow-2xs cursor-pointer"
                    title="Auto-fill quotation data from linked lead requirements & service master"
                  >
                    <Sparkles size={12} className="text-blue-600" />
                    <span>Auto-Fill</span>
                  </button>
                )}

                {/* Live Auto-Save Status Badge */}
                {autoSaveStatus === 'saving' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                    <RefreshCw size={11} className="animate-spin text-amber-600" />
                    <span>Auto-saving live...</span>
                  </span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                    title={lastSavedAt ? `Auto-saved live at ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Live auto-save active'}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Auto-saved live {lastSavedAt ? `(${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})` : ''}</span>
                  </span>
                )}
                {draftRestoredAt && (
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors cursor-pointer"
                    title="Discard auto-saved draft and reload lead template defaults"
                  >
                    <RotateCcw size={11} />
                    <span>Reset Draft</span>
                  </button>
                )}
              </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openPreview({ print: false })}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50"
            >
              <Eye size={14} className="text-blue-600" /> Live Preview
            </Button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              title="Close"
              aria-label="Close"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* 6-Step Navigation Tabs */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-200 shrink-0 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[700px]">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isPast = currentStep > step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center gap-2.5 py-2 px-3 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-50/90 text-blue-800 font-bold border border-blue-200 shadow-xs'
                      : isPast
                      ? 'text-slate-700 hover:bg-slate-100 font-medium'
                      : 'text-slate-400 hover:bg-slate-50 font-normal'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    isActive
                      ? 'bg-[var(--primary)] text-white'
                      : isPast
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {isPast ? <Check size={14} /> : step.id}
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-none">{step.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-none">{step.desc}</div>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <ChevronRight size={14} className="text-slate-300 ml-1 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Body: Step Editor & Persistent Summary */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#f8fafc]">
          
          {/* Main Step Content Area (Cols 1-8) */}
          <div className="lg:col-span-8 space-y-5">

            {/* ========================================================================= */}
            {/* STEP 1: CLIENT & PROJECT INFORMATION                                      */}
            {/* ========================================================================= */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <Card className="p-5 bg-white border-slate-200 shadow-2xs space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <FileText size={16} className="text-blue-600" />
                      Proposal Charter &amp; Identification
                    </h3>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>Proposal Title *</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        Ends with &ldquo;Proposal for {lead?.companyName || lead?.name || 'Client'}&rdquo;
                      </span>
                    </label>
                    <textarea
                      rows={2}
                      className="w-full px-3 py-2 text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none shadow-2xs leading-relaxed"
                      placeholder={`e.g. Services - Proposal for ${lead?.companyName || lead?.name || 'Client'}`}
                      value={formData.title}
                      onChange={(e) => setField('title', e.target.value)}
                    />
                  </div>

                  {/* Selected Services Card with Search & Features-like Layout */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Layers size={14} className="text-blue-600" />
                          Selected Services ({(formData.serviceNames || []).length})
                        </label>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Add or remove services from Service Master with their commercial rates
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        {(formData.serviceNames || []).length} {(formData.serviceNames || []).length === 1 ? 'service' : 'services'}
                        {selectedServicesTotalPrice > 0 && ` • ${formatLeadAmount(selectedServicesTotalPrice, currency)}`}
                      </span>
                    </div>

                    {/* Search & Add Service Row */}
                    <div className="relative" ref={serviceDropdownRef}>
                      <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                        <div className="relative flex-1">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <Input
                            className="h-8.5 text-xs pl-8.5 pr-3 rounded-lg border-slate-300 bg-white w-full"
                            placeholder="Search and add service from Master (e.g. Website, Mobile App, SEO, AMC)..."
                            value={serviceSearchQuery}
                            onChange={(e) => {
                              setServiceSearchQuery(e.target.value);
                              setIsServiceDropdownOpen(true);
                            }}
                            onFocus={() => setIsServiceDropdownOpen(true)}
                          />
                        </div>
                        {serviceSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setServiceSearchQuery('');
                              setIsServiceDropdownOpen(false);
                            }}
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                            title="Clear search"
                          >
                            <X size={14} />
                          </button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => setIsServiceDropdownOpen((prev) => !prev)}
                          className="h-8.5 px-3 rounded-lg text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border-slate-300 shrink-0 inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <PlusCircle size={14} className="text-blue-600" />
                          <span>Browse Services</span>
                        </Button>
                      </div>

                      {/* Search Suggestions Dropdown */}
                      {isServiceDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
                          {filteredMasterServices.length > 0 ? (
                            filteredMasterServices.map((svc) => {
                              const sPrice = Number(svc.defaultPrice ?? svc.payload?.defaultPrice ?? 0);
                              return (
                                <button
                                  key={svc.id || svc.name}
                                  type="button"
                                  onClick={() => {
                                    handleAddService(svc.name);
                                    setServiceSearchQuery('');
                                    setIsServiceDropdownOpen(false);
                                  }}
                                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-blue-50/70 transition-colors text-xs group cursor-pointer"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                                    <div className="min-w-0">
                                      <div className="font-bold text-slate-900 group-hover:text-blue-700 truncate">
                                        {svc.name}
                                      </div>
                                      {(svc.category || svc.timeline) && (
                                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                          {svc.category && <span>{svc.category}</span>}
                                          {svc.category && svc.timeline && <span>•</span>}
                                          {svc.timeline && <span>{svc.timeline}</span>}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2.5 shrink-0">
                                    {sPrice > 0 && (
                                      <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                                        {formatLeadAmount(sPrice, currency)}
                                      </span>
                                    )}
                                    <span className="text-xs font-bold text-blue-600 group-hover:underline inline-flex items-center gap-0.5">
                                      + Add
                                    </span>
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="p-4 text-center text-xs text-slate-400">
                              {serviceCatalog.length === 0
                                ? 'No services found in Service Master catalog'
                                : 'All matching services are already added'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Features-like 2-Column Grid of Selected Services with Prices */}
                    {(formData.serviceNames || []).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-0.5">
                        {(formData.serviceNames || []).map((svcName) => {
                          const price = getServicePrice(svcName);
                          return (
                            <div
                              key={svcName}
                              className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/80 hover:bg-blue-50/40 border border-slate-200/80 transition-all shadow-2xs group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                                <span className="text-xs font-bold text-slate-900 truncate" title={svcName}>
                                  {svcName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {price > 0 && (
                                  <span className="font-mono font-bold text-xs text-emerald-700 bg-white border border-emerald-200 px-2 py-0.5 rounded-md shadow-2xs">
                                    {formatLeadAmount(price, currency)}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveService(svcName)}
                                  className="text-slate-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                                  title={`Remove ${svcName}`}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                        <p className="text-xs text-slate-400">No services selected. Search and add services from Service Master above.</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Proposal Issue Date</label>
                      <Input
                        type="date"
                        className="h-10 text-xs"
                        value={formData.proposalDate}
                        onChange={(e) => setField('proposalDate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Quotation Validity Until</label>
                      <Input
                        type="date"
                        className="h-10 text-xs"
                        value={formData.validUntil}
                        onChange={(e) => setField('validUntil', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Quotation Status</label>
                      <select
                        className="w-full h-10 px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.status}
                        onChange={(e) => setField('status', e.target.value)}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Internal Review">Internal Review</option>
                        <option value="Approved for Issue">Approved for Issue</option>
                        <option value="Sent">Sent to Client</option>
                        <option value="Accepted">Accepted / Won</option>
                        <option value="Declined">Declined</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Target Delivery Timeline</label>
                      <Input
                        className="h-10 text-xs"
                        placeholder="e.g. 4 - 6 Weeks (Standard Sprints)"
                        value={formData.timeline}
                        onChange={(e) => setField('timeline', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-bold text-slate-700">Client Requirements &amp; Project Background</label>
                    <textarea
                      rows={3}
                      className="w-full p-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Outline client objectives, pain points, or specific technical criteria..."
                      value={formData.comments}
                      onChange={(e) => setField('comments', e.target.value)}
                    />
                  </div>
                </Card>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 2: SERVICES, SCOPE & DELIVERABLES                                    */}
            {/* ========================================================================= */}
            {currentStep === 2 && (
              <div className="space-y-5">
                {/* 1-Click Agency Packages */}
                <Card className="p-4 bg-white border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" />
                      1-Click Industry Solution Packages
                    </span>
                    <span className="text-[11px] text-slate-400">Replaces scope &amp; schedule automatically</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {QUOTATION_PACKAGE_PRESETS.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => handleApplyPackagePreset(pkg)}
                        className="p-3 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded">
                            {pkg.badge}
                          </span>
                          <span className="text-xs font-extrabold text-slate-900 font-mono">
                            {formatLeadAmount(pkg.amount, currency)}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 truncate">
                          {pkg.name}
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>

                {/* Deliverables Line Items Table */}
                <Card className="p-5 bg-white border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <Layers size={16} className="text-blue-600" />
                        Commercial Deliverables &amp; Work Breakdown
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Itemized modules contributing to the project investment</p>
                    </div>
                    <Button
                      type="button"
                      size="xs"
                      onClick={addDeliverableItem}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer shadow-xs"
                    >
                      <Plus size={13} className="mr-1" /> Add Deliverable Item
                    </Button>
                  </div>

                  {formData.items?.length > 0 ? (
                    <div className="space-y-3">
                      {formData.items.map((item, idx) => (
                        <div key={item.id || idx} className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5">
                          <div className="flex items-start gap-2.5">
                            <span className="w-6 h-6 rounded-md bg-slate-200 text-slate-700 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-1">
                              {idx + 1}
                            </span>
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                              <div className="sm:col-span-6">
                                <Input
                                  className="h-9 text-xs font-bold"
                                  placeholder="Deliverable module name (e.g. Mobile UI Design System)"
                                  value={item.name}
                                  onChange={(e) => updateDeliverableItem(idx, 'name', e.target.value)}
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <Input
                                  type="number"
                                  className="h-9 text-xs"
                                  placeholder="Qty"
                                  value={item.qty || 1}
                                  onChange={(e) => updateDeliverableItem(idx, 'qty', e.target.value)}
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <Input
                                  type="number"
                                  className="h-9 text-xs font-mono"
                                  placeholder="Rate (₹)"
                                  value={item.rate || 0}
                                  onChange={(e) => updateDeliverableItem(idx, 'rate', e.target.value)}
                                />
                              </div>
                              <div className="sm:col-span-2 flex items-center justify-between">
                                <span className="font-mono font-bold text-xs text-slate-900">
                                  {formatLeadAmount(item.amount || (item.qty * item.rate), currency)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeDeliverableItem(idx)}
                                  className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                          <Input
                            className="h-8 text-[11px] text-slate-600 bg-white"
                            placeholder="Detailed deliverable specification, inclusions, and handoff criteria..."
                            value={item.description}
                            onChange={(e) => updateDeliverableItem(idx, 'description', e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                      <p className="text-xs text-slate-500 mb-2">No line-item deliverables added yet.</p>
                      <Button type="button" size="xs" variant="outline" onClick={addDeliverableItem}>
                        <Plus size={13} className="mr-1" /> Add First Deliverable
                      </Button>
                    </div>
                  )}

                </Card>

                {/* Complete Feature List Card (Service-wise & Compact) */}
                <Card className="p-5 bg-white border-slate-200 shadow-2xs space-y-3.5 rounded-2xl">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <Layers size={16} className="text-blue-600" />
                        Complete Feature List
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Grouped service-wise from Service Master. Add or remove features for this quotation.
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                      {formData.features?.length || 0} features • {groupedFeatures.length} {groupedFeatures.length === 1 ? 'service' : 'services'}
                    </span>
                  </div>

                  {/* Compact Add Feature Input Row */}
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                    {availableFeatureServices.length > 1 && (
                      <select
                        value={selectedFeatureService || availableFeatureServices[0] || ''}
                        onChange={(e) => setSelectedFeatureService(e.target.value)}
                        className="h-8 px-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0 max-w-[200px] truncate"
                      >
                        {availableFeatureServices.map((svc) => (
                          <option key={svc} value={svc}>{svc}</option>
                        ))}
                      </select>
                    )}
                    <Input
                      className="h-8 text-xs px-3 rounded-lg border-slate-300 bg-white flex-1"
                      placeholder={`Add extra feature to ${selectedFeatureService || availableFeatureServices[0] || 'service'}...`}
                      value={featureDraft}
                      onChange={(e) => setFeatureDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addFeature();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={addFeature}
                      className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border-slate-300 shrink-0 inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <PlusCircle size={14} className="text-slate-600" />
                      <span>Add feature</span>
                    </Button>
                  </div>

                  {/* Service-wise Grouped Feature Sections */}
                  {groupedFeatures.length > 0 ? (
                    <div className="space-y-3 pt-1">
                      {groupedFeatures.map(([serviceName, feats]) => (
                        <div
                          key={serviceName}
                          className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-2"
                        >
                          {/* Group Subheading */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2 h-2 rounded-full bg-[var(--primary)] shrink-0" />
                              <h4 className="text-xs font-extrabold text-slate-900 tracking-tight truncate">
                                {serviceName}
                              </h4>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200/80 px-2 py-0.5 rounded-full shrink-0">
                              {feats.length} {feats.length === 1 ? 'feature' : 'features'}
                            </span>
                          </div>

                          {/* Compact 2-Column Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                            {feats.map((feat) => (
                              <div
                                key={feat.globalIndex}
                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white hover:bg-blue-50/40 border border-slate-200/70 transition-colors group"
                              >
                                <div className="flex items-center gap-2 min-w-0 pr-1.5">
                                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                                  <span className="text-xs font-medium text-slate-800 truncate" title={feat.text}>
                                    {feat.text}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeFeature(feat.globalIndex)}
                                  className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors shrink-0 cursor-pointer"
                                  title="Remove feature"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                      <p className="text-xs text-slate-400">No features added yet. Type a feature above or select services.</p>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 3: TECHNOLOGY & DELIVERY ROADMAP                                     */}
            {/* ========================================================================= */}
            {currentStep === 3 && (
              <div className="space-y-3.5 sm:space-y-4">
                {/* 1. Scope of Work & Solution Architecture Narrative (FIRST) */}
                <Card className="p-3.5 sm:p-4 bg-white border-slate-200 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <FileText size={16} className="text-blue-600" />
                      Scope of Work &amp; Solution Architecture Narrative
                    </h3>
                    <span className="text-[11px] text-slate-400">Technical boundaries &amp; core delivery scope</span>
                  </div>
                  <div>
                    <RichTextEditor
                      value={formData.scopeOfWork}
                      onChange={(html) => setField('scopeOfWork', html)}
                      minHeight="400px"
                      resizable
                      placeholder="Detail the technical implementation strategy, system boundaries, and deliverables..."
                    />
                  </div>
                </Card>

                {/* 2. Post-Launch Warranty & Operational Handover (SECOND) */}
                <Card className="p-3.5 sm:p-4 bg-white border-slate-200 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <ShieldCheck size={16} className="text-emerald-600" />
                      Post-Launch Warranty &amp; Operational Handover
                    </h3>
                    <span className="text-[11px] text-slate-400">Complimentary warranty, admin training &amp; handover commitments</span>
                  </div>
                  <div className="space-y-1.5">
                    <textarea
                      style={{ minHeight: '300px', height: '300px' }}
                      className="w-full p-3.5 text-xs font-medium text-slate-800 leading-relaxed border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs resize-y"
                      placeholder="Complimentary bug-fix warranty terms, training sessions, and transition commitments..."
                      value={formData.afterCompletion}
                      onChange={(e) => setField('afterCompletion', e.target.value)}
                    />
                  </div>
                </Card>

                {/* 3. Technology Stack & Infrastructure (THIRD - with Icons, Tier Categories & Service-wise Views) */}
                <Card className="p-3.5 sm:p-4 bg-white border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <Cpu size={16} className="text-blue-600" />
                        Technology Stack &amp; Infrastructure
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {parsedTechItems.length} active technologies across {formData.serviceNames?.length || 0} selected services
                      </p>
                    </div>

                    {/* View Mode Toggle: Architecture Tiers vs Service-Wise vs Raw Editor + Search/Add Tech Icon */}
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => setTechViewTab('tiers')}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            techViewTab === 'tiers'
                              ? 'bg-white text-slate-900 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Architecture Tiers
                        </button>
                        <button
                          type="button"
                          onClick={() => setTechViewTab('services')}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            techViewTab === 'services'
                              ? 'bg-white text-slate-900 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Service-Wise
                        </button>
                        <button
                          type="button"
                          onClick={() => setTechViewTab('text')}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            techViewTab === 'text'
                              ? 'bg-white text-slate-900 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Raw Editor
                        </button>
                        <div className="w-[1px] h-4 bg-slate-200/80 mx-0.5" />
                        <button
                          type="button"
                          onClick={() => {
                            setNewTechInput('');
                            setIsTechModalOpen(true);
                          }}
                          className="w-7 h-7 flex items-center justify-center text-blue-600 hover:text-blue-700 hover:bg-white rounded-lg transition-all shadow-2xs border border-transparent hover:border-slate-200/80 cursor-pointer"
                          title="Search & Add Technologies (150+ CRM Catalog)"
                          aria-label="Search and Add Technologies"
                        >
                          <Search size={14} strokeWidth={2.2} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* TAB 1: ARCHITECTURE TIERS (Frontend, Backend, Database, Cloud, APIs, DevOps) */}
                  {techViewTab === 'tiers' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {ARCHITECTURE_TIERS.filter((tier) => tier.id !== 'others' || (techByTier.others && techByTier.others.length > 0)).map((tier) => {
                        const TierIcon = tier.icon;
                        const items = techByTier[tier.id] || [];
                        return (
                          <div
                            key={tier.id}
                            className={`p-3.5 rounded-xl border ${
                              tier.id === 'others'
                                ? 'bg-indigo-50/40 border-indigo-200/80'
                                : items.length ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-50/30 border-dashed border-slate-200'
                            } space-y-2.5 transition-all`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: `${tier.dotColor}15`, color: tier.dotColor }}
                                >
                                  <TierIcon size={14} />
                                </span>
                                <span className="text-xs font-bold text-slate-800">{tier.shortTitle}</span>
                              </div>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                                tier.id === 'others'
                                  ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}>
                                {items.length}
                              </span>
                            </div>

                            {items.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {items.map((tech) => (
                                  <TechBadge key={tech} tech={tech} onRemove={handleRemoveTech} />
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">No {tier.shortTitle.toLowerCase()} tech specified</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* TAB 2: SERVICE-WISE BREAKDOWN */}
                  {techViewTab === 'services' && (
                    <div className="space-y-3">
                      {techByService.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {techByService.map((svc) => (
                            <div
                              key={svc.serviceName}
                              className={`p-3.5 border rounded-xl space-y-2.5 ${
                                svc.isCustom ? 'bg-indigo-50/40 border-indigo-200/80' : 'bg-slate-50/80 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${svc.isCustom ? 'bg-indigo-600' : 'bg-blue-600'}`} />
                                  <h4 className="text-xs font-bold text-slate-900 truncate max-w-[220px]" title={svc.serviceName}>
                                    {svc.serviceName}
                                  </h4>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  svc.isCustom
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                  {svc.technologies.length} tech
                                </span>
                              </div>
                              {svc.technologies.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {svc.technologies.map((tech) => (
                                    <TechBadge key={tech} tech={tech} onRemove={handleRemoveTech} />
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">No specific technologies linked to this service</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic py-4 text-center">No services selected in Step 1</p>
                      )}
                    </div>
                  )}

                  {/* TAB 3: RAW TEXT EDITOR */}
                  {techViewTab === 'text' && (
                    <div className="space-y-2">
                      <textarea
                        rows={4}
                        className="w-full p-3.5 text-xs font-mono text-slate-800 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs leading-relaxed"
                        placeholder="Comma or line-separated list of technologies..."
                        value={formData.technologyStack}
                        onChange={(e) => setField('technologyStack', e.target.value)}
                      />
                      <p className="text-[11px] text-slate-400">
                        Edit comma or line-separated technologies directly. All tier cards, service badges, and icons will update in real time.
                      </p>
                    </div>
                  )}

                  {/* QUICK ADD & CATALOG BROWSE FOOTER */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                        <Sparkles size={11} className="text-amber-500" /> Quick Add:
                      </span>
                      {POPULAR_TECH_SUGGESTIONS.slice(0, 6).map((suggestion) => {
                        const isAlreadyAdded = parsedTechItems.some((t) => t.toLowerCase() === suggestion.toLowerCase());
                        if (isAlreadyAdded) return null;
                        return (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => handleAddTech(suggestion)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200/80 transition-colors cursor-pointer"
                          >
                            <Plus size={10} />
                            {suggestion}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setNewTechInput('');
                        setIsTechModalOpen(true);
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                    >
                      <Search size={11} /> Browse &amp; Search 150+ Catalog →
                    </button>
                  </div>
                </Card>

                {/* SEARCH & ADD TECHNOLOGY POPUP MODAL */}
                {isTechModalOpen && (
                  <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6 animate-in fade-in duration-150"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) setIsTechModalOpen(false);
                    }}
                  >
                    <div
                      className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Modal Header */}
                      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-2xs shrink-0">
                            <Search size={17} strokeWidth={2.2} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm md:text-base font-bold text-slate-900">
                                Search &amp; Add Technologies
                              </h3>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                150+ CRM Catalog
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              Browse enterprise technology stacks or type a custom technology
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsTechModalOpen(false)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all shadow-2xs cursor-pointer shrink-0"
                          title="Close"
                          aria-label="Close"
                        >
                          <X size={16} strokeWidth={2.5} />
                        </button>
                      </div>

                      {/* Search Bar & Category Filters */}
                      <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
                        <div className="relative flex items-center">
                          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            autoFocus
                            placeholder="Search CRM tech (React, Node, AWS, PostgreSQL...) or type custom..."
                            value={newTechInput}
                            onChange={(e) => setNewTechInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newTechInput.trim()) {
                                  const customVal = newTechInput.trim();
                                  handleAddTech(customVal);
                                  toast.success(`Added "${customVal}" under Others`);
                                  setNewTechInput('');
                                  setIsTechModalOpen(false);
                                }
                              } else if (e.key === 'Escape') {
                                setIsTechModalOpen(false);
                              }
                            }}
                            className="w-full pl-10 pr-9 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-2xs font-medium placeholder:text-slate-400"
                          />
                          {newTechInput && (
                            <button
                              type="button"
                              onClick={() => setNewTechInput('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                              title="Clear"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>

                        {/* Custom Tech Add Banner if typed */}
                        {newTechInput.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              const customVal = newTechInput.trim();
                              handleAddTech(customVal);
                              toast.success(`Added "${customVal}" under Others`);
                              setNewTechInput('');
                              setIsTechModalOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-3.5 py-2 bg-blue-50/80 hover:bg-blue-100/90 border border-blue-200 rounded-xl transition-all cursor-pointer group text-left"
                          >
                            <div className="flex items-center gap-2 text-xs font-semibold text-blue-900 min-w-0 pr-2">
                              <PlusCircle size={15} className="text-blue-600 shrink-0" />
                              <span className="truncate">
                                Add <span className="font-bold underline decoration-blue-500">"{newTechInput.trim()}"</span> as custom tech (Others)
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200 shadow-2xs shrink-0">
                              Press Enter ↵
                            </span>
                          </button>
                        )}

                        {/* Category Filter Pills */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                          {TECH_CATEGORY_FILTERS.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setTechCategoryFilter(cat.id)}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                                techCategoryFilter === cat.id
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
                              }`}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Scrollable Technologies Grid */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[220px] max-h-[46vh]">
                        {filteredCrmTechnologies.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {filteredCrmTechnologies.map((t) => {
                              const isAdded = parsedTechItems.some((item) => item.toLowerCase() === t.name.toLowerCase());
                              const iconData = resolveTechIcon(t.name);
                              const IconComp = iconData?.Icon || DEFAULT_TECHNOLOGY_ICON.Icon;
                              return (
                                <div
                                  key={t.name}
                                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                    isAdded
                                      ? 'bg-emerald-50/60 border-emerald-200/80'
                                      : 'bg-white hover:bg-slate-50/80 border-slate-200/80'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                    <span
                                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-slate-200/80 bg-white shadow-2xs"
                                      style={{ color: iconData.color || '#475569' }}
                                    >
                                      <IconComp size={15} />
                                    </span>
                                    <div className="min-w-0">
                                      <div className="font-bold text-xs truncate text-slate-800">
                                        {t.name}
                                      </div>
                                      <div className="text-[10px] text-slate-400 capitalize truncate">
                                        {t.category}
                                      </div>
                                    </div>
                                  </div>
                                  {isAdded ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTech(t.name)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100/90 text-emerald-800 hover:bg-red-50 hover:text-red-700 hover:border-red-200 border border-emerald-200 transition-all cursor-pointer group shrink-0"
                                      title="Click to remove from quotation"
                                    >
                                      <Check size={11} className="group-hover:hidden" />
                                      <X size={11} className="hidden group-hover:inline" />
                                      <span className="group-hover:hidden text-[11px]">Added</span>
                                      <span className="hidden group-hover:inline text-[11px]">Remove</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleAddTech(t.name)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 transition-all cursor-pointer shrink-0 shadow-2xs"
                                    >
                                      <Plus size={11} />
                                      Add
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-12 text-center space-y-2">
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                              <Search size={18} />
                            </div>
                            <p className="text-xs font-bold text-slate-700">No matching technologies in CRM catalog</p>
                            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                              Type above to add "{newTechInput.trim()}" as a custom technology to this quotation.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                          <span>
                            <strong>{parsedTechItems.length}</strong> technologies active in quotation
                          </span>
                        </div>
                        <Button
                          type="button"
                          onClick={() => setIsTechModalOpen(false)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-2xs cursor-pointer"
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 4: COMMERCIAL PROPOSAL & MILESTONE ENGINE                            */}
            {/* ========================================================================= */}
            {currentStep === 4 && (
              <div className="space-y-5">
                {/* Costing & Tax Configuration Card */}
                <Card className="p-5 bg-white border-slate-200 shadow-2xs space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Calculator size={16} className="text-blue-600" />
                      Commercial Valuation, Discounts &amp; Statutory GST
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Base Quotation Amount (₹) *</label>
                      <Input
                        type="number"
                        className="h-10 text-sm font-bold font-mono"
                        placeholder="e.g. 100000"
                        value={formData.amount}
                        onChange={(e) => setField('amount', e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">Special Discount</label>
                        <input
                          type="checkbox"
                          checked={formData.discountEnabled}
                          onChange={(e) => setField('discountEnabled', e.target.checked)}
                          className="rounded text-blue-600 cursor-pointer"
                        />
                      </div>
                      <div className="flex gap-2">
                        <select
                          disabled={!formData.discountEnabled}
                          className="w-24 h-10 px-2 text-xs bg-slate-50 border border-slate-300 rounded-lg disabled:opacity-50"
                          value={formData.discountType}
                          onChange={(e) => setField('discountType', e.target.value)}
                        >
                          <option value="percent">%</option>
                          <option value="flat">₹ Flat</option>
                        </select>
                        <Input
                          type="number"
                          disabled={!formData.discountEnabled}
                          className="h-10 text-xs font-mono disabled:opacity-50"
                          placeholder={formData.discountType === 'percent' ? 'e.g. 10' : 'e.g. 5000'}
                          value={formData.discountValue}
                          onChange={(e) => setField('discountValue', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">Statutory GST</label>
                        <input
                          type="checkbox"
                          checked={formData.gstApplicable}
                          onChange={(e) => setField('gstApplicable', e.target.checked)}
                          className="rounded text-blue-600 cursor-pointer"
                        />
                      </div>
                      <select
                        disabled={!formData.gstApplicable}
                        className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg disabled:opacity-50 font-semibold"
                        value={formData.gstRate}
                        onChange={(e) => setField('gstRate', e.target.value)}
                      >
                        <option value="18">18% (Standard IT Services)</option>
                        <option value="12">12%</option>
                        <option value="5">5%</option>
                        <option value="0">0% (Exempt)</option>
                      </select>
                    </div>
                  </div>

                  {/* Statutory Tax Resolution Pill */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-700">Tax Regime Applied:</span>{' '}
                      <span className="font-semibold text-blue-700">{commercialTotals.taxLabel}</span>{' '}
                      <span className="text-slate-400">({commercialTotals.taxSummary})</span>
                    </div>
                    <div className="font-mono font-bold text-slate-900">
                      GST: {formatLeadAmount(commercialTotals.gstAmount, currency)}
                    </div>
                  </div>
                </Card>

                {/* Centralized Payment Milestone Engine */}
                <Card className="p-5 bg-white border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <DollarSign size={16} className="text-blue-600" />
                        Disbursement Milestones Engine (Must = 100%)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Stage-gate commercial disbursement schedule</p>
                    </div>
                    <Badge
                      className={`text-xs font-bold ${
                        milestoneValidation.isValid
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {milestoneValidation.isValid ? '✓ 100% Balanced' : `Total: ${milestoneValidation.totalPercentage}% (${milestoneValidation.difference > 0 ? `${milestoneValidation.difference}% needed` : `${Math.abs(milestoneValidation.difference)}% excess`})`}
                    </Badge>
                  </div>

                  {/* Milestone Presets */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Quick Milestone Presets (Replaces Schedule Cleanly):</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {MILESTONE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyMilestonePreset(preset)}
                          className="px-3 py-2 text-left text-xs font-semibold border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Milestones Table */}
                  <div className="space-y-2 pt-2">
                    {formData.milestones?.map((ms, idx) => (
                      <div key={ms.id || idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold bg-[#0f172a] text-white px-2 py-0.5 rounded text-[11px]">
                            MS-{String(idx + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900">{ms.name}</div>
                            {ms.dueEvent && ms.dueEvent !== ms.name && (
                              <div className="text-[10.5px] text-slate-500">Condition: {ms.dueEvent}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-mono font-bold text-blue-700">
                            {ms.percentage}% ({formatLeadAmount(Math.round((ms.percentage / 100) * commercialTotals.totalAmount), currency)})
                          </span>
                          <button
                            type="button"
                            onClick={() => removeMilestone(idx)}
                            className="text-slate-400 hover:text-red-500 cursor-pointer p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Custom Milestone Row */}
                  <div className="p-3 bg-blue-50/50 border border-dashed border-blue-200 rounded-xl space-y-2">
                    <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">Add Custom Milestone:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-5">
                        <Input
                          className="h-8 text-xs bg-white"
                          placeholder="Milestone title (e.g. Beta Demonstration)"
                          value={customMilestone.name}
                          onChange={(e) => setCustomMilestone((m) => ({ ...m, name: e.target.value }))}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          type="number"
                          className="h-8 text-xs bg-white font-mono"
                          placeholder="Percentage %"
                          value={customMilestone.percentage}
                          onChange={(e) => setCustomMilestone((m) => ({ ...m, percentage: e.target.value }))}
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <Input
                          className="h-8 text-xs bg-white"
                          placeholder="Trigger event / Due condition"
                          value={customMilestone.dueEvent}
                          onChange={(e) => setCustomMilestone((m) => ({ ...m, dueEvent: e.target.value }))}
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <Button type="button" size="xs" onClick={addCustomMilestone} className="w-full h-8 text-xs">
                          <Plus size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 5: LEGAL & COMPLIANCE GOVERNANCE                                     */}
            {/* ========================================================================= */}
            {currentStep === 5 && (
              <div className="space-y-5">
                {(() => {
                  const list = formData.legalAgreements || [];
                  const enabledCount = list.filter((a) => a.enabled).length;

                  return (
                    <div className="rounded-2xl border border-blue-200 bg-white p-5 space-y-4 shadow-2xs">
                      {/* Top Header */}
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                            <Scale size={18} className="text-blue-600 shrink-0" />
                            <span>Legal Agreements &amp; Compliance Clauses</span>
                            <span className="text-xs font-normal text-slate-400">
                              (Rendered at End of Quotation)
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Select which IT company agreements to attach to this quotation. Toggle ON or OFF for each agreement.
                          </p>
                        </div>

                        <div className="flex flex-col items-start md:items-end gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                                enabledCount > 0
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {enabledCount} of {list.length} Included
                            </span>

                            <button
                              type="button"
                              onClick={() => toggleAllAgreements(true)}
                              className="px-3.5 py-1 text-xs font-medium rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer"
                              title="Include all agreements in quotation"
                            >
                              Include All
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleAllAgreements(false)}
                              className="px-3.5 py-1 text-xs font-medium rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer"
                              title="Exclude all agreements from quotation"
                            >
                              Exclude All
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={resetAllAgreementsFromMaster}
                            className="px-3.5 py-1 text-xs font-medium rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                            title="Reset all agreements to master templates"
                          >
                            <RotateCcw size={12} className="text-slate-500" />
                            <span>Reset Defaults</span>
                          </button>
                        </div>
                      </div>

                      {/* Filter and Search Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                          {legalCategories.map((cat) => {
                            const isActive = legalCategoryFilter === cat;
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setLegalCategoryFilter(cat)}
                                className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                                  isActive
                                    ? "bg-blue-600 text-white shadow-2xs"
                                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                {cat}
                              </button>
                            );
                          })}
                        </div>

                        <div className="relative w-64 shrink-0">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={legalSearch}
                            onChange={(e) => setLegalSearch(e.target.value)}
                            placeholder="Search agreements (NDA, SOW, IP...)"
                            className="w-full pl-8.5 pr-8 py-1.5 text-xs rounded-full border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                          />
                          {legalSearch && (
                            <button
                              type="button"
                              onClick={() => setLegalSearch('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Agreements Cards Grid / List */}
                      {list.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center bg-white">
                          <Scale size={28} className="mx-auto text-slate-400 mb-2" />
                          <p className="text-xs text-slate-600 font-medium">No legal templates loaded yet.</p>
                          <button
                            type="button"
                            onClick={resetAllAgreementsFromMaster}
                            className="mt-3 px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs cursor-pointer"
                          >
                            Initialize 13 IT Agreements from Legal Master
                          </button>
                        </div>
                      ) : filteredAgreements.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center bg-slate-50/50 text-xs text-slate-500">
                          No agreements match &quot;{legalSearch || legalCategoryFilter}&quot;.
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                          {filteredAgreements.map(({ item: agreement, originalIndex }) => {
                            const keyId = agreement.id || agreement.name || originalIndex;
                            const isExpanded = Boolean(expandedAgreements[keyId]);
                            const previewSnippet = (agreement.content || '')
                              .split('\n')
                              .map((l) => l.trim())
                              .filter(Boolean)[0] || 'No clauses configured';

                            return (
                              <div
                                key={keyId}
                                className={`rounded-2xl border transition-all duration-200 p-3.5 bg-white ${
                                  agreement.enabled
                                    ? "border-slate-200 shadow-2xs"
                                    : "border-slate-200/90 bg-white opacity-85 hover:opacity-100"
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  {/* Left: Switch + Details */}
                                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                                    {/* Interactive Toggle Switch */}
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={Boolean(agreement.enabled)}
                                      onClick={() => toggleAgreement(originalIndex)}
                                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                        agreement.enabled ? 'bg-emerald-500' : 'bg-slate-200'
                                      }`}
                                      title={agreement.enabled ? "Toggle OFF to exclude from proposal" : "Toggle ON to include in proposal"}
                                    >
                                      <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                          agreement.enabled ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                      />
                                    </button>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span
                                          className={`text-sm truncate ${
                                            agreement.enabled ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
                                          }`}
                                        >
                                          {agreement.name}
                                        </span>

                                        {agreement.category && (
                                          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-full">
                                            {agreement.category}
                                          </span>
                                        )}

                                        {agreement.enabled ? (
                                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                            <CheckCircle2 size={12} className="text-emerald-600" />
                                            Included in Proposal
                                          </span>
                                        ) : (
                                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                            Excluded
                                          </span>
                                        )}
                                      </div>

                                      <p className="text-xs text-slate-500 truncate mt-1 max-w-2xl">
                                        {previewSnippet}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Right: Actions */}
                                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedAgreements((prev) => ({ ...prev, [keyId]: !isExpanded }))}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                    >
                                      <span>{isExpanded ? 'Collapse Clauses' : 'Edit Clauses'}</span>
                                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => resetAgreementToDefault(originalIndex)}
                                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                      title="Reset clauses to template default"
                                    >
                                      <RotateCcw size={13} />
                                    </button>
                                  </div>
                                </div>

                                {/* Expandable Drawer */}
                                {isExpanded && (
                                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                      <span className="font-medium text-slate-600">Agreement Clauses for Proposal</span>
                                      <button
                                        type="button"
                                        onClick={() => resetAgreementToDefault(originalIndex)}
                                        className="text-blue-600 hover:text-blue-800 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        <RotateCcw size={11} /> Reset to template default
                                      </button>
                                    </div>
                                    <textarea
                                      rows={6}
                                      value={agreement.content || ''}
                                      onChange={(e) => updateAgreementContent(originalIndex, e.target.value)}
                                      className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 leading-relaxed text-slate-800"
                                      placeholder="Enter agreement clauses..."
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 6: REVIEW, PREVIEW & PUBLISH                                         */}
            {/* ========================================================================= */}
            {currentStep === 6 && (
              <div className="space-y-5">
                <Card className="p-6 bg-white border-slate-200 shadow-2xs space-y-5">
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        Executive Document Review &amp; Issuance Gate
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Verify all proposal criteria before dispatching to client</p>
                    </div>
                    <Badge variant="outline" className="text-xs font-bold bg-emerald-50 text-emerald-800 border-emerald-300">
                      Ready for Issuance
                    </Badge>
                  </div>

                  {/* Summary Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">CLIENT &amp; CHARTER</div>
                      <div className="text-sm font-bold text-slate-900">{lead?.companyName || lead?.name || 'Client'}</div>
                      <div className="text-xs text-slate-600">Proposal: <strong>{formData.title}</strong></div>
                      <div className="text-xs text-slate-600">Validity: <strong>{formData.validUntil}</strong></div>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">COMMERCIAL SUMMARY</div>
                      <div className="text-xl font-extrabold font-mono text-blue-700">{formatLeadAmount(commercialTotals.totalAmount, currency)}</div>
                      <div className="text-xs text-slate-600">Tax Breakdown: <strong>{commercialTotals.taxLabel}</strong> ({formatLeadAmount(commercialTotals.gstAmount, currency)})</div>
                      <div className="text-xs text-slate-600">Milestones: <strong>{formData.milestones?.length || 0} Stage-Gate disbursements (100%)</strong></div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openPreview({ print: false })}
                      className="flex items-center gap-2 text-xs font-bold bg-white text-slate-800 hover:bg-slate-50"
                    >
                      <Eye size={15} className="text-blue-600" /> View Live Proposal Document
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openPreview({ print: true })}
                      className="flex items-center gap-2 text-xs font-bold bg-white text-slate-800 hover:bg-slate-50"
                    >
                      <Printer size={15} className="text-indigo-600" /> Print / Save PDF
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setWhatsAppOpen(true)}
                      className="flex items-center gap-2 text-xs font-bold bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                    >
                      <Share2 size={15} className="text-emerald-700" /> Share via WhatsApp
                    </Button>
                  </div>
                </Card>
              </div>
            )}

          </div>

          {/* Persistent Summary Panel (Cols 9-12) */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="p-4 bg-white border-slate-200 shadow-2xs space-y-4 sticky top-4">
              <div className="border-b border-slate-100 pb-2.5">
                <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
                  LIVE INVESTMENT SUMMARY
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                  {formatLeadAmount(commercialTotals.totalAmount, currency)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {formData.gstApplicable ? `Inclusive of ${commercialTotals.taxLabel}` : 'Exclusive of taxes'}
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className="space-y-1.5 text-xs text-slate-600 border-b border-slate-100 pb-3">
                <div className="flex justify-between">
                  <span>Base Cost:</span>
                  <strong className="font-mono text-slate-900">{formatLeadAmount(commercialTotals.subtotal, currency)}</strong>
                </div>
                {formData.discountEnabled && commercialTotals.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount:</span>
                    <strong className="font-mono">- {formatLeadAmount(commercialTotals.discountAmount, currency)}</strong>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Net Taxable:</span>
                  <strong className="font-mono text-slate-900">{formatLeadAmount(commercialTotals.taxableAmount, currency)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>{commercialTotals.isInterState ? 'IGST (Inter-State):' : 'CGST + SGST:'}</span>
                  <strong className="font-mono text-slate-900">+{formatLeadAmount(commercialTotals.gstAmount, currency)}</strong>
                </div>
              </div>

              {/* Budget Fit Indicator */}
              {budgetFit && (
                <div className={`p-2.5 rounded-lg border text-xs ${
                  budgetFit.isWithin
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  <div className="font-bold">{budgetFit.label}</div>
                  <div className="text-[10.5px] opacity-80 mt-0.5">Lead Budget: {formatLeadAmount(budgetFit.leadBudget, currency)}</div>
                </div>
              )}

              {/* Milestone Check Indicator */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700">Milestone Balance:</span>
                  <span className={`font-mono font-bold ${milestoneValidation.isValid ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {milestoneValidation.totalPercentage}% / 100%
                  </span>
                </div>
                {!milestoneValidation.isValid && (
                  <div className="text-[10.5px] text-amber-800 leading-tight">
                    {milestoneValidation.difference > 0 ? `${milestoneValidation.difference}% remaining` : `${Math.abs(milestoneValidation.difference)}% excess`}
                  </div>
                )}
              </div>

              {/* Step Navigation Actions */}
              <div className="pt-2 flex flex-col gap-2">
                <div className="flex gap-2">
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStep((s) => s - 1)}
                      className="flex-1 text-xs font-semibold"
                    >
                      <ChevronLeft size={14} className="mr-1" /> Prev
                    </Button>
                  )}
                  {currentStep < 6 ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setCurrentStep((s) => s + 1)}
                      className="flex-1 text-xs font-semibold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] cursor-pointer"
                    >
                      Next <ChevronRight size={14} className="ml-1" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSubmit}
                      disabled={busy}
                      className="flex-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-md shadow-emerald-600/20"
                    >
                      {busy ? 'Saving...' : 'Publish Quotation'}
                    </Button>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={busy}
                  className="w-full text-xs font-semibold"
                >
                  Save as Draft
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 md:p-6 overflow-hidden">
        {builderContent}
        {whatsAppOpen && (
          <WhatsAppModal
            isOpen={whatsAppOpen}
            onClose={() => setWhatsAppOpen(false)}
            defaultPhone={lead?.phone || ''}
            defaultMessage={generatedWhatsAppPitch}
            lead={lead}
            proposalTitle={formData.title}
            proposalLink={formData.quotationLink}
          />
        )}
      </div>
    );
  }

  return (
    <>
      {builderContent}
      {whatsAppOpen && (
        <WhatsAppModal
          isOpen={whatsAppOpen}
          onClose={() => setWhatsAppOpen(false)}
          defaultPhone={lead?.phone || ''}
          defaultMessage={generatedWhatsAppPitch}
          lead={lead}
          proposalTitle={formData.title}
          proposalLink={formData.quotationLink}
        />
      )}
    </>
  );
}
