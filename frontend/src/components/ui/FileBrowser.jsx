import { useState, useEffect, useCallback, useRef } from 'react';
import { Folder, FileText, Image as ImageIcon, Video, FileArchive, Search, ChevronRight, Home, Grid as GridIcon, List as ListIcon, Check, Upload, FolderPlus, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { Input } from './Input';
import { cn } from '../../lib/cn';
import { API_BASE_URL, api } from '../../api/client';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

function getFileIcon(mimeType = '') {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return FileArchive;
  return FileText;
}

export function FileBrowser({ onSelectFile, allowSelect = false, selectable = false, selectedIds = [], onSelectionChange = () => {}, onViewFile, onUploadComplete, refreshTrigger = 0, showUpload = true, showSidebar = false, uploadModule, uploadEntityId }) {
  const { token } = useAuth();
  const fileInputRef = useRef(null);
  const [currentPath, setCurrentPath] = useState([{ id: '', name: 'Home' }]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [driveUsage, setDriveUsage] = useState(0);
  
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  
  const [activeMenuId, setActiveMenuId] = useState(null);
  
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const currentFolderId = currentPath[currentPath.length - 1].id;

  const loadDirectory = useCallback(async (folderId) => {
    setLoading(true);
    try {
      const response = await api.files.driveBrowse(token, folderId);
      const data = response.data || { files: [] };
      
      const allItems = data.files || [];
      setFolders(allItems.filter((f) => f.mimeType === 'application/vnd.google-apps.folder' && f.name !== 'CRM_Hidden_System'));
      setFiles(allItems.filter(f => f.mimeType !== 'application/vnd.google-apps.folder'));
    } catch (error) {
      toast.error(error.message || 'Failed to load Drive folder');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDirectory(currentFolderId);
    
    // Fetch total drive usage
    if (showSidebar) {
      api.files.getUsage(token)
        .then(res => setDriveUsage(res.data?.usage || 0))
        .catch(console.error);
    }
  }, [currentFolderId, refreshTrigger, loadDirectory, showSidebar, token]);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        let uploadFile = file;
        // Compress images before upload
        if (file.type.startsWith('image/')) {
          try {
            uploadFile = await imageCompression(file, {
              maxSizeMB: 1, // Compress to under 1MB
              maxWidthOrHeight: 1920,
              useWebWorker: true,
            });
          } catch (e) {
            console.error('Image compression error:', e);
            // Fallback to original file on error
          }
        }
        formData.append('file', uploadFile);
      }
      
      if (uploadModule) {
        // Smart Upload: bypass current folder and let backend place it using module structure
        formData.append('moduleName', uploadModule);
        if (uploadEntityId) formData.append('entityId', uploadEntityId);
      } else {
        // Normal Upload: place in current folder
        formData.append('moduleName', 'general');
        formData.append('folderId', currentFolderId || '');
      }

      const response = await api.files.upload(token, formData);
      const uploaded = Array.isArray(response.data) ? response.data : [];
      toast.success('Files uploaded successfully');
      loadDirectory(currentFolderId); // Refresh after upload
      onUploadComplete?.(uploaded);
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFolderClick = (folderId, folderName) => {
    setCurrentPath(prev => [...prev, { id: folderId, name: folderName }]);
    setSearch('');
  };

  const handleBreadcrumbClick = (index) => {
    setCurrentPath(prev => prev.slice(0, index + 1));
    setSearch('');
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    
    setCreatingFolder(true);
    try {
      await api.files.createFolder(token, {
        name: newFolderName,
        parentDriveId: currentFolderId || null
      });
      toast.success('Folder created');
      setNewFolderOpen(false);
      setNewFolderName('');
      loadDirectory(currentFolderId);
    } catch (error) {
      toast.error('Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleRename = async (e) => {
    e.preventDefault();
    if (!renameValue.trim() || !renameTarget) return;
    
    setRenaming(true);
    try {
      await api.files.renameDriveFile(token, renameTarget.id, renameValue);
      toast.success('Renamed successfully');
      setRenameOpen(false);
      setRenameTarget(null);
      loadDirectory(currentFolderId);
    } catch (error) {
      toast.error('Rename failed');
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    setDeleting(true);
    try {
      await api.files.deleteDriveFile(token, deleteTarget.id);
      toast.success('Moved to trash');
      setDeleteOpen(false);
      setDeleteTarget(null);
      loadDirectory(currentFolderId);
    } catch (error) {
      toast.error('Failed to move to trash');
    } finally {
      setDeleting(false);
    }
  };
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const renderGridFile = (file) => {
    const isSelected = selectedIds.includes(file.id);
    const Icon = getFileIcon(file.mimeType);
    const name = file.name || 'Unknown File';
    const isImage = file.mimeType?.startsWith('image/');

    return (
      <div 
        key={file.id} 
        className={cn(
          "group relative flex cursor-pointer flex-col overflow-hidden rounded-[var(--radius-card,0.75rem)] border bg-white p-3 shadow-sm transition-all hover:border-[var(--primary)] hover:shadow-md",
          isSelected ? "border-[var(--primary)] ring-1 ring-[var(--primary)]" : "border-slate-200"
        )}
        onClick={() => {
          if (allowSelect) onSelectFile?.(file);
          else if (selectable) onSelectionChange(isSelected ? selectedIds.filter(id => id !== file.id) : [...selectedIds, file.id]);
          else if (onViewFile) onViewFile(file);
          else if (file.driveWebViewLink) window.open(file.driveWebViewLink, '_blank');
        }}
      >
        <div 
          className="flex h-32 items-center justify-center bg-slate-50 mb-3 overflow-hidden border border-slate-100"
          style={{ borderRadius: 'calc(var(--radius-card, 0.75rem) - 4px)' }}
        >
          {isImage && file.driveFileId ? (
            <img 
              src={`${API_BASE_URL}/files/drive/${file.driveFileId}/view`} 
              alt={name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div className={cn("flex items-center justify-center", (isImage && file.driveFileId) ? 'hidden' : 'flex')}>
            <Icon size={40} strokeWidth={1} className="text-slate-400" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-1 px-1">
          <div className="flex flex-col min-w-0">
            <span className="truncate text-sm font-medium text-slate-700" title={name}>{name}</span>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{formatSize(file.sizeBytes)}</span>
            </div>
          </div>
        </div>

        {isSelected && (
          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-sm">
            <Check size={12} strokeWidth={3} />
          </div>
        )}
      </div>
    );
  };



  return (
    <>
      <div className={cn("flex h-full bg-white rounded-[var(--radius-card,0.75rem)] overflow-hidden shadow-sm relative", showSidebar ? "" : "border border-slate-200 flex-col")}>
        
        {/* Left Sidebar */}
        {showSidebar && (
          <div className="w-64 shrink-0 border-r border-slate-200 bg-slate-50/30 flex flex-col hidden md:flex">
            <div className="p-4 space-y-6 flex-1 overflow-y-auto">
              
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Quick Access</h4>
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(0)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-[var(--radius-button,0.5rem)] px-3 py-2 text-sm font-medium transition-colors",
                    currentPath.length === 1 ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Home size={16} />
                    All Files
                  </div>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    currentPath.length === 1 ? "bg-[var(--primary)]/20" : "bg-slate-100 text-slate-500"
                  )}>{files.length + folders.length}</span>
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 px-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Folders</h4>
                  <button onClick={() => setNewFolderOpen(true)} className="text-slate-400 hover:text-slate-700">
                    <FolderPlus size={14} />
                  </button>
                </div>
                <div className="space-y-1">
                  {folders.map(folder => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => handleFolderClick(folder.id, folder.name)}
                      className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-button,0.5rem)] px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Folder size={16} className="text-slate-400" />
                        <span className="truncate">{folder.name}</span>
                      </div>
                    </button>
                  ))}
                  {folders.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-400">No folders</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Storage Usage</h4>
              <div className="flex items-center justify-between px-2 text-sm font-medium text-slate-700">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                  Used Space
                </div>
                <span>{formatSize(driveUsage)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className={cn("flex flex-col flex-1 min-w-0", showSidebar ? "border border-slate-200 m-4 rounded-xl shadow-sm overflow-hidden bg-white" : "")}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-4">
        {/* Breadcrumbs */}
        <div className="flex items-center flex-wrap gap-1.5 text-sm">
          {currentPath.map((part, index) => {
            const isLast = index === currentPath.length - 1;
            return (
              <div key={index} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(index)}
                  className={cn(
                    "flex items-center hover:text-[var(--primary)] transition-colors rounded-[var(--radius-button,0.5rem)] px-2 py-1 -mx-2 hover:bg-slate-100",
                    isLast ? "font-semibold text-slate-800 cursor-default hover:bg-transparent hover:text-slate-800" : "font-medium text-slate-500"
                  )}
                  disabled={isLast}
                >
                  {index === 0 ? <Home size={16} className={isLast ? "text-[var(--primary)]" : ""} /> : part.name}
                </button>
                {!isLast && <ChevronRight size={14} className="text-slate-400 mt-0.5" />}
              </div>
            );
          })}
        </div>

        {/* Search & View Toggle */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {showUpload && (
            <>
              <button
                type="button"
                onClick={() => setNewFolderOpen(true)}
                className="inline-flex items-center justify-center rounded-[var(--radius-button,0.5rem)] font-medium transition text-xs h-9 px-4 bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                <FolderPlus size={14} className="mr-1.5" />
                New Folder
              </button>

              <input 
                type="file" 
                multiple
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center rounded-[var(--radius-button,0.5rem)] font-medium transition text-xs h-9 px-4 bg-[var(--primary)] text-white hover:opacity-90"
              >
                <Upload size={14} className="mr-1.5" />
                Upload File
              </button>
            </>
          )}
          <div className="relative flex-1 sm:w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search size={14} className="text-slate-400" />
            </div>
            <Input 
              placeholder="Search in folder..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex items-center rounded-[var(--radius-button,0.5rem)] border border-slate-200 bg-white p-1">
            <button 
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn("rounded-[calc(var(--radius-button,0.5rem)-4px)] p-1.5 transition-colors", viewMode === 'grid' ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600")}
            >
              <GridIcon size={16} />
            </button>
            <button 
              type="button"
              onClick={() => setViewMode('list')}
              className={cn("rounded-[calc(var(--radius-button,0.5rem)-4px)] p-1.5 transition-colors", viewMode === 'list' ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600")}
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/20 min-h-[400px]">
        {loading && (
           <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
             <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
           </div>
        )}
        
        {search.trim() ? (
          <div className="mb-4 text-sm font-medium text-slate-500">
            Search results for "{search}" ({filteredFolders.length + filteredFiles.length} found)
          </div>
        ) : null}

        {!loading && filteredFolders.length === 0 && filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
            <Folder size={48} strokeWidth={1} className="mb-4 opacity-50" />
            <p className="text-sm font-medium">This folder is empty</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Folders */}
            {filteredFolders.length > 0 && viewMode === 'grid' && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Folders</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredFolders.map(folder => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => handleFolderClick(folder.id, folder.name)}
                      className="group flex items-center gap-3 rounded-[var(--radius-card,0.75rem)] border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-all hover:border-[var(--primary)] hover:shadow-md hover:bg-blue-50/50"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <Folder size={20} className="text-blue-400 group-hover:text-[var(--primary)] shrink-0" fill="currentColor" fillOpacity={0.2} />
                          <span className="truncate text-sm font-medium text-slate-700">{folder.name}</span>
                        </div>
                        {/* Folder Action Menu */}
                        <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setActiveMenuId(activeMenuId === folder.id ? null : folder.id)}
                            className="p-1 rounded-[var(--radius-button,0.5rem)] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {activeMenuId === folder.id && (
                            <div className="absolute right-0 top-full mt-1 w-36 rounded-[calc(var(--radius-card,0.75rem)-4px)] border border-slate-200 bg-white shadow-lg z-20 overflow-hidden text-sm">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setRenameTarget(folder);
                                  setRenameValue(folder.name);
                                  setRenameOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                <Edit2 size={14} />
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setDeleteTarget(folder);
                                  setDeleteOpen(true);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 size={14} />
                                Trash
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {(filteredFiles.length > 0 || (filteredFolders.length > 0 && viewMode === 'list')) && (
              <div>
                {viewMode === 'grid' && <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Files</h4>}
                
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredFiles.map(renderGridFile)}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Name</th>
                          <th className="px-4 py-3 font-semibold">Size</th>
                          <th className="px-4 py-3 font-semibold">Date modified</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {/* Folders in List Mode */}
                        {filteredFolders.map(folder => (
                          <tr 
                            key={`folder-${folder.id}`} 
                            onClick={() => handleFolderClick(folder.id, folder.name)}
                            className="cursor-pointer hover:bg-slate-50/80 transition-colors group"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Folder size={18} className="text-blue-400 group-hover:text-[var(--primary)]" fill="currentColor" fillOpacity={0.2} />
                                <span className="font-medium text-slate-700">{folder.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-400">-</td>
                            <td className="px-4 py-3 text-slate-400">{new Date(folder.updatedAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                        
                        {/* Files in List Mode */}
                        {filteredFiles.map(file => {
                          const Icon = getFileIcon(file.mimeType);
                          const name = file.name || 'Unknown File';
                          const isSelected = selectedIds.includes(file.id);
                          return (
                            <tr 
                              key={file.id} 
                              className={cn(
                                "cursor-pointer transition-colors group",
                                isSelected ? "bg-blue-50/50" : "hover:bg-slate-50/80"
                              )}
                              onClick={() => {
                                if (allowSelect) onSelectFile?.(file);
                                else if (selectable) onSelectionChange(isSelected ? selectedIds.filter(id => id !== file.id) : [...selectedIds, file.id]);
                                else if (onViewFile) onViewFile(file);
                                else if (file.driveWebViewLink) window.open(file.driveWebViewLink, '_blank');
                              }}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="relative">
                                    <Icon size={18} className={isSelected ? "text-[var(--primary)]" : "text-slate-400 group-hover:text-slate-600"} />
                                    {isSelected && (
                                      <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-[var(--primary)] text-white flex items-center justify-center ring-2 ring-white">
                                        <Check size={8} strokeWidth={4} />
                                      </div>
                                    )}
                                  </div>
                                  <span className={cn("font-medium", isSelected ? "text-[var(--primary)]" : "text-slate-700")}>{name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-500">{formatSize(file.sizeBytes)}</td>
                              <td className="px-4 py-3 text-slate-500">{new Date(file.updatedAt).toLocaleDateString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>

    {/* New Folder Modal */}
      <Modal open={newFolderOpen} onClose={() => !creatingFolder && setNewFolderOpen(false)} title="Create New Folder">
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Folder Name</label>
            <Input 
              value={newFolderName} 
              onChange={(e) => setNewFolderName(e.target.value)} 
              placeholder="e.g. 2026 Invoices" 
              autoFocus
              disabled={creatingFolder}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button"
              onClick={() => setNewFolderOpen(false)}
              disabled={creatingFolder}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={creatingFolder || !newFolderName.trim()}
              className="inline-flex items-center justify-center rounded-[var(--radius-button,0.5rem)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {creatingFolder ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </Modal>
    {/* Rename Modal */}
    <Modal open={renameOpen} onClose={() => !renaming && setRenameOpen(false)} title="Rename Item">
      <form onSubmit={handleRename} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">New Name</label>
          <Input 
            value={renameValue} 
            onChange={(e) => setRenameValue(e.target.value)} 
            autoFocus
            disabled={renaming}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button 
            type="button"
            onClick={() => setRenameOpen(false)}
            disabled={renaming}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
          <button 
            type="submit"
            disabled={renaming || !renameValue.trim() || renameValue === renameTarget?.name}
            className="inline-flex items-center justify-center rounded-[var(--radius-button,0.5rem)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {renaming ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>

    {/* Delete Modal */}
    <Modal open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} title="Move to Trash">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Are you sure you want to move <strong>{deleteTarget?.name}</strong> to trash?
          Files in trash can be restored from Google Drive if needed.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button 
            type="button"
            onClick={() => setDeleteOpen(false)}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center justify-center rounded-[var(--radius-button,0.5rem)] bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? 'Moving...' : 'Move to Trash'}
          </button>
        </div>
      </div>
    </Modal>

    </>
  );
}
