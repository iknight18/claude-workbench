'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FloppyDisk, Trash, FileMd, Plus } from '@phosphor-icons/react';
import MarkdownEditor from '@/components/shared/MarkdownEditor';
import {
  fetchProjectConfig,
  writeProjectConfig,
  deleteProjectConfig,
} from '@/lib/api/sessions';
import type { ProjectConfig } from '@/lib/api/sessions';

type ConfigFile = 'claude' | 'agents';

interface ToolsConfigTabProps {
  sessionId: string;
  directory: string;
}

export default function ToolsConfigTab({ sessionId, directory }: ToolsConfigTabProps) {
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeFile, setActiveFile] = useState<ConfigFile>('claude');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Track current editor content vs saved content
  const editorContentRef = useRef<string>('');
  const savedContentRef = useRef<string>('');

  // Load config when sessionId or directory changes
  useEffect(() => {
    if (!sessionId || !directory) {
      setConfig(null);
      return;
    }
    setLoading(true);
    fetchProjectConfig(sessionId)
      .then((c) => {
        setConfig(c);
        // Default to whichever file exists, preferring claude
        if (c.claudeMd === null && c.agentsMd !== null) {
          setActiveFile('agents');
        } else {
          setActiveFile('claude');
        }
      })
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, [sessionId, directory]);

  // Reset dirty state when switching tabs
  useEffect(() => {
    setDirty(false);
    setConfirmDelete(false);
    setSaveStatus('idle');
    const content = activeFile === 'claude' ? (config?.claudeMd ?? '') : (config?.agentsMd ?? '');
    savedContentRef.current = content;
    editorContentRef.current = content;
  }, [activeFile, config]);

  const handleEditorChange = useCallback((value: string) => {
    editorContentRef.current = value;
    setDirty(value !== savedContentRef.current);
    setSaveStatus('idle');
  }, []);

  const handleSave = useCallback(async () => {
    if (!sessionId || saving) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      const data = activeFile === 'claude'
        ? { claudeMd: editorContentRef.current }
        : { agentsMd: editorContentRef.current };
      const updated = await writeProjectConfig(sessionId, data);
      setConfig(updated);
      savedContentRef.current = editorContentRef.current;
      setDirty(false);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('idle');
    } finally {
      setSaving(false);
    }
  }, [sessionId, activeFile, saving]);

  // Ctrl+S handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (dirty) handleSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [dirty, handleSave]);

  const handleCreate = async () => {
    if (!sessionId) return;
    setSaving(true);
    try {
      const updated = await writeProjectConfig(sessionId, {
        claudeMd: '@AGENTS.md',
        agentsMd: '',
      });
      setConfig(updated);
      setActiveFile('claude');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!sessionId) return;
    setSaving(true);
    try {
      const updated = await deleteProjectConfig(sessionId, activeFile);
      setConfig(updated);
      setConfirmDelete(false);
      // Switch to remaining file if one exists
      if (activeFile === 'claude' && updated.agentsMd !== null) {
        setActiveFile('agents');
      } else if (activeFile === 'agents' && updated.claudeMd !== null) {
        setActiveFile('claude');
      }
    } finally {
      setSaving(false);
    }
  };

  // No directory set
  if (!directory) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-zinc-600 px-4 text-center">
        Set a project directory to manage config files
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-zinc-600">
        Loading...
      </div>
    );
  }

  // Both files missing — show create state
  const bothMissing = config && config.claudeMd === null && config.agentsMd === null;
  if (!config || bothMissing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
        <div className="text-xs text-zinc-600 text-center">
          No CLAUDE.md or AGENTS.md found in project directory
        </div>
        <button
          onClick={handleCreate}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
        >
          <Plus size={12} />
          Create Config Files
        </button>
      </div>
    );
  }

  // Determine which tabs to show
  const hasClause = config.claudeMd !== null;
  const hasAgents = config.agentsMd !== null;
  const currentContent = activeFile === 'claude' ? (config.claudeMd ?? '') : (config.agentsMd ?? '');
  const editorKey = `${sessionId}-${activeFile}`;

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar + actions */}
      <div className="flex items-center border-b border-zinc-800 px-2">
        <div className="flex flex-1 gap-0.5">
          {hasClause && (
            <button
              onClick={() => setActiveFile('claude')}
              className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-mono transition-colors ${
                activeFile === 'claude'
                  ? 'text-emerald-400 border-b border-emerald-500'
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              <FileMd size={10} />
              CLAUDE.md
            </button>
          )}
          {hasAgents && (
            <button
              onClick={() => setActiveFile('agents')}
              className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-mono transition-colors ${
                activeFile === 'agents'
                  ? 'text-emerald-400 border-b border-emerald-500'
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              <FileMd size={10} />
              AGENTS.md
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {saveStatus === 'saving' && (
            <span className="text-[10px] text-zinc-500">Saving...</span>
          )}
          {saveStatus === 'saved' && !dirty && (
            <span className="text-[10px] text-emerald-500">Saved</span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors"
            title="Save (Ctrl+S)"
          >
            <FloppyDisk size={13} />
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
              title="Delete file"
            >
              <Trash size={13} />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                className="text-[10px] text-red-400 hover:text-red-300 px-1"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] text-zinc-500 hover:text-zinc-400 px-1"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <MarkdownEditor
          key={editorKey}
          value={currentContent}
          onChange={handleEditorChange}
          placeholder={activeFile === 'claude' ? 'Project instructions...' : 'Agent definitions...'}
        />
      </div>
    </div>
  );
}
