const { getDriveClient } = require('./services/driveStorage.service');
const fileAssetModel = require('./models/fileAsset.model');
const { ensureDatabase } = require('./config/initDb');

async function cleanup() {
  await ensureDatabase();
  console.log('Connecting to Google Drive...');
  const drive = await getDriveClient();
  
  console.log('Fetching all files from CRM database...');
  const files = await fileAssetModel.list({});
  console.log(`Found ${files.length} files in database.`);
  
  let deletedCount = 0;
  
  for (const file of files) {
    if (!file.driveFileId) continue;
    try {
      // Try to fetch file metadata from Drive
      await drive.files.get({ fileId: file.driveFileId, fields: 'id, trashed' });
      // If it exists and is trashed, we can choose to delete it too
      // But just confirming it exists without throwing a 404 is enough
    } catch (error) {
      if (error.code === 404 || error.status === 404) {
        console.log(`File missing in Drive: ${file.originalName} (ID: ${file.driveFileId}). Removing from CRM DB...`);
        await fileAssetModel.remove(file.id);
        deletedCount++;
      } else {
        console.log(`Error checking file ${file.originalName}: ${error.message}`);
      }
    }
  }
  
  console.log(`Cleanup complete! Removed ${deletedCount} ghost files from CRM.`);
  process.exit(0);
}

cleanup().catch(console.error);
