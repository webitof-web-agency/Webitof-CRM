import { useState } from 'react';
import { Modal } from './Modal';
import { Eye, Download, Copy, Check, FileText, Image as ImageIcon, Video, FileArchive, Trash2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { API_BASE_URL } from '../../api/client';

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

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(file.driveWebViewLink || file.driveWebContentLink || '');
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
        <div className="w-full md:w-[55%] lg:w-[60%] flex-shrink-0 bg-slate-50 rounded-[var(--radius-card,0.75rem)] border border-slate-200 flex items-center justify-center overflow-hidden min-h-[300px]">
          {isImage && file.driveFileId ? (
            <img 
              src={`${API_BASE_URL}/files/drive/${file.driveFileId}/view`} 
              alt={name}
              className="max-h-[60vh] max-w-full object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div className={cn("flex-col items-center justify-center text-slate-400 gap-4", (isImage && file.driveFileId) ? 'hidden' : 'flex')}>
            <Icon size={80} strokeWidth={1} />
            <span className="text-sm font-medium">No preview available</span>
          </div>
        </div>

        {/* Right Side: Details */}
        <div className="w-full md:w-[45%] lg:w-[40%] flex flex-col pt-2">
          <h3 className="text-lg font-bold text-slate-800 mb-6">File Information</h3>
          
          <div className="space-y-5 flex-1">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">File Name</label>
              <p className="text-sm font-medium text-slate-800 break-all">{name}</p>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Display Name</label>
              <p className="text-sm font-medium text-slate-800 break-all">{file.originalName || name}</p>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">File Type</label>
              <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {file.mimeType || 'unknown'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">File Size</label>
              <p className="text-sm font-medium text-slate-800">{formatSize(file.sizeBytes)}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Upload Date</label>
              <p className="text-sm font-medium text-slate-800">{new Date(file.createdAt || Date.now()).toLocaleDateString()}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">File URL</label>
              <div className="flex items-center gap-2 mt-1 rounded-[var(--radius-input,0.5rem)] border border-slate-200 bg-slate-50 px-3 py-2">
                <input 
                  readOnly 
                  value={file.driveWebViewLink || file.driveWebContentLink || ''} 
                  className="flex-1 bg-transparent text-xs text-slate-600 focus:outline-none"
                />
                <button 
                  onClick={handleCopyUrl}
                  className="flex shrink-0 items-center justify-center text-slate-500 hover:text-[var(--primary)] transition-colors"
                  title="Copy URL"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6">
            <h4 className="text-sm font-bold text-slate-800 mb-3">Actions</h4>
            <div className="flex flex-wrap items-center gap-3">
              {file.driveWebViewLink && (
                <button 
                  type="button"
                  onClick={() => window.open(file.driveWebViewLink, '_blank')}
                  className="flex items-center justify-center gap-2 rounded-[var(--radius-button,0.5rem)] border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <Eye size={16} className="text-blue-500" />
                  View
                </button>
              )}
              {file.driveWebContentLink && (
                <button 
                  type="button"
                  onClick={() => window.open(file.driveWebContentLink, '_blank')}
                  className="flex items-center justify-center gap-2 rounded-[var(--radius-button,0.5rem)] border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <Download size={16} className="text-emerald-500" />
                  Download
                </button>
              )}
              {onDelete && (
                <button 
                  type="button"
                  onClick={() => onDelete(file)}
                  className="flex items-center justify-center gap-2 rounded-[var(--radius-button,0.5rem)] border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-rose-50 hover:border-rose-200 transition-colors shadow-sm"
                >
                  <Trash2 size={16} className="text-rose-500" />
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
