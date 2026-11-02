'use client';

import { useState, useCallback, useMemo } from 'react';
import PromptList from '@/components/prompts/PromptList';
import PromptEditor from '@/components/prompts/PromptEditor';
import VersionDrawer from '@/components/prompts/VersionDrawer';
import { usePrompts, useVersions, useTags } from '@/lib/hooks/usePrompts';
import { useProfiles } from '@/lib/hooks/useProfiles';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import type { Prompt, PromptVersion } from '@/lib/api/prompts';

export default function PromptsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<PromptVersion | null>(null);
  const [revisionKey, setRevisionKey] = useState(0);

  const filters = useMemo(
    () => ({
      search: searchQuery || undefined,
      tag: activeTags[0] || undefined,
    }),
    [searchQuery, activeTags]
  );

  const { prompts, loading, create, update, remove, reload } = usePrompts(filters);
  const { profiles } = useProfiles();
  const { tags: allTags, reload: reloadTags } = useTags();
  const { versions, loading: versionsLoading, restore, reload: reloadVersions } =
    useVersions(activePromptId);

  const activePrompt = prompts.find(p => p.id === activePromptId) ?? null;

  const handleCreate = useCallback(async () => {
    const prompt = await create('Untitled');
    setActivePromptId(prompt.id);
    setHistoryOpen(false);
    setPreviewVersion(null);
  }, [create]);

  const handleSelect = useCallback((prompt: Prompt) => {
    setActivePromptId(prompt.id);
    setHistoryOpen(false);
    setPreviewVersion(null);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      await remove(id);
      if (activePromptId === id) {
        setActivePromptId(null);
      }
    },
    [remove, activePromptId]
  );

  const handleUpdate = useCallback(
    async (id: string, input: { title?: string; content?: string; notes?: string; tags?: string[] }) => {
      const result = await update(id, input);
      if (input.tags !== undefined) reloadTags();
      return result;
    },
    [update, reloadTags]
  );

  const handleTagToggle = useCallback((tag: string) => {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleRestore = useCallback(
    async (versionId: string) => {
      const prompt = await restore(versionId);
      if (prompt) {
        await reload();
        setPreviewVersion(null);
        setRevisionKey(k => k + 1);
      }
    },
    [restore, reload]
  );

  const handlePreview = useCallback((version: PromptVersion | null) => {
    setPreviewVersion(version);
  }, []);

  const handleExitPreview = useCallback(() => {
    setPreviewVersion(null);
  }, []);

  const toggleHistory = useCallback(() => {
    setHistoryOpen(prev => {
      if (!prev && activePromptId) reloadVersions();
      return !prev;
    });
    setPreviewVersion(null);
  }, [activePromptId, reloadVersions]);

  useKeyboardShortcuts([
    { key: 'n', alt: true, handler: handleCreate },
    { key: 'h', ctrl: true, shift: true, handler: toggleHistory },
    {
      key: 'Escape',
      handler: () => {
        if (previewVersion) {
          setPreviewVersion(null);
        } else if (historyOpen) {
          setHistoryOpen(false);
        }
      },
    },
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-72 flex-shrink-0">
        <PromptList
          prompts={prompts}
          allTags={allTags}
          activePromptId={activePromptId}
          searchQuery={searchQuery}
          activeTags={activeTags}
          onSearchChange={setSearchQuery}
          onTagToggle={handleTagToggle}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onCreate={handleCreate}
        />
      </div>

      <div className="flex-1 min-w-0">
        <PromptEditor
          prompt={activePrompt}
          allTags={allTags}
          previewVersion={previewVersion}
          revisionKey={revisionKey}
          onUpdate={handleUpdate}
          onOpenHistory={toggleHistory}
          onRestore={handleRestore}
          onExitPreview={handleExitPreview}
          profiles={profiles}
          onCreate={handleCreate}
        />
      </div>

      <VersionDrawer
        open={historyOpen}
        versions={versions}
        loading={versionsLoading}
        onClose={() => {
          setHistoryOpen(false);
          setPreviewVersion(null);
        }}
        onRestore={handleRestore}
        onPreview={handlePreview}
        previewingId={previewVersion?.id ?? null}
      />
    </div>
  );
}
