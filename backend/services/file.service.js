// Upload pipeline shared by every module: type allowlist, size limit, storage key,
// active storage provider, file_assets row. Reads go through each file's own provider.
const path = require('path');
const { randomUUID } = require('crypto');
const fileAssetModel = require('../models/fileAsset.model');
const storage = require('./storage/storage.service');
const { buildFolderPath } = require('../utils/uploadPath');
const { createId } = require('../utils/format');

// Extension → stored and served MIME type. The browser's Content-Type is never trusted,
// so .html or .svg cannot run script in the app's origin.
const DOCUMENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.rtf': 'application/rtf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.zip': 'application/zip'
};
const AUDIO_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.amr': 'audio/amr',
  '.3gp': 'audio/3gpp',
  '.flac': 'audio/flac',
  '.webm': 'audio/webm',
  '.caf': 'audio/x-caf',
  '.opus': 'audio/ogg',
  '.mp4': 'audio/mp4'
};
const ALL_TYPES = { ...DOCUMENT_TYPES, ...AUDIO_TYPES };

const INLINE_MIME = /^(image\/(jpeg|png|gif|webp|bmp)|application\/pdf|audio\/.+)$/;

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

function maxUploadBytes() {
  return Number(process.env.UPLOAD_MAX_SIZE_BYTES || 25 * 1024 * 1024);
}

function cleanOriginalName(name) {
  return path.basename(String(name || 'file')).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180) || 'file';
}

function buildStoredName(originalName, extension) {
  const base = path.basename(originalName, path.extname(originalName))
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase() || 'file';
  const unique = `${Date.now().toString(36)}${randomUUID().replace(/-/g, '').slice(0, 4)}`;
  return `${base}-${unique}${extension}`;
}

function resolveType(originalName, types) {
  const extension = path.extname(originalName).toLowerCase();
  const mimeType = types[extension];
  if (!mimeType) {
    throw httpError(`Unsupported file type: ${extension || 'unknown'}`);
  }
  return { extension, mimeType };
}

function locatorOf(record) {
  return {
    storageProvider: record.storageProvider || 'gdrive',
    storageKey: record.storageKey || record.driveFileId,
    storageBucket: record.storageBucket || record.driveFolderId || ''
  };
}

function toPublicFile(record) {
  if (!record) return record;
  return { ...record, viewUrl: `/files/${record.id}/view` };
}

async function saveUpload({
  buffer,
  originalName,
  moduleName = 'general',
  entityId = '',
  types = DOCUMENT_TYPES,
  maxBytes = maxUploadBytes(),
  extra = {},
  dbClient = null
}) {
  if (!buffer?.length) throw httpError('Empty files cannot be uploaded');
  if (buffer.length > maxBytes) {
    throw httpError(`File is larger than ${Math.round(maxBytes / (1024 * 1024))} MB`);
  }
  const cleanName = cleanOriginalName(originalName);
  const { extension, mimeType } = resolveType(cleanName, types);
  const storedName = buildStoredName(cleanName, extension);
  const folderPath = buildFolderPath({ moduleName, entityId });
  const locator = await storage.upload(buffer, `${folderPath}/${storedName}`, { mimeType });

  try {
    const record = await fileAssetModel.create({
      ...extra,
      fileKey: createId('file'),
      originalName: cleanName,
      storedName,
      mimeType,
      sizeBytes: buffer.length,
      storageProvider: locator.storageProvider,
      storageKey: locator.storageKey,
      storageBucket: locator.storageBucket,
      driveFileId: locator.storageProvider === 'gdrive' ? locator.storageKey : null,
      driveFolderId: locator.storageProvider === 'gdrive' ? locator.storageBucket : null,
      driveWebViewLink: '',
      driveWebContentLink: '',
      moduleName,
      entityId,
      folderKey: folderPath,
      isPublic: false
    }, dbClient);
    return toPublicFile(record);
  } catch (error) {
    // Don't leave an orphaned object behind when the row cannot be written.
    await storage.remove(locator);
    throw error;
  }
}

// Files are referenced across the app by their file_assets id, or by the Drive id of older uploads.
async function findByRef(ref) {
  const value = String(ref || '').trim();
  if (!value) return null;
  if (/^file_[a-z0-9]+$/i.test(value)) {
    const record = await fileAssetModel.findById(value);
    if (record) return record;
  }
  return (await fileAssetModel.list({ where: { driveFileId: value } }))[0] || null;
}

async function openFile(record, options) {
  return storage.open(locatorOf(record), options);
}

async function readFileBuffer(record) {
  return storage.readBuffer(locatorOf(record));
}

async function removeFile(record) {
  if (!record) return false;
  await storage.remove(locatorOf(record));
  return fileAssetModel.remove(record.id);
}

async function removeFileByRef(ref) {
  return removeFile(await findByRef(ref));
}

async function renameFile(record, name) {
  const cleanName = cleanOriginalName(name);
  await storage.rename(locatorOf(record), cleanName);
  return toPublicFile(await fileAssetModel.update(record.id, { originalName: cleanName }));
}

async function archiveFile(record, reason = 'archived') {
  return toPublicFile(await fileAssetModel.update(record.id, {
    isArchived: true,
    archivedAt: new Date().toISOString(),
    archivedReason: reason
  }));
}

function isInlineMime(mimeType) {
  return INLINE_MIME.test(String(mimeType || ''));
}

module.exports = {
  ALL_TYPES,
  AUDIO_TYPES,
  DOCUMENT_TYPES,
  archiveFile,
  findByRef,
  isInlineMime,
  locatorOf,
  openFile,
  readFileBuffer,
  removeFile,
  removeFileByRef,
  renameFile,
  saveUpload,
  toPublicFile
};
