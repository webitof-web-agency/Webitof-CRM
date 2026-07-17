const { getDriveClient } = require('./services/driveStorage.service');
async function run() {
  const drive = await getDriveClient();
  const res = await drive.files.list({
    q: "mimeType = 'application/vnd.google-apps.folder' and name = 'WebitofCRMFils' and trashed = false",
    fields: 'files(id, name)'
  });
  console.log('FOUND:', res.data.files);
}
run();
