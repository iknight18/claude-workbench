'use client';

import { useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import type { Prompt } from '@/lib/api/prompts';

interface PromptListItemProps {
  prompt: Prompt;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function PromptListItem({
  prompt,
  active,
  onClick,
  onDelete,
}: PromptListItemProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      onClick={onClick}
      className={`group relative px-3 py-2.5 cursor-pointer border-l-2 transition-colors ${
        active
          ? 'border-l-emerald-500 bg-zinc-800/50'
          : 'border-l-transparent hover:bg-zinc-800/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-zinc-200 truncate">
            {prompt.title || 'Untitled'}
          </h4>
          {prompt.content && (
            <p className="text-xs text-zinc-500 truncate mt-0.5">
              {prompt.content.slice(0, 80)}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {prompt.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500"
              >
                {tag}
              </span>
            ))}
            <span className="text-[10px] text-zinc-500">
              {timeAgo(prompt.updated_at)}
            </span>
          </div>
        </div>

        {!confirming && (
          <button
            onClick={e => {
              e.stopPropagation();
              setConfirming(true);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-all"
          >
            <Trash size={14} />
          </button>
        )}
      </div>

      {confirming && (
        <div
          className="flex items-center gap-2 mt-2 text-xs"
          onClick={e => e.stopPropagation()}
        >
          <span className="text-zinc-500">Delete?</span>
          <button
            onClick={() => onDelete()}
            className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            Confirm
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
