const { createCrudController } = require('./crudController');
const leadModel = require('../models/lead.model');
const leadEventModel = require('../models/leadEvent.model');
const leadContactModel = require('../models/leadContact.model');
const clientContactModel = require('../models/clientContact.model');
const clientModel = require('../models/client.model');
const { withTransaction } = require('../config/db');
const { getSettings } = require('../models/settings.model');
const { buildLeadSummary } = require('../services/analytics.service');
const { notifyBusinessEvent } = require('../services/notification.service');

function normalizeLabels(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') return String(item.label || item.value || '').trim();
        return '';
      })
      .filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? normalizeLabels(parsed) : [];
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  return [];
}

function isWonStatus(settings, status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return false;

  const leadStatuses = Array.isArray(settings?.statuses?.leads) ? settings.statuses.leads : [];
  const wonLabels = leadStatuses
    .filter((item) => item && typeof item === 'object' && String(item.state || '').toLowerCase() === 'won')
    .map((item) => String(item.label || '').trim().toLowerCase())
    .filter(Boolean);

  return wonLabels.includes(normalized) || normalized === 'won';
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return `+${digits}`;
}

function getActorName(user) {
  if (!user) return 'System';
  return user.fullName || user.username || user.email || 'System';
}

function normalizeLeadLabels(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') return String(item.label || item.value || '').trim();
        return '';
      })
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? normalizeLeadLabels(parsed) : [];
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeSharedLabels(value) {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value).flat()
      : [];

  return source
    .map((item) => {
      if (typeof item === 'string') {
        const label = item.trim();
        return label ? { label, color: '#64748b' } : null;
      }
      if (item && typeof item === 'object') {
        const label = String(item.label || item.value || '').trim();
        if (!label) return null;
        return { label, color: item.color || item.badgeColor || '#64748b' };
      }
      return null;
    })
    .filter(Boolean);
}

function serializeForCompare(value) {
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((item) => String(item || '').trim()).filter(Boolean).sort());
  }
  if (value == null) return '';
  return String(value).trim();
}

function getLeadPatch(body = {}, current = null, req = null) {
  const type = body.type || current?.type || 'Organization';
  const companyName = String(body.companyName ?? current?.companyName ?? '').trim();
  const name = String(body.name ?? current?.name ?? '').trim();
  const ownerName = body.ownerName !== undefined
    ? String(body.ownerName || '').trim()
    : String(current?.ownerName || '').trim();
  const phone = normalizePhone(body.phone !== undefined ? body.phone : current?.phone);
  const labels = normalizeLeadLabels(body.labels !== undefined ? body.labels : current?.labels || []);

  return {
    ...body,
    type,
    name: type === 'Organization' ? (companyName || name) : name,
    companyName: type === 'Organization' ? companyName : companyName || name,
    phone,
    ownerName,
    labels,
    createdBy: current?.createdBy || req?.user?.id || null,
    assignedTo: current?.assignedTo || req?.user?.id || null
  };
}

function getFieldChangeSummary(current = {}, next = {}) {
  const fields = [
    ['type', 'Type'],
    ['name', 'Name'],
    ['companyName', 'Company name'],
    ['ownerName', 'Owner'],
    ['phone', 'Phone'],
    ['email', 'Email'],
    ['status', 'Status'],
    ['source', 'Source'],
    ['followUpDate', 'Follow up date'],
    ['value', 'Value'],
    ['labels', 'Labels'],
    ['notes', 'Notes'],
    ['city', 'City'],
    ['state', 'State'],
    ['country', 'Country']
  ];

  const changes = [];
  fields.forEach(([key, label]) => {
    const before = serializeForCompare(current[key]);
    const after = serializeForCompare(next[key]);
    if (before !== after) {
      changes.push({ key, label, before: current[key], after: next[key] });
    }
  });
  return changes;
}

async function createLeadTimelineEvent(db, lead, req, { kind, title, description, meta = {}, date = null, eventType = 'system' }) {
  const actor = req?.user || null;
  return leadEventModel.create({
    leadId: lead.id,
    eventType,
    title,
    description,
    startDate: date || lead.updatedAt || lead.createdAt || null,
    endDate: date || lead.updatedAt || lead.createdAt || null,
    payload: {
      kind,
      actorUserId: actor?.id || null,
      actorName: getActorName(actor),
      meta
    }
  }, db);
}

function buildClientFromLead(lead, settings, primaryContactName = '') {
  const leadLabels = normalizeLabels(lead.labels);
  const labelColorMap = new Map();

  [
    ...normalizeSharedLabels(settings?.labels || [])
  ].forEach((item) => {
    if (item && typeof item === 'object') {
      const label = String(item.label || item.value || '').trim();
      if (label) labelColorMap.set(label.toLowerCase(), item.color || '#64748b');
    }
  });

  return {
    name: lead.type === 'Person' ? (lead.name || lead.companyName || '') : (lead.companyName || lead.name || ''),
    companyName: lead.companyName || '',
    clientType: lead.type === 'Person' ? 'Person' : 'Organization',
    assignedTo: lead.assignedTo || '',
    managers: lead.managers || '',
    source: lead.source || '',
    mobile: lead.phone || '',
    email: lead.email || '',
    website: lead.website || '',
    billingAddress: lead.address || '',
    contactPerson: primaryContactName || lead.contactPerson || lead.ownerName || '',
    city: lead.city || '',
    state: lead.state || '',
    pincode: lead.pincode || '',
    country: lead.country || 'India',
    vatNumber: lead.vatNumber || '',
    gstNumber: lead.gstNumber || '',
    currency: lead.currency || 'INR',
    currencySymbol: lead.currencySymbol || '',
    labels: leadLabels.map((label) => {
      const color = labelColorMap.get(String(label).toLowerCase());
      return color ? { label, color } : label;
    }),
    followUpDate: lead.followUpDate || '',
    notes: lead.notes || '',
    status: 'Active'
  };
}

async function convertLeadRecord(leadId, settings, db) {
  const current = await leadModel.findById(leadId, db);
  if (!current) return null;

  const leadContactsResult = await db.query(
    'select * from lead_contacts where lead_id = $1 order by created_at asc, updated_at asc',
    [leadId]
  );
  const leadContacts = leadContactsResult.rows.map((row) => leadContactModel.hydrateRow(row)).filter(Boolean);
  const primaryLeadContact = leadContacts[0] || null;
  const primaryContactName = primaryLeadContact
    ? `${primaryLeadContact.firstName || ''} ${primaryLeadContact.lastName || ''}`.trim()
    : String(current.ownerName || current.contactPerson || '').trim();

  const clientRecord = await clientModel.create(buildClientFromLead(current, settings, primaryContactName), db);

  if (leadContacts.length) {
    for (let index = 0; index < leadContacts.length; index += 1) {
      const contact = leadContacts[index];
      await clientContactModel.create({
        clientId: clientRecord.id,
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email: contact.email || '',
        phone: contact.phone || '',
        jobTitle: contact.jobTitle || '',
        gender: contact.gender || 'Other',
        notes: contact.notes || '',
        isPrimary: index === 0
      }, db);
    }
  } else if (primaryContactName) {
    await clientContactModel.create({
      clientId: clientRecord.id,
      firstName: current.contactPerson || primaryContactName,
      lastName: '',
      email: current.email || '',
      phone: current.phone || '',
      jobTitle: 'Primary Contact',
      gender: 'Other',
      notes: current.notes || '',
      isPrimary: true
    }, db);
  }

  await leadModel.remove(leadId, db);

  return { lead: current, client: clientRecord };
}

const baseController = createCrudController(leadModel, {
  defaultOrder: 'updated_at DESC',
  onCreate: async (body, req) => getLeadPatch(body, null, req),
  onUpdate: async (body, req, current) => getLeadPatch(body, current, req)
});

const leadsController = {
  ...baseController,
  create: async (req, res, next) => {
    try {
      const record = await withTransaction(async (db) => {
        const body = getLeadPatch(req.body || {}, null, req);
        const created = await leadModel.create(body, db);
        await createLeadTimelineEvent(db, created, req, {
          kind: 'created',
          title: 'Lead created',
          description: `Created by ${getActorName(req.user)}`
        });
        return created;
      });

      notifyBusinessEvent({
        moduleName: 'leads',
        eventKey: 'created',
        entity: record,
        title: 'Lead created',
        message: `${record.name || record.companyName || 'Lead'} was created.`,
        actorUserId: req.user?.id || null,
        explicitUserIds: [record.assignedTo, record.createdBy].filter(Boolean),
        routePath: `/app/leads/${record.id}`
      }).catch(() => {});

      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  },
  summary: async (req, res, next) => {
    try {
      const result = await buildLeadSummary(req.params.id);
      if (!result) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
  update: async (req, res, next) => {
    try {
      const record = await withTransaction(async (db) => {
        const current = await leadModel.findById(req.params.id, db);
        if (!current) return null;

        const patch = getLeadPatch(req.body || {}, current, req);
        const updated = await leadModel.update(req.params.id, patch, db);
        const changes = getFieldChangeSummary(current, updated);
        const statusChanged = String(current.status || '').trim() !== String(updated.status || '').trim();

        if (statusChanged) {
          await createLeadTimelineEvent(db, updated, req, {
            kind: 'status_changed',
            title: `Status changed to ${updated.status || 'Updated'}`,
            description: `Changed from ${current.status || '-'} by ${getActorName(req.user)}`,
            meta: {
              previousStatus: current.status || '',
              nextStatus: updated.status || ''
            }
          });
        }

        const meaningfulChanges = changes.filter((change) => change.key !== 'status');
        if (meaningfulChanges.length) {
          const summary = meaningfulChanges.slice(0, 4).map((change) => change.label).join(', ');
          await createLeadTimelineEvent(db, updated, req, {
            kind: 'updated',
            title: 'Lead updated',
            description: `${summary} updated by ${getActorName(req.user)}`,
            meta: {
              changes: meaningfulChanges.map((change) => ({
                key: change.key,
                label: change.label,
                before: change.before,
                after: change.after
              }))
            }
          });
        }

        return updated;
      });

      if (!record) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      notifyBusinessEvent({
        moduleName: 'leads',
        eventKey: 'updated',
        entity: record,
        title: 'Lead updated',
        message: `${record.name || record.companyName || 'Lead'} was updated.`,
        actorUserId: req.user?.id || null,
        explicitUserIds: [record.assignedTo, record.createdBy].filter(Boolean),
        routePath: `/app/leads/${record.id}`
      }).catch(() => {});

      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  },
  convert: async (req, res, next) => {
    try {
      const settings = await getSettings();
      const converted = await withTransaction(async (db) => convertLeadRecord(req.params.id, settings, db));
      if (!converted) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      notifyBusinessEvent({
        moduleName: 'leads',
        eventKey: 'converted',
        entity: converted.client,
        title: 'Lead converted',
        message: `${converted.lead?.name || converted.lead?.companyName || 'Lead'} was converted to a client.`,
        severity: 'success',
        actorUserId: req.user?.id || null,
        explicitUserIds: [converted.lead?.assignedTo, converted.lead?.createdBy].filter(Boolean),
        routePath: `/app/clients/${converted.client.id}`
      }).catch(() => {});

      return res.json({
        success: true,
        data: converted.client,
        convertedLeadId: req.params.id,
        clientId: converted.client.id,
        deletedLead: true
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = leadsController;
