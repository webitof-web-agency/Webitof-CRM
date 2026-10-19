import { useState, useEffect, useCallback, useRef } from 'react';
import { Folder, FileText, Image as ImageIcon, Video, FileArchive, Search, ChevronRight, Home, Grid as GridIcon, List as ListIcon, Check, Upload } from 'lucide-react';
import { Input } from './Input';
import { cn } from '../../lib/cn';
import { api } from '../../api/client';
import { getFileOpenUrl, getFileViewUrl } from '../../lib/fileUpload';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

const MONTH_LABELS = {
  jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June',
  jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'December'
};

// Folders come from the upload layout: year / month / section / record, plus site and earlier uploads.
function folderLabel(name = '') {
  if (MONTH_LABELS[name]) return MONTH_LABELS[name];
  if (name === 'site') return 'Site assets';
  if (name === 'earlier-uploads') return 'Earlier uploads';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function toBrowserFile(file) {
  return { ...file, name: file.originalName || file.name || 'Unknown File' };
}

function getFileIcon(mimeType = '') {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return FileArchive;
  return FileText;
}

export function FileBrowser({ onSelectFile, allowSelect = false, selectable = false, selectedIds = [], onSelectionChange = () => {}, onViewFile, onUploadComplete, refreshTrigger = 0, showUpload = true, showSidebar = false, uploadModule, uploadEntityId }) {
  const { token } = useAuth();
  const fileInputRef = useRef(null);
  const [currentPath, setCurrentPath] = useState([{ path: '', name: 'Home' }]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [driveUsage, setDriveUsage] = useState(0);
  
  const currentFolderPath = currentPath[currentPath.length - 1].path;

  const loadDirectory = useCallback(async (folderPath) => {
    setLoading(true);
    try {
      const response = await api.files.browse(token, folderPath);
      const data = response.data || { folders: [], files: [] };
      setFolders(data.folders || []);
      setFiles((data.files || []).map(toBrowserFile));
    } catch (error) {
      toast.error(error.message || 'Failed to load folder');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDirectory(currentFolderPath);

    // Fetch total storage usage
    if (showSidebar) {
      api.files.getUsage(token)
        .then(res => setDriveUsage(res.data?.usage || 0))
        .catch(console.error);
    }
  }, [currentFolderPath, refreshTrigger, loadDirectory, showSidebar, token]);

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
      
      // The backend places files by module and record (year/month/section/record).
      formData.append('moduleName', uploadModule || 'general');
      if (uploadModule && uploadEntityId) formData.append('entityId', uploadEntityId);

      const response = await api.files.upload(token, formData);
      const uploaded = Array.isArray(response.data) ? response.data : [];
      toast.success('Files uploaded successfully');
      loadDirectory(currentFolderPath); // Refresh after upload
      onUploadComplete?.(uploaded);
    } catch (error) {
      toast.error(error.message || 'Upload failed');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFolderClick = (folderPath, folderName) => {
    setCurrentPath(prev => [...prev, { path: folderPath, name: folderLabel(folderName) }]);
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

  const filteredFolders = folders.filter(f => folderLabel(f.name).toLowerCase().includes(search.toLowerCase()));
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const renderGridFile = (file) => {
    const isSelected = selectedIds.includes(file.id);
    const Icon = getFileIcon(file.mimeType);
    const name = file.name || 'Unknown File';
    const isImage = file.mimeType?.startsWith('image/');

    return (
      <div 
        key={file.id} 
        className={cn(
          "group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-[var(--surface)] p-3 shadow-2xs transition-all hover:border-[var(--primary)] hover:shadow-xs",
          isSelected ? "border-[var(--primary)] ring-1 ring-[var(--primary)] bg-[var(--primary-subtle)]/30" : "border-[var(--border)]"
        )}
        onClick={() => {
          if (allowSelect) onSelectFile?.(file);
          else if (selectable) onSelectionChange(isSelected ? selectedIds.filter(id => id !== file.id) : [...selectedIds, file.id]);
          else if (onViewFile) onViewFile(file);
          else window.open(getFileOpenUrl(file), '_blank', 'noopener');
        }}
      >
        <div 
          className="flex h-32 items-center justify-center bg-[var(--surface-2)]/50 mb-3 overflow-hidden border border-[var(--border)] rounded-xl"
        >
          {isImage ? (
            <img
              src={getFileViewUrl(file)}
              alt={name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div className={cn("flex items-center justify-center", isImage ? 'hidden' : 'flex')}>
            <Icon size={36} strokeWidth={1.5} className="text-[var(--text-muted)]" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-1 px-1">
          <div className="flex flex-col min-w-0">
            <span className="truncate text-xs font-semibold text-[var(--text-main)]" title={name}>{name}</span>
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-0.5">
              <span>{formatSize(file.sizeBytes)}</span>
            </div>
          </div>
        </div>

        {isSelected && (
          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-xs">
            <Check size={11} strokeWidth={3} />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className={cn("flex h-full bg-[var(--surface)] text-[var(--text-main)] rounded-2xl overflow-hidden shadow-2xs relative", showSidebar ? "" : "border border-[var(--border)] flex-col")}>
        
        {/* Left Sidebar */}
        {showSidebar && (
          <div className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface-2)]/30 flex flex-col hidden md:flex">
            <div className="p-4 space-y-6 flex-1 overflow-y-auto">
              
              <div>
                <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-2">Quick Access</h4>
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(0)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-colors cursor-pointer",
                    currentPath.length === 1 ? "bg-[var(--primary-subtle)] text-[var(--primary)]" : "text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Home size={15} />
                    All Files
                  </div>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    currentPath.length === 1 ? "bg-[var(--primary)]/20 text-[var(--primary)]" : "bg-[var(--surface-2)] text-[var(--text-muted)]"
                  )}>{files.length + folders.length}</span>
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 px-2">
                  <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Folders</h4>
                </div>
                <div className="space-y-1">
                  {folders.map(folder => (
                    <button
                      key={folder.path}
                      type="button"
                      onClick={() => handleFolderClick(folder.path, folder.name)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Folder size={15} className="text-[var(--text-muted)]" />
                        <span className="truncate">{folderLabel(folder.name)}</span>
                      </div>
                      <span className="text-[10px]">{folder.fileCount}</span>
                    </button>
                  ))}
                  {folders.length === 0 && (
                    <div className="px-3 py-2 text-xs text-[var(--text-muted)]">No folders</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border)]">
              <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-2">Storage Usage</h4>
              <div className="flex items-center justify-between px-2 text-xs font-semibold text-[var(--text-main)]">
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
        <div className={cn("flex flex-col flex-1 min-w-0 bg-[var(--surface)]", showSidebar ? "border border-[var(--border)] m-4 rounded-2xl shadow-2xs overflow-hidden" : "")}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface-2)]/40 p-4">
        {/* Breadcrumbs */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs font-medium">
          {currentPath.map((part, index) => {
            const isLast = index === currentPath.length - 1;
            return (
              <div key={index} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(index)}
                  className={cn(
                    "flex items-center hover:text-[var(--primary)] transition-colors rounded-lg px-2 py-1 -mx-2 hover:bg-[var(--hover-bg)] cursor-pointer",
                    isLast ? "font-bold text-[var(--text-main)] cursor-default hover:bg-transparent hover:text-[var(--text-main)]" : "text-[var(--text-muted)]"
                  )}
                  disabled={isLast}
                >
                  {index === 0 ? <Home size={15} className={isLast ? "text-[var(--primary)] mr-1" : "mr-1"} /> : null}
                  {index === 0 ? 'Home' : part.name}
                </button>
                {!isLast && <ChevronRight size={13} className="text-[var(--text-muted)] mt-0.5" />}
              </div>
            );
          })}
        </div>

        {/* Search & View Toggle */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {showUpload && (
            <>
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
                className="inline-flex items-center justify-center rounded-xl font-semibold transition text-xs h-9 px-3.5 bg-[var(--primary)] text-white hover:opacity-90 shadow-2xs cursor-pointer"
              >
                <Upload size={14} className="mr-1.5" />
                Upload File
              </button>
            </>
          )}
          <div className="relative flex-1 sm:w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search size={14} className="text-[var(--text-muted)]" />
            </div>
            <Input 
              placeholder="Search in folder..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-1">
            <button 
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn("rounded-lg p-1.5 transition-colors cursor-pointer", viewMode === 'grid' ? "bg-[var(--surface)] text-[var(--text-main)] shadow-2xs" : "text-[var(--text-muted)] hover:text-[var(--text-main)]")}
            >
              <GridIcon size={15} />
            </button>
            <button 
              type="button"
              onClick={() => setViewMode('list')}
              className={cn("rounded-lg p-1.5 transition-colors cursor-pointer", viewMode === 'list' ? "bg-[var(--surface)] text-[var(--text-main)] shadow-2xs" : "text-[var(--text-muted)] hover:text-[var(--text-main)]")}
            >
              <ListIcon size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[var(--background)] min-h-[400px]">
        {loading && (
           <div className="absolute inset-0 bg-[var(--surface)]/70 backdrop-blur-xs flex items-center justify-center z-10">
             <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
           </div>
        )}
        
        {search.trim() ? (
          <div className="mb-4 text-xs font-semibold text-[var(--text-muted)]">
            Search results for "{search}" ({filteredFolders.length + filteredFiles.length} found)
          </div>
        ) : null}

        {!loading && filteredFolders.length === 0 && filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] py-12">
            <Folder size={44} strokeWidth={1} className="mb-3 opacity-40" />
            <p className="text-xs font-semibold">This folder is empty</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Folders */}
            {filteredFolders.length > 0 && viewMode === 'grid' && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Folders</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {filteredFolders.map(folder => (
                    <button
                      key={folder.path}
                      type="button"
                      onClick={() => handleFolderClick(folder.path, folder.name)}
                      className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left shadow-2xs transition-all hover:border-[var(--primary)] hover:shadow-xs cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <Folder size={18} className="text-blue-500 group-hover:text-[var(--primary)] shrink-0" fill="currentColor" fillOpacity={0.2} />
                          <span className="truncate text-xs font-semibold text-[var(--text-main)]">{folderLabel(folder.name)}</span>
                        </div>
                        <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{folder.fileCount}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {(filteredFiles.length > 0 || (filteredFolders.length > 0 && viewMode === 'list')) && (
              <div>
                {viewMode === 'grid' && <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Files</h4>}
                
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {filteredFiles.map(renderGridFile)}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--surface-2)]/50 text-[var(--text-muted)] border-b border-[var(--border)]">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Name</th>
                          <th className="px-4 py-3 font-semibold">Size</th>
                          <th className="px-4 py-3 font-semibold">Date modified</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {/* Folders in List Mode */}
                        {filteredFolders.map(folder => (
                          <tr
                            key={`folder-${folder.path}`}
                            onClick={() => handleFolderClick(folder.path, folder.name)}
                            className="cursor-pointer hover:bg-[var(--hover-bg)] transition-colors group"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <Folder size={16} className="text-blue-500 group-hover:text-[var(--primary)]" fill="currentColor" fillOpacity={0.2} />
                                <span className="font-semibold text-[var(--text-main)]">{folderLabel(folder.name)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[var(--text-muted)]">{folder.fileCount} files</td>
                            <td className="px-4 py-3 text-[var(--text-muted)]">-</td>
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
                                isSelected ? "bg-[var(--primary-subtle)]" : "hover:bg-[var(--hover-bg)]"
                              )}
                              onClick={() => {
                                if (allowSelect) onSelectFile?.(file);
                                else if (selectable) onSelectionChange(isSelected ? selectedIds.filter(id => id !== file.id) : [...selectedIds, file.id]);
                                else if (onViewFile) onViewFile(file);
                                else window.open(getFileOpenUrl(file), '_blank', 'noopener');
                              }}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="relative">
                                    <Icon size={16} className={isSelected ? "text-[var(--primary)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-main)]"} />
                                    {isSelected && (
                                      <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-[var(--primary)] text-white flex items-center justify-center ring-2 ring-[var(--surface)]">
                                        <Check size={7} strokeWidth={4} />
                                      </div>
                                    )}
                                  </div>
                                  <span className={cn("font-medium", isSelected ? "text-[var(--primary)] font-bold" : "text-[var(--text-main)]")}>{name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-[var(--text-muted)]">{formatSize(file.sizeBytes)}</td>
                              <td className="px-4 py-3 text-[var(--text-muted)]">{new Date(file.updatedAt).toLocaleDateString()}</td>
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

    </>
  );
}
