'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FolderOpen, ArrowLeft, X, Check, Plus, House } from '@phosphor-icons/react';
import { browseDirectory, createDirectory, type BrowseResult } from '@/lib/api/sessions';

interface DirectoryBrowserProps {
  open: boolean;
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export default function DirectoryBrowser({
  open,
  initialPath,
  onSelect,
  onClose,
}: DirectoryBrowserProps) {
  const [browse, setBrowse] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const newFolderRef = useRef<HTMLInputElement>(null);

  const loadDirectory = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await browseDirectory(path);
      setBrowse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to browse directory');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim() || !browse?.current) return;
    const newPath = browse.current.replace(/\\/g, '/') + '/' + newFolderName.trim();
    try {
      await createDirectory(newPath);
      setNewFolderName('');
      setShowNewFolder(false);
      loadDirectory(browse.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create directory');
    }
  }, [newFolderName, browse, loadDirectory]);

  useEffect(() => {
    if (open) {
      loadDirectory(initialPath || undefined);
      setShowNewFolder(false);
      setNewFolderName('');
    }
  }, [open, initialPath, loadDirectory]);

  useEffect(() => {
    if (showNewFolder && newFolderRef.current) {
      newFolderRef.current.focus();
    }
  }, [showNewFolder]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[520px] max-h-[70vh] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-200">Select Directory</h3>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Current path */}
        <div className="px-4 py-2 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadDirectory(undefined)}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
              title="Go to workspace root"
            >
              <House size={14} />
            </button>
            {browse?.parent && (
              <button
                onClick={() => loadDirectory(browse.parent!)}
                className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
                title="Go to parent directory"
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <span className="text-xs font-mono text-zinc-400 truncate flex-1">
              {browse?.current ?? '...'}
            </span>
            <button
              onClick={() => setShowNewFolder(v => !v)}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
              title="New folder"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Directory list */}
        <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[400px]">
          {showNewFolder && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/50">
              <FolderOpen size={14} className="text-emerald-500 flex-shrink-0" />
              <input
                ref={newFolderRef}
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); }
                }}
                placeholder="Folder name..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
              />
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-2 py-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-500 rounded hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
              >
                Create
              </button>
              <button
                onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center h-32 text-sm text-zinc-500">
              Loading...
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-32 text-sm text-red-400">
              {error}
            </div>
          )}
          {!loading && !error && browse && (
            <>
              {browse.directories.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-zinc-600">
                  No subdirectories
                </div>
              ) : (
                browse.directories.map(dir => {
                  const fullPath = browse.current.replace(/\\/g, '/') + '/' + dir;
                  return (
                    <div
                      key={dir}
                      className="flex items-center gap-2.5 w-full px-4 py-2 hover:bg-zinc-800/50 transition-colors group"
                    >
                      <button
                        type="button"
                        onClick={() => loadDirectory(fullPath)}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                        title="Open"
                      >
                        <FolderOpen size={14} className="text-zinc-600 group-hover:text-zinc-400 flex-shrink-0" />
                        <span className="text-sm text-zinc-300 truncate">{dir}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(fullPath);
                          onClose();
                        }}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-500 rounded hover:bg-emerald-500/20 transition-all flex-shrink-0"
                        title="Select this directory"
                      >
                        <Check size={11} weight="bold" />
                        Select
                      </button>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (browse?.current) {
                onSelect(browse.current);
                onClose();
              }
            }}
            disabled={!browse?.current}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
          >
            <Check size={12} weight="bold" />
            Select This Directory
          </button>
        </div>
      </div>
    </div>
  );
}
