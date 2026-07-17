import imageCompression from 'browser-image-compression';
import { api } from '../api/client';

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
