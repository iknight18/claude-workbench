'use client';

import { Suspense, useState, useCallback, useMemo } from 'react';
import { useQueryState } from 'nuqs';
import SessionList from '@/components/sessions/SessionList';
import SessionEditor from '@/components/sessions/SessionEditor';
import { useSessions, useDirectories, useGroups, useSessionTags } from '@/lib/hooks/useSessions';
import { useProfiles } from '@/lib/hooks/useProfiles';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { useTerminals } from '@/lib/contexts/TerminalContext';
import type { Session } from '@/lib/api/sessions';

type SessionStatus = 'active' | 'completed' | 'archived';

export default function SessionsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full text-sm text-zinc-500">
        Loading...
      </div>
    }>
      <SessionsPageContent />
    </Suspense>
  );
}

function SessionsPageContent() {
  const [activeSessionId, setActiveSessionId] = useQueryState('select', {
    history: 'replace',
    scroll: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeStatus, setActiveStatus] = useState<SessionStatus>('active');

  const { terminals } = useTerminals();
  const activeTerminals = useMemo(
    () => Array.from(terminals.keys()),
    [terminals]
  );

  const filters = useMemo(
    () => ({
      search: searchQuery || undefined,
      tag: activeTags[0] || undefined,
      status: activeStatus,
    }),
    [searchQuery, activeTags, activeStatus]
  );

  const { sessions, loading, create, update, remove } =
    useSessions(filters);
  const { tags: allTags } = useSessionTags();
  const { reload: reloadDirectories } = useDirectories();
  const { profiles } = useProfiles();
  const { groups, reload: reloadGroups } = useGroups();

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null;

  const handleCreate = useCallback(async () => {
    const defaultProfile = profiles.length > 0 ? profiles[0].name : undefined;
    const session = await create('Untitled Session', undefined, defaultProfile);
    setActiveSessionId(session.id);
  }, [create, profiles, setActiveSessionId]);

  const handleDuplicate = useCallback(async (source: Session) => {
    const session = await create(
      `${source.name} (copy)`,
      source.directory || undefined,
      source.profile || undefined,
    );
    // Copy over remaining fields
    await update(session.id, {
      skip_permissions: source.skip_permissions,
      group: source.group || undefined,
      notes: source.notes || undefined,
      tags: source.tags.length > 0 ? source.tags : undefined,
    });
    setActiveSessionId(session.id);
  }, [create, update, setActiveSessionId]);

  const handleSelect = useCallback(
    (session: Session) => {
      setActiveSessionId(session.id);
    },
    [setActiveSessionId]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await remove(id);
      if (activeSessionId === id) {
        setActiveSessionId(null);
      }
    },
    [remove, activeSessionId, setActiveSessionId]
  );

  const handleUpdate = useCallback(
    async (id: string, input: Parameters<typeof update>[1]) => {
      const result = await update(id, input);
      if ('directory' in input) reloadDirectories();
      if ('group' in input) reloadGroups();
      return result;
    },
    [update, reloadDirectories, reloadGroups]
  );

  const handleTagToggle = useCallback((tag: string) => {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  useKeyboardShortcuts([
    { key: 'n', alt: true, handler: handleCreate },
    {
      key: 'Escape',
      handler: () => setActiveSessionId(null),
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
        <SessionList
          sessions={sessions}
          allTags={allTags}
          activeSessionId={activeSessionId}
          searchQuery={searchQuery}
          activeTags={activeTags}
          activeStatus={activeStatus}
          activeTerminals={activeTerminals}
          onSearchChange={setSearchQuery}
          onTagToggle={handleTagToggle}
          onStatusChange={setActiveStatus}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onCreate={handleCreate}
        />
      </div>

      <div className="flex-1 min-w-0">
        <SessionEditor
          session={activeSession}
          allTags={allTags}
          profiles={profiles}
          groups={groups}
          onUpdate={handleUpdate}
          onCreate={handleCreate}
        />
      </div>
    </div>
  );
}
