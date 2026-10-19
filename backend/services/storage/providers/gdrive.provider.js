const { Readable } = require('stream');
const { DriveError } = require('../../googleDrive/drive.client');
const connection = require('../../googleDrive/driveConnection.service');

// "<parentId>/<name>" → folder id, plus in-flight lookups so concurrent uploads
// into a new month do not create duplicate folders.
const folderCache = new Map();
const folderInflight = new Map();

function clearFolderCache() {
  folderCache.clear();
  folderInflight.clear();
}

async function ensureChildFolder(client, parentId, name) {
  const cacheKey = `${parentId}/${name}`;
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey);
  if (folderInflight.has(cacheKey)) return folderInflight.get(cacheKey);

  const pending = (async () => {
    const found = await client.findFolder(name, parentId);
    const folder = found || await client.createFolder(name, parentId);
    folderCache.set(cacheKey, folder.id);
    return folder.id;
  })();
  folderInflight.set(cacheKey, pending);
  try {
    return await pending;
  } finally {
    folderInflight.delete(cacheKey);
  }
}

async function ensureFolderPath(client, rootId, parts) {
  let parentId = rootId;
  for (const part of parts) {
    parentId = await ensureChildFolder(client, parentId, part);
  }
  return parentId;
}

async function uploadOnce(buffer, storageKey, mimeType) {
  const client = await connection.getClient();
  const uploadsId = await connection.ensureFolder('uploads');
  const parts = String(storageKey).split('/').filter(Boolean);
  const fileName = parts.pop();
  const parentId = await ensureFolderPath(client, uploadsId, parts);
  const file = await client.uploadFile({ name: fileName, parentId, mimeType, buffer });
  return { storageProvider: 'gdrive', storageKey: file.id, storageBucket: uploadsId };
}

const gdriveProvider = {
  name: 'gdrive',

  async upload(buffer, storageKey, { mimeType = 'application/octet-stream' } = {}) {
    try {
      return await uploadOnce(buffer, storageKey, mimeType);
    } catch (error) {
      // A cached folder was deleted in Drive: forget the cache and try once more.
      if (error instanceof DriveError && error.statusCode === 404) {
        clearFolderCache();
        return uploadOnce(buffer, storageKey, mimeType);
      }
      throw error;
    }
  },

  async open(locator, { range = '' } = {}) {
    try {
      const client = await connection.getClient();
      const response = await client.download(locator.storageKey, { range });
      return {
        status: response.status === 206 ? 206 : 200,
        stream: Readable.fromWeb(response.body),
        contentLength: Number(response.headers.get('content-length') || 0) || null,
        contentRange: response.headers.get('content-range') || ''
      };
    } catch (error) {
      // Log the cause; otherwise a broken connection only shows up as "file not found".
      console.error(`Google Drive file ${locator.storageKey} could not be opened:`, error.message);
      return null;
    }
  },

  async readBuffer(locator) {
    const opened = await gdriveProvider.open(locator);
    if (!opened) return null;
    const chunks = [];
    for await (const chunk of opened.stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  },

  async exists(locator) {
    try {
      const client = await connection.getClient();
      const file = await client.getFile(locator.storageKey, 'id,trashed');
      return !file.trashed;
    } catch {
      return false;
    }
  },

  async delete(locator) {
    try {
      const client = await connection.getClient();
      await client.deleteFile(locator.storageKey);
    } catch (error) {
      if (!(error instanceof DriveError && error.statusCode === 404)) {
        console.error(`Google Drive file ${locator.storageKey} could not be deleted:`, error.message);
      }
    }
  },

  async rename(locator, name) {
    try {
      const client = await connection.getClient();
      await client.updateFile(locator.storageKey, { name });
    } catch (error) {
      console.error(`Google Drive file ${locator.storageKey} could not be renamed:`, error.message);
    }
  },

  async testConnection() {
    const key = `.storage-test-${Date.now()}.txt`;
    const body = Buffer.from('ok');
    const locator = await gdriveProvider.upload(body, key, { mimeType: 'text/plain' });
    const read = await gdriveProvider.readBuffer(locator);
    await gdriveProvider.delete(locator);
    if (!read || !read.equals(body)) throw new Error('Google Drive read-back failed');
    return { ok: true, message: 'Google Drive upload, read and delete worked' };
  }
};

module.exports = {
  clearFolderCache,
  gdriveProvider
};
