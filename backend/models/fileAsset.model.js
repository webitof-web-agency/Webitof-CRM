const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'file_assets',
  idPrefix: 'file',
  columns: [
    column({ key: 'fileKey', db: 'file_key' }),
    column({ key: 'originalName', db: 'original_name' }),
    column({ key: 'storedName', db: 'stored_name' }),
    column({ key: 'mimeType', db: 'mime_type' }),
    column({ key: 'sizeBytes', db: 'size_bytes', type: 'number' }),
    column({ key: 'driveFileId', db: 'drive_file_id' }),
    column({ key: 'driveFolderId', db: 'drive_folder_id' }),
    column({ key: 'driveWebViewLink', db: 'drive_web_view_link' }),
    column({ key: 'driveWebContentLink', db: 'drive_web_content_link' }),
    column({ key: 'moduleName', db: 'module_name' }),
    column({ key: 'entityId', db: 'entity_id' }),
    column({ key: 'folderKey', db: 'folder_key' }),
    column({ key: 'isPublic', db: 'is_public', type: 'boolean' }),
    column({ key: 'isArchived', db: 'is_archived', type: 'boolean' }),
    column({ key: 'archivedAt', db: 'archived_at', type: 'date' }),
    column({ key: 'archivedReason', db: 'archived_reason' })
  ],
  searchColumns: ['original_name', 'stored_name', 'module_name', 'entity_id']
});
