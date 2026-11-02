'use client';

import { useState } from 'react';
import { Plus, CaretRight, CaretDown } from '@phosphor-icons/react';
import SearchInput from '@/components/shared/SearchInput';
import TagFilter from '@/components/prompts/TagFilter';
import SessionListItem from './SessionListItem';
import type { Session } from '@/lib/api/sessions';

type SessionStatus = 'active' | 'completed' | 'archived';

interface SessionListProps {
  sessions: Session[];
  allTags: string[];
  activeSessionId: string | null;
  searchQuery: string;
  activeTags: string[];
  activeStatus: SessionStatus;
  activeTerminals?: string[];
  onSearchChange: (query: string) => void;
  onTagToggle: (tag: string) => void;
  onStatusChange: (status: SessionStatus) => void;
  onSelect: (session: Session) => void;
  onDelete: (id: string) => void;
  onDuplicate: (session: Session) => void;
  onCreate: () => void;
}

const statusTabs: { label: string; value: SessionStatus }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Archived', value: 'archived' },
];

interface SessionGroup {
  name: string;
  sessions: Session[];
}

function groupSessions(sessions: Session[]): SessionGroup[] {
  const groups = new Map<string, Session[]>();

  for (const session of sessions) {
    const groupName = session.group || '';
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName)!.push(session);
  }

  const result: SessionGroup[] = [];

  // Named groups first, alphabetically
  const named = [...groups.entries()]
    .filter(([name]) => name !== '')
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [name, sessions] of named) {
    result.push({ name, sessions });
  }

  // Ungrouped at the bottom
  const ungrouped = groups.get('');
  if (ungrouped) {
    result.push({ name: '', sessions: ungrouped });
  }

  return result;
}

export default function SessionList({
  sessions,
  allTags,
  activeSessionId,
  searchQuery,
  activeTags,
  activeStatus,
  activeTerminals = [],
  onSearchChange,
  onTagToggle,
  onStatusChange,
  onSelect,
  onDelete,
  onDuplicate,
  onCreate,
}: SessionListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groups = groupSessions(sessions);
  const hasMultipleGroups = groups.length > 1 || (groups.length === 1 && groups[0].name !== '');

  const toggleGroup = (name: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full border-r border-zinc-800">
      <div className="flex flex-col gap-3 p-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search sessions..."
          />
          <button
            onClick={onCreate}
            title="New Session (Alt+N)"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors flex-shrink-0"
          >
            <Plus size={16} weight="bold" />
          </button>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1">
          {statusTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => onStatusChange(tab.value)}
              className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                activeStatus === tab.value
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <TagFilter
          allTags={allTags}
          activeTags={activeTags}
          onToggle={onTagToggle}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            {searchQuery || activeTags.length > 0 || activeStatus !== 'active' ? (
              <p className="text-sm text-zinc-500">No sessions match your filters</p>
            ) : (
              <>
                <p className="text-sm text-zinc-400 mb-1">No sessions yet</p>
                <p className="text-xs text-zinc-500 mb-3">Create one to start tracking your work.</p>
                <button
                  onClick={onCreate}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors"
                >
                  New Session
                </button>
              </>
            )}
          </div>
        ) : hasMultipleGroups ? (
          groups.map(group => {
            const isCollapsed = collapsed.has(group.name);
            const label = group.name || 'Ungrouped';

            return (
              <div key={group.name}>
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[10px] text-zinc-500 uppercase tracking-wider hover:text-zinc-400 transition-colors sticky top-0 bg-zinc-950 z-10"
                >
                  {isCollapsed ? (
                    <CaretRight size={10} />
                  ) : (
                    <CaretDown size={10} />
                  )}
                  <span>{label}</span>
                  <span className="text-zinc-600">({group.sessions.length})</span>
                </button>

                {!isCollapsed &&
                  group.sessions.map(session => (
                    <SessionListItem
                      key={session.id}
                      session={session}
                      active={session.id === activeSessionId}
                      hasRunningTerminal={activeTerminals.includes(session.id)}
                      onClick={() => onSelect(session)}
                      onDelete={() => onDelete(session.id)}
                      onDuplicate={() => onDuplicate(session)}
                    />
                  ))}
              </div>
            );
          })
        ) : (
          // Single group or all ungrouped — render flat
          sessions.map(session => (
            <SessionListItem
              key={session.id}
              session={session}
              active={session.id === activeSessionId}
              hasRunningTerminal={activeTerminals.includes(session.id)}
              onClick={() => onSelect(session)}
              onDelete={() => onDelete(session.id)}
              onDuplicate={() => onDuplicate(session)}
            />
          ))
        )}
      </div>
    </div>
  );
}
