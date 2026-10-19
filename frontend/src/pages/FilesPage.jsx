import { useEffect, useState } from 'react';
import { Archive, FolderUp, RefreshCw, Upload, ExternalLink, Plus } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';
import { api } from '../api/client';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { SearchableSelect } from '../components/forms/SearchableSelect';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/overlays/ConfirmDialog';
import { buildInitialDraft } from '../lib/resource';
import { FileBrowser } from '../components/ui/FileBrowser';
import { FileDetailsModal } from '../components/ui/FileDetailsModal';


export function FilesPage() {
  const { token, hasPermission } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewingFile, setViewingFile] = useState(null);

  const canWrite = hasPermission('files.write');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const canDelete = hasPermission('files.write');

  const load = () => {
    setRefreshTrigger(prev => prev + 1);
  };



  async function handleFileSelect(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setBusy(true);
    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        let uploadFile = file;
        if (file.type.startsWith('image/')) {
          try {
            uploadFile = await imageCompression(file, {
              maxSizeMB: 1,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
            });
          } catch (err) {
            console.error('Compression error:', err);
          }
        }
        formData.append('file', uploadFile);
      }
      
      formData.append('moduleName', 'general');

      await api.files.upload(token, formData);
      toast.success('Files uploaded');
      setUploadOpen(false);
      setRefreshTrigger(prev => prev + 1); // Refresh FileBrowser
    } catch (error) {
      toast.error(error.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteFile() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.files.remove(token, deleteTarget.id);
      toast.success('File deleted');
      setDeleteTarget(null);
      await load();
      setViewingFile(null); // Close the modal if it's open
    } catch (error) {
      toast.error(error.message || 'Unable to delete the file');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Manage Media Library</h1>
        {canWrite && (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center justify-center rounded-[var(--radius-button,0.5rem)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Upload size={16} className="mr-2" />
            Upload Files
          </button>
        )}
      </div>

      <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[600px] overflow-hidden -mx-4 md:-mx-8 px-4 md:px-8">
        <FileBrowser 
          onViewFile={(file) => setViewingFile(file)}
          refreshTrigger={refreshTrigger}
          showSidebar={true}
          showUpload={false}
        />
      </div>

      <Modal
        open={uploadOpen}
        title="Upload Files"
        subtitle="Upload new files to your media library"
        onClose={() => !busy && setUploadOpen(false)}
        width="min(600px, 90vw)"
        footer={null}
      >
        <div className="relative border-2 border-dashed border-slate-200 rounded-[var(--radius-card,0.75rem)] bg-slate-50/50 hover:bg-slate-50 transition-colors p-12 flex flex-col items-center justify-center text-center mt-4">
          <input
            type="file"
            multiple
            disabled={busy}
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          
          <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center text-slate-400 mb-6 shadow-sm border border-slate-100">
            <Upload size={28} />
          </div>
          
          <h4 className="text-lg font-bold text-slate-800 mb-2">
            {busy ? 'Uploading your files...' : 'Upload your files'}
          </h4>
          
          <p className="text-sm text-slate-500 mb-8 max-w-sm">
            {busy ? 'Please wait while we process and upload your files securely.' : 'Drag and drop your files here, or click to browse'}
          </p>
          
          <button 
            type="button" 
            disabled={busy}
            className="inline-flex items-center justify-center rounded-[var(--radius-button,0.5rem)] bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 z-0"
          >
            <span className="mr-2 text-lg leading-none">+</span>
            Choose Files
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete file"
        description={`Delete ${deleteTarget?.name || deleteTarget?.originalName}? Records that link to it will no longer open it. This can't be undone.`}
        confirmLabel={busy ? 'Deleting...' : 'Delete'}
        confirmVariant="danger"
        onConfirm={deleteFile}
        onClose={() => setDeleteTarget(null)}
        busy={busy}
      />

      <FileDetailsModal
        open={!!viewingFile}
        file={viewingFile}
        onClose={() => setViewingFile(null)}
        onDelete={(file) => setDeleteTarget(file)}
      />
    </div>
  );
}
