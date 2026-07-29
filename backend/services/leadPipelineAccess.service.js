const { query } = require('../config/db');
const leadPipelineModel = require('../models/leadPipeline.model');

const DEFAULT_PIPELINE_ID = 'pipe-default';
const DEFAULT_PIPELINE = {
  id: DEFAULT_PIPELINE_ID,
  name: 'Default Pipeline',
  code: 'default',
  description: 'Default lead pipeline',
  color: '#2563eb',
  sortOrder: 0,
  isActive: true
};

function normalizePipelineName(name) {
  return String(name || '').trim();
}

function normalizePipelineCode(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'pipeline';
}

function normalizeAllowedPipelineIds(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return normalizeAllowedPipelineIds(parsed);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function getUserAllowedPipelineIds(user) {
  return normalizeAllowedPipelineIds(user?.payload?.allowedLeadPipelineIds);
}

function userHasAllPipelineAccess(user) {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  const allowed = getUserAllowedPipelineIds(user);
  return allowed.length === 0;
}

function canAccessPipeline(user, pipelineId) {
  if (userHasAllPipelineAccess(user)) return true;
  const allowed = getUserAllowedPipelineIds(user);
  return allowed.includes(String(pipelineId || DEFAULT_PIPELINE_ID));
}

async function ensureDefaultLeadPipeline(dbClient = null) {
  const exec = dbClient?.query || query;
  const existing = await exec.call(dbClient || null, 'select id from lead_pipelines where id = $1 limit 1', [DEFAULT_PIPELINE_ID]);
  if (!existing.rows.length) {
    await leadPipelineModel.create(DEFAULT_PIPELINE, dbClient);
  }
  await exec.call(dbClient || null, `update leads set pipeline_id = $1 where pipeline_id is null or pipeline_id = ''`, [DEFAULT_PIPELINE_ID]);
  return DEFAULT_PIPELINE_ID;
}

async function getPipelineIdOrDefault(pipelineId, dbClient = null) {
  const id = String(pipelineId || '').trim();
  if (!id) return DEFAULT_PIPELINE_ID;
  const pipeline = await leadPipelineModel.findById(id, dbClient);
  return pipeline ? pipeline.id : DEFAULT_PIPELINE_ID;
}

function sanitizePipelinePayload(body = {}) {
  const name = normalizePipelineName(body.name);
  const code = normalizePipelineCode(body.code || name);
  return {
    name,
    code,
    description: String(body.description || '').trim(),
    color: String(body.color || '#2563eb').trim(),
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    isActive: body.isActive !== false
  };
}

module.exports = {
  DEFAULT_PIPELINE,
  DEFAULT_PIPELINE_ID,
  canAccessPipeline,
  ensureDefaultLeadPipeline,
  getPipelineIdOrDefault,
  getUserAllowedPipelineIds,
  normalizeAllowedPipelineIds,
  sanitizePipelinePayload,
  userHasAllPipelineAccess
};
