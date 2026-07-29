const leadPipelineModel = require('../models/leadPipeline.model');
const { query, withTransaction } = require('../config/db');
const {
  DEFAULT_PIPELINE_ID,
  canAccessPipeline,
  ensureDefaultLeadPipeline,
  getUserAllowedPipelineIds,
  sanitizePipelinePayload,
  userHasAllPipelineAccess
} = require('../services/leadPipelineAccess.service');

async function list(req, res, next) {
  try {
    await ensureDefaultLeadPipeline();
    const rows = await leadPipelineModel.list({ orderBy: 'sort_order ASC, name ASC' });
    const visibleRows = userHasAllPipelineAccess(req.user)
      ? rows
      : rows.filter((row) => canAccessPipeline(req.user, row.id));

    res.json({
      success: true,
      data: visibleRows,
      access: {
        all: userHasAllPipelineAccess(req.user),
        allowedPipelineIds: getUserAllowedPipelineIds(req.user)
      }
    });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const payload = sanitizePipelinePayload(req.body || {});
    if (!payload.name) {
      return res.status(400).json({ success: false, message: 'Pipeline name is required' });
    }
    const created = await leadPipelineModel.create(payload);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const current = await leadPipelineModel.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Pipeline not found' });
    }
    const payload = sanitizePipelinePayload({ ...current, ...(req.body || {}) });
    const updated = await leadPipelineModel.update(req.params.id, payload);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    if (String(req.params.id) === DEFAULT_PIPELINE_ID) {
      return res.status(400).json({ success: false, message: 'Default pipeline cannot be deleted' });
    }

    const removed = await withTransaction(async (client) => {
      const leadCount = await client.query('select count(*)::int as count from leads where pipeline_id = $1', [req.params.id]);
      if (Number(leadCount.rows[0]?.count || 0) > 0) {
        const disabled = await leadPipelineModel.update(req.params.id, { isActive: false }, client);
        return { disabled };
      }
      const ok = await leadPipelineModel.remove(req.params.id, client);
      return { ok };
    });

    if (!removed.ok && !removed.disabled) {
      return res.status(404).json({ success: false, message: 'Pipeline not found' });
    }

    if (removed.disabled) {
      return res.json({ success: true, message: 'Pipeline disabled because leads are assigned to it', data: removed.disabled });
    }

    res.json({ success: true, message: 'Pipeline deleted successfully' });
  } catch (error) {
    next(error);
  }
}

async function options(req, res, next) {
  try {
    const result = await query(
      `select id, name, code, color, is_active
       from lead_pipelines
       where is_active = true
       order by sort_order asc, name asc`
    );
    res.json({ success: true, data: result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      color: row.color,
      isActive: row.is_active
    })) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  create,
  list,
  options,
  remove,
  update
};
