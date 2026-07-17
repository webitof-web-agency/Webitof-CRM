import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { FileBrowser } from './FileBrowser';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Button } from './Button';

export function FileBrowserModal({
  open,
  onClose,
  onSelect,
  uploadModule,
  uploadEntityId,
  onUploadComplete,
  allowSelect = true,
  title = 'Browse Files',
  subtitle = 'Select a file from your Drive storage'
}) {
  if (!open) return null;

  return (
    <Modal
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      width="min(1000px, 96vw)"
      footer={
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      }
    >
        <div className="h-[60vh] min-h-[400px] flex flex-col -mx-6 -my-6 border-t border-b border-slate-200 bg-slate-50 overflow-hidden relative">
           <FileBrowser 
             allowSelect={allowSelect}
             onSelectFile={(file) => {
               if (onSelect) onSelect(file);
               if (allowSelect) onClose();
             }}
             onUploadComplete={onUploadComplete}
             uploadModule={uploadModule}
             uploadEntityId={uploadEntityId}
           />
      </div>
    </Modal>
  );
}
