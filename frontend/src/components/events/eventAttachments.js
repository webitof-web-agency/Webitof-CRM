export function normalizeEventAttachment(file) {
  if (!file || typeof file !== 'object') return null;
  const driveFileId = String(file.driveFileId || file.id || '').trim();
  if (!driveFileId) return null;

  return {
    id: file.id || driveFileId,
    driveFileId,
    name: file.name || file.originalName || 'File',
    originalName: file.originalName || file.name || 'File',
    driveWebViewLink: file.driveWebViewLink || file.webViewLink || '',
    mimeType: file.mimeType || ''
  };
}

export function normalizeEventAttachments(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeEventAttachment).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? normalizeEventAttachments(parsed) : [];
    } catch {
      return [];
    }
  }

  return [];
}
