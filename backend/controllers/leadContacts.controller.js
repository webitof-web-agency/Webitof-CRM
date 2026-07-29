const leadContactModel = require('../models/leadContact.model');
const leadModel = require('../models/lead.model');
const { DEFAULT_PIPELINE_ID, canAccessPipeline, userHasAllPipelineAccess } = require('../services/leadPipelineAccess.service');

function forbiddenPipelineError() {
  const error = new Error('You do not have access to this lead pipeline');
  error.statusCode = 403;
  return error;
}

async function getAccessibleLead(leadId, req) {
  const lead = await leadModel.findById(leadId);
  if (!lead) return null;
  if (!canAccessPipeline(req?.user, lead.pipelineId || DEFAULT_PIPELINE_ID)) {
    throw forbiddenPipelineError();
  }
  return lead;
}

async function filterContactsByAccess(rows = [], req) {
  if (userHasAllPipelineAccess(req?.user)) return rows;
  const leadIds = [...new Set(rows.map((row) => row.leadId).filter(Boolean))];
  if (!leadIds.length) return [];
  const allowedLeadIds = new Set();
  for (const leadId of leadIds) {
    const lead = await leadModel.findById(leadId);
    if (lead && canAccessPipeline(req?.user, lead.pipelineId || DEFAULT_PIPELINE_ID)) {
      allowedLeadIds.add(String(leadId));
    }
  }
  return rows.filter((row) => allowedLeadIds.has(String(row.leadId)));
}

async function list(req, res, next) {
  try {
    const { search, limit, offset, orderBy, ...filters } = req.query || {};
    let rows = await leadContactModel.list({
      where: filters,
      search,
      orderBy: orderBy || 'updated_at DESC'
    });
    rows = await filterContactsByAccess(rows, req);

    if (limit || offset) {
      const start = Number(offset || 0);
      const end = limit ? start + Number(limit) : undefined;
      rows = rows.slice(start, end);
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const record = await leadContactModel.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    await getAccessibleLead(record.leadId, req);
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const lead = await getAccessibleLead(req.body?.leadId, req);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    const record = await leadContactModel.create(req.body || {});
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const current = await leadContactModel.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    await getAccessibleLead(current.leadId, req);
    if (req.body?.leadId && String(req.body.leadId) !== String(current.leadId)) {
      await getAccessibleLead(req.body.leadId, req);
    }
    const record = await leadContactModel.update(req.params.id, req.body || {});
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const current = await leadContactModel.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    await getAccessibleLead(current.leadId, req);
    const ok = await leadContactModel.remove(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  create,
  getById,
  list,
  remove,
  update
};
