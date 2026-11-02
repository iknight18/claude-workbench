'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { EditorView } from '@codemirror/view';
import MarkdownEditor from '@/components/shared/MarkdownEditor';
import {
  ClockCounterClockwise,
  Check,
  ArrowCounterClockwise,
  ArrowLeft,
  Sparkle,
  SpinnerGap,
  FileText,
} from '@phosphor-icons/react';
import ProfileSelector from '@/components/sessions/ProfileSelector';
import { enhancePrompt } from '@/lib/api/prompts';
import type { Profile } from '@/lib/api/profiles';
import type { Prompt, PromptVersion } from '@/lib/api/prompts';
import TagEditor from './TagEditor';
import PromptNotes from './PromptNotes';
import EmptyState from '@/components/shared/EmptyState';


function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface PromptEditorProps {
  prompt: Prompt | null;
  allTags: string[];
  previewVersion: PromptVersion | null;
  revisionKey: number;
  onUpdate: (id: string, input: { title?: string; content?: string; notes?: string; tags?: string[] }) => Promise<Prompt>;
  onOpenHistory: () => void;
  onRestore: (versionId: string) => void;
  onExitPreview: () => void;
  profiles: Profile[];
  onCreate?: () => void;
}

export default function PromptEditor({
  prompt,
  allTags,
  previewVersion,
  revisionKey,
  onUpdate,
  onOpenHistory,
  onRestore,
  onExitPreview,
  profiles,
  onCreate,
}: PromptEditorProps) {
  const editorViewRef = useRef<EditorView | null>(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastSyncedRef = useRef<string | null>(null);
  const [enhanceProfile, setEnhanceProfile] = useState('');
  const [enhancing, setEnhancing] = useState(false);

  // Sync state when prompt changes (different prompt selected or after restore)
  useEffect(() => {
    if (!prompt) return;
    const fingerprint = `${prompt.id}|${revisionKey}|${prompt.title}|${prompt.content}|${prompt.notes}|${prompt.tags.join(',')}`;
    if (fingerprint === lastSyncedRef.current) return;
    lastSyncedRef.current = fingerprint;

    setTitle(prompt.title);
    setTags(prompt.tags);
    setNotes(prompt.notes);
    setContent(prompt.content);
  }, [prompt, revisionKey]);

  // Auto-select first profile if none set (default profile is unauthenticated)
  useEffect(() => {
    if (!enhanceProfile && profiles.length > 0) {
      setEnhanceProfile(profiles[0].name);
    }
  }, [enhanceProfile, profiles]);

  const trackedUpdate = useCallback(async (id: string, input: Parameters<typeof onUpdate>[1]) => {
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const result = await onUpdate(id, input);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 1500);
      return result;
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
      setTimeout(() => { setSaveStatus('idle'); setSaveError(null); }, 4000);
      throw err;
    }
  }, [onUpdate]);

  const handleTitleSave = useCallback(() => {
    if (!prompt || title === prompt.title) return;
    trackedUpdate(prompt.id, { title }).catch(() => setTitle(prompt.title));
  }, [prompt, title, trackedUpdate]);

  const handleNotesSave = useCallback(() => {
    if (!prompt || notes === prompt.notes) return;
    trackedUpdate(prompt.id, { notes }).catch(() => setNotes(prompt.notes));
  }, [prompt, notes, trackedUpdate]);

  const handleContentSave = useCallback(() => {
    if (!prompt || content === prompt.content) return;
    trackedUpdate(prompt.id, { content }).catch(() => setContent(prompt.content));
  }, [prompt, content, trackedUpdate]);

  const handleTagsChange = useCallback((newTags: string[]) => {
    if (!prompt) return;
    const oldTags = tags;
    setTags(newTags);
    trackedUpdate(prompt.id, { tags: newTags }).catch(() => setTags(oldTags));
  }, [prompt, tags, trackedUpdate]);

  const handleEnhance = useCallback(async () => {
    if (!prompt || enhancing || previewVersion) return;
    setEnhancing(true);
    try {
      const result = await enhancePrompt(prompt.id, enhanceProfile || undefined);
      setContent(result.content);
      await trackedUpdate(prompt.id, { content: result.content });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Enhancement failed');
      setSaveStatus('error');
      setTimeout(() => { setSaveStatus('idle'); setSaveError(null); }, 4000);
    } finally {
      setEnhancing(false);
    }
  }, [prompt, enhancing, previewVersion, enhanceProfile, trackedUpdate]);

  if (!prompt) {
    return (
      <EmptyState
        icon={<FileText size={32} weight="light" />}
        title="No prompt selected"
        description="Pick a prompt from the list, or create a new one to start building your library."
        action={onCreate ? { label: 'New Prompt', onClick: onCreate, shortcut: 'Alt+N' } : undefined}
      />
    );
  }

  const isPreview = previewVersion !== null;
  const displayTitle = isPreview ? previewVersion.title : title;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <input
            type="text"
            value={displayTitle}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleSave}
            disabled={isPreview}
            placeholder="Untitled prompt"
            className="flex-1 text-lg font-medium bg-transparent text-zinc-100 placeholder:text-zinc-600 focus:outline-none tracking-tight disabled:text-zinc-400"
          />
          <div className="flex items-center gap-2 ml-4">
            {!isPreview && (
              <>
                {saveStatus === 'saving' && (
                  <span className="text-xs text-zinc-500">Saving...</span>
                )}
                {saveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-xs text-emerald-500">
                    <Check size={12} weight="bold" />
                    Saved
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-xs text-red-400">{saveError}</span>
                )}
                <ProfileSelector
                  value={enhanceProfile}
                  profiles={profiles}
                  onChange={setEnhanceProfile}
                />
                <button
                  onClick={handleEnhance}
                  disabled={enhancing || !content.trim()}
                  title="Enhance prompt with AI"
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-zinc-500 hover:text-amber-400 hover:bg-zinc-800"
                >
                  {enhancing ? (
                    <SpinnerGap size={14} className="animate-spin" />
                  ) : (
                    <Sparkle size={14} />
                  )}
                  {enhancing ? 'Enhancing...' : 'Enhance'}
                </button>
              </>
            )}
            <button
              onClick={onOpenHistory}
              title="Version History (Ctrl+Shift+H)"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <ClockCounterClockwise size={14} />
              History
            </button>
          </div>
        </div>
        {!isPreview && (
          <TagEditor tags={tags} allTags={allTags} onChange={handleTagsChange} />
        )}
      </div>

      {/* Preview banner */}
      {isPreview && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 border-b border-zinc-800">
          <span className="text-xs text-zinc-400">
            Viewing version from {formatDate(previewVersion.created_at)}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRestore(previewVersion.id)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-500/10 text-emerald-500 rounded-md hover:bg-emerald-500/20 transition-colors"
            >
              <ArrowCounterClockwise size={12} />
              Restore
            </button>
            <button
              onClick={onExitPreview}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 rounded-md hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft size={12} />
              Back to current
            </button>
          </div>
        </div>
      )}

      {/* CodeMirror Editor */}
      <div className="flex-1 overflow-hidden">
        <MarkdownEditor
          key={`${prompt.id}-${revisionKey}-${previewVersion?.id ?? 'current'}`}
          value={isPreview ? previewVersion!.content : content}
          onChange={isPreview ? undefined : setContent}
          onBlur={isPreview ? undefined : handleContentSave}
          readOnly={isPreview}
          placeholder="Start writing your prompt..."
          onViewReady={(view) => { editorViewRef.current = view; }}
        />
      </div>

      {/* Notes Panel */}
      {!isPreview && (
        <PromptNotes notes={notes} onChange={setNotes} onBlur={handleNotesSave} />
      )}
    </div>
  );
}
