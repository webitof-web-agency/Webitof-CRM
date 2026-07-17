const fileAssetModel = require('../models/fileAsset.model');
const { deleteFileByDriveId } = require('./driveStorage.service');

function normalizeKey(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeId(value = '') {
  return String(value || '').trim();
}

function looksLikeAttachmentFile(item) {
  if (!item || typeof item !== 'object') return false;
  if (String(item.driveFileId || '').trim()) return true;
  const hasFileFields = [
    item.name,
    item.originalName,
    item.driveWebViewLink,
    item.webViewLink,
    item.mimeType
  ].some((value) => String(value || '').trim());
  return Boolean(hasFileFields && String(item.id || '').trim());
}

function collectDriveFileIds(value, out = new Set()) {
  if (!value) return out;

  if (Array.isArray(value)) {
    value.forEach((item) => collectDriveFileIds(item, out));
    return out;
  }

  if (typeof value === 'string') {
    const raw = normalizeId(value);
    if (raw) out.add(raw);
    return out;
  }

  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'attachments')) {
      collectDriveFileIds(value.attachments, out);
    }

    if (looksLikeAttachmentFile(value)) {
      const driveFileId = normalizeId(value.driveFileId || value.id);
      if (driveFileId) out.add(driveFileId);
    }
  }

  return out;
}

async function maybeTrashDirectUpload(driveFileId, context = {}) {
  const normalizedDriveFileId = normalizeId(driveFileId);
  if (!normalizedDriveFileId) return false;

  const records = await fileAssetModel.list({ where: { driveFileId: normalizedDriveFileId } });
  if (!records.length) return false;

  const expectedModule = normalizeKey(context.moduleName);
  const expectedEntityId = normalizeId(context.entityId);

  const matchesContext = records.some((record) => {
    const recordModule = normalizeKey(record.moduleName);
    const recordEntityId = normalizeId(record.entityId);
    if (!recordModule || !expectedModule || !expectedEntityId) return false;
    return recordModule === expectedModule && recordEntityId === expectedEntityId;
  });

  if (!matchesContext) return false;

  await deleteFileByDriveId(normalizedDriveFileId);
  return true;
}

async function rebindFileAssetsToEntity(context = {}, fromEntityId, toEntityId) {
  const expectedModule = normalizeKey(context.moduleName);
  const sourceEntityId = normalizeId(fromEntityId);
  const targetEntityId = normalizeId(toEntityId);

  if (!expectedModule || !sourceEntityId || !targetEntityId || sourceEntityId === targetEntityId) {
    return 0;
  }

  const records = await fileAssetModel.list({
    where: {
      moduleName: expectedModule,
      entityId: sourceEntityId
    }
  });

  let updatedCount = 0;
  for (const record of records) {
    await fileAssetModel.update(record.id, { entityId: targetEntityId });
    updatedCount += 1;
  }

  return updatedCount;
}

async function cleanupRemovedAttachments(currentValue, nextValue, context = {}) {
  const currentIds = collectDriveFileIds(currentValue);
  const nextIds = collectDriveFileIds(nextValue);
  const removedIds = Array.from(currentIds).filter((driveFileId) => !nextIds.has(driveFileId));

  for (const driveFileId of removedIds) {
    try {
      await maybeTrashDirectUpload(driveFileId, context);
    } catch (error) {
      console.error('Attachment cleanup skipped:', error.message);
    }
  }

  return removedIds;
}

module.exports = {
  cleanupRemovedAttachments,
  rebindFileAssetsToEntity
};
