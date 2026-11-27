// Upload pipeline shared by every module: type allowlist, size limit, storage key,
// active storage provider, file_assets row. Reads go through each file's own provider.
const path = require('path');
const fileAssetModel = require('../models/fileAsset.model');
const storage = require('./storage/storage.service');
const { buildFolderPath, isRecordFolderSection, isSiteModule, istParts, sectionFor } = require('../utils/uploadPath');
const { resolveEntityInfo } = require('./storage/entityLabel.service');
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

// "Aadhaar Card - Mallika Paik" -> "aadhaar-card-mallika-paik".
function slugFileBase(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/, '');
}

function dbExec(dbClient) {
  return dbClient?.query ? dbClient : require('../config/db');
}

async function storedNameTaken(folderPath, storedName, dbClient) {
  try {
    const result = await dbExec(dbClient).query(
      'select 1 from file_assets where folder_key = $1 and lower(stored_name) = lower($2) limit 1',
      [folderPath, storedName]
    );
    return result.rowCount > 0;
  } catch {
    // Without the check the local provider still refuses to overwrite (EEXIST) and Drive keeps
    // same-named files apart by id, so nothing is lost; the name just may repeat.
    return false;
  }
}

// "Signed Agreement (final).pdf" uploaded on 27 Nov -> "2026-11-27_signed-agreement-final"; call
// recordings also get the time: "2026-11-27_10-32_call-9876543210".
function datedFileBase(originalName, moduleName, date = new Date()) {
  const parts = istParts(date);
  const base = slugFileBase(path.basename(originalName, path.extname(originalName))) || 'file';
  const prefix = sectionFor(moduleName) === 'calls' ? `${parts.date}_${parts.time}` : parts.date;
  return `${prefix}_${base}`.slice(0, 120);
}

// The folder of this record's first upload in the current layout: a record renamed later keeps
// all its files in one place instead of starting a second folder.
async function existingRecordFolder(moduleName, entityId, computedFolder, dbClient) {
  if (!entityId || !isRecordFolderSection(moduleName)) return '';
  const top = computedFolder.split('/')[0];
  try {
    const result = await dbExec(dbClient).query(
      'select folder_key from file_assets where module_name = $1 and entity_id = $2 and folder_key like $3 and archived_at is null order by created_at limit 1',
      [moduleName, entityId, `${top}/%`]
    );
    return result.rows[0]?.folder_key || '';
  } catch {
    return '';
  }
}

// Readable, stable names ("aadhaar-card-mallika-paik.pdf"). A name already used in the folder
// gets "-2", "-3"...: the database check covers both providers, and EEXIST covers a file left
// on disk without a record (the local provider never overwrites).
async function uploadWithReadableName(buffer, folderPath, fileBaseName, extension, mimeType, dbClient, { slug = true, spacedSuffix = false } = {}) {
  const base = (slug ? slugFileBase(fileBaseName) : fileBaseName) || 'file';
  for (let n = 1; n <= 50; n += 1) {
    // Slugged names repeat as "-2"; names kept as given (recordings) as " (2)".
    const suffix = n > 1 ? (spacedSuffix ? ` (${n})` : `-${n}`) : '';
    const candidate = `${base}${suffix}${extension}`;
    if (await storedNameTaken(folderPath, candidate, dbClient)) continue;
    try {
      const locator = await storage.upload(buffer, `${folderPath}/${candidate}`, { mimeType });
      return { storedName: candidate, locator };
    } catch (error) {
      if (error?.code === 'EEXIST') continue;
      throw error;
    }
  }
  throw httpError('Could not find a free file name in this folder');
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
  dbClient = null,
  // Optional: a fixed folder (instead of <year>/<mon>/<section>/<record>) and a readable
  // file name (instead of the uploaded name plus a random suffix). Used by HRM documents.
  folderPath: fixedFolder = '',
  fileBaseName = '',
  // fileBaseName is already a readable, safe name (call recordings): keep it as given
  // instead of turning it into "lower-case-with-hyphens".
  keepFileName = false
}) {
  if (!buffer?.length) throw httpError('Empty files cannot be uploaded');
  if (buffer.length > maxBytes) {
    throw httpError(`File is larger than ${Math.round(maxBytes / (1024 * 1024))} MB`);
  }
  const cleanName = cleanOriginalName(originalName);
  const { extension, mimeType } = resolveType(cleanName, types);
  const now = new Date();
  let folderPath = fixedFolder;
  if (!folderPath) {
    const entity = entityId && !isSiteModule(moduleName) ? await resolveEntityInfo(moduleName, entityId) : null;
    folderPath = buildFolderPath({ moduleName, entityId, entity, date: now });
    folderPath = (await existingRecordFolder(moduleName, entityId, folderPath, dbClient)) || folderPath;
  }
  const { storedName, locator } = fileBaseName
    ? await uploadWithReadableName(buffer, folderPath, fileBaseName, extension, mimeType, dbClient, { slug: !keepFileName, spacedSuffix: keepFileName })
    : await uploadWithReadableName(buffer, folderPath, datedFileBase(cleanName, moduleName, now), extension, mimeType, dbClient, { slug: false });

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
  datedFileBase,
  findByRef,
  isInlineMime,
  locatorOf,
  openFile,
  readFileBuffer,
  removeFile,
  removeFileByRef,
  renameFile,
  saveUpload,
  slugFileBase,
  toPublicFile
};
