import { useRef, useState } from 'react';
import { Paperclip, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Button } from './Button';
import { FileBrowserModal } from './FileBrowserModal';
import { uploadFilesToDrive } from '../../lib/fileUpload';

export function AttachmentPicker({
  attachments = [],
  title = 'Attachments',
  emptyText = 'Attach files from the file manager or upload a new document.',
  uploadLabel = 'Upload File',
  browseLabel = 'Browse files',
  uploadModule = 'general',
  uploadEntityId = '',
  uploadFields = {},
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
      await api.files.deleteDriveFile(token, driveFileId);
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
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-700">{title}</div>
          <div className="text-xs text-slate-500">
            {Array.isArray(attachments) && attachments.length ? `${attachments.length} file(s) attached` : emptyText}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload size={16} className="mr-2" />
            {uploading ? 'Uploading...' : uploadLabel}
          </Button>
          <Button type="button" variant="outline" onClick={() => setBrowserOpen(true)}>
            <Paperclip size={16} className="mr-2" />
            {browseLabel}
          </Button>
        </div>
      </div>

      {Array.isArray(attachments) && attachments.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {attachments.map((file) => (
            <span
              key={file.driveFileId || file.id}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {file.driveWebViewLink ? (
                <a href={file.driveWebViewLink} target="_blank" rel="noreferrer" className="max-w-[240px] truncate hover:underline">
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
                  className="text-slate-400 hover:text-rose-500"
                  aria-label={`Remove ${file.name}`}
                >
                  <X size={14} />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Use Upload File or Browse files to attach documents.
        </div>
      )}

      <input ref={inputRef} type="file" multiple className="hidden" onChange={handleDirectUpload} />

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
