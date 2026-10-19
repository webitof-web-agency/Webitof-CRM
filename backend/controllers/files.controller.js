const multer = require('multer');
const path = require('path');
const fileAssetModel = require('../models/fileAsset.model');
const leadModel = require('../models/lead.model');
const fileService = require('../services/file.service');
const { DEFAULT_PIPELINE_ID, canAccessPipeline } = require('../services/leadPipelineAccess.service');

const LEAD_ATTACHMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.zip']);
const EARLIER_UPLOADS_FOLDER = 'earlier-uploads';

async function assertLeadFileAccess(moduleName, entityId, req) {
  if (String(moduleName || '').toLowerCase() !== 'leads' || !entityId || String(entityId).startsWith('lead-draft-')) return;
  const lead = await leadModel.findById(entityId);
  if (!lead || !canAccessPipeline(req?.user, lead.pipelineId || DEFAULT_PIPELINE_ID)) {
    const error = new Error('You do not have access to this lead file');
    error.statusCode = 403;
    throw error;
  }
}

function validateLeadAttachments(files = [], moduleName = '') {
  if (String(moduleName).toLowerCase() !== 'leads') return;
  for (const file of files) {
    const extension = path.extname(String(file.originalname || '')).toLowerCase();
    if (!LEAD_ATTACHMENT_EXTENSIONS.has(extension)) {
      const error = new Error(`Unsupported lead attachment type: ${extension || 'unknown'}`);
      error.statusCode = 400;
      throw error;
    }
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_SIZE_BYTES || 25 * 1024 * 1024)
  }
});

function notFound(res) {
  return res.status(404).json({ success: false, message: 'File not found' });
}

async function list(req, res, next) {
  try {
    const filters = {};
    if (req.query.moduleName) filters.moduleName = req.query.moduleName;
    if (req.query.entityId) filters.entityId = req.query.entityId;
    if (req.query.folderKey) filters.folderKey = req.query.folderKey;
    await assertLeadFileAccess(filters.moduleName, filters.entityId, req);
    const rows = await fileAssetModel.list({ where: filters, search: req.query.search || '', orderBy: 'created_at DESC' });
    res.json({ success: true, data: rows.map(fileService.toPublicFile) });
  } catch (error) {
    next(error);
  }
}

// Uploads made before storage providers sit in Drive folders outside the layout;
// they are shown under "earlier-uploads/<module>".
function virtualFolderOf(record) {
  const key = String(record.folderKey || '');
  if (key === 'site' || /^\d{4}\//.test(key)) return key;
  const moduleName = String(record.moduleName || 'general').toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'general';
  return `${EARLIER_UPLOADS_FOLDER}/${moduleName}`;
}

// Virtual folder view over every stored file, whichever provider holds it.
async function browse(req, res, next) {
  try {
    const current = String(req.query.path || '').replace(/^\/+|\/+$/g, '');
    const search = String(req.query.search || '').trim();
    const rows = (await fileAssetModel.list({ search, orderBy: 'created_at DESC' })).filter((row) => !row.isArchived);

    if (search) {
      return res.json({ success: true, data: { path: current, folders: [], files: rows.map(fileService.toPublicFile) } });
    }

    const prefix = current ? `${current}/` : '';
    const folders = new Map();
    const files = [];
    for (const row of rows) {
      const folder = virtualFolderOf(row);
      if (folder === current) {
        files.push(fileService.toPublicFile(row));
      } else if (folder.startsWith(prefix)) {
        const name = folder.slice(prefix.length).split('/')[0];
        const entry = folders.get(name) || { name, path: `${prefix}${name}`, fileCount: 0 };
        entry.fileCount += 1;
        folders.set(name, entry);
      }
    }

    const sortedFolders = Array.from(folders.values()).sort((a, b) => {
      // Newest year/month first; everything else alphabetically.
      if (/^\d{4}$/.test(a.name) && /^\d{4}$/.test(b.name)) return b.name.localeCompare(a.name);
      return a.name.localeCompare(b.name);
    });
    res.json({ success: true, data: { path: current, folders: sortedFolders, files } });
  } catch (error) {
    next(error);
  }
}

async function uploadFiles(req, res, next) {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    if (!files.length) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const moduleName = String(req.body.moduleName || 'general').trim();
    const entityId = String(req.body.entityId || '').trim();
    await assertLeadFileAccess(moduleName, entityId, req);
    validateLeadAttachments(files, moduleName);
    const reservedKeys = new Set(['moduleName', 'entityId', 'folderKey', 'folderId', 'isPublic', 'file', 'files']);
    const extraPayload = {};
    Object.entries(req.body || {}).forEach(([key, value]) => {
      if (reservedKeys.has(key)) return;
      if (value == null || value === '') return;
      if (key === 'labels') {
        try {
          extraPayload[key] = JSON.parse(value);
          return;
        } catch {
          extraPayload[key] = String(value)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
          return;
        }
      }
      extraPayload[key] = value;
    });

    const uploaded = [];
    for (const file of files) {
      uploaded.push(await fileService.saveUpload({
        buffer: file.buffer,
        originalName: file.originalname,
        moduleName,
        entityId,
        extra: extraPayload
      }));
    }

    res.status(201).json({ success: true, data: uploaded });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const record = await fileService.findByRef(req.params.id);
    if (!record) return notFound(res);
    await assertLeadFileAccess(record.moduleName, record.entityId, req);
    res.json({ success: true, data: fileService.toPublicFile(record) });
  } catch (error) {
    next(error);
  }
}

async function archive(req, res, next) {
  try {
    const current = await fileService.findByRef(req.params.id);
    if (!current) return notFound(res);
    await assertLeadFileAccess(current.moduleName, current.entityId, req);
    res.json({ success: true, data: await fileService.archiveFile(current, req.body?.reason || 'archived') });
  } catch (error) {
    next(error);
  }
}

function contentDisposition(type, name) {
  const fallback = String(name || 'file').replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name || 'file')}`;
}

async function streamRecord(record, req, res) {
  const opened = await fileService.openFile(record, { range: req.headers.range || '' });
  if (!opened) return notFound(res);

  const inline = fileService.isInlineMime(record.mimeType) && !req.query.download;
  const headers = {
    'Content-Type': inline ? record.mimeType : 'application/octet-stream',
    'Content-Disposition': contentDisposition(inline ? 'inline' : 'attachment', record.originalName),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=86400',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Accept-Ranges': 'bytes'
  };
  // Chrome's PDF viewer refuses to open inside a sandbox.
  if (record.mimeType !== 'application/pdf') {
    headers['Content-Security-Policy'] = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox";
  }
  if (opened.contentLength) headers['Content-Length'] = String(opened.contentLength);
  if (opened.contentRange) headers['Content-Range'] = opened.contentRange;

  res.writeHead(opened.status, headers);
  opened.stream.on('error', () => res.destroy());
  opened.stream.pipe(res);
}

async function viewFile(req, res) {
  try {
    const record = await fileService.findByRef(req.params.id);
    if (!record) return notFound(res);
    await streamRecord(record, req, res);
  } catch (error) {
    console.error('File view failed:', error.message);
    if (!res.headersSent) notFound(res);
  }
}

// Links saved before storage providers point at /files/drive/<drive id>/view.
async function viewLegacyDriveFile(req, res) {
  try {
    const record = await fileService.findByRef(req.params.driveFileId);
    if (!record) return notFound(res);
    await streamRecord(record, req, res);
  } catch (error) {
    console.error('File view failed:', error.message);
    if (!res.headersSent) notFound(res);
  }
}

async function rename(req, res, next) {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const current = await fileService.findByRef(req.params.id);
    if (!current) return notFound(res);
    await assertLeadFileAccess(current.moduleName, current.entityId, req);
    res.json({ success: true, data: await fileService.renameFile(current, name) });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const current = await fileService.findByRef(req.params.id);
    if (!current) return notFound(res);
    await assertLeadFileAccess(current.moduleName, current.entityId, req);
    await fileService.removeFile(current);
    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    next(error);
  }
}

async function getUsage(req, res, next) {
  try {
    const files = await fileAssetModel.list();
    const usage = files.reduce((sum, file) => (file.isArchived ? sum : sum + (Number(file.sizeBytes) || 0)), 0);
    res.json({ success: true, data: { usage, limit: 0 } });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  archive,
  browse,
  getById,
  getUsage,
  list,
  remove,
  rename,
  upload,
  uploadFiles,
  viewFile,
  viewLegacyDriveFile
};
