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

// Inline check: requiring middlewares/auth here would be circular (auth -> auth.service -> this file).
function userCanViewAllLeads(user) {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return Array.isArray(user.permissions) && user.permissions.includes('leads.view_all');
}

function toIdList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item?.id ?? item ?? '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      return toIdList(JSON.parse(value));
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

// Without leads.view_all a user sees only leads they work on.
function isLeadParticipant(user, lead) {
  const userId = String(user?.id || '').trim();
  if (!userId || !lead) return false;
  const ids = [
    lead.assignedTo ?? lead.assigned_to,
    lead.leadOwner ?? lead.lead_owner,
    lead.createdBy ?? lead.created_by,
    ...toIdList(lead.secondaryAssignees ?? lead.secondary_assignees),
    ...toIdList(lead.managers)
  ];
  return ids.some((id) => String(id || '').trim() === userId);
}

function canAccessLead(user, lead) {
  if (!user || !lead) return false;
  if (!canAccessPipeline(user, lead.pipelineId || lead.pipeline_id || DEFAULT_PIPELINE_ID)) return false;
  return userCanViewAllLeads(user) || isLeadParticipant(user, lead);
}

// True when no per-lead filtering is needed (all pipelines and leads.view_all).
function userHasUnrestrictedLeadAccess(user) {
  return userHasAllPipelineAccess(user) && userCanViewAllLeads(user);
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
  canAccessLead,
  canAccessPipeline,
  ensureDefaultLeadPipeline,
  getPipelineIdOrDefault,
  getUserAllowedPipelineIds,
  normalizeAllowedPipelineIds,
  isLeadParticipant,
  sanitizePipelinePayload,
  userCanViewAllLeads,
  userHasAllPipelineAccess,
  userHasUnrestrictedLeadAccess
};
