const clientModel = require('../models/client.model');
const projectModel = require('../models/project.model');
const invoiceModel = require('../models/invoice.model');
const paymentModel = require('../models/payment.model');
const expenseModel = require('../models/expense.model');
const outsourcingModel = require('../models/outsourcingExpense.model');
const leadCommissionModel = require('../models/leadCommission.model');
const leadModel = require('../models/lead.model');
const leadContactModel = require('../models/leadContact.model');
const clientContactModel = require('../models/clientContact.model');
const leadEventModel = require('../models/leadEvent.model');
const userModel = require('../models/user.model');
const bankAccountModel = require('../models/bankAccount.model');
const bankTransactionModel = require('../models/bankTransaction.model');
const amcModel = require('../models/amc.model');
const renewalModel = require('../models/renewal.model');
const followUpModel = require('../models/followUp.model');
const masterItemModel = require('../models/masterItem.model');
const { getSettings } = require('../models/settings.model');
const {
  calculateExpenseImpact,
  calculateInvoiceTotals,
  calculateLeadCommission,
  calculateOutsourcingExpense,
  getPlaceOfSupplyForClient
} = require('../utils/finance');
const { round2, toNumber } = require('../utils/format');
const { getInvoiceSnapshot, getPayrollExpenseTotal, getPayrollRecords } = require('./finance.service');

function sumBy(items = [], iteratee = (item) => item) {
  return round2(items.reduce((sum, item) => sum + toNumber(iteratee(item)), 0));
}

function isSalaryExpenseRecord(expense = {}) {
  return String(expense.expenseType || expense.expense_type || '').trim() === 'Employee Salary';
}

function daysUntil(dateString, fromDate = new Date()) {
  if (!dateString) return null;
  const target = new Date(dateString);
  const base = new Date(fromDate);
  if (Number.isNaN(target.getTime()) || Number.isNaN(base.getTime())) return null;
  return Math.ceil((target - base) / (1000 * 60 * 60 * 24));
}

function getRenewalDate(record = {}) {
  return record.renewalDate || record.expiryDate || record.endDate || record.nextInvoiceDate || '';
}

function getRenewalTitle(record = {}) {
  return record.domainName || record.hostingName || record.softwareName || record.amcType || record.renewalType || record.provider || 'Renewal';
}

function getRenewalCategory(record = {}) {
  if (record.recordType === 'AMC' || record.amcType) return 'AMC';
  return record.category || record.renewalType || 'Renewal';
}

function getRenewalProvider(record = {}) {
  return record.providerName || record.provider || record.domainProvider || record.hostingProvider || '-';
}

function getRenewalAmount(record = {}) {
  return round2(record.renewalPrice ?? record.renewalCost ?? record.amcAmount ?? record.clientCharge ?? 0);
}

function getComputedRenewalStatus(record = {}, compareDate = new Date()) {
  if (record.status === 'Cancelled') return 'Cancelled';
  const remainingDays = daysUntil(getRenewalDate(record), compareDate);
  if (remainingDays === null) return record.status || 'Pending';
  if (remainingDays < 0) return 'Expired';
  if (remainingDays <= 30) return 'Due Soon';
  return record.status || 'Pending';
}

async function loadBusinessState() {
  const settings = (await getSettings()) || {};
  const [
    clients,
    projects,
    invoices,
    payments,
    expenses,
    outsourcingExpenses,
    leads,
    leadContacts,
    clientContacts,
    leadEvents,
    users,
    leadCommissions,
    bankAccounts,
    bankTransactions,
    amcs,
    renewals,
    vendors,
    followUps
  ] = await Promise.all([
    clientModel.list(),
    projectModel.list(),
    invoiceModel.list(),
    paymentModel.list(),
    expenseModel.list(),
    outsourcingModel.list(),
    leadModel.list(),
    leadContactModel.list(),
    clientContactModel.list(),
    leadEventModel.list(),
    userModel.list(),
    leadCommissionModel.list(),
    bankAccountModel.list(),
    bankTransactionModel.list(),
    amcModel.list(),
    renewalModel.list(),
    masterItemModel.listByType('vendor'),
    followUpModel.list()
  ]);

  return {
    settings,
    clients,
    projects,
    invoices,
    payments,
    expenses,
    outsourcingExpenses,
    leads,
    leadContacts,
    clientContacts,
    leadEvents,
    events: leadEvents,
    users,
    leadCommissions,
    bankAccounts,
    bankTransactions,
    amcs,
    renewals,
    vendors,
    followUps
  };
}

function getUserDisplayName(userId, state) {
  if (!userId) return 'System';
  const user = (state.users || []).find((item) => String(item.id) === String(userId));
  return user?.fullName || user?.username || user?.email || 'System';
}

function parseListValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parseListValue(parsed);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseActivities(value) {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? (() => {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
      : [];

  return items.filter((item) => item && typeof item === 'object');
}

function getScopedEvents(state, { scopeType, scopeId, allowLegacy = false } = {}) {
  const normalizedType = String(scopeType || '').trim().toLowerCase();
  const normalizedId = String(scopeId || '').trim();

  return (state.events || []).filter((event) => {
    const eventScopeType = String(event.scopeType || '').trim().toLowerCase();
    const eventScopeId = String(event.scopeId || event.leadId || event.clientId || event.projectId || '').trim();

    if (normalizedType && normalizedId) {
      if (eventScopeType === normalizedType && eventScopeId === normalizedId) return true;
      if (allowLegacy) {
        if (normalizedType === 'lead' && String(event.leadId || '').trim() === normalizedId) return true;
        if (normalizedType === 'client' && String(event.clientId || '').trim() === normalizedId) return true;
        if (normalizedType === 'project' && String(event.projectId || '').trim() === normalizedId) return true;
      }
      return false;
    }

    return true;
  });
}

function mapEventRecord(event, fallbackTitle = 'Event') {
  if (!event) return null;
  const eventType = String(event.eventType || 'event').toLowerCase();
  const title = String(event.title || '').trim() || fallbackTitle;
  return {
    id: String(event.id || ''),
    eventType,
    title,
    description: String(event.description || '').trim(),
    startDate: event.startDate || '',
    startTime: event.startTime || '',
    endDate: event.endDate || '',
    endTime: event.endTime || '',
    location: String(event.location || '').trim(),
    labels: parseListValue(event.labels),
    color: event.color || '#3b82f6',
    scopeType: String(event.scopeType || '').trim().toLowerCase() || 'global',
    scopeId: String(event.scopeId || event.leadId || event.clientId || event.projectId || '').trim(),
    leadId: event.leadId || '',
    clientId: event.clientId || '',
    projectId: event.projectId || '',
    ownerUserId: event.ownerUserId || '',
    visibility: String(event.visibility || 'all_team').trim().toLowerCase(),
    allowedUserIds: parseListValue(event.allowedUserIds),
    allowedTeamIds: parseListValue(event.allowedTeamIds),
    source: 'global',
    createdAt: event.createdAt || event.created_at || '',
    updatedAt: event.updatedAt || event.updated_at || ''
  };
}

async function buildDashboardSummary() {
  const state = await loadBusinessState();
  const invoiceTotals = state.invoices
    .filter((invoice) => invoice.status !== 'Cancelled')
    .map((invoice) => {
      const client = state.clients.find((item) => String(item.id) === String(invoice.clientId));
      return calculateInvoiceTotals(invoice, invoice.items || [], state.settings, client);
    });
  const invoiceSnapshots = state.invoices
    .filter((invoice) => invoice.status !== 'Cancelled')
    .map((invoice) => {
      const client = state.clients.find((item) => String(item.id) === String(invoice.clientId));
      const payments = state.payments.filter((payment) => String(payment.invoiceId) === String(invoice.id));
      return getInvoiceSnapshot(invoice, payments, state.settings, client);
    });
  const expenseImpacts = state.expenses.filter((expense) => !isSalaryExpenseRecord(expense)).map(calculateExpenseImpact);
  const outsourcingImpacts = state.outsourcingExpenses.map((item) => calculateOutsourcingExpense(item, state.vendors.find((vendor) => String(vendor.id) === String(item.vendorId)), state.settings));
  const commissionImpacts = state.leadCommissions.map((item) => calculateLeadCommission(item, state.vendors.find((vendor) => String(vendor.id) === String(item.partnerId)), state.settings));
  const payrollExpense = getPayrollExpenseTotal(state);

  const outputGst = sumBy(invoiceTotals, (total) => total.gstAmount);
  const inputGst = sumBy(expenseImpacts, (item) => item.inputGst)
    + sumBy(outsourcingImpacts, (item) => item.inputGst)
    + sumBy(commissionImpacts, (item) => item.inputGst);

  return {
    totalClients: state.clients.length,
    activeProjects: state.projects.filter((project) => project.status === 'Active').length,
    totalProjects: state.projects.length,
    totalInvoiceAmount: sumBy(invoiceTotals, (item) => item.totalAmount),
    totalTaxableAmount: sumBy(invoiceTotals, (item) => item.taxableAmount),
    totalGstCharged: outputGst,
    totalReceived: sumBy(state.payments, (payment) => toNumber(payment.amountReceived) + toNumber(payment.tdsDeducted)),
    totalDue: sumBy(invoiceSnapshots, (snapshot) => snapshot.balanceDue),
    overdueDue: sumBy(invoiceSnapshots.filter((snapshot) => snapshot.isOverdue), (snapshot) => snapshot.balanceDue),
    outputGst,
    inputGst,
    payrollExpense,
    netGstPayable: round2(outputGst - inputGst),
    pendingInvoices: state.invoices.filter((invoice) => ['Sent', 'Partially Paid', 'Overdue'].includes(invoice.status)).length,
    amcExpiringSoon: state.amcs.filter((amc) => {
      const remaining = daysUntil(amc.nextInvoiceDate || amc.endDate);
      return remaining !== null && remaining >= 0 && remaining <= 30;
    }).length,
    renewalsExpiringSoon: state.renewals.filter((renewal) => {
      const remaining = daysUntil(getRenewalDate(renewal));
      return remaining !== null && remaining >= 0 && remaining <= 30;
    }).length
  };
}

async function buildClientSummary(clientId) {
  const state = await loadBusinessState();
  const client = state.clients.find((item) => String(item.id) === String(clientId));
  if (!client) return null;

  const invoices = state.invoices.filter((invoice) => String(invoice.clientId) === String(clientId));
  const projects = state.projects.filter((project) => String(project.clientId) === String(clientId));
  const payments = state.payments.filter((payment) => String(payment.clientId) === String(clientId));
  const expenses = state.expenses.filter((expense) => String(expense.clientId) === String(clientId));
  const outsourcingExpenses = state.outsourcingExpenses.filter((expense) => String(expense.clientId) === String(clientId));
  const leadCommissions = state.leadCommissions.filter((commission) => String(commission.clientId) === String(clientId));
  const amcs = state.amcs.filter((amc) => String(amc.clientId) === String(clientId));
  const renewals = state.renewals.filter((renewal) => String(renewal.clientId) === String(clientId));
  const clientActivities = parseActivities(client.activities);
  const globalEvents = getScopedEvents(state, { scopeType: 'client', scopeId: clientId, allowLegacy: false })
    .map((event) => mapEventRecord(event, 'Client event'))
    .filter(Boolean);
  const legacyEventItems = clientActivities
    .filter((activity) => String(activity?.type || activity?.eventType || '').toLowerCase() === 'event')
    .map((activity) => ({
      id: String(activity.id || ''),
      eventType: 'event',
      title: String(activity.title || '').trim() || 'Event',
      description: String(activity.description || '').trim(),
      startDate: activity.startDate || '',
      startTime: activity.startTime || '',
      endDate: activity.endDate || '',
      endTime: activity.endTime || '',
      location: String(activity.location || '').trim(),
      labels: Array.isArray(activity.labels) ? activity.labels : [],
      color: activity.color || '#3b82f6',
      scopeType: 'client',
      scopeId: String(clientId),
      ownerUserId: activity.ownerUserId || '',
      visibility: activity.visibility || 'all_team',
      allowedUserIds: parseListValue(activity.allowedUserIds),
      allowedTeamIds: parseListValue(activity.allowedTeamIds),
      source: 'legacy',
      createdAt: activity.createdAt || '',
      updatedAt: activity.updatedAt || ''
    }));
  const events = [...globalEvents, ...legacyEventItems];
  const contacts = state.clientContacts
    .filter((contact) => String(contact.clientId) === String(clientId))
    .sort((a, b) => {
      const primaryA = a.isPrimary ? 1 : 0;
      const primaryB = b.isPrimary ? 1 : 0;
      if (primaryA !== primaryB) return primaryB - primaryA;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
  const primaryContact = contacts.find((contact) => contact.isPrimary) || contacts[0] || null;

  const invoiceTotals = invoices.map((invoice) => calculateInvoiceTotals(invoice, invoice.items || [], state.settings, client));
  const invoiceSnapshots = invoices.map((invoice) => getInvoiceSnapshot(invoice, state.payments.filter((payment) => String(payment.invoiceId) === String(invoice.id)), state.settings, client));
  const expenseImpacts = expenses.map(calculateExpenseImpact);
  const outsourcingImpacts = outsourcingExpenses.map((item) => calculateOutsourcingExpense(item, state.vendors.find((vendor) => String(vendor.id) === String(item.vendorId)), state.settings));
  const commissionImpacts = leadCommissions.map((item) => calculateLeadCommission(item, state.vendors.find((vendor) => String(vendor.id) === String(item.partnerId)), state.settings));

  return {
    client,
    summary: {
      totalProjects: projects.length,
      activeProjects: projects.filter((project) => project.status === 'Active').length,
      completedProjects: projects.filter((project) => project.status === 'Completed').length,
      totalInvoiceAmount: sumBy(invoiceTotals, (item) => item.totalAmount),
      totalTaxableAmount: sumBy(invoiceTotals, (item) => item.taxableAmount),
      totalGstCharged: sumBy(invoiceTotals, (item) => item.gstAmount),
      totalReceived: sumBy(payments, (payment) => toNumber(payment.amountReceived) + toNumber(payment.tdsDeducted)),
      totalDue: sumBy(invoiceSnapshots, (snapshot) => snapshot.balanceDue),
      overdueDue: sumBy(invoiceSnapshots.filter((snapshot) => snapshot.isOverdue), (snapshot) => snapshot.balanceDue),
      paymentProgress: invoices.length ? round2(sumBy(invoiceSnapshots, (snapshot) => snapshot.paymentProgress) / invoices.length) : 0,
      totalClientExpenses: sumBy(expenseImpacts, (item) => item.expenseAmount)
        + sumBy(outsourcingImpacts, (item) => item.expenseImpact)
        + sumBy(commissionImpacts, (item) => item.expenseImpact),
      totalEligibleItc: sumBy(expenseImpacts, (item) => item.inputGst)
        + sumBy(outsourcingImpacts, (item) => item.inputGst)
        + sumBy(commissionImpacts, (item) => item.inputGst),
      totalProfitLoss: round2(sumBy(invoiceTotals, (item) => item.taxableAmount) - (
        sumBy(expenseImpacts, (item) => item.expenseAmount)
        + sumBy(outsourcingImpacts, (item) => item.expenseImpact)
        + sumBy(commissionImpacts, (item) => item.expenseImpact)
      )),
      amcActive: amcs.filter((amc) => amc.status === 'Active').length,
      amcExpired: amcs.filter((amc) => amc.status === 'Expired').length,
      pendingRenewals: renewals.filter((renewal) => renewal.status === 'Pending').length,
      activitiesCount: clientActivities.length,
      tasksCount: clientActivities.filter((activity) => String(activity?.type || '').toLowerCase() === 'task').length,
      notesCount: clientActivities.filter((activity) => String(activity?.type || '').toLowerCase() === 'note').length,
      remindersCount: clientActivities.filter((activity) => String(activity?.type || '').toLowerCase() === 'reminder').length,
      eventsCount: events.length,
      contactsCount: contacts.length,
      finance: {
        totalInvoiced: sumBy(invoiceSnapshots, (snapshot) => snapshot.totalAmount),
        totalReceived: sumBy(invoiceSnapshots, (snapshot) => snapshot.amountPaid),
        outstanding: sumBy(invoiceSnapshots, (snapshot) => snapshot.balanceDue),
        overdueOutstanding: sumBy(invoiceSnapshots.filter((snapshot) => snapshot.isOverdue), (snapshot) => snapshot.balanceDue),
        paymentProgress: invoices.length ? round2(sumBy(invoiceSnapshots, (snapshot) => snapshot.paymentProgress) / invoices.length) : 0
      }
    },
    events,
    timeline: buildClientTimeline(clientId, state),
    projects,
    invoices,
    payments,
    amcs,
    renewals,
    contacts,
    primaryContact
  };
}

function buildLeadTimeline(leadId, state) {
  const lead = state.leads.find((item) => String(item.id) === String(leadId));
  const contacts = state.leadContacts.filter((item) => String(item.leadId) === String(leadId));
  const events = getScopedEvents(state, { scopeType: 'lead', scopeId: leadId, allowLegacy: true });

  const leadFollowUps = (state.followUps || []).filter(
    (f) => String(f.relatedEntityType).toLowerCase() === 'lead' && String(f.relatedEntityId) === String(leadId) && !f.deletedAt
  );

  const existingFollowUpEventIds = new Set(
    events.map((e) => e.payload?.followUpId || e.id).filter(Boolean)
  );

  const followUpEvents = leadFollowUps.filter((f) => !existingFollowUpEventIds.has(f.id)).map((f) => {
    const due = f.dueAt ? new Date(f.dueAt).toISOString() : '';
    const isCompleted = ['Completed', 'Auto-Closed', 'Cancelled'].includes(f.status);
    return {
      id: f.id,
      leadId: leadId,
      eventType: 'reminder',
      title: f.title || 'Lead follow-up',
      description: f.discussionNote ? `${f.description || ''}\n[Remark]: ${f.discussionNote}` : (f.description || ''),
      startDate: due ? due.slice(0, 10) : '',
      startTime: due ? new Date(f.dueAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: f.timezone || 'Asia/Kolkata' }) : '',
      endDate: due ? due.slice(0, 10) : '',
      endTime: '',
      status: f.status,
      priority: f.priority,
      labels: [isCompleted ? 'completed' : 'pending', 'follow-up-engine', ...(f.tags || [])],
      color: isCompleted ? '#10b981' : '#f59e0b',
      ownerUserId: f.assignedTo,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      followUpNumber: f.followUpNumber,
      actualOutcome: f.actualOutcome,
      discussionNote: f.discussionNote,
      payload: {
        followUpId: f.id,
        followUpNumber: f.followUpNumber,
        status: f.status,
        actualOutcome: f.actualOutcome,
        discussionNote: f.discussionNote
      }
    };
  });

  const mergedEvents = [...events, ...followUpEvents];
  const reminders = [];
  const leadLifecycleEvents = [];
  const existingSystemKinds = new Set(
    mergedEvents
      .filter((event) => String(event.eventType || '').toLowerCase() === 'system')
      .map((event) => event.payload?.kind)
      .filter(Boolean)
  );

  if (lead?.createdAt && !existingSystemKinds.has('created')) {
    const creatorName = getUserDisplayName(lead.createdBy, state);
    leadLifecycleEvents.push({
      date: lead.createdAt,
      title: 'Lead created',
      detail: `Created by ${creatorName}`,
      kind: 'created',
      actorName: creatorName,
      amount: 0
    });
  }

  if (lead?.updatedAt && String(lead.updatedAt) !== String(lead.createdAt || '') && !existingSystemKinds.has('updated')) {
    leadLifecycleEvents.push({
      date: lead.updatedAt,
      title: 'Lead updated',
      detail: `Last updated by ${getUserDisplayName(lead.createdBy || lead.assignedTo, state)}`,
      kind: 'updated',
      actorName: getUserDisplayName(lead.createdBy || lead.assignedTo, state),
      amount: 0
    });
  }

  const timeline = [
    ...leadLifecycleEvents,
    ...mergedEvents.map((event) => {
      const eventType = String(event.eventType || 'event').toLowerCase();
      const activityLabel = {
        reminder: 'Reminder',
        note: 'Note',
        task: 'Task',
        event: 'Event',
        call: 'Call'
      }[eventType] || 'Activity';

      return {
        id: event.id,
        date: eventType === 'system'
          ? event.createdAt || event.startDate || event.endDate
          : event.startDate || event.endDate || event.createdAt,
        title: eventType === 'system'
          ? event.payload?.kind === 'created'
            ? 'Lead created'
            : event.payload?.kind === 'status_changed'
              ? `Status changed to ${event.payload?.meta?.nextStatus || event.title || 'Updated'}`
              : event.title || 'Lead updated'
          : event.title || activityLabel,
        detail: eventType === 'system'
          ? event.description || (event.payload?.meta?.changes?.length
            ? event.payload.meta.changes.map((change) => change.label).join(', ')
            : 'Lead activity updated')
          : event.description || event.location || `${activityLabel} logged`,
        kind: eventType === 'system' ? event.payload?.kind || 'system' : eventType,
        actorName: eventType === 'system'
          ? event.payload?.actorName || 'System'
          : getUserDisplayName(event.ownerUserId, state),
        meta: {
          ...(event.payload || {}),
          ...(event.payload?.meta || {})
        },
        payload: event.payload || {},
        attachments: event.attachments || [],
        color: event.color || null,
        amount: 0
      };
    }),
    ...reminders
  ];

  return {
    contacts,
    events: mergedEvents,
    timeline: timeline.filter((item) => item.date).sort((a, b) => String(b.date).localeCompare(String(a.date)))
  };
}

async function buildLeadSummary(leadId) {
  const state = await loadBusinessState();
  const lead = state.leads.find((item) => String(item.id) === String(leadId));
  if (!lead) return null;

  const { contacts, events, timeline } = buildLeadTimeline(leadId, state);
  const sortedContacts = [...contacts].sort((a, b) => {
    const aTime = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const bTime = new Date(b.createdAt || b.updatedAt || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  return {
    lead,
    contacts: sortedContacts,
    primaryContact: sortedContacts[0] || null,
    events,
    timeline,
    summary: {
      contactsCount: sortedContacts.length,
      eventsCount: events.length,
      tasksCount: events.filter((event) => String(event.eventType || '').toLowerCase() === 'task').length,
      notesCount: events.filter((event) => String(event.eventType || '').toLowerCase() === 'note').length,
      remindersCount: events.filter((event) => String(event.eventType || '').toLowerCase() === 'reminder').length + (lead.followUpDate ? 1 : 0)
    }
  };
}

function buildClientTimeline(clientId, state) {
  const client = state.clients.find((item) => String(item.id) === String(clientId));
  const renewals = state.renewals.filter((item) => String(item.clientId) === String(clientId));
  const amcs = state.amcs.filter((item) => String(item.clientId) === String(clientId));
  const invoices = state.invoices.filter((item) => String(item.clientId) === String(clientId) || item.sourceRenewalId || item.sourceAmcId);
  const expenses = state.expenses.filter((item) => String(item.clientId) === String(clientId) || item.sourceRenewalId || item.sourceAmcId);
  const clientActivities = Array.isArray(client?.activities)
    ? client.activities
    : typeof client?.activities === 'string'
      ? (() => {
        try {
          const parsed = JSON.parse(client.activities);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
      : [];

  const activityEvents = clientActivities.map((activity) => {
    const kind = String(activity?.type || activity?.eventType || 'note').toLowerCase();
    const kindTitle = {
      task: 'Task',
      note: 'Note',
      reminder: 'Reminder',
      event: 'Event'
    }[kind] || 'Activity';

    return {
      date: activity?.startDate || activity?.date || activity?.deadline || activity?.createdAt || activity?.updatedAt || '',
      title: kindTitle,
      detail: activity?.description || activity?.title || 'Client activity',
      kind,
      actorName: activity?.createdByName || activity?.assignedToName || activity?.actorName || 'System',
      color: activity?.color || null,
      meta: activity || {},
      amount: 0
    };
  });

  const globalEvents = getScopedEvents(state, { scopeType: 'client', scopeId: clientId, allowLegacy: false }).map((event) => ({
    date: event.startDate || event.endDate || event.createdAt || '',
    title: event.title || 'Event',
    detail: event.description || event.location || 'Client event',
    kind: 'event',
    actorName: getUserDisplayName(event.ownerUserId, state),
    color: event.color || null,
    meta: event,
    amount: 0
  }));

  const events = [
    ...client?.createdAt ? [{
      date: client.createdAt,
      title: 'Client created',
      detail: `Created by ${getUserDisplayName(client.createdBy || client.assignedTo, state)}`,
      kind: 'created',
      actorName: getUserDisplayName(client.createdBy || client.assignedTo, state),
      amount: 0
    }] : [],
    ...client?.updatedAt && String(client.updatedAt) !== String(client.createdAt || '') ? [{
      date: client.updatedAt,
      title: 'Client updated',
      detail: `Last updated by ${getUserDisplayName(client.createdBy || client.assignedTo, state)}`,
      kind: 'updated',
      actorName: getUserDisplayName(client.createdBy || client.assignedTo, state),
      amount: 0
    }] : [],
    ...renewals.flatMap((item) => [
      item.purchaseDate ? {
        date: item.purchaseDate,
        title: `${getRenewalCategory(item)} purchased`,
        detail: `${getRenewalTitle(item)} via ${getRenewalProvider(item)}`,
        amount: item.purchasePrice || item.renewalCost || 0
      } : null,
      getRenewalDate(item) ? {
        date: getRenewalDate(item),
        title: `${getRenewalCategory(item)} renewal due`,
        detail: `${getRenewalTitle(item)} renewal ${String(getComputedRenewalStatus(item)).toLowerCase()}`,
        amount: getRenewalAmount(item)
      } : null
    ].filter(Boolean)),
    ...amcs.flatMap((item) => [
      item.startDate ? {
        date: item.startDate,
        title: 'AMC started',
        detail: `${item.amcType || 'AMC'} ${item.billingCycle || ''}`,
        amount: item.amcAmount || 0
      } : null,
      item.nextInvoiceDate ? {
        date: item.nextInvoiceDate,
        title: 'AMC invoice due',
        detail: `${item.amcType || 'AMC'} next billing`,
        amount: item.amcAmount || 0
      } : null,
      item.endDate ? {
        date: item.endDate,
        title: 'AMC ends',
        detail: `${item.amcType || 'AMC'} ${String(getComputedRenewalStatus(item)).toLowerCase()}`,
        amount: item.amcAmount || 0
      } : null
    ].filter(Boolean)),
    ...activityEvents,
    ...globalEvents,
    ...invoices.map((invoice) => ({
      date: invoice.invoiceDate,
      title: 'Invoice created',
      detail: invoice.invoiceNumber,
      amount: invoice.totalAmount || invoice.items?.[0]?.total || 0
    })),
    ...expenses.map((expense) => ({
      date: expense.expenseDate,
      title: 'Expense booked',
      detail: expense.payeeName || expense.vendor || expense.invoiceNumber || 'Expense',
      amount: expense.totalAmount || expense.amountBeforeGst || 0
    }))
  ];

  return events
    .filter((event) => event.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function parseProjectActivities(value) {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? (() => {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
      : [];

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const type = String(item.type || item.eventType || 'note').toLowerCase();
      return {
        ...item,
        id: String(item.id || ''),
        type,
        title: String(item.title || '').trim(),
        description: String(item.description || '').trim(),
        labels: Array.isArray(item.labels) ? item.labels : typeof item.labels === 'string' ? item.labels.split(',').map((label) => label.trim()).filter(Boolean) : [],
        attachments: Array.isArray(item.attachments) ? item.attachments : [],
        color: item.color || null,
        createdAt: item.createdAt || item.created_at || new Date().toISOString(),
        updatedAt: item.updatedAt || item.updated_at || item.createdAt || new Date().toISOString(),
        createdByName: item.createdByName || item.actorName || 'System'
      };
    })
    .filter(Boolean);
}

function normalizeProjectContacts(clientContacts = [], leadContacts = []) {
  const seen = new Set();
  return [...clientContacts, ...leadContacts]
    .map((contact) => {
      const firstName = contact.firstName || contact.first_name || '';
      const lastName = contact.lastName || contact.last_name || '';
      const email = contact.email || '';
      const phone = contact.phone || '';
      const key = `${firstName}|${lastName}|${email}|${phone}`.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        ...contact,
        firstName,
        lastName,
        email,
        phone,
        jobTitle: contact.jobTitle || contact.job_title || '',
        notes: contact.notes || '',
        isPrimary: Boolean(contact.isPrimary ?? contact.is_primary),
        source: contact.source || 'Client'
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const primaryA = a.isPrimary ? 1 : 0;
      const primaryB = b.isPrimary ? 1 : 0;
      if (primaryA !== primaryB) return primaryB - primaryA;
      return String(a.createdAt || a.updatedAt || '').localeCompare(String(b.createdAt || b.updatedAt || ''));
    });
}

function getProjectActivityDate(activity) {
  return activity?.startDate || activity?.date || activity?.deadline || activity?.createdAt || activity?.updatedAt || '';
}

function getProjectActivityKindLabel(kind = '') {
  const lower = String(kind || '').toLowerCase();
  return {
    task: 'Task',
    note: 'Note',
    reminder: 'Reminder',
    event: 'Event'
  }[lower] || 'Activity';
}

async function buildProjectSummary(projectId) {
  const state = await loadBusinessState();
  const project = state.projects.find((item) => String(item.id) === String(projectId));
  if (!project) return null;

  const invoices = state.invoices.filter((invoice) => String(invoice.projectId) === String(projectId));
  const expenses = state.expenses.filter((expense) => String(expense.projectId) === String(projectId));
  const outsourcingExpenses = state.outsourcingExpenses.filter((expense) => String(expense.projectId) === String(projectId));
  const leadCommissions = state.leadCommissions.filter((commission) => String(commission.projectId) === String(projectId));
  const client = state.clients.find((item) => String(item.id) === String(project.clientId));
  const lead = state.leads.find((item) => String(item.id) === String(project.leadId));
  const owner = state.users.find((item) => String(item.id) === String(project.assignedTo));
  const projectActivities = parseProjectActivities(project.activities);
  const globalEvents = getScopedEvents(state, { scopeType: 'project', scopeId: projectId, allowLegacy: false })
    .map((event) => mapEventRecord(event, 'Project event'))
    .filter(Boolean);
  const legacyEventItems = projectActivities
    .filter((activity) => String(activity.type || '').toLowerCase() === 'event')
    .map((activity) => ({
      id: String(activity.id || ''),
      eventType: 'event',
      title: String(activity.title || '').trim() || 'Event',
      description: String(activity.description || '').trim(),
      startDate: activity.startDate || '',
      startTime: activity.startTime || '',
      endDate: activity.endDate || '',
      endTime: activity.endTime || '',
      location: String(activity.location || '').trim(),
      labels: Array.isArray(activity.labels) ? activity.labels : [],
      color: activity.color || '#3b82f6',
      scopeType: 'project',
      scopeId: String(projectId),
      ownerUserId: activity.ownerUserId || '',
      visibility: activity.visibility || 'all_team',
      allowedUserIds: parseListValue(activity.allowedUserIds),
      allowedTeamIds: parseListValue(activity.allowedTeamIds),
      source: 'legacy',
      createdAt: activity.createdAt || '',
      updatedAt: activity.updatedAt || ''
    }));
  const events = [...globalEvents, ...legacyEventItems];
  const contacts = normalizeProjectContacts(
    state.clientContacts.filter((item) => String(item.clientId) === String(project.clientId)).map((item) => ({ ...item, source: 'Client' })),
    lead ? state.leadContacts.filter((item) => String(item.leadId) === String(lead.id)).map((item) => ({ ...item, source: 'Lead' })) : []
  );
  const primaryContact = contacts.find((contact) => contact.isPrimary) || contacts[0] || null;
  const clientDisplayName = client?.companyName || client?.name || project.clientName || project.client || project.clientId || '-';
  const ownerDisplayName = owner?.fullName || owner?.username || owner?.email || project.assignedToName || project.ownerName || getUserDisplayName(project.assignedTo || project.createdBy, state);

  const invoiceTotals = invoices.map((invoice) => calculateInvoiceTotals(invoice, invoice.items || [], state.settings, client));
  const invoiceSnapshots = invoices.map((invoice) => getInvoiceSnapshot(invoice, state.payments.filter((payment) => String(payment.invoiceId) === String(invoice.id)), state.settings, client));
  const expenseImpacts = expenses.map(calculateExpenseImpact);
  const outsourcingImpacts = outsourcingExpenses.map((item) => calculateOutsourcingExpense(item, state.vendors.find((vendor) => String(vendor.id) === String(item.vendorId)), state.settings));
  const commissionImpacts = leadCommissions.map((item) => calculateLeadCommission(item, state.vendors.find((vendor) => String(vendor.id) === String(item.partnerId)), state.settings));

  const totalExpense = sumBy(expenseImpacts, (item) => item.expenseAmount)
    + sumBy(outsourcingImpacts, (item) => item.expenseImpact)
    + sumBy(commissionImpacts, (item) => item.expenseImpact);

  const totalInputGst = sumBy(expenseImpacts, (item) => item.inputGst)
    + sumBy(outsourcingImpacts, (item) => item.inputGst)
    + sumBy(commissionImpacts, (item) => item.inputGst);

  const projectTimeline = [
    ...(project.createdAt ? [{
      date: project.createdAt,
      title: 'Project created',
      detail: `Created by ${getUserDisplayName(project.createdBy || project.assignedTo, state)}`,
      kind: 'created',
      actorName: getUserDisplayName(project.createdBy || project.assignedTo, state),
      amount: 0
    }] : []),
    ...(project.updatedAt && String(project.updatedAt) !== String(project.createdAt || '') ? [{
      date: project.updatedAt,
      title: 'Project updated',
      detail: `Last updated by ${getUserDisplayName(project.createdBy || project.assignedTo, state)}`,
      kind: 'updated',
      actorName: getUserDisplayName(project.createdBy || project.assignedTo, state),
      amount: 0
    }] : []),
    ...projectActivities.map((activity) => ({
      date: getProjectActivityDate(activity) || activity.createdAt,
      title: activity.title || getProjectActivityKindLabel(activity.type),
      detail: activity.description || activity.category || 'Project activity',
      kind: activity.type,
      actorName: activity.createdByName || 'System',
      color: activity.color || null,
      meta: activity,
      amount: 0
    })),
    ...globalEvents.map((event) => ({
      date: event.startDate || event.endDate || event.createdAt,
      title: event.title || 'Event',
      detail: event.description || event.location || 'Project event',
      kind: 'event',
      actorName: getUserDisplayName(event.ownerUserId, state),
      color: event.color || null,
      meta: event,
      amount: 0
    })),
    ...invoices.map((invoice) => ({
      date: invoice.invoiceDate,
      title: 'Invoice created',
      detail: invoice.invoiceNumber,
      amount: invoice.totalAmount || invoice.items?.[0]?.total || 0
    })),
    ...expenses.map((expense) => ({
      date: expense.expenseDate,
      title: 'Expense booked',
      detail: expense.payeeName || expense.vendor || expense.invoiceNumber || 'Expense',
      amount: expense.totalAmount || expense.amountBeforeGst || 0
    }))
  ].filter((item) => item.date).sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return {
    project,
    lead,
    client,
    clientDisplayName,
    ownerDisplayName,
    contacts,
    primaryContact,
    activities: projectActivities,
    events,
    summary: {
      invoiceTotal: sumBy(invoiceTotals, (item) => item.totalAmount),
      taxableRevenue: sumBy(invoiceTotals, (item) => item.taxableAmount),
      gstOutput: sumBy(invoiceTotals, (item) => item.gstAmount),
      totalReceived: sumBy(invoiceSnapshots, (snapshot) => snapshot.amountPaid),
      totalOutstanding: sumBy(invoiceSnapshots, (snapshot) => snapshot.balanceDue),
      overdueOutstanding: sumBy(invoiceSnapshots.filter((snapshot) => snapshot.isOverdue), (snapshot) => snapshot.balanceDue),
      expenseAmount: totalExpense,
      outsourcingExpense: sumBy(outsourcingImpacts, (item) => item.expenseImpact),
      commissionExpense: sumBy(commissionImpacts, (item) => item.expenseImpact),
      inputGst: totalInputGst,
      profit: round2(sumBy(invoiceTotals, (item) => item.taxableAmount) - totalExpense),
      progressPercent: Number(project.progressPercent || project.progress || 0) || (String(project.status || '').toLowerCase() === 'completed' ? 100 : String(project.status || '').toLowerCase() === 'in progress' ? 55 : String(project.status || '').toLowerCase() === 'on hold' ? 25 : 0),
      activitiesCount: projectActivities.length,
      tasksCount: projectActivities.filter((item) => item.type === 'task').length,
      notesCount: projectActivities.filter((item) => item.type === 'note').length,
      remindersCount: projectActivities.filter((item) => item.type === 'reminder').length,
      eventsCount: events.length,
      contactsCount: contacts.length,
      finance: {
        totalInvoiced: sumBy(invoiceSnapshots, (snapshot) => snapshot.totalAmount),
        totalReceived: sumBy(invoiceSnapshots, (snapshot) => snapshot.amountPaid),
        outstanding: sumBy(invoiceSnapshots, (snapshot) => snapshot.balanceDue),
        overdueOutstanding: sumBy(invoiceSnapshots.filter((snapshot) => snapshot.isOverdue), (snapshot) => snapshot.balanceDue),
        expenseAmount: totalExpense,
        profit: round2(sumBy(invoiceTotals, (item) => item.taxableAmount) - totalExpense)
      }
    },
    invoices,
    expenses,
    outsourcingExpenses,
    leadCommissions,
    timeline: projectTimeline
  };
}

function buildRenewalDashboard(state) {
  const rows = [
    ...state.renewals.map((item) => ({ ...item, recordType: 'Renewal' })),
    ...state.amcs.map((item) => ({
      ...item,
      recordType: 'AMC',
      category: 'AMC',
      title: item.title || item.amcType || 'AMC',
      renewalDate: item.nextInvoiceDate || item.endDate,
      renewalPrice: item.amcAmount,
      daysRemaining: daysUntil(item.nextInvoiceDate || item.endDate)
    }))
  ];
  const activeRows = rows.filter((item) => getRenewalDate(item) && item.status !== 'Cancelled');
  const expired = activeRows.filter((item) => daysUntil(getRenewalDate(item)) < 0);
  const nearby = activeRows.filter((item) => {
    const remaining = daysUntil(getRenewalDate(item));
    return remaining !== null && remaining >= 0 && remaining <= 30;
  });
  const future = activeRows.filter((item) => {
    const remaining = daysUntil(getRenewalDate(item));
    return remaining !== null && remaining > 30;
  });
  return { rows: activeRows, expired, nearby, future };
}

module.exports = {
  buildClientSummary,
  buildDashboardSummary,
  buildLeadSummary,
  buildProjectSummary,
  buildRenewalDashboard,
  loadBusinessState,
  getRenewalDate,
  getRenewalTitle,
  getRenewalCategory,
  getRenewalProvider,
  getRenewalAmount,
  getComputedRenewalStatus
};
