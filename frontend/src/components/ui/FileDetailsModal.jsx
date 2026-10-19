import { useState } from 'react';
import { Modal } from './Modal';
import { Eye, Download, Copy, Check, FileText, Image as ImageIcon, Video, FileArchive, Trash2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { getFileOpenUrl, getFileViewUrl } from '../../lib/fileUpload';

function getFileIcon(mimeType = '') {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return FileArchive;
  return FileText;
}

export function FileDetailsModal({ open, file, onClose, onDelete }) {
  const [copied, setCopied] = useState(false);

  if (!open || !file) return null;

  const isImage = file.mimeType?.startsWith('image/');
  const Icon = getFileIcon(file.mimeType);
  const name = file.originalName || file.storedName || file.name || 'Unknown File';
  const viewUrl = getFileViewUrl(file);
  const openUrl = getFileOpenUrl(file);
  const downloadUrl = viewUrl ? `${viewUrl}${viewUrl.includes('?') ? '&' : '?'}download=1` : file.driveWebContentLink || '';

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(openUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <Modal open={open} onClose={onClose} width="min(900px, 92vw)" title="Media Details" subtitle="View detailed information about this media">
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Left Side: Preview */}
        <div className="w-full md:w-[55%] lg:w-[60%] shrink-0 bg-[var(--surface-2)]/50 rounded-2xl border border-[var(--border)] flex items-center justify-center overflow-hidden min-h-[300px]">
          {isImage && viewUrl ? (
            <img
              src={viewUrl}
              alt={name}
              className="max-h-[60vh] max-w-full object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div className={cn("flex-col items-center justify-center text-[var(--text-muted)] gap-3", (isImage && viewUrl) ? 'hidden' : 'flex')}>
            <Icon size={64} strokeWidth={1} />
            <span className="text-xs font-semibold">No preview available</span>
          </div>
        </div>

        {/* Right Side: Details */}
        <div className="w-full md:w-[45%] lg:w-[40%] flex flex-col pt-1">
          <h3 className="text-sm font-bold text-[var(--text-main)] mb-5">File Information</h3>
          
          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">File Name</label>
              <p className="text-xs font-semibold text-[var(--text-main)] break-all">{name}</p>
            </div>
            
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Display Name</label>
              <p className="text-xs font-semibold text-[var(--text-main)] break-all">{file.originalName || name}</p>
            </div>
            
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">File Type</label>
              <div className="inline-flex items-center rounded-full bg-[var(--surface-2)] border border-[var(--border)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
                {file.mimeType || 'unknown'}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">File Size</label>
              <p className="text-xs font-semibold text-[var(--text-main)]">{formatSize(file.sizeBytes)}</p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Upload Date</label>
              <p className="text-xs font-semibold text-[var(--text-main)]">{new Date(file.createdAt || Date.now()).toLocaleDateString()}</p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">File URL</label>
              <div className="flex items-center gap-2 mt-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-2">
                <input 
                  readOnly 
                  value={openUrl}
                  className="flex-1 bg-transparent text-xs text-[var(--text-muted)] focus:outline-none"
                />
                <button 
                  onClick={handleCopyUrl}
                  className="flex shrink-0 items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                  title="Copy URL"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <h4 className="text-xs font-bold text-[var(--text-main)] mb-3">Actions</h4>
            <div className="flex flex-wrap items-center gap-2">
              {openUrl && (
                <button
                  type="button"
                  onClick={() => window.open(openUrl, '_blank', 'noopener')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--hover-bg)] transition-colors shadow-2xs cursor-pointer"
                >
                  <Eye size={14} className="text-blue-500" />
                  View
                </button>
              )}
              {downloadUrl && (
                <button
                  type="button"
                  onClick={() => window.open(downloadUrl, '_blank', 'noopener')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--hover-bg)] transition-colors shadow-2xs cursor-pointer"
                >
                  <Download size={14} className="text-emerald-500" />
                  Download
                </button>
              )}
              {onDelete && (
                <button 
                  type="button"
                  onClick={() => onDelete(file)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/30 transition-colors shadow-2xs cursor-pointer"
                >
                  <Trash2 size={14} className="text-rose-500" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
