'use client';

import { Plus } from '@phosphor-icons/react';
import SearchInput from '@/components/shared/SearchInput';
import TagFilter from './TagFilter';
import PromptListItem from './PromptListItem';
import type { Prompt } from '@/lib/api/prompts';

interface PromptListProps {
  prompts: Prompt[];
  allTags: string[];
  activePromptId: string | null;
  searchQuery: string;
  activeTags: string[];
  onSearchChange: (query: string) => void;
  onTagToggle: (tag: string) => void;
  onSelect: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

export default function PromptList({
  prompts,
  allTags,
  activePromptId,
  searchQuery,
  activeTags,
  onSearchChange,
  onTagToggle,
  onSelect,
  onDelete,
  onCreate,
}: PromptListProps) {
  return (
    <div className="flex flex-col h-full border-r border-zinc-800">
      <div className="flex flex-col gap-3 p-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search prompts..."
          />
          <button
            onClick={onCreate}
            title="New Prompt (Alt+N)"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors flex-shrink-0"
          >
            <Plus size={16} weight="bold" />
          </button>
        </div>
        <TagFilter
          allTags={allTags}
          activeTags={activeTags}
          onToggle={onTagToggle}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {prompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-sm text-zinc-500">No prompts found</p>
          </div>
        ) : (
          prompts.map(prompt => (
            <PromptListItem
              key={prompt.id}
              prompt={prompt}
              active={prompt.id === activePromptId}
              onClick={() => onSelect(prompt)}
              onDelete={() => onDelete(prompt.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
