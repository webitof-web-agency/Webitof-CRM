import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Folder, FolderOpen, RefreshCw, Search } from 'lucide-react';
import { api } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

// Popup with every folder under "Webitof ERP Data" (GET /google-drive/folders), as an expandable
// tree. The main folder and its top-level folders start open; a search opens the matching branches.

// The node if it or a descendant matches, with only the matching branches kept.
function filterTree(node, term) {
  if (!term) return node;
  const children = node.children.map((child) => filterTree(child, term)).filter(Boolean);
  if (children.length || node.name.toLowerCase().includes(term)) return { ...node, children };
  return null;
}

function countFolders(node) {
  return node.children.reduce((sum, child) => sum + 1 + countFolders(child), 0);
}

function TreeNode({ node, depth, expanded, onToggle, forceOpen }) {
  const hasChildren = node.children.length > 0;
  const open = forceOpen || expanded.has(node.id);
  const Icon = open && hasChildren ? FolderOpen : Folder;
  return (
    <li>
      <div
        className="group flex items-center gap-1 rounded-lg py-1 pr-2 hover:bg-[var(--surface-2)]"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 ${hasChildren ? 'hover:text-slate-700 dark:hover:text-slate-200' : 'invisible'}`}
          aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
          tabIndex={hasChildren ? 0 : -1}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <Icon size={15} className="shrink-0 text-[var(--primary)]" />
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className={`min-w-0 truncate text-left text-xs ${depth === 0 ? 'font-semibold' : ''} text-slate-800 dark:text-slate-100`}
          title={node.name}
        >
          {node.name}
        </button>
        {hasChildren ? <span className="shrink-0 text-[10px] text-slate-400">{node.children.length}</span> : null}
        <a
          href={node.link}
          target="_blank"
          rel="noreferrer"
          className="ml-auto shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-[var(--primary)] focus:opacity-100"
          title="Open in Google Drive"
        >
          <ExternalLink size={12} />
        </a>
      </div>
      {open && hasChildren ? (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} forceOpen={forceOpen} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function DriveFolderTreeModal({ open, onClose, token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.googleDrive.folders(token);
      const tree = response.data?.tree;
      setData(response.data || null);
      // The main folder and its top-level folders start open.
      setExpanded(new Set(tree ? [tree.id, ...tree.children.map((child) => child.id)] : []));
    } catch (err) {
      setError(err.message || 'The folders could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Read once each time the popup opens; Refresh reads again.
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const term = query.trim().toLowerCase();
  const shown = useMemo(() => (data?.tree ? filterTree(data.tree, term) : null), [data, term]);

  const toggle = (id) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const allIds = (node, ids = []) => {
    ids.push(node.id);
    node.children.forEach((child) => allIds(child, ids));
    return ids;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Folders in Google Drive"
      subtitle={data ? `${data.count} folders in ${data.tree?.name}${data.truncated ? ' (first ones only)' : ''}` : 'Webitof ERP Data'}
      width="min(640px, 95vw)"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search folders" className="pl-8" />
          </div>
          <Button size="xs" variant="ghost" onClick={() => data?.tree && setExpanded(new Set(allIds(data.tree)))} disabled={!data}>
            Expand all
          </Button>
          <Button size="xs" variant="ghost" onClick={() => data?.tree && setExpanded(new Set([data.tree.id]))} disabled={!data}>
            Collapse
          </Button>
          <Button size="xs" variant="outline" onClick={load} loading={loading} disabled={loading}>
            <RefreshCw size={12} />
            Refresh
          </Button>
        </div>

        <div className="max-h-[60vh] min-h-[200px] overflow-y-auto rounded-xl border border-[var(--border)] p-2">
          {loading && !data ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : null}
          {error ? <p className="p-3 text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
          {data && !shown ? <p className="p-3 text-xs text-slate-500">No folder matches “{query}”.</p> : null}
          {shown ? (
            <ul>
              <TreeNode node={shown} depth={0} expanded={expanded} onToggle={toggle} forceOpen={Boolean(term)} />
            </ul>
          ) : null}
        </div>
        {shown && term ? (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{countFolders(shown)} folders shown: the matches and the folders they are in.</p>
        ) : null}
      </div>
    </Modal>
  );
}
