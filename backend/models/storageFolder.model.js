const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'storage_folders',
  idPrefix: 'folder',
  columns: [
    column({ key: 'folderKey', db: 'folder_key' }),
    column({ key: 'folderName', db: 'folder_name' }),
    column({ key: 'driveFolderId', db: 'drive_folder_id' }),
    column({ key: 'parentKey', db: 'parent_key' })
  ],
  searchColumns: ['folder_key', 'folder_name', 'drive_folder_id']
});
