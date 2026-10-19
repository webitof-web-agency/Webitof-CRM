import { useRef, useState } from 'react';
import { Paperclip, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Button } from './Button';
import { FileBrowserModal } from './FileBrowserModal';
import { getFileOpenUrl, uploadFilesToDrive } from '../../lib/fileUpload';

export function AttachmentPicker({
  attachments = [],
  title = 'Attachments',
  emptyText = 'Attach files from the file manager or upload a new document.',
  uploadLabel = 'Upload File',
  browseLabel = 'Browse files',
  uploadModule = 'general',
  uploadEntityId = '',
  uploadFields = {},
  accept,
  maxSizeBytes = 25 * 1024 * 1024,
  onAddFile,
  onRemoveFile
}) {
  const { token } = useAuth();
  const inputRef = useRef(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState('');

  async function handleDirectUpload(event) {
    const files = event.target.files;
    if (!files || !files.length) return;
    const oversized = Array.from(files).find((file) => file.size > maxSizeBytes);
    if (oversized) {
      toast.error(`${oversized.name} exceeds the ${Math.round(maxSizeBytes / (1024 * 1024))} MB limit`);
      event.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadFilesToDrive(token, files, {
        moduleName: uploadModule,
        entityId: uploadEntityId,
        isPublic: false,
        compressImages: true,
        extraFields: uploadFields
      });
      uploaded.forEach((file) => onAddFile?.(file));
      api.cache.invalidate('/files');
      toast.success(uploaded.length > 1 ? 'Files uploaded' : 'File uploaded');
    } catch (error) {
      toast.error(error.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleSelect(file) {
    if (!file) return;
    onAddFile?.(file);
  }

  async function handleRemove(file) {
    const driveFileId = String(file?.driveFileId || file?.id || '').trim();
    if (!driveFileId) return;

    setRemovingId(driveFileId);
    try {
      await api.files.remove(token, driveFileId);
      onRemoveFile?.(driveFileId, file);
      api.cache.invalidate('/files');
      toast.success('Attachment removed');
    } catch (error) {
      toast.error(error.message || 'Failed to remove attachment');
    } finally {
      setRemovingId('');
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-[var(--text-main)]">{title}</div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {Array.isArray(attachments) && attachments.length ? `${attachments.length} file(s) attached` : emptyText}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} loading={uploading}>
            <Upload size={14} className="mr-1.5" />
            {uploading ? 'Uploading...' : uploadLabel}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setBrowserOpen(true)}>
            <Paperclip size={14} className="mr-1.5" />
            {browseLabel}
          </Button>
        </div>
      </div>

      {Array.isArray(attachments) && attachments.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {attachments.map((file) => (
            <span
              key={file.driveFileId || file.id}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--text-main)]"
            >
              {getFileOpenUrl(file) ? (
                <a href={getFileOpenUrl(file)} target="_blank" rel="noreferrer" className="max-w-[240px] truncate hover:underline hover:text-[var(--primary)]">
                  {file.name}
                </a>
              ) : (
                <span className="max-w-[240px] truncate">{file.name}</span>
              )}
              {onRemoveFile ? (
                <button
                  type="button"
                  onClick={() => handleRemove(file)}
                  disabled={removingId === String(file.driveFileId || file.id || '')}
                  className="text-[var(--text-muted)] hover:text-rose-500 cursor-pointer"
                  aria-label={`Remove ${file.name}`}
                >
                  <X size={14} />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-xs text-[var(--text-muted)]">
          Use Upload File or Browse files to attach documents.
        </div>
      )}

      <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={handleDirectUpload} />

      <FileBrowserModal
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={(file) => {
          handleSelect(file);
          setBrowserOpen(false);
        }}
        uploadModule={uploadModule}
        uploadEntityId={uploadEntityId}
      />
    </div>
  );
}
