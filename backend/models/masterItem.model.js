const { createRepository, column } = require('./baseModel');

const masterItemRepository = createRepository({
  table: 'master_items',
  idPrefix: 'master',
  columns: [
    column({ key: 'type', db: 'type', type: 'string' }),
    column({ key: 'name', db: 'name', type: 'string' }),
    column({ key: 'isActive', db: 'is_active', type: 'boolean' }),
    column({ key: 'sortOrder', db: 'sort_order', type: 'number' })
  ],
  searchColumns: ['name', 'type', 'payload::text']
});

async function listByType(type, options = {}) {
  return masterItemRepository.list({ ...options, where: { ...(options.where || {}), type } });
}

async function findOne(type, id) {
  const record = await masterItemRepository.findById(id);
  return record && record.type === type ? record : null;
}

async function createByType(type, data = {}) {
  return masterItemRepository.create({ ...data, type });
}

async function updateByType(type, id, patch = {}) {
  const current = await findOne(type, id);
  if (!current) return null;
  return masterItemRepository.update(id, { ...patch, type });
}

async function removeByType(type, id) {
  const current = await findOne(type, id);
  if (!current) return false;
  return masterItemRepository.remove(id);
}

module.exports = {
  createByType,
  findOne,
  listByType,
  masterItemRepository,
  removeByType,
  updateByType
};
