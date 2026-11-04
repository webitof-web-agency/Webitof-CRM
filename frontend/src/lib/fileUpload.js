import imageCompression from 'browser-image-compression';
import { API_BASE_URL, api } from '../api/client';

async function compressIfNeeded(file, compressImages) {
  if (!compressImages || !file?.type?.startsWith('image/')) return file;

  try {
    return await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true
    });
  } catch {
    return file;
  }
}

export async function uploadFilesToDrive(token, files, {
  moduleName = 'general',
  entityId = '',
  folderKey = '',
  folderId = '',
  isPublic = false,
  compressImages = true,
  extraFields = {}
} = {}) {
  const list = Array.from(files || []).filter(Boolean);
  if (!list.length) return [];

  const formData = new FormData();
  for (const file of list) {
    const uploadFile = await compressIfNeeded(file, compressImages);
    formData.append('file', uploadFile);
  }

  formData.append('moduleName', String(moduleName || 'general'));
  if (entityId) formData.append('entityId', String(entityId));
  if (folderKey) formData.append('folderKey', String(folderKey));
  if (folderId) formData.append('folderId', String(folderId));
  if (isPublic !== undefined) formData.append('isPublic', String(Boolean(isPublic)));
  Object.entries(extraFields || {}).forEach(([key, value]) => {
    if (value == null || value === '') return;
    formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
  });

  const response = await api.files.upload(token, formData);
  return Array.isArray(response.data) ? response.data : [];
}

const FILE_ID_PATTERN = /^file_[a-z0-9]+$/i;
const LEGACY_VIEW_PATH = /^\/files\/drive\//;

// The file_assets id, when this reference has one (older attachments may only carry a Drive id).
function fileIdOf(file) {
  return [file.id, file.fileId, file.driveFileId]
    .map((value) => String(value || '').trim())
    .find((value) => FILE_ID_PATTERN.test(value)) || '';
}

// URL that streams a stored file through the API (works for local and Google Drive storage).
// Usable directly in <img>, <audio> and links. A file known only by its Drive id is served this
// way only when it is a public asset (logos, avatars); use getFileOpenUrl for links.
export function getFileViewUrl(file) {
  if (!file) return '';
  const fileId = fileIdOf(file);
  if (fileId) return `${API_BASE_URL}/files/${fileId}/view`;
  if (file.viewUrl && !LEGACY_VIEW_PATH.test(file.viewUrl)) return `${API_BASE_URL}${file.viewUrl}`;
  if (file.driveFileId) return `${API_BASE_URL}/files/drive/${file.driveFileId}/view`;
  return file.url || '';
}

// In-app page that looks up a file by id or Drive id for the signed-in user and opens it.
export function getFileOpenPageUrl(ref) {
  return `${window.location.origin}${window.location.pathname}#/files/open/${encodeURIComponent(ref)}`;
}

// Link to open a file in a new tab. Older uploads keep their Drive page link; ones known only
// by their Drive id go through the signed-in open page.
export function getFileOpenUrl(file) {
  if (!file) return '';
  if (file.driveWebViewLink || file.webViewLink) return file.driveWebViewLink || file.webViewLink;
  if (fileIdOf(file) || (file.viewUrl && !LEGACY_VIEW_PATH.test(file.viewUrl))) return getFileViewUrl(file);
  const driveFileId = String(file.driveFileId || '').trim();
  if (driveFileId) return getFileOpenPageUrl(driveFileId);
  return file.url || '';
}
