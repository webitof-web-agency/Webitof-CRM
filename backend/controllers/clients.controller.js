const { createCrudController } = require('./crudController');
const clientModel = require('../models/client.model');
const clientContactModel = require('../models/clientContact.model');
const { withTransaction } = require('../config/db');
const { buildClientSummary } = require('../services/analytics.service');
const { cleanupRemovedAttachments } = require('../services/attachmentCleanup.service');

const clientsController = createCrudController(clientModel, {
  defaultOrder: 'updated_at DESC'
});

function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return `+${digits}`;
}

async function syncPrimaryClientContact(db, clientId, source = {}) {
  const contactName = String(source.contactPerson || source.name || '').trim();
  const email = String(source.email || '').trim();
  const phone = normalizePhone(source.mobile || source.phone || '');
  const existingResult = await db.query(
    'select * from client_contacts where client_id = $1 order by is_primary desc, created_at asc',
    [clientId]
  );
  const existing = existingResult.rows.map((row) => clientContactModel.hydrateRow(row));
  const primary = existing.find((item) => item.isPrimary) || existing[0] || null;

  if (!contactName && !email && !phone && !primary) {
    return;
  }

  if (primary) {
    await clientContactModel.update(primary.id, {
      firstName: contactName || primary.firstName || '',
      lastName: primary.lastName || '',
      email: email || primary.email || '',
      phone: phone || primary.phone || '',
      jobTitle: primary.jobTitle || 'Primary contact',
      gender: primary.gender || 'Other',
      notes: primary.notes || '',
      isPrimary: true
    }, db);
    return;
  }

  await clientContactModel.create({
    clientId,
    firstName: contactName || '',
    lastName: '',
    email,
    phone,
    jobTitle: 'Primary contact',
    gender: 'Other',
    notes: '',
    isPrimary: true
  }, db);
}

clientsController.create = async (req, res, next) => {
  try {
    const record = await withTransaction(async (db) => {
      const body = req.body || {};
      const created = await clientModel.create(body, db);
      await syncPrimaryClientContact(db, created.id, body);
      return created;
    });

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

clientsController.update = async (req, res, next) => {
  try {
    let previousActivities = [];
    let nextActivities = [];
    const record = await withTransaction(async (db) => {
      const current = await clientModel.findById(req.params.id, db);
      if (!current) return null;

      const patch = req.body || {};
      const updated = await clientModel.update(req.params.id, patch, db);
      previousActivities = Array.isArray(current.activities) ? current.activities : [];
      nextActivities = Array.isArray(updated.activities) ? updated.activities : [];
      await syncPrimaryClientContact(db, updated.id, {
        ...current,
        ...updated,
        ...patch
      });
      return updated;
    });

    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    await cleanupRemovedAttachments(previousActivities, nextActivities, {
      moduleName: 'clients',
      entityId: req.params.id
    });

    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

clientsController.remove = async (req, res, next) => {
  try {
    const current = await clientModel.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    const ok = await clientModel.remove(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    await cleanupRemovedAttachments(current.activities || [], [], {
      moduleName: 'clients',
      entityId: req.params.id
    });

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
};

clientsController.summary = async (req, res, next) => {
  try {
    const result = await buildClientSummary(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = clientsController;
