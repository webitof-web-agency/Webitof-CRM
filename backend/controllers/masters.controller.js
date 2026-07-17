const { createId, nowIso, toNumber } = require('../utils/format');
const { createByType, findOne, listByType, removeByType, updateByType } = require('../models/masterItem.model');

const TYPE_ALIASES = {
  service: 'service',
  services: 'service',
  service_category: 'service_category',
  service_categories: 'service_category',
  expense_category: 'expense_category',
  expense_categories: 'expense_category',
  tax_rate: 'tax_rate',
  tax_rates: 'tax_rate',
  vendor: 'vendor',
  vendors: 'vendor',
  renewal_provider: 'renewal_provider',
  renewal_providers: 'renewal_provider',
  amc_type: 'amc_type',
  amc_types: 'amc_type',
  billing_cycle: 'billing_cycle',
  billing_cycles: 'billing_cycle',
  invoice_term: 'invoice_term',
  invoice_terms: 'invoice_term'
};

const ALLOWED_TYPES = new Set(Object.values(TYPE_ALIASES));

function normalizeType(type) {
  return String(type || '').trim();
}

function assertAllowedType(type) {
  const normalized = normalizeType(type);
  const resolved = TYPE_ALIASES[normalized];
  if (!resolved || !ALLOWED_TYPES.has(resolved)) {
    const error = new Error(`Unsupported master type: ${type}`);
    error.statusCode = 400;
    throw error;
  }
  return resolved;
}

function getActor(user = null) {
  if (!user) return null;
  return {
    id: user.id || null,
    name: user.fullName || user.name || user.username || 'Unknown',
    username: user.username || null,
    email: user.email || null
  };
}

function normalizeServicePrice(value) {
  const number = toNumber(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function buildServicePriceEntry({ from = 0, to = 0, user = null, reason = 'updated' } = {}) {
  const actor = getActor(user);
  return {
    id: createId('svc-price'),
    from: normalizeServicePrice(from),
    to: normalizeServicePrice(to),
    reason,
    changedAt: nowIso(),
    changedBy: actor
  };
}

function normalizeServicePayloadForSave(current = null, patch = {}, user = null) {
  const currentPayload = current?.payload || {};
  const nextPayload = { ...(patch.payload || {}) };
  const currentPrice = normalizeServicePrice(current?.defaultPrice ?? currentPayload.defaultPrice ?? 0);
  const patchPrice = patch.defaultPrice != null
    ? normalizeServicePrice(patch.defaultPrice)
    : normalizeServicePrice(nextPayload.defaultPrice ?? currentPrice);
  const priceHistory = Array.isArray(currentPayload.priceHistory) ? [...currentPayload.priceHistory] : [];
  const priceChanged = !current || currentPrice !== patchPrice;

  if (!current) {
    priceHistory.push(buildServicePriceEntry({ from: patchPrice, to: patchPrice, user, reason: 'created' }));
  } else if (priceChanged) {
    priceHistory.push(buildServicePriceEntry({ from: currentPrice, to: patchPrice, user, reason: 'price changed' }));
  }

  const lastChange = priceHistory[priceHistory.length - 1] || null;
  return {
    ...patch,
    payload: {
      ...currentPayload,
      ...nextPayload,
      defaultPrice: patchPrice,
      priceHistory,
      lastPriceChangeAt: lastChange?.changedAt || currentPayload.lastPriceChangeAt || null,
      lastPriceChangeBy: lastChange?.changedBy || currentPayload.lastPriceChangeBy || null
    }
  };
}

async function listMasters(req, res, next) {
  try {
    const type = req.params.type ? assertAllowedType(req.params.type) : null;
    if (type) {
      const rows = await listByType(type, { search: req.query.search });
      return res.json({ success: true, data: rows });
    }

    const types = Array.from(ALLOWED_TYPES);
    const result = {};
    for (const itemType of types) {
      result[itemType] = await listByType(itemType, { search: req.query.search });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function createMaster(req, res, next) {
  try {
    const type = assertAllowedType(req.params.type);
    const body = type === 'service'
      ? normalizeServicePayloadForSave(null, req.body || {}, req.user)
      : (req.body || {});
    const record = await createByType(type, body);
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function updateMaster(req, res, next) {
  try {
    const type = assertAllowedType(req.params.type);
    const current = type === 'service' ? await findOne(type, req.params.id) : null;
    const body = type === 'service'
      ? normalizeServicePayloadForSave(current, req.body || {}, req.user)
      : (req.body || {});
    const record = await updateByType(type, req.params.id, body);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function deleteMaster(req, res, next) {
  try {
    const type = assertAllowedType(req.params.type);
    const ok = await removeByType(type, req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createMaster,
  deleteMaster,
  listMasters,
  updateMaster
};
