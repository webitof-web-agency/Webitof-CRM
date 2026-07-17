const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { google } = require('googleapis');
const { createId, isTruthy, nowIso } = require('../utils/format');
const fileAssetModel = require('../models/fileAsset.model');
const storageFolderModel = require('../models/storageFolder.model');

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];
const ROOT_FOLDER_KEY = 'root';
const DEFAULT_ROOT_FOLDER_NAME = 'Webitof CRM Files';
const STANDARD_FOLDER_GROUPS = {
  assets: {
    key: 'crm-assets',
    name: 'CRM_Assets'
  },
  records: {
    key: 'crm-clients-leads',
    name: 'CRM_Clients_Leads'
  },
  hidden: {
    key: 'crm-hidden-system',
    name: 'CRM_Hidden_System'
  }
};
const MODULE_FOLDER_GROUPS = {
  general: 'assets',
  files: 'assets',
  settings: 'assets',
  invoice: 'assets',
  invoices: 'assets',
  branding: 'assets',
  templates: 'assets',
  assets: 'assets',
  lead: 'records',
  leads: 'records',
  client: 'records',
  clients: 'records',
  project: 'records',
  projects: 'records',
  event: 'records',
  events: 'records',
  task: 'records',
  tasks: 'records',
  note: 'records',
  notes: 'records',
  reminder: 'records',
  reminders: 'records',
  users: 'hidden',
  user: 'hidden',
  profile: 'hidden',
  avatar: 'hidden',
  avatars: 'hidden',
  temp: 'hidden',
  temporary: 'hidden'
};

let driveClientPromise = null;

function parseJsonEnv(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

async function getAuthClient() {
  const serviceAccountJson = parseJsonEnv(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (serviceAccountJson?.client_email && serviceAccountJson?.private_key) {
    return new google.auth.JWT(
      serviceAccountJson.client_email,
      null,
      serviceAccountJson.private_key,
      DRIVE_SCOPES,
      process.env.GOOGLE_DRIVE_SUBJECT || undefined
    );
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const filePath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (fs.existsSync(filePath)) {
      const auth = new google.auth.GoogleAuth({
        keyFile: filePath,
        scopes: DRIVE_SCOPES
      });
      return auth.getClient();
    }
  }

  if (process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost'
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
    });
    return oauth2Client;
  }

  throw new Error('Google Drive credentials are missing. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS, or OAuth client env vars.');
}

async function getDriveClient() {
  if (!driveClientPromise) {
    driveClientPromise = getAuthClient().then((auth) => google.drive({ version: 'v3', auth }));
  }
  return driveClientPromise;
}

function getRootFolderSeed() {
  return {
    folderKey: ROOT_FOLDER_KEY,
    folderName: process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME || DEFAULT_ROOT_FOLDER_NAME,
    driveFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '',
    parentKey: ''
  };
}

function normalizeModuleName(moduleName = 'general') {
  return String(moduleName || 'general').trim().toLowerCase() || 'general';
}

function getFolderGroupForModule(moduleName = 'general') {
  const normalized = normalizeModuleName(moduleName);
  return MODULE_FOLDER_GROUPS[normalized] || 'assets';
}

async function ensureStandardFolders(drive) {
  const root = await ensureRootFolder(drive);
  const groups = Object.values(STANDARD_FOLDER_GROUPS);
  const folders = {};

  for (const group of groups) {
    const folderKey = `${ROOT_FOLDER_KEY}/${group.key}`;
    const cached = await storageFolderModel.list({ where: { folderKey } });
    if (cached[0]?.driveFolderId) {
      folders[group.key] = cached[0];
      continue;
    }

    const found = await findFolderByName(drive, group.name, root.driveFolderId);
    const folderData = found || await createDriveFolder(drive, group.name, [root.driveFolderId]);
    folders[group.key] = await storageFolderModel.upsert({
      folderKey,
      folderName: group.name,
      driveFolderId: folderData.id,
      parentKey: ROOT_FOLDER_KEY
    });
  }

  return { root, folders };
}

async function ensureRootFolder(drive) {
  const existing = await storageFolderModel.findById(ROOT_FOLDER_KEY);
  if (existing?.driveFolderId) return existing;

  if (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID) {
    return storageFolderModel.upsert({
      id: ROOT_FOLDER_KEY,
      ...getRootFolderSeed()
    });
  }

  const folderName = process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME || DEFAULT_ROOT_FOLDER_NAME;

  // Try to find it in Drive first
  const existingInDrive = await findFolderByName(drive, folderName, null);
  let driveFolderId;

  if (existingInDrive) {
    driveFolderId = existingInDrive.id;
  } else {
    const created = await createDriveFolder(drive, folderName, []);
    driveFolderId = created.id;
  }

  return storageFolderModel.upsert({
    id: ROOT_FOLDER_KEY,
    folderKey: ROOT_FOLDER_KEY,
    folderName,
    driveFolderId,
    parentKey: ''
  });
}

async function listDriveDirectory(folderId = null) {
  const drive = await getDriveClient();
  let targetFolderId = folderId;

  if (!targetFolderId) {
    const root = await ensureRootFolder(drive);
    await ensureStandardFolders(drive);
    targetFolderId = root.driveFolderId;
  }

  const response = await drive.files.list({
    q: `'${targetFolderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime)',
    spaces: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    orderBy: 'folder, name'
  });

  const files = (response.data.files || []).filter((file) => {
    const name = String(file.name || '').trim();
    return name !== STANDARD_FOLDER_GROUPS.hidden.name;
  });

  return {
    folderId: targetFolderId,
    files
  };
}

async function createDriveFolder(drive, name, parentIds = []) {
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentIds.filter(Boolean)
    },
    fields: 'id, name, parents',
    supportsAllDrives: true
  });
  return response.data;
}

async function createNewFolder(name, parentDriveId = null) {
  const drive = await getDriveClient();
  let parents = [];
  if (parentDriveId) {
    parents = [parentDriveId];
  } else {
    const root = await ensureRootFolder(drive);
    parents = [root.driveFolderId];
  }
  return createDriveFolder(drive, name, parents);
}

async function findFolderByName(drive, folderName, parentDriveId) {
  const queryParts = [
    `mimeType = 'application/vnd.google-apps.folder'`,
    `name = '${String(folderName).replace(/'/g, "\\'")}'`,
    'trashed = false'
  ];
  if (parentDriveId) {
    queryParts.push(`'${parentDriveId}' in parents`);
  }

  const response = await drive.files.list({
    q: queryParts.join(' and '),
    fields: 'files(id, name, parents)',
    spaces: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });

  return response.data.files?.[0] || null;
}

async function ensureFolderPath(folderParts = []) {
  const drive = await getDriveClient();
  const root = await ensureRootFolder(drive);
  let parentDriveId = root.driveFolderId;
  let parentKey = ROOT_FOLDER_KEY;
  let currentFolder = root;

  for (const part of folderParts.filter(Boolean)) {
    const folderName = String(part).trim();
    const folderKey = `${parentKey}/${folderName.toLowerCase().replace(/[^a-z0-9_-]+/gi, '-')}`;
    const cached = await storageFolderModel.list({
      where: { folderKey }
    });

    if (cached[0]?.driveFolderId) {
      currentFolder = cached[0];
      parentDriveId = currentFolder.driveFolderId;
      parentKey = folderKey;
      continue;
    }

    const found = await findFolderByName(drive, folderName, parentDriveId);
    const folderData = found || await createDriveFolder(drive, folderName, [parentDriveId]);
    currentFolder = await storageFolderModel.upsert({
      folderKey,
      folderName,
      driveFolderId: folderData.id,
      parentKey
    });
    parentDriveId = currentFolder.driveFolderId;
    parentKey = folderKey;
  }

  return {
    root,
    folder: currentFolder,
    driveFolderId: currentFolder.driveFolderId,
    folderKey: parentKey
  };
}

async function setPublicReadPermission(drive, fileId) {
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    },
    supportsAllDrives: true
  });
}

async function uploadBuffer({
  buffer,
  originalName,
  mimeType,
  moduleName = 'general',
  entityId = '',
  folderParts = [],
  isPublic = false,
  targetFolderId = null
}) {
  const drive = await getDriveClient();
  const normalizedModule = normalizeModuleName(moduleName);

  let parentDriveId = targetFolderId;
  let folderKey = '';

  if (!parentDriveId) {
    const folderGroup = getFolderGroupForModule(normalizedModule);
    const folderInfo = await ensureFolderPath([
      STANDARD_FOLDER_GROUPS[folderGroup].name,
      normalizedModule,
      entityId,
      ...folderParts
    ].filter(Boolean));
    parentDriveId = folderInfo.driveFolderId;
    folderKey = folderInfo.folderKey;
  }

  const storedName = String(originalName || `file-${Date.now()}`).trim();
  const response = await drive.files.create({
    requestBody: {
      name: storedName,
      parents: [parentDriveId]
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: Readable.from([buffer])
    },
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, parents',
    supportsAllDrives: true
  });

  if (isPublic || isTruthy(process.env.GOOGLE_DRIVE_PUBLIC_FILES)) {
    await setPublicReadPermission(drive, response.data.id);
  }

  return {
    fileKey: createId('file'),
    originalName: storedName,
    storedName,
    mimeType: response.data.mimeType || mimeType || '',
    sizeBytes: Number(response.data.size || buffer.length || 0),
    driveFileId: response.data.id,
    driveFolderId: parentDriveId,
    driveWebViewLink: response.data.webViewLink || '',
    driveWebContentLink: response.data.webContentLink || '',
    moduleName,
    entityId,
    folderKey: folderKey,
    isPublic: Boolean(isPublic || isTruthy(process.env.GOOGLE_DRIVE_PUBLIC_FILES)),
    payload: {
      drive: response.data
    }
  };
}

async function listFiles(where = {}, search = '') {
  return fileAssetModel.list({ where, search, orderBy: 'created_at DESC' });
}

async function archiveFile(fileId, reason = 'archived') {
  const current = await fileAssetModel.findById(fileId);
  if (!current) return null;
  return fileAssetModel.update(fileId, {
    isArchived: true,
    archivedAt: nowIso(),
    archivedReason: reason
  });
}

async function getDriveFileUrl(fileId) {
  const current = await fileAssetModel.findById(fileId);
  if (!current) return null;
  return current.driveWebViewLink || current.driveWebContentLink || `https://drive.google.com/file/d/${current.driveFileId}/view`;
}

async function deleteFile(fileId) {
  const current = await fileAssetModel.findById(fileId);
  if (!current || !current.driveFileId) return false;

  try {
    const drive = await getDriveClient();
    await drive.files.update({
      fileId: current.driveFileId,
      requestBody: { trashed: true },
      supportsAllDrives: true
    });
  } catch (error) {
    console.error('Error deleting file from Drive:', error.message);
  }

  // Soft delete locally if you have isArchived, or remove
  return fileAssetModel.remove(fileId);
}

async function renameFile(driveFileId, newName) {
  const drive = await getDriveClient();
  const response = await drive.files.update({
    fileId: driveFileId,
    requestBody: {
      name: newName
    },
    supportsAllDrives: true
  });
  
  // Try to update local db if it exists
  try {
    const records = await fileAssetModel.list({ where: { driveFileId } });
    if (records && records.length > 0) {
      for (const record of records) {
        await fileAssetModel.update(record.id, { originalName: newName, storedName: newName });
      }
    }
  } catch (e) {
    console.error("Local db rename sync skipped", e);
  }
  return response.data;
}

async function deleteFileByDriveId(driveFileId) {
  const drive = await getDriveClient();
  await drive.files.update({
    fileId: driveFileId,
    requestBody: { trashed: true },
    supportsAllDrives: true
  });
  
  try {
    const records = await fileAssetModel.list({ where: { driveFileId } });
    if (records && records.length > 0) {
      for (const record of records) {
        // Just mark archived instead of deleting to act like trash in DB
        await fileAssetModel.update(record.id, { isArchived: true, archivedAt: new Date().toISOString() });
      }
    }
  } catch (e) {
    console.error("Local db trash sync skipped", e);
  }
  return { trashed: true };
}

async function getDriveUsage() {
  try {
    const files = await fileAssetModel.list();
    const usage = files.reduce((sum, file) => {
      if (!file.isArchived) {
        return sum + (parseInt(file.sizeBytes, 10) || 0);
      }
      return sum;
    }, 0);
    return { usage, limit: 0 };
  } catch (error) {
    console.error('Error fetching drive usage:', error.message);
    return { usage: 0, limit: 0 };
  }
}

module.exports = {
  archiveFile,
  createNewFolder,
  deleteFile,
  deleteFileByDriveId,
  ensureFolderPath,
  getDriveClient,
  getDriveFileUrl,
  getDriveUsage,
  listDriveDirectory,
  listFiles,
  renameFile,
  uploadBuffer
};
