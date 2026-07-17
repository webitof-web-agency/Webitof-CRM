const multer = require('multer');
const fileAssetModel = require('../models/fileAsset.model');
const { archiveFile, listFiles, uploadBuffer, listDriveDirectory, createNewFolder } = require('../services/driveStorage.service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_SIZE_BYTES || 25 * 1024 * 1024)
  }
});

async function list(req, res, next) {
  try {
    const filters = {};
    if (req.query.moduleName) filters.moduleName = req.query.moduleName;
    if (req.query.entityId) filters.entityId = req.query.entityId;
    if (req.query.folderKey) filters.folderKey = req.query.folderKey;
    const rows = await listFiles(filters, req.query.search || '');
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function browseDrive(req, res, next) {
  try {
    const { folderId } = req.query;
    const data = await listDriveDirectory(folderId);

    // Map Drive files format to frontend expected format
    const mapped = data.files.map(f => ({
      id: f.id,
      driveFileId: f.id,
      originalName: f.name,
      name: f.name,
      mimeType: f.mimeType,
      sizeBytes: f.size ? parseInt(f.size, 10) : 0,
      driveWebViewLink: f.webViewLink,
      driveWebContentLink: f.webContentLink,
      createdAt: f.createdTime,
      updatedAt: f.modifiedTime,
      // Default mapping for FileBrowser
      moduleName: 'Drive',
      isPublic: false
    }));

    res.json({ success: true, data: { folderId: data.folderId, files: mapped } });
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
    const folderKey = req.body.folderKey || '';
    const folderId = req.body.folderId || null;
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
      let isPublic = false;
      if (req.body.isPublic !== undefined) {
        isPublic = String(req.body.isPublic) === 'true';
      }
      const record = await uploadBuffer({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        moduleName,
        entityId,
        folderParts: folderKey ? folderKey.split('/').filter(Boolean) : [],
        isPublic,
        targetFolderId: folderId
      });
      const saved = await fileAssetModel.create({ ...record, ...extraPayload });
      uploaded.push(saved);
    }

    res.status(201).json({ success: true, data: uploaded });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const record = await fileAssetModel.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function archive(req, res, next) {
  try {
    const record = await archiveFile(req.params.id, req.body?.reason || 'archived');
    if (!record) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function viewDriveFile(req, res, next) {
  try {
    const { getDriveClient } = require('../services/driveStorage.service');
    const fileAssetModel = require('../models/fileAsset.model');
    const drive = await getDriveClient();

    const record = (await fileAssetModel.list({ where: { driveFileId: req.params.driveFileId } }))[0];
    const mimeType = record?.mimeType || 'image/png';

    const response = await drive.files.get(
      { fileId: req.params.driveFileId, alt: 'media' },
      { responseType: 'stream' }
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    response.data.pipe(res);
  } catch (error) {
    console.error('Error fetching drive file:', error);
    res.status(404).send('Image not found or access denied');
  }
}

async function createDriveFolderController(req, res, next) {
  try {
    const { name, parentDriveId } = req.body || {};
    if (!name) {
      return res.status(400).json({ success: false, message: 'Folder name is required' });
    }
    const result = await createNewFolder(name, parentDriveId);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function renameDriveFile(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const { renameFile } = require('../services/driveStorage.service');
    const result = await renameFile(req.params.driveFileId, name);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function deleteDriveFile(req, res, next) {
  try {
    const { deleteFileByDriveId } = require('../services/driveStorage.service');
    await deleteFileByDriveId(req.params.driveFileId);
    res.json({ success: true, message: 'Moved to trash' });
  } catch (error) {
    next(error);
  }
}

async function getUsage(req, res, next) {
  try {
    const { getDriveUsage } = require('../services/driveStorage.service');
    const usageData = await getDriveUsage();
    res.json({ success: true, data: usageData });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  archive,
  browseDrive,
  createDriveFolderController,
  deleteDriveFile,
  getById,
  getUsage,
  list,
  renameDriveFile,
  upload,
  uploadFiles,
  viewDriveFile
};
