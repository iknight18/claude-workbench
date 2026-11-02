'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, FloppyDisk, CircleNotch, PencilSimple, Eye } from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  readSkillContent,
  writeSkillContent,
  previewSkillContent,
} from '@/lib/api/skills';

interface SkillViewerModalProps {
  skillName: string;
  // For installed skills (editable) — the absolute path to the .md file
  filePath?: string;
  // For browse skills (read-only)
  source?: string;
  branch?: string;
  skillPath?: string;
  onClose: () => void;
}

export default function SkillViewerModal({
  skillName,
  filePath,
  source,
  branch,
  skillPath,
  onClose,
}: SkillViewerModalProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const isEditable = !!filePath;
  const isDirty = content !== originalContent;

  useEffect(() => {
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        if (filePath) {
          const res = await readSkillContent(filePath);
          setContent(res.content);
          setOriginalContent(res.content);
        } else if (source && branch) {
          const res = await previewSkillContent(source, branch, skillPath || '');
          setContent(res.content);
          setOriginalContent(res.content);
        }
      } catch (err) {
        setError((err as Error).message || 'Failed to load skill content');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [filePath, skillName, source, branch, skillPath]);

  const handleSave = useCallback(async () => {
    if (!filePath || !isDirty) return;
    setSaving(true);
    try {
      await writeSkillContent(filePath, content);
      setOriginalContent(content);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [filePath, content, isDirty]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 's' && (e.ctrlKey || e.metaKey) && isEditable && editing) {
        e.preventDefault();
        handleSave();
      }
    },
    [onClose, isEditable, editing, handleSave]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl w-[640px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-200 tracking-tight">
              {skillName}
            </span>
            {!isEditable && (
              <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                read-only
              </span>
            )}
            {isEditable && isDirty && (
              <span className="text-[10px] text-amber-500">unsaved</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isEditable && !editing && !loading && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded transition-colors"
              >
                <PencilSimple size={11} />
                Edit
              </button>
            )}
            {isEditable && editing && (
              <button
                onClick={() => {
                  setEditing(false);
                  setContent(originalContent);
                }}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded transition-colors"
              >
                <Eye size={11} />
                View
              </button>
            )}
            {isEditable && editing && isDirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 rounded transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <CircleNotch size={11} className="animate-spin" />
                ) : (
                  <FloppyDisk size={11} />
                )}
                Save
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-40 text-xs text-zinc-600">
              <CircleNotch size={16} className="animate-spin mr-2" />
              Loading...
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-40 text-xs text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && editing && (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full h-full min-h-[400px] p-4 bg-transparent text-xs text-zinc-300 font-mono leading-relaxed resize-none focus:outline-none"
              spellCheck={false}
            />
          )}

          {!loading && !error && !editing && (
            <div className="p-4 skill-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
